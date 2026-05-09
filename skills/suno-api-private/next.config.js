/** @type {import('next').NextConfig} */
const path = require('path');

const nextConfig = {
  webpack: (config, { isServer }) => {
    // Stub out swagger-ui CSS to avoid CSS parsing errors
    config.module.rules.push({
      test: /swagger-ui.*\.css$/,
      loader: 'null-loader',
    });
    config.module.rules.push({
      test: /\.(ttf|html)$/i,
      type: 'asset/resource'
    });
    return config;
  },
  experimental: {
    serverMinification: false,
  },
};  

module.exports = nextConfig;