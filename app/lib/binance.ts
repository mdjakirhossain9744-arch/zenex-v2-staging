import crypto from 'crypto';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY || "";
const BINANCE_API_BASE_URL = "https://api.binance.com"; 

// ==========================================
// 🛡️ THE SECURITY ENGINE: Blacklist & Validation
// ==========================================
const BLACKLISTED_ADDRESSES = [
    "13kwLzEEocs56zW5UjyQgX8pRuh1mbgn2f", // Clipboard Hijacker Hacker Address
    // ভবিষ্যতে কোনো হ্যাকার অ্যাড্রেস পেলে জাস্ট এখানে কমা দিয়ে বসিয়ে দেবেন
];

export const validateSolanaAddress = (address: string) => {
    const cleanAddress = address.trim();

    // 1. Blacklist Checker
    if (BLACKLISTED_ADDRESSES.includes(cleanAddress)) {
        return { 
            isValid: false, 
            message: "⚠️ Security Alert: This address is blacklisted due to malware/suspicious activity. Your device might be infected with a clipboard hijacker." 
        };
    }

    // 2. EVM (BNB/ETH) Address Blocker
    if (cleanAddress.startsWith("0x")) {
        return { 
            isValid: false, 
            message: "❌ Invalid Format: Please provide a valid Solana (SOL) address. BNB/ETH (0x...) addresses are not supported." 
        };
    }

    // 3. Solana Base58 Format & Length Checker (32-44 characters)
    // সোলানা অ্যাড্রেসে 0, O, I, l থাকে না।
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;
    if (!base58Regex.test(cleanAddress)) {
        return { 
            isValid: false, 
            message: "❌ Invalid SOL Address: Make sure you copied the correct Solana network address. It should be 32-44 characters long." 
        };
    }

    return { isValid: true, message: "Valid" };
};

// ==========================================
// 💥 THE MAGIC: Smart Average P2P Rate Fetcher 
// ==========================================
export const getLiveUsdtRate = async () => {
    try {
        const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fiat: "BDT", 
                page: 1, 
                rows: 5, 
                tradeType: "BUY", 
                asset: "USDT",
                countries: [], 
                proMerchantAds: false, 
                shieldMerchantAds: false,
                filterType: "all", 
                periods: [], 
                additionalKycVerifyFilter: 0,
                publisherType: null, 
                payTypes: [], 
                classifies: ["mass", "profession", "user"]
            }),
            next: { revalidate: 60 } 
        });

        const data = await response.json();
        
        if (data.code === "000000" && data.data && data.data.length > 0) {
            let totalPrice = 0;
            const totalMerchants = data.data.length;

            data.data.forEach((item: any) => {
                totalPrice += parseFloat(item.adv.price);
            });

            const averageBuyPrice = totalPrice / totalMerchants;
            
            const finalRateWithMargin = averageBuyPrice + 2.00; 

            return parseFloat(finalRateWithMargin.toFixed(2)); 
        }

        return 127.00; 
    } catch (error) {
        return 127.00; 
    }
};

// ==========================================
// 💥 Binance Standard Crypto Withdrawal (SOL Network) 
// ==========================================
export const sendBinancePay = async (address: string, amountUsdt: number, idempotencyKey: string) => {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return { success: false, message: "Binance API keys missing in server!" };
    }

    try {
        const timestamp = Date.now();
        
        const queryString = `coin=USDT&network=SOL&address=${address.trim()}&amount=${amountUsdt}&transactionFeeFlag=true&withdrawOrderId=${idempotencyKey}&timestamp=${timestamp}`;
        
        const signature = crypto.createHmac("sha256", BINANCE_SECRET_KEY).update(queryString).digest("hex");

        const response = await fetch(`${BINANCE_API_BASE_URL}/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signature}`, {
            method: "POST",
            headers: {
                "X-MBX-APIKEY": BINANCE_API_KEY
            }
        });

        const data = await response.json();

        if (data.id) {
            return { success: true, txId: data.id };
        } else {
            return { success: false, message: data.msg || "Binance API Error" };
        }

    } catch (error: any) {
        return { success: false, message: error.message };
    }
};