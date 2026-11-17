/*
 * Local server for the Huawei router dashboard.
 *
 *   node server.js [--port 8099] [--no-open]
 *
 * Two jobs: serve the files in public/, and forward the page's router calls to
 * the router. The forwarding exists because a page cannot call the router
 * directly — the router sends no CORS headers and rejects the preflight the
 * browser sends first. Here the request comes from Node, so no such rule
 * applies.
 *
 * The router's session cookie is kept here, in memory, because a page is not
 * allowed to set the Cookie header on its own requests. Nothing is written to
 * disk.
 */

"use strict";

const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { exec } = require("node:child_process");

const PUBLIC_DIR = path.join(__dirname, "public");
const DEFAULT_ROUTER = "http://192.168.8.1";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

/** One session cookie per router address. Lost when the server stops. */
const sessions = new Map();

function readBody(request) {
  return new Promise((resolve) => {
    const chunks = [];
    request.on("data", (chunk) => chunks.push(chunk));
    request.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    request.on("error", () => resolve(""));
  });
}

function routerBase(value) {
  let text = String(value || "").trim() || DEFAULT_ROUTER;
  if (!/^https?:\/\//i.test(text)) text = "http://" + text;
  return text.replace(/\/+$/, "");
}

/**
 * Forward one call to the router and return its answer unchanged.
 *
 * The page supplies the router address in `X-Router`, so one server can talk to
 * whichever router the user typed. Only the token header and the content type
 * are passed through; everything else is set here.
 */
async function proxyToRouter(request, response) {
  const base = routerBase(request.headers["x-router"]);
  const target = base + "/" + request.url.replace(/^\/router\//, "");

  const headers = {};
  const token =
    request.headers["__requestverificationtoken"] ||
    request.headers["__requestverificationtokens"];
  if (token) headers["__RequestVerificationToken"] = token;
  if (request.headers["content-type"]) {
    headers["Content-Type"] = request.headers["content-type"];
  }

  const cookie = sessions.get(base);
  if (cookie) headers["Cookie"] = cookie;

  const method = request.method || "GET";
  const body = method === "GET" || method === "HEAD" ? undefined : await readBody(request);

  let upstream;
  try {
    upstream = await fetch(target, {
      method,
      headers,
      body,
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
  } catch (err) {
    response.writeHead(502, { "Content-Type": "application/json" });
    response.end(
      JSON.stringify({
        message:
          "Cannot reach the router at " + base + ". Check the address and that this computer is on its network.",
      })
    );
    return;
  }

  // Keep the session cookie the router just handed out.
  const setCookies = upstream.headers.getSetCookie
    ? upstream.headers.getSetCookie()
    : [];
  if (setCookies.length) {
    sessions.set(
      base,
      setCookies.map((entry) => entry.split(";")[0]).join("; ")
    );
  }

  const outHeaders = { "Content-Type": upstream.headers.get("content-type") || "text/xml" };
  for (const name of [
    "__RequestVerificationToken",
    "__RequestVerificationTokenone",
    "__RequestVerificationTokentwo",
  ]) {
    const value = upstream.headers.get(name.toLowerCase());
    if (value) outHeaders[name] = value;
  }

  const text = await upstream.text();
  response.writeHead(upstream.status, outHeaders);
  response.end(text);
}

function serveFile(request, response) {
  const url = request.url.split("?")[0];
  const relative = url === "/" ? "index.html" : decodeURIComponent(url.slice(1));
  const file = path.join(PUBLIC_DIR, relative);

  // Refuse anything that escapes public/.
  if (!file.startsWith(PUBLIC_DIR)) {
    response.writeHead(403).end("Forbidden");
    return;
  }

  fs.readFile(file, (err, data) => {
    if (err) {
      response.writeHead(404, { "Content-Type": "text/plain" });
      response.end("Not found");
      return;
    }
    response.writeHead(200, {
      "Content-Type": TYPES[path.extname(file)] || "application/octet-stream",
      // Always revalidate, so an edited page is never served from cache.
      "Cache-Control": "no-cache",
    });
    response.end(data);
  });
}

function openBrowser(url) {
  const command =
    process.platform === "win32"
      ? `start "" "${url}"`
      : process.platform === "darwin"
        ? `open "${url}"`
        : `xdg-open "${url}"`;
  exec(command, () => {});
}

function main() {
  const args = process.argv.slice(2);
  const portIndex = args.indexOf("--port");
  const port = portIndex >= 0 ? Number(args[portIndex + 1]) : 8099;
  const open = !args.includes("--no-open");

  const server = http.createServer((request, response) => {
    if (request.url.startsWith("/router/")) {
      proxyToRouter(request, response).catch((err) => {
        response.writeHead(500, { "Content-Type": "application/json" });
        response.end(JSON.stringify({ message: String(err && err.message) }));
      });
      return;
    }
    serveFile(request, response);
  });

  server.listen(port, "127.0.0.1", () => {
    const url = `http://127.0.0.1:${port}`;
    console.log(`Dashboard on ${url}  (Ctrl+C to stop)`);
    if (open) openBrowser(url);
  });

  server.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(
        `Port ${port} is already in use — the dashboard may already be running.`
      );
    } else {
      console.error("The dashboard could not start:", err.message);
    }
    process.exit(1);
  });
}

main();
