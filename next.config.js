const path = require("path");

/** @type {import('next').NextConfig} */
const nextConfig = {
  // 父目录 `practise` 也有 package-lock.json，Next/Turbopack 会误判工作区根为父目录，
  // 从而在 `practise/node_modules` 里找 tailwindcss（找不到）。显式指定本应用目录为根。
  turbopack: {
    root: path.resolve(__dirname),
  },
};

module.exports = nextConfig;
