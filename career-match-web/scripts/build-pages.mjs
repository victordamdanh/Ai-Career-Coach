import { copyFile, mkdir, readFile, writeFile } from "node:fs/promises";

const root = new URL("../", import.meta.url);
const output = new URL("dist/pages/", root);
const read = path => readFile(new URL(path, root), "utf8");
await mkdir(output, { recursive: true });

const staticFiles = [
  "web/styles.css", "web/agent.mjs", "web/career-steps.mjs", "web/inbox.mjs",
  "src/api.mjs", "src/data.mjs", "src/listings.mjs", "hosting/pages/request.mjs",
];
await Promise.all(staticFiles.map(path => copyFile(new URL(path, root), new URL(path.split("/").at(-1), output))));

const html = (await read("web/index.html"))
  .replace("</p></section>\n<nav", "</p><p class=\"hint\">Public classroom demo. Resume analysis runs in your browser. Profiles and saved jobs are kept only while this page is open.</p></section>\n<nav")
  .replace("Save a resume and your own candidate details for later visits.", "Keep a resume and candidate details while this page is open.");
const app = 'import { createClassroomRequest } from "./request.mjs";\nconst classroomRequest = createClassroomRequest();\n' +
  (await read("web/app.mjs")).replace('fetch("./api/" + path, options)', "classroomRequest(path, options)");
if (!html.includes("Public classroom demo") || !app.includes("await classroomRequest(path, options)")) {
  throw new Error("Public entry points changed. Update the classroom build.");
}
await Promise.all([
  writeFile(new URL("index.html", output), html),
  writeFile(new URL("app.mjs", output), app),
  writeFile(new URL(".nojekyll", output), ""),
]);
