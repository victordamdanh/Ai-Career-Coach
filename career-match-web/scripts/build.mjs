import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const read = path => readFile(new URL(path, root), "utf8");
const files = {
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
  "/career-steps.mjs": ["career-steps.mjs", "text/javascript; charset=utf-8"],
  "/job-preferences.mjs": ["job-preferences.mjs", "text/javascript; charset=utf-8"],
  "/preference-pickers.mjs": ["preference-pickers.mjs", "text/javascript; charset=utf-8"],
  "/preference-catalog.mjs": ["preference-catalog.mjs", "text/javascript; charset=utf-8"],
};
const assets = Object.fromEntries(await Promise.all(Object.entries(files).map(async ([route, [name, type]]) => [
  route, { type, body: await read("web/" + name) },
])));
const portrait = await readFile(new URL("web/interviewer-bf80c53f7c.png", root));
assets["/interviewer-bf80c53f7c.png"] = { type: "image/png", body: portrait.toString("base64"), base64: true };
// Expression frames stay on the static host so the embedded Worker stays small.
for (const frame of ["maya-speaking-a6a2e4d45f.png", "maya-blink-bb1ea41801.png"]) {
  assets["/"].body = assets["/"].body.replace("./" + frame, "https://victordamdanh.github.io/Ai-Career-Coach/" + frame);
}
const sources = await Promise.all(["src/data.mjs", "web/job-preferences.mjs", "src/listings.mjs", "src/api.mjs", "src/account.mjs", "src/chat.mjs"].map(read));
const worker = sources.map(source => source.replace(/^import .*?\n/gm, "")).join("\n") + `
const assets = ${JSON.stringify(assets)};
export default {
  async fetch(request, env) {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/account" || pathname === "/api/saved-jobs") return account(request, env);
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
