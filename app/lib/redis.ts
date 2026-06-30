import { Redis } from 'ioredis';

// 💥 ELITE ENTERPRISE REDIS ENGINE 💥
// এটি সিঙ্গলটন প্যাটার্ন ফলো করে, যাতে বারবার নতুন কানেকশন তৈরি না হয়

const globalForRedis = global as unknown as { redis: Redis };

export const redis =
  globalForRedis.redis ||
  new Redis({
    host: '127.0.0.1', // লোকাল সার্ভারেই Redis চলছে
    port: 6379,
    maxRetriesPerRequest: null,
    enableReadyCheck: false,
    retryStrategy(times) {
      // যদি কোনো কারণে Redis ডাউন হয়, তবে সে প্রতি ৩ সেকেন্ড পরপর কানেক্ট করার চেষ্টা করবে
      return Math.min(times * 50, 3000);
    },
  });

if (process.env.NODE_ENV !== 'production') globalForRedis.redis = redis;

export default redis;