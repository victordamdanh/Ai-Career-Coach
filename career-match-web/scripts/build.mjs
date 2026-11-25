import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const files = {
  "/history-records.mjs": ["history-records.mjs", "text/javascript; charset=utf-8"],
  "/profile-history.mjs": ["profile-history.mjs", "text/javascript; charset=utf-8"],
  "/": ["index.html", "text/html; charset=utf-8"],
  "/styles.css": ["styles.css", "text/css; charset=utf-8"],
  "/app.mjs": ["app.mjs", "text/javascript; charset=utf-8"],
  "/match-evidence.mjs": ["match-evidence.mjs", "text/javascript; charset=utf-8"],
  "/agent.mjs": ["agent.mjs", "text/javascript; charset=utf-8"],
  "/resume-review.mjs": ["resume-review.mjs", "text/javascript; charset=utf-8"],
  "/chat-agent.mjs": ["chat-agent.mjs", "text/javascript; charset=utf-8"],
  "/workflow.mjs": ["workflow.mjs", "text/javascript; charset=utf-8"],
  "/chat.mjs": ["chat.mjs", "text/javascript; charset=utf-8"],
  "/inbox.mjs": ["inbox.mjs", "text/javascript; charset=utf-8"],
  "/guided.mjs": ["guided.mjs", "text/javascript; charset=utf-8"],
  "/interview.mjs": ["interview.mjs", "text/javascript; charset=utf-8"],
  "/avatar-motion.mjs": ["avatar-motion.mjs", "text/javascript; charset=utf-8"],
  "/automatic-preferences.mjs": ["automatic-preferences.mjs", "text/javascript; charset=utf-8"],
  "/career-steps.mjs": ["career-steps.mjs", "text/javascript; charset=utf-8"],
  "/job-preferences.mjs": ["job-preferences.mjs", "text/javascript; charset=utf-8"],
  "/preference-pickers.mjs": ["preference-pickers.mjs", "text/javascript; charset=utf-8"],
  "/preference-catalog.mjs": ["preference-catalog.mjs", "text/javascript; charset=utf-8"],
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([route, [name, type]]) => [
  route, { type, body: await read("web/" + name) },
])));
// Maya's layers are small WebP images, so the Worker serves them itself.
for (const layer of ["maya-room-cba388ece6.webp", "maya-body-5b836358ba.webp", "maya-head-cb0fa2c051.webp", "maya-mouth-1b64935fdd.webp", "maya-eyes-a3a7eca425.webp"]) {
  const body = await readFile(new URL("web/" + layer, root));
  assets["/" + layer] = { type: "image/webp", body: body.toString("base64"), base64: true };
}
const sources = await Promise.all(["src/data.mjs", "web/job-preferences.mjs", "src/listings.mjs", "src/api.mjs", "web/history-records.mjs", "src/account.mjs", "src/chat.mjs"].map(read));
const worker = sources.map(source => source.replace(/^import .*?\n/gm, "")).join("\n") + `
const assets = ${JSON.stringify(assets)};
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/account" || pathname === "/api/saved-jobs" || pathname === "/api/history") return account(request, env);
    if (pathname === "/api/chat") return careerChat(request, env);
    if (pathname.startsWith("/api/")) return api(request);
    const asset = Object.hasOwn(assets, pathname) && assets[pathname];
    if (!asset) return new Response("Page unavailable.", { status: 404 });
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method unavailable.", { status: 405 });
    const body = request.method === "HEAD" ? null : asset.base64
      ? Uint8Array.from(atob(asset.body), char => char.charCodeAt(0)) : asset.body;
    return new Response(body, { headers: {
      "content-type": asset.type, "x-content-type-options": "nosniff", "referrer-policy": "no-referrer",
    } });
  },
};
`;
await mkdir(new URL("dist/server/", root), { recursive: true });
await mkdir(new URL("dist/.openai/", root), { recursive: true });
const builtManifest = new URL("dist/.openai/hosting.json", root);
try {
  await copyFile(new URL(".openai/hosting.json", root), builtManifest);
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  await rm(builtManifest, { force: true });
}
await writeFile(new URL("dist/server/index.js", root), worker);

await mkdir(new URL("dist/.openai/drizzle/", root), { recursive: true });
await copyFile(new URL("drizzle/0000_career_match.sql", root), new URL("dist/.openai/drizzle/0000_career_match.sql", root));

await copyFile(new URL("drizzle/0001_history.sql", root), new URL("dist/.openai/drizzle/0001_history.sql", root));
