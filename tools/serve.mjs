import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

// Dependency-free local launcher for the compiled game. Only dist is exposed.
const root = fileURLToPath(new URL("../dist/", import.meta.url));
const port = Number(process.env.MARS_PORT || 8080);
const mime = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".json": "application/json",
};
try {
  await stat(path.join(root, "index.html"));
} catch {
  console.error(
    "The game build is missing. Run npm install and npm run build first.",
  );
  process.exit(1);
}
const server = http.createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(
      new URL(req.url, "http://localhost").pathname,
    );
    const file = path.resolve(
      root,
      "." + (pathname === "/" ? "/index.html" : pathname),
    );
    if (!file.startsWith(path.resolve(root) + path.sep)) {
      res.writeHead(403);
      return res.end("Forbidden");
    }
    const data = await readFile(file);
    res.writeHead(200, {
      "Content-Type": mime[path.extname(file)] || "application/octet-stream",
      "Cache-Control": "no-cache",
      "X-Content-Type-Options": "nosniff",
    });
    res.end(data);
  } catch {
    res.writeHead(404);
    res.end("Not found");
  }
});
server.on("error", (error) => {
  console.error(
    error.code === "EADDRINUSE"
      ? `Port ${port} is already in use. Close the other preview, or set MARS_PORT to a different port.`
      : error.message,
  );
  process.exitCode = 1;
});
server.listen(port, "127.0.0.1", () => {
  const url = `http://127.0.0.1:${port}/`;
  console.log(
    `Mars Sweet Heist is ready: ${url}\nKeep this window open while playing. Ctrl+C stops the game server.`,
  );
  if (process.argv.includes("--open") && process.platform === "win32")
    spawn("explorer.exe", [url], { windowsHide: true }).on("error", () =>
      console.log("Open the address above in your browser."),
    );
});
