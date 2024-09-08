// @ts-check
 
/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'archive.smashing.media',
        port: '',
        pathname: '/**',
      },
    ],
  },
}
 
module.exports = nextConfig