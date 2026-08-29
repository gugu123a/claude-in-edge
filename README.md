> **关于本 README**：本仓库的 README 由咕咕（[gugu123a](https://github.com/gugu123a)）授权 Claude 代笔整理。

# Claude in edge

一个「Claude 风格」的 AI 伴侣聊天 PWA。前端是纯静态的 Anthropic 设计语言界面（珊瑚色、暖色调、Anthropic 字体），后端是一个极简的 Node.js / Express 服务，接入 DeepSeek API，支持流式回复（SSE）。

它是「Claude in edge / 咕巢」这条产品线的早期形态——轻量、免登录、打开即聊。

## 特性

- 📱 **PWA**：可安装到手机 / 桌面，`public/manifest.webmanifest` + `public/sw.js` 离线缓存
- 💬 **流式回复**：后端用 SSE 把 DeepSeek 的增量实时推给前端
- 🎨 **Claude 设计语言**：Anthropic Sans / Serif 字体、珊瑚色强调、暖色背景
- 🤖 **深度人设**：`server.js` 内置完整系统提示词（AI 伴侣人设）
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
| `PORT` | 服务端口 | `3000` |

## 技术栈

| 层 | 技术 |
|---|---|
| 后端 | Node.js 22+ / Express 5（ESM） |
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

本项目与 Anthropic / Claude 官方无关，仅供个人学习使用。
