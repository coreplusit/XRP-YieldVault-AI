import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Keep soft-nav RSC payloads warm so Dashboard ↔ Profile ↔ History
   * tab switches reuse the client router cache instead of refetching.
   */
  experimental: {
    staleTimes: {
      dynamic: 60,
      static: 300,
    },
  },
  transpilePackages: [
    "@web3auth/modal",
    "@web3auth/no-modal",
    "@web3auth/base",
    "@web3auth/base-provider",
    "@web3auth/auth-adapter",
    "@web3auth/ethereum-provider",
  ],
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
      crypto: false,
    };
    return config;
  },
  async redirects() {
    return [
      {
        source: "/dao",
        destination: "/",
        permanent: false,
      },
      {
        source: "/DAO",
        destination: "/",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
