import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { dirname, extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const port = Number.parseInt(process.argv[2] ?? "3456", 10);
const host = "127.0.0.1";

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("ポート番号は1～65535で指定してください。");
}

if (!existsSync(join(projectRoot, "index.html"))) {
  throw new Error(`index.htmlが見つかりません: ${projectRoot}`);
}

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".gif", "image/gif"],
  [".html", "text/html; charset=utf-8"],
  [".ico", "image/x-icon"],
  [".jpeg", "image/jpeg"],
  [".jpg", "image/jpeg"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml"],
  [".webp", "image/webp"],
]);

const server = createServer((request, response) => {
  try {
    if (request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, {
        "Allow": "GET, HEAD",
        "Content-Type": "text/plain; charset=utf-8",
      }).end("Method Not Allowed");
      return;
    }

    const pathname = decodeURIComponent(new URL(request.url, `http://${host}`).pathname);
    const pathSegments = pathname.split("/").filter(Boolean);
    if (pathSegments.some((segment) => segment.startsWith("."))) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }

    let filePath = resolve(projectRoot, `.${pathname}`);
    const isInsideProject = filePath === projectRoot || filePath.startsWith(`${projectRoot}${sep}`);

    if (!isInsideProject) {
      response.writeHead(403).end("Forbidden");
      return;
    }

    if (existsSync(filePath) && statSync(filePath).isDirectory()) {
      filePath = join(filePath, "index.html");
    }

    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" }).end("Not Found");
      return;
    }

    response.writeHead(200, {
      "Cache-Control": "no-store",
      "Content-Type": contentTypes.get(extname(filePath).toLowerCase()) ?? "application/octet-stream",
    });

    if (request.method === "HEAD") {
      response.end();
      return;
    }

    createReadStream(filePath).pipe(response);
  } catch {
    response.writeHead(400, { "Content-Type": "text/plain; charset=utf-8" }).end("Bad Request");
  }
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    console.error(`ポート${port}は別のローカルサーバーが使用中です。`);
    console.error("古いプレビューを終了してから、もう一度起動してください。");
  } else {
    console.error(`ローカルプレビューを起動できませんでした: ${error.message}`);
  }
  process.exitCode = 1;
});

server.listen(port, host, () => {
  console.log("石川マップ ローカルプレビュー");
  console.log(`配信元: ${projectRoot}`);
  console.log(`URL: http://${host}:${port}/`);
  console.log("終了するときは Ctrl+C を押してください。");
});
