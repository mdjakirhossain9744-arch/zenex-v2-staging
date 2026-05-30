import crypto from 'crypto';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY || "";
const BINANCE_API_BASE_URL = "https://api.binance.com"; // 💥 Changed to Standard API URL

// 💥 THE MAGIC: Live Binance P2P Rate Fetcher 💥
export const getLiveUsdtRate = async () => {
    try {
        const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                fiat: "BDT", page: 1, rows: 1, tradeType: "BUY", asset: "USDT",
                countries: [], proMerchantAds: false, shieldMerchantAds: false,
                filterType: "all", periods: [], additionalKycVerifyFilter: 0,
                publisherType: null, payTypes: [], classifies: ["mass", "profession", "user"]
            }),
            next: { revalidate: 60 } 
        });

        const data = await response.json();
        if (data.code === "000000" && data.data && data.data.length > 0) {
            return parseFloat(data.data[0].adv.price);
        }
        return 120.00; 
    } catch (error) {
        return 120.00; 
    }
};

// 💥 Binance Standard Crypto Withdrawal (USDT via SOL Network) 💥
export const sendBinancePay = async (address: string, amountUsdt: number, idempotencyKey: string) => {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return { success: false, message: "Binance API keys missing in server!" };
    }

    try {
        const timestamp = Date.now();
        
        // 💥 Parameters for Standard On-Chain/Internal Withdrawal 💥
        // network=SOL নির্দেশ করছে যে এটি সোলানা নেটওয়ার্কে যাবে
        const queryString = `coin=USDT&network=SOL&address=${address.trim()}&amount=${amountUsdt}&withdrawOrderId=${idempotencyKey}&timestamp=${timestamp}`;
        
        // 💥 Standard API uses SHA256 (Not SHA512) 💥
        const signature = crypto.createHmac("sha256", BINANCE_SECRET_KEY).update(queryString).digest("hex");

        const response = await fetch(`${BINANCE_API_BASE_URL}/sapi/v1/capital/withdraw/apply?${queryString}&signature=${signature}`, {
            method: "POST",
            headers: {
                "X-MBX-APIKEY": BINANCE_API_KEY
            }
        });

        const data = await response.json();

        // Binance সফল হলে একটি 'id' (Withdrawal ID) রিটার্ন করে
        if (data.id) {
            return { success: true, txId: data.id };
        } else {
            return { success: false, message: data.msg || "Binance API Error" };
        }

    } catch (error: any) {
        return { success: false, message: error.message };
    }
};