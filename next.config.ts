import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  typescript: {
    // Disable type checking during next build (reduces tsc memory usage)
    ignoreBuildErrors: true,
  },
  eslint: {
    // Disable ESLint check during next build (reduces ESLint memory usage)
    ignoreDuringBuilds: true,
  },
  // Disable separate compilation workers to keep memory footprint in a single process
  experimental: {
    webpackBuildWorker: false,
  },
  webpack: (config, { dev }) => {
    // Optimize Webpack memory usage in development mode
    if (dev) {
      config.cache = {
        type: 'memory',
        maxGenerations: 1, // Minimize generations kept in memory
      };
      
      // Limit parallelism in compilation to reduce simultaneous memory footprint
      config.parallelism = 2;
    }
    return config;
  },
};

export default nextConfig;
