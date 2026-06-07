import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      }),
    });
    console.log('✅ ZENEX Next.js: Firebase Admin Initialized Successfully!');
  } catch (error) {
    console.error('❌ Next.js Firebase Admin Error:', error);
  }
}

export const adminMessaging = admin.messaging();