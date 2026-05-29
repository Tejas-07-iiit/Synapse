import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
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
