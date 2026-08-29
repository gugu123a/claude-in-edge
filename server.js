import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const envPath = path.join(__dirname, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    const value = trimmed.slice(eqIdx + 1).trim();
    if (!process.env[key]) process.env[key] = value;
  }
}

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "127.0.0.1";
const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || "";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL || "deepseek-v4-flash";
const BASIC_AUTH_USER = process.env.BASIC_AUTH_USER || "";
const BASIC_AUTH_PASSWORD = process.env.BASIC_AUTH_PASSWORD || "";
const MAX_BODY_BYTES = 1_000_000;
const AUTH_ENABLED = Boolean(BASIC_AUTH_USER && BASIC_AUTH_PASSWORD);

if (Boolean(BASIC_AUTH_USER) !== Boolean(BASIC_AUTH_PASSWORD)) {
  throw new Error("BASIC_AUTH_USER and BASIC_AUTH_PASSWORD must be set together");
}
if (!["127.0.0.1", "localhost", "::1"].includes(HOST) && !AUTH_ENABLED) {
  throw new Error("Basic authentication is required when listening outside localhost");
}

const SYSTEM_PROMPT = `你是一个温暖、坦诚且尊重用户边界的中文对话助手。
清楚区分事实、推测和不确定信息；发现观点中的漏洞时礼貌指出，不谄媚，也不作绝对化承诺。
优先用自然、简洁的语言回答。用户表达疲惫或不想继续时，不追问。`;

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".woff2": "font/woff2",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".webmanifest": "application/manifest+json",
};

const publicDir = path.resolve(__dirname, "public");

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("X-Frame-Options", "DENY");
}

function safeEqual(actual, expected) {
  const left = Buffer.from(actual);
  const right = Buffer.from(expected);
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function isAuthorized(req) {
  if (!AUTH_ENABLED) return true;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Basic ")) return false;
  try {
    const decoded = Buffer.from(header.slice(6), "base64").toString("utf-8");
    const separator = decoded.indexOf(":");
    if (separator < 0) return false;
    return safeEqual(decoded.slice(0, separator), BASIC_AUTH_USER)
      && safeEqual(decoded.slice(separator + 1), BASIC_AUTH_PASSWORD);
  } catch {
    return false;
  }
}

function serveStatic(req, res) {
  const pathname = new URL(req.url, "http://localhost").pathname;
  const relativePath = pathname === "/" ? "index.html" : pathname.slice(1);
  const fullPath = path.resolve(publicDir, relativePath);
  const relative = path.relative(publicDir, fullPath);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end("Forbidden");
    return true;
  }

  try {
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) return false;
    const ext = path.extname(fullPath);
    res.writeHead(200, {
      "Content-Type": MIME[ext] || "application/octet-stream",
      "Cache-Control": ext === ".html" || ext === ".webmanifest"
        ? "no-cache"
        : "public, max-age=31536000, immutable",
    });
    fs.createReadStream(fullPath).pipe(res);
    return true;
  } catch {
    return false;
  }
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > MAX_BODY_BYTES) {
      const error = new Error("Request body too large");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString("utf-8");
}

function validateMessages(messages) {
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > 100) {
    throw new Error("messages must contain between 1 and 100 items");
  }
  let totalLength = 0;
  return messages.map((message) => {
    if (!message || !["user", "assistant"].includes(message.role)) {
      throw new Error("message role must be user or assistant");
    }
    if (typeof message.content !== "string" || message.content.length > 20_000) {
      throw new Error("message content must be a string no longer than 20000 characters");
    }
    totalLength += message.content.length;
    if (totalLength > 100_000) throw new Error("conversation is too large");
    return { role: message.role, content: message.content };
  });
}

async function handleChat(req, res) {
  if (req.method !== "POST") {
    res.writeHead(405);
    return res.end("Method Not Allowed");
  }
  if (!DEEPSEEK_API_KEY) {
    res.writeHead(503, { "Content-Type": "application/json; charset=utf-8" });
    return res.end(JSON.stringify({ error: "Chat service is not configured" }));
  }

  try {
    const payload = JSON.parse(await readBody(req));
    const messages = validateMessages(payload.messages);
    const apiRes = await fetch("https://api.deepseek.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${DEEPSEEK_API_KEY}`,
      },
      body: JSON.stringify({
        model: DEEPSEEK_MODEL,
        messages: [{ role: "system", content: SYSTEM_PROMPT }, ...messages],
        stream: true,
        max_tokens: 8192,
      }),
    });

    if (!apiRes.ok) {
      console.error(`DeepSeek API returned HTTP ${apiRes.status}`);
      res.writeHead(502, { "Content-Type": "application/json; charset=utf-8" });
      return res.end(JSON.stringify({ error: "Upstream chat service failed" }));
    }

    res.writeHead(200, {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    });
    const reader = apiRes.body.getReader();
    const decoder = new TextDecoder();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(decoder.decode(value, { stream: true }));
    }
    res.end();
  } catch (error) {
    const status = error.statusCode || 400;
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
    res.end(JSON.stringify({ error: status === 413 ? "Request body too large" : "Invalid request" }));
  }
}

function handleHealth(_req, res) {
  res.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify({ status: "ok", model: DEEPSEEK_MODEL }));
}

const server = http.createServer(async (req, res) => {
  setSecurityHeaders(res);
  const url = new URL(req.url, "http://localhost").pathname;

  if (url === "/api/health") return handleHealth(req, res);
  if (!isAuthorized(req)) {
    res.writeHead(401, { "WWW-Authenticate": 'Basic realm="Claude in edge", charset="UTF-8"' });
    return res.end("Authentication required");
  }
  if (url === "/api/chat") return handleChat(req, res);
  if (serveStatic(req, res)) return;

  const indexPath = path.join(publicDir, "index.html");
  if (fs.existsSync(indexPath)) {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return fs.createReadStream(indexPath).pipe(res);
  }
  res.writeHead(404);
  res.end("404 Not Found");
});

server.listen(PORT, HOST, () => {
  console.log(`Claude in edge PWA running on http://${HOST}:${PORT}`);
  if (!DEEPSEEK_API_KEY) console.warn("DEEPSEEK_API_KEY is not set; chat is unavailable");
  if (!AUTH_ENABLED) console.warn("Basic authentication is disabled; localhost access only");
});
