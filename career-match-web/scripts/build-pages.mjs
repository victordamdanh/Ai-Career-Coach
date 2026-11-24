import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/pages/", root);
const read = path => readFile(new URL(path, root), "utf8");
await mkdir(output, { recursive: true });

const staticFiles = [
  "web/styles.css", "web/agent.mjs", "web/career-steps.mjs", "web/inbox.mjs", "web/chat.mjs", "web/chat-agent.mjs", "web/resume-review.mjs",
  "src/api.mjs", "src/data.mjs", "src/listings.mjs", "hosting/pages/request.mjs",
];
const assets = Object.fromEntries(await Promise.all(staticFiles.map(async path => [path.split("/").at(-1), await read(path)])));
assets["index.html"] = (await read("web/index.html"))
  .replace("File extraction runs in your browser.", "Public classroom demo. Resume extraction runs in your browser. Profiles and saved jobs are kept only while this page is open.")
  .replace("Save a resume and your own candidate details for later visits.", "Keep a resume and candidate details while this page is open.")
  .replace("If Gemini is configured, Google processes the conversation and any details you choose to include. Remove personal contact information before sharing.", "This public edition runs chat on your device. Live chat requires WebGPU and downloads a model on first use.");
assets["app.mjs"] = 'import { createClassroomRequest } from "./request.mjs";\nconst classroomRequest = createClassroomRequest();\n' +
  (await read("web/app.mjs"))
    .replace('fetch("./api/" + path, options)', "classroomRequest(path, options)")
    .replace("onDeviceOnly: false", "onDeviceOnly: true");
if (!assets["index.html"].includes("Public classroom demo") ||
  !assets["app.mjs"].includes("await classroomRequest(path, options)") ||
  !assets["app.mjs"].includes("onDeviceOnly: true")) {
  throw new Error("Public entry points changed. Update the classroom build.");
}
assets[".nojekyll"] = "";
const version = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
await Promise.all(Object.entries(assets).map(([name, content]) => writeFile(
  new URL(name, output),
  content.replace(/(["'])\.\/([a-z.-]+\.(?:mjs|css))\1/g, (match, quote, asset) =>
    Object.hasOwn(assets, asset) ? quote + "./" + asset + "?v=" + version + quote : match),
)));
