const isDev = process.env.NODE_ENV !== 'production'
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    unoptimized: isDev,
    remotePatterns: [
      { protocol: 'https', hostname: 'zpbwjwikdzxcseumoiwk.supabase.co', pathname: '/**' },
      { protocol: 'https', hostname: 'archive.smashing.media', pathname: '/**' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com', pathname: '/**' },
      { protocol: 'https', hostname: 'cloudflare-ipfs.com', pathname: '/**' },
      { protocol: 'https', hostname: 'picsum.photos', pathname: '/**' },
      { protocol: 'https', hostname: 'loremflickr.com', pathname: '/**' },
    ],
  },
}

export default nextConfig;
