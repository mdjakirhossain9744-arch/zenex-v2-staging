import crypto from 'crypto';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY || "";
const BINANCE_API_BASE_URL = "https://api.binance.com"; 

// 💥 THE MAGIC: Smart Average P2P Rate Fetcher (BUY Rate + 1 BDT Admin Margin) 💥
export const getLiveUsdtRate = async () => {
    try {
        const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fiat: "BDT", 
                page: 1, 
                rows: 5, 
                tradeType: "BUY", // চড়া দাম (BUY Rate)
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
            next: { revalidate: 60 } // 60 Seconds Micro-Caching (Zero API Load)
        });

        const data = await response.json();
        
        if (data.code === "000000" && data.data && data.data.length > 0) {
            let totalPrice = 0;
            const totalMerchants = data.data.length;

            data.data.forEach((item: any) => {
                totalPrice += parseFloat(item.adv.price);
            });

            const averageBuyPrice = totalPrice / totalMerchants;
            
            // 💥 MASTER UPDATE: BUY Rate + 1 BDT PROFIT MARGIN 💥
            // এতে ইউজাররা রেট ভালো পাবে, এবং আপনারও লস হবে না।
            const finalRateWithMargin = averageBuyPrice + 1.00; 

            return parseFloat(finalRateWithMargin.toFixed(2)); 
        }

        // 💥 Fallback Rate 💥
        return 127.00; 
    } catch (error) {
        // 💥 Fallback Rate 💥
        return 127.00; 
    }
};

// 💥 Binance Standard Crypto Withdrawal (SOL Network) 💥
export const sendBinancePay = async (address: string, amountUsdt: number, idempotencyKey: string) => {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return { success: false, message: "Binance API keys missing in server!" };
    }

    try {
        const timestamp = Date.now();
        
        // 💥 MAGIC FLAG: transactionFeeFlag=true (ফি ইউজারের টাকা থেকে কাটবে) 💥
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