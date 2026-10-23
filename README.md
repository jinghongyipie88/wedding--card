# 婚礼邀请函 H5（Vercel 部署版）

在线制作电子婚礼请柬：客户扫码加客服购买 → 收到专属编辑链接+编辑码 → 填好姓名/日期/地点/故事 → 生成图片邀请函分享给亲友 → 亲友打开 H5 查看并提交回执 → 你在后台看回执。

## 技术栈

- Node.js + Express（后端 API + 静态服务）
- 存储：Upstash KV（云）或本地 JSON 文件（本地开发）
- 部署：Vercel（免费 Hobby 计划即可）

## 部署到 Vercel

1. 把本项目推到 GitHub 仓库
2. 打开 [vercel.com](https://vercel.com) → **Add New → Project** → 选择该仓库 → Import
3. **Environment Variables（环境变量）** 必填两项：
   - `ADMIN_PASSWORD`：管理后台登录密码（自己设一个强密码，如 `Wx@2026!admin`）
   - `DATA_KEY`：数据加密密钥（任意长随机字符串，如 32 位随机字符）
   - `KV_REST_API_URL` 和 `KV_REST_API_TOKEN`：见下方"数据存储"
4. Deploy 等待完成，拿到 `https://xxx.vercel.app` 域名

## 数据存储（重要）

Vercel 服务器无持久磁盘，必须用云存储保存邀请函和回执数据。推荐 Vercel 自带 KV：

1. 部署完成后，在 Vercel 项目里 **Storage → Create Database → KV**（免费额度足够）
2. 创建后会自动把 `KV_REST_API_URL` 和 `KV_REST_API_TOKEN` 注入环境变量，无需手动填
3. Redeploy 一次即可生效

没有配置 KV 时，程序自动回落本地文件存储（仅用于本地开发/自托管）。

## 本地运行

```bash
npm install
npm start
# 打开 http://localhost:3000
```

## 后台入口

- 管理后台：`/admin`（输入 ADMIN_PASSWORD 登录）
- 创建邀请函：后台"生成邀请函"→ 得到 id、编辑码、编辑链接
- 编辑链接格式：`/editor?id=xxx&code=xxxxxx`（客户凭编辑码自己编辑）

## 数据安全说明

- 宾客电话等敏感字段以 AES-256-GCM 加密后存储，密钥来自环境变量 `DATA_KEY`
- 后台登录有防暴力破解限流（同 IP 错 5 次锁 10 分钟）
- 邀请函只能凭专属编辑码修改，其他人无法改动
