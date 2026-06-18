import * as admin from 'firebase-admin';

const projectId = process.env.FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');

if (!admin.apps.length) {
  if (projectId && clientEmail && privateKey) {
    try {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId,
          clientEmail,
          privateKey,
        }),
      });
      console.log('✅ ZENEX Next.js: Firebase Admin Initialized Successfully!');
    } catch (error) {
      console.error('❌ Next.js Firebase Admin Error:', error);
    }
  } else {
    console.warn('⚠️ Firebase Env vars missing. Bypassing initialization for local build.');
  }
}

// 💥 Bulletproof Bypass: If Firebase is off, return a dummy object so Next.js Build doesn't crash!
export const adminMessaging = admin.apps.length 
  ? admin.messaging() 
  : { sendMulticast: async () => { return { responses: [] }; } } as any;