import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/pages/", root);
const read = path => readFile(new URL(path, root), "utf8");
await mkdir(output, { recursive: true });

const staticFiles = [
  "web/styles.css", "web/workflow.mjs", "web/agent.mjs", "web/match-evidence.mjs", "web/career-steps.mjs", "web/inbox.mjs", "web/chat.mjs", "web/chat-agent.mjs", "web/resume-review.mjs",
  "web/job-preferences.mjs", "web/preference-pickers.mjs", "web/preference-catalog.mjs", "web/guided.mjs", "web/interview.mjs", "web/avatar-motion.mjs", "web/automatic-preferences.mjs", "web/history-records.mjs", "web/profile-history.mjs", "web/supabase-storage.mjs", "web/supabase-config.mjs",
  "src/api.mjs", "src/data.mjs", "src/listings.mjs", "hosting/pages/request.mjs",
];
const assets = Object.fromEntries(await Promise.all(staticFiles.map(async path => [path.split("/").at(-1), await read(path)])));
assets["listings.mjs"] = assets["listings.mjs"].replace('from "../web/job-preferences.mjs"', 'from "./job-preferences.mjs"');
assets["index.html"] = (await read("web/index.html"))
  .replace("File extraction runs in your browser.", "Public classroom demo. Resume extraction runs in your browser. Named resume versions, interview records and saved jobs are stored in your private Supabase account when you save them.")
  .replace("If Gemini is configured, Google processes the conversation and any details you choose to include. Remove personal contact information before sharing.", "This public edition runs chat on your device. Live chat requires WebGPU and downloads a model on first use.");
assets["app.mjs"] = 'import { createClassroomRequest, bindSupabaseLogin } from "./request.mjs";\nconst classroomRequest = createClassroomRequest();\n' +
  (await read("web/app.mjs"))
    .replace('fetch("./api/" + path, options)', "classroomRequest(path, options)")
    .replace("onDeviceOnly: false", "onDeviceOnly: true")
    .replace('loadAccount().catch(error => status("account-status", error.message, true));\n\n\nfunction syncResumePreview', 'bindSupabaseLogin(loadAccount);\nloadAccount().catch(error => status("account-status", error.message, true));\n\n\nfunction syncResumePreview');
if (!assets["index.html"].includes("Public classroom demo") ||
  !assets["app.mjs"].includes("await classroomRequest(path, options)") ||
  !assets["app.mjs"].includes("onDeviceOnly: true") || !assets["app.mjs"].includes("bindSupabaseLogin(loadAccount);")) {
  throw new Error("Public entry points changed. Update the classroom build.");
}
assets[".nojekyll"] = "";
const version = createHash("sha256").update(JSON.stringify(assets)).digest("hex").slice(0, 12);
await Promise.all(Object.entries(assets).map(([name, content]) => writeFile(
  new URL(name, output),
  content.replace(/(["'])\.\/([a-z.-]+\.(?:mjs|css))\1/g, (match, quote, asset) =>
    Object.hasOwn(assets, asset) ? quote + "./" + asset + "?v=" + version + quote : match),
)));

for (const portrait of ["maya-room-cba388ece6.webp", "maya-body-5b836358ba.webp", "maya-head-cb0fa2c051.webp", "maya-mouth-1b64935fdd.webp", "maya-eyes-a3a7eca425.webp"]) {
  await copyFile(new URL("web/" + portrait, root), new URL(portrait, output));
}
