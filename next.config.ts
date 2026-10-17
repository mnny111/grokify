import type { NextConfig } from "next";
import path from 'node:path';

const nextConfig: NextConfig = {
  distDir: '.railway-next',
  serverExternalPackages: ['node:sqlite'],
  webpack(config, {webpack}) {
    config.plugins.push(new webpack.NormalModuleReplacementPlugin(/^cloudflare:workers$/, path.resolve('railway/env.mjs')));
    return config;
  },
};

export default nextConfig;
