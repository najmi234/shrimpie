import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  reactCompiler: true,
};

export default nextConfig;

// next.config.js
module.exports = {
  allowedDevOrigins: ['10.222.107.57'],
}