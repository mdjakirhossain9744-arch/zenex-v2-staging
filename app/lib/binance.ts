import crypto from 'crypto';

const BINANCE_API_KEY = process.env.BINANCE_API_KEY || "";
const BINANCE_SECRET_KEY = process.env.BINANCE_SECRET_KEY || "";
const BINANCE_PAY_BASE_URL = "https://bpay.binanceapi.com";

// 💥 THE MAGIC: Live Binance P2P Rate Fetcher 💥
export const getLiveUsdtRate = async () => {
    try {
        const response = await fetch("https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                fiat: "BDT",
                page: 1,
                rows: 1, // শুধু সবচেয়ে টপ রেটটা আনবো
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
            next: { revalidate: 60 } // ১ মিনিট পর পর ক্যাশ ক্লিয়ার করবে (সার্ভার ফাস্ট রাখতে)
        });

        const data = await response.json();
        
        if (data.code === "000000" && data.data && data.data.length > 0) {
            const livePrice = parseFloat(data.data[0].adv.price);
            return livePrice; // Example: 126.73
        }

        return 120.00; // API ফেইল করলে Fallback Rate
    } catch (error) {
        return 120.00; // Server/Network error হলে Fallback Rate
    }
};

// 💥 Binance Auto Pay Execution 💥
export const sendBinancePay = async (payId: string, amountUsdt: number, idempotencyKey: string) => {
    if (!BINANCE_API_KEY || !BINANCE_SECRET_KEY) {
        return { success: false, message: "Binance API keys missing in server!" };
    }

    try {
        const timestamp = Date.now().toString();
        const nonce = crypto.randomBytes(16).toString("hex");

        const payload = {
            requestId: idempotencyKey, // 💥 Zero Double-Spend Guarantee 💥
            batchName: "ZENEX_PAYOUT",
            currency: "USDT",
            totalAmount: amountUsdt.toString(),
            totalNumber: 1,
            transferDetailList: [
                {
                    receiveType: "PAY_ID", // Pay ID হলে PAY_ID, ইমেইল হলে EMAIL
                    transferMethod: "FUNDING_WALLET",
                    receiver: payId,
                    transferAmount: amountUsdt.toString(),
                    remark: "ZENEX NETWORK Earnings"
                }
            ]
        };

        const bodyStr = JSON.stringify(payload);
        const signaturePayload = `${timestamp}\n${nonce}\n${bodyStr}\n`;
        const signature = crypto.createHmac("sha512", BINANCE_SECRET_KEY).update(signaturePayload).digest("hex").toUpperCase();

        const response = await fetch(`${BINANCE_PAY_BASE_URL}/binancepay/openapi/v2/payout/transfer`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "BinancePay-Timestamp": timestamp,
                "BinancePay-Nonce": nonce,
                "BinancePay-Certificate-Sn": BINANCE_API_KEY,
                "BinancePay-Signature": signature
            },
            body: bodyStr
        });

        const data = await response.json();

        if (data.status === "SUCCESS") {
            return { success: true, txId: data.data?.batchId || idempotencyKey };
        } else {
            return { success: false, message: data.errorMessage || "Binance API Error" };
        }

    } catch (error: any) {
        return { success: false, message: error.message };
    }
};