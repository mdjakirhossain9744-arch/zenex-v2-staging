import { MetadataRoute } from 'next'
 
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/admin/', '/api/'], // গুগলকে বলছি এই প্রাইভেট ফোল্ডারগুলোতে না ঢুকতে
    },
    sitemap: 'https://www.zenexnetwork.com/sitemap.xml',
  }
}