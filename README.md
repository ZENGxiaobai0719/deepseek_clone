# DeepSeek Clone Practice

一个基于 Next.js + Clerk + Drizzle + AI SDK 的 DeepSeek 风格聊天练习项目。

## 快速开始

1. 安装依赖

```bash
npm install
```

2. 创建环境变量文件

```bash
cp .env.example .env
```

3. 按照 `.env.example` 注释填写必须项（尤其是 `DEEPSEEK_API_KEY` 与 `DATABASE_URL`）

4. 启动开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000)。

## 必填环境变量说明

- `DEEPSEEK_API_KEY`: DeepSeek API Key，必须是有效且有余额的 key
- `DATABASE_URL`: Postgres 连接串
- `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` / `CLERK_SECRET_KEY`: Clerk 登录配置

如果遇到 `Insufficient Balance`，说明 key 可用但余额不足；如果遇到 `invalid api key`，说明 key 无效或不匹配当前网关。


## 常用命令

```bash
npm run dev
npm run build
npm run start
npm run lint
```
