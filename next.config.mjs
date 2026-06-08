/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  transpilePackages: ['three', '@react-three/fiber', '@react-three/drei'],
  experimental: {
    urlImports: ['https://framer.com/m/'],
  },
};

export default nextConfig;
