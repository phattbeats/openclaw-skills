# Suno API - JWT Token Support

> **基于 [gcui-art/suno-api](https://github.com/gcui-art/suno-api) 的改进版本**
> 主要改进：支持直接使用 JWT Token 进行认证，解决 Clerk session 失效问题

## 🎯 为什么需要这个版本？

**问题**：原版 suno-api 依赖 Clerk session 进行认证，但 Clerk API 经常返回空 session（`sessions: []`），导致 401 Unauthorized 错误。

**解决方案**：本版本支持直接从浏览器提取 JWT Token，跳过 Clerk 认证流程，稳定可靠。

## ✨ 主要改进

- ✅ **支持直接使用 JWT Token**：从浏览器 Network 请求中提取 token，不再依赖 Clerk session
- ✅ **自动检测认证方式**：如果 cookie 中有 `__session` token，自动使用；否则回退到 Clerk 认证
- ✅ **更好的隐私保护**：增强 `.gitignore` 规则，防止敏感数据泄露
- ✅ **交互式配置脚本**：提供 `setup-cookie.js` 简化 token 配置流程

## 🚀 快速开始

### 1. 安装依赖

```bash
git clone https://github.com/joeseesun/suno-api-private.git
cd suno-api-private
npm install
```

### 2. 获取 JWT Token（重要！）

**方法一：使用交互式脚本（推荐）**

1. 在浏览器中访问 https://suno.com/create 并登录
2. 按 `F12` 打开开发者工具
3. 切换到 **Network** 标签
4. 在页面上点击输入框（触发 API 请求）
5. 在 Network 列表中找到 `studio-api.prod.suno.com` 的请求
6. 点击请求 → **Headers** → **Request Headers**
7. 复制两个值：
   - `authorization: Bearer xxx` → 复制 `Bearer` 后面的 token
   - `cookie: xxx` → 复制整个 cookie 字符串

8. 运行配置脚本：

```bash
node setup-cookie.js
```

按提示粘贴 JWT token 和 cookies 即可。

**方法二：手动配置**

创建 `.env` 文件：

```bash
SUNO_COOKIE=__session=<你的JWT_TOKEN>; __client=xxx; ajs_anonymous_id=xxx; ...
```

**重要**：确保 `__session=` 后面是从 Authorization header 提取的 JWT token！

### 3. 启动服务

```bash
npm run dev
```

服务将在 http://localhost:3001 启动

### 4. 测试 API

```bash
# 查看账户额度
curl http://localhost:3001/api/get_limit

# 生成歌词
curl -X POST http://localhost:3001/api/generate_lyrics \
  -H "Content-Type: application/json" \
  -d '{"prompt": "a happy song about sunshine"}'

# 生成音乐
curl -X POST http://localhost:3001/api/custom_generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "sunshine and rainbows",
    "tags": "pop, upbeat",
    "title": "Happy Day"
  }'
```

## 📚 API 文档

启动服务后访问：http://localhost:3001/docs

### 支持的模型

| 版本 | 模型名称 | 常量名 | 说明 |
|------|----------|--------|------|
| V3.5 | `chirp-v3-5` | `SUNO_MODELS.V3_5` | 旧版本 |
| V4 | `chirp-v4` | `SUNO_MODELS.V4` | - |
| V4.5+ | `chirp-bluejay` | `SUNO_MODELS.V4_5_PLUS` | 蓝松鸦 🐦 |
| V4.5 Pro | `chirp-auk` | `SUNO_MODELS.V4_5_PRO` | 海雀 🐧 |
| **V5** | `chirp-crow` | `SUNO_MODELS.V5` | 乌鸦 🦅 **（默认）** |

使用示例：

```bash
# 使用默认模型 (V5)
curl -X POST http://localhost:3001/api/custom_generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "sunshine and rainbows",
    "tags": "pop, upbeat",
    "title": "Happy Day"
  }'

# 指定模型版本
curl -X POST http://localhost:3001/api/custom_generate \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "sunshine and rainbows",
    "tags": "pop, upbeat",
    "title": "Happy Day",
    "model": "chirp-bluejay"
  }'
```

### 主要端点

- `GET /api/get_limit` - 获取账户剩余额度
- `POST /api/generate` - 生成音乐（简单模式）
- `POST /api/custom_generate` - 生成音乐（自定义模式）
- `POST /api/generate_lyrics` - 生成歌词
- `GET /api/get?ids=xxx` - 获取音乐详情
- `POST /api/extend_audio` - 延长音乐

完整 API 文档请参考：https://suno.gcui.ai/docs

## 🔧 配置说明

### 环境变量

```bash
# 必需
SUNO_COOKIE=__session=<JWT_TOKEN>; __client=xxx; ...

# 可选（CAPTCHA 解决方案）
TWOCAPTCHA_KEY=your_2captcha_key

# 可选（浏览器配置）
BROWSER=chromium                    # chromium | firefox
BROWSER_HEADLESS=true               # true | false
BROWSER_LOCALE=zh-CN                # 浏览器语言
BROWSER_GHOST_CURSOR=false          # 使用幽灵光标（更自然）
BROWSER_DISABLE_GPU=false           # Docker 环境建议 true
```

### JWT Token 有效期

JWT Token 通常有效期为 **几小时到几天**。Token 过期后会返回 401 错误，需要：

1. 重新访问 https://suno.com/create
2. 从 Network 请求中提取新的 JWT token
3. 更新 `.env` 文件

**提示**：可以设置定时任务自动更新 token（未来版本会支持自动刷新）。

## ❓ 常见问题

### Q: 为什么返回 401 Unauthorized？

**A:** JWT Token 已过期或格式错误。请：
1. 检查 `.env` 中的 `SUNO_COOKIE` 是否以 `__session=` 开头
2. 确认 `__session=` 后面是从 Authorization header 提取的 JWT token（不是普通 cookie）
3. 重新从浏览器提取最新的 JWT token

### Q: 为什么 Clerk session 一直是空的？

**A:** 这是正常现象。Suno 现在的认证机制已改变，不再依赖 Clerk session。本版本通过直接使用 JWT token 绕过了这个问题。

### Q: JWT Token 在哪里？

**A:** 在浏览器开发者工具的 Network 标签中：
1. 找到任意 `studio-api.prod.suno.com` 的请求
2. 查看 Request Headers
3. 复制 `authorization: Bearer xxx` 中 `Bearer` 后面的部分

### Q: Cookie 太长导致 431 错误怎么办？

**A:** 这是因为包含了太多无关 cookies（Google、Facebook 等）。使用 `setup-cookie.js` 脚本会自动过滤，只保留 Suno 相关的 cookies。

## 🐳 Docker 部署

```bash
# 构建镜像
docker build -t suno-api .

# 运行容器
docker run -d -p 3001:3000 \
  -e SUNO_COOKIE="__session=xxx; __client=xxx; ..." \
  suno-api
```

## 📝 变更日志

### v1.2.0 (2026-01-25)
- ✨ 新增：支持 Suno V4/V4.5+/V4.5 Pro/V5 全部模型
- ✨ 新增：`SUNO_MODELS` 常量导出，方便类型安全使用
- 🔄 变更：默认模型从 V3.5 升级到 V5 (`chirp-crow`)
- 📝 改进：README 添加完整模型列表和使用示例

### v1.1.0 (2026-01-25)
- ✨ 新增：支持直接使用 JWT Token 认证
- ✨ 新增：`setup-cookie.js` 交互式配置脚本
- 🐛 修复：Clerk session 为空导致的 401 错误
- 🔒 增强：`.gitignore` 规则，防止敏感数据泄露
- 📝 改进：详细的 README 和配置指南

### v1.0.0
- 🎉 Fork 自 [gcui-art/suno-api](https://github.com/gcui-art/suno-api)

## 🤝 贡献

欢迎 PR 和 Issue！主要改进方向：

- [ ] 自动刷新 JWT token
- [ ] 支持多账号轮询
- [ ] 更友好的错误提示
- [ ] Web 管理界面

## 📄 许可证

MIT License - 详见 [LICENSE](LICENSE) 文件

## 🙏 致谢

- 原项目：[gcui-art/suno-api](https://github.com/gcui-art/suno-api)
- [Suno AI](https://suno.ai) - 提供强大的音乐生成服务

## ⚠️ 免责声明

本项目仅供学习和研究使用。请遵守 Suno.ai 的服务条款，不要用于商业用途或滥用服务。

---

**如果这个项目对你有帮助，请给个 ⭐ Star！**

问题反馈：https://github.com/joeseesun/suno-api-private/issues
