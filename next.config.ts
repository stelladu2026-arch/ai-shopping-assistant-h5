import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ["node:sqlite", "@langchain/langgraph", "@langchain/core"],
  outputFileTracingIncludes: {
    "/api/guide/act": ["./data/knowledge/**/*"],
    "/api/agent/chat": ["./data/knowledge/**/*"],
  },
  /**
   * 部分 Windows 环境下，原生文件监听会卡在 Starting / 首编译极久。
   * 开发态启用轮询可显著减少「永远不出 Ready」或假死。
   * @see https://webpack.js.org/configuration/watch/#watchoptions
   */
  webpack: (config, { dev }) => {
    if (dev) {
      /** 低内存环境：关闭持久化缓存，避免 PackFileCache / ArrayBuffer 分配失败与堆溢出 */
      config.cache = false;
      config.watchOptions = {
        ...config.watchOptions,
        poll: 2000,
        aggregateTimeout: 500,
        ignored: ["**/node_modules/**", "**/.git/**", "**/.next/**"],
      };
    }
    return config;
  },
};

export default nextConfig;
