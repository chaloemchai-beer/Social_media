// @ts-check
 
const isDev = process.env.NODE_ENV !== 'production'
/** @type {import('next').NextConfig} */
const nextConfig = {
  // Prevent webpack from bundling native-addon packages (socket.io, ws, etc.)
  serverExternalPackages: ['socket.io', 'engine.io', 'ws', 'bufferutil', 'utf-8-validate'],
  webpack: (config, { isServer }) => {
    if (isServer) {
      // Ensure native ws deps are never bundled — return empty object if not installed
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : [config.externals].filter(Boolean)),
        ({ request }, callback) => {
          if (request === 'bufferutil' || request === 'utf-8-validate') {
            return callback(null, `commonjs ${request}`)
          }
          callback()
        },
      ]
    }
    return config
  },
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
        hostname: 'xwygeahsealzforxllfa.supabase.co',
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
