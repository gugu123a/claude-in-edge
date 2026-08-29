> **关于本 README**：本仓库的 README 由咕咕（[gugu123a](https://github.com/gugu123a)）授权 Claude 代笔整理。

# Claude in edge

一个「Claude 风格」的聊天 PWA。前端是纯静态界面，后端是一个极简的 Node.js HTTP 服务，接入 DeepSeek API，支持流式回复（SSE）。

默认仅监听本机回环地址；如果要开放到局域网或公网，必须先配置 HTTP Basic Auth。

## 特性

- 📱 **PWA**：可安装到手机 / 桌面，`public/manifest.webmanifest` + `public/sw.js` 离线缓存
- 💬 **流式回复**：后端用 SSE 把 DeepSeek 的增量实时推给前端
- 🎨 **Claude 设计语言**：Anthropic Sans / Serif 字体、珊瑚色强调、暖色背景
- 🤖 **通用人设**：仓库只包含不涉及个人信息的通用系统提示词
- 🧪 **AB 评估**：`run-eval-ab.cjs` + `eval-ab-output.txt` 用于对话质量评估

## 快速开始

```bash
npm install
cp .env.example .env    # 填入 DEEPSEEK_API_KEY
npm start               # 默认 http://localhost:3000
```

开发模式（文件变更自动重启）：

```bash
npm run dev
```

## 配置

`.env` 支持以下变量：

| 变量 | 说明 | 默认 |
|---|---|---|
| `DEEPSEEK_API_KEY` | DeepSeek API 密钥（必填） | 无 |
| `DEEPSEEK_MODEL` | API 模型名 | `deepseek-v4-flash` |
| `HOST` | 监听地址；非本机地址必须启用认证 | `127.0.0.1` |
| `PORT` | 服务端口 | `3000` |
| `BASIC_AUTH_USER` | 网页访问用户名 | 无 |
| `BASIC_AUTH_PASSWORD` | 网页访问密码 | 无 |

服务端会限制请求体大小、消息数量和单条消息长度，不向浏览器暴露上游 API 的原始错误内容。不要把 `.env` 或真实对话评测材料提交到仓库。

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js 22+ 原生 HTTP（ESM） |
| 前端 | 原生 HTML / CSS / JS（无框架） |
| 模型 | DeepSeek API（SSE 流式） |
| 设计 | Anthropic 设计语言 |

## 项目结构

```
server.js                # 后端：API 转发 + 静态文件服务 + 人设
public/index.html        # PWA 前端
public/sw.js             # Service Worker
public/manifest.webmanifest
run-eval-ab.cjs          # AB 评估脚本
```

## 免责声明

本项目与 Anthropic / Claude 官方无关，仅借鉴了其设计语言风格。模型由 DeepSeek 提供。
