import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { canNavigateWorkflow } from "../web/workflow.mjs";

const stepIds = ["upload", "preferences", "review", "jobs", "match", "application", "inbox", "interview", "chat", "profile"];

test("career navigation only allows the next step and earlier steps", () => {
  for (const [index, step] of stepIds.entries()) {
    assert.equal(canNavigateWorkflow(undefined, step), index === 0, step);
    for (const [destinationIndex, destination] of stepIds.entries()) {
      assert.equal(canNavigateWorkflow(step, destination), destinationIndex <= index + 1, `${step} → ${destination}`);
    }
  }
  assert.equal(canNavigateWorkflow("review", "unknown"), false);
});

test("every career page includes a visible Continue action before its content", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const sections = html.split(/\n  <section data-page="/).slice(1);
  const links = sections.map(section => [section.split('"')[0], section.match(/class="flow-actions"><a class="button" href="#([^"]+)">/)?.[1]]);
  assert.deepEqual(links, stepIds.map((step, index) => [step, stepIds[index + 1] ?? "upload"]));
  const [review] = sections.filter(section => section.startsWith('review"'));
  assert.ok(review.indexOf("Continue to Find Jobs") > review.indexOf("Resume review"));
  assert.ok(review.indexOf("Continue to Find Jobs") < review.indexOf('id="analyze-resume"'));
});
