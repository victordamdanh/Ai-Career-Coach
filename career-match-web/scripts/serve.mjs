import "./build.mjs";
import { createServer } from "node:http";
import { localDatabase } from "./sqlite.mjs";
import { Readable } from "node:stream";

const { default: worker } = await import("../dist/server/index.js");
const port = Number(process.env.PORT ?? 3000);
const env = { LOCAL_SQLITE: true, GEMINI_API_KEY: process.env.GEMINI_API_KEY, DB: localDatabase(process.env.DATABASE_PATH ?? "career-match.sqlite") };
const server = createServer(async (incoming, outgoing) => {
  try {
    if (!["127.0.0.1:" + port, "localhost:" + port].includes(incoming.headers.host)) {
      outgoing.writeHead(403).end("Open the local demo using its printed URL.");
      return;
    }
    const method = incoming.method;
    const options = { method, headers: incoming.headers };
    if (method !== "GET" && method !== "HEAD") {
      options.body = Readable.toWeb(incoming);
      options.duplex = "half";
    }
    const response = await worker.fetch(new Request("http://" + (incoming.headers.host ?? "127.0.0.1:" + port) + incoming.url, options), env);
    outgoing.writeHead(response.status, Object.fromEntries(response.headers));
    if (response.body) Readable.fromWeb(response.body).pipe(outgoing);
    else outgoing.end();
  } catch {
    outgoing.writeHead(500).end("Unexpected server error.");
  }
});
server.listen(port, "127.0.0.1", () => console.log("AI Career Match at http://127.0.0.1:" + port));
