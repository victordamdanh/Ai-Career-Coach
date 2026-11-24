import assert from "node:assert/strict";
import test from "node:test";
import { recommendCompanies } from "../src/listings.mjs";

const intro = "Our company builds the operational backbone for the future of mobility. ".repeat(30);
const duties = "Own the depot schedule and coordinate shift coverage. ".repeat(20);
const postings = {
  1: "<p>" + intro + "</p><p>Responsibilities:</p><p>" + duties + "</p><p>Experience:</p><p>2+ years of operations experience with Excel.</p>",
  2: "<p>" + intro + "</p><p>The Opportunity</p><p>" + duties + "</p>",
  3: "<p>" + intro + "</p><p>Experience with a fast-paced team is a plus in our culture.</p><p>" + duties + "</p>",
};
const board = async url => {
  const company = new URL(url).pathname.split("/")[3];
  return Response.json({ jobs: Object.entries(postings).map(([id, content]) => ({ id: Number(id), title: "Operations Associate " + id,
    location: { name: "Remote" }, content, absolute_url: "https://job-boards.greenhouse.io/" + company + "/jobs/" + id })) });
};

test("long posting excerpts skip the company introduction", async () => {
  const { matches } = await recommendCompanies({ roles: ["Operations Associate"], place: "", level: "" }, board);
  const jobs = new Map(matches[0].jobs.map(job => [job.id, job.excerpt]));
  assert.match(jobs.get(1), /^Experience:/);
  assert.match(jobs.get(2), /^The Opportunity/);
  assert.match(jobs.get(3), /^Our company builds/, "a sentence that starts with 'Experience' is not a heading");
});
