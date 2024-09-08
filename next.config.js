// @ts-check
 
/** @type {import('next').NextConfig} */
const nextConfig = {
  typescript: {
    ignoreBuildErrors: true
  },
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