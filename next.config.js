// @ts-check
 
const isDev = process.env.NODE_ENV !== 'production'
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
  images: {
    // Disable server-side optimizer in dev to avoid external fetch/DNS errors
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'zpbwjwikdzxcseumoiwk.supabase.co',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'archive.smashing.media',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'avatars.githubusercontent.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cloudflare-ipfs.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'loremflickr.com',
        port: '',
        pathname: '/**',
      },
    ],
  },
}
 
module.exports = nextConfig
