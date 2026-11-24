import assert from "node:assert/strict";
import test from "node:test";
import { recommendCompanies } from "../src/listings.mjs";

// One board response for every company: an Arizona operations role and a senior
// supply chain role in Chicago. Boards are cached, so each query reuses this data.
const board = async url => {
  const company = new URL(url).pathname.split("/")[3];
  const job = (id, title, location) => ({ id, title, location: { name: location },
    absolute_url: "https://job-boards.greenhouse.io/" + company + "/jobs/" + id });
  return Response.json({ jobs: [job(1, "Operations Analyst", "Phoenix, AZ"), job(2, "Senior Supply Chain Analyst", "Chicago, IL")] });
};

test("search keeps the chosen location when it has matches", async () => {
  const result = await recommendCompanies({ roles: ["Operations Analyst"], place: "Arizona", level: "" }, board);
  assert(result.matches.length > 0);
  assert(result.matches.every(group => group.jobs.every(job => job.location === "Phoenix, AZ")));
  assert.deepEqual(result.relaxed, []);
});

test("search relaxes the location, then level, only when nothing matches", async () => {
  const elsewhere = await recommendCompanies({ roles: ["Supply Chain Analyst"], place: "Arizona", level: "" }, board);
  assert(elsewhere.matches.length > 0);
  assert.deepEqual(elsewhere.relaxed, ["location"]);
  const senior = await recommendCompanies({ roles: ["Supply Chain Analyst"], place: "Arizona", level: "Entry level" }, board);
  assert(senior.matches.length > 0);
  assert.deepEqual(senior.relaxed, ["location", "level"]);
  const none = await recommendCompanies({ roles: ["Registered Nurse"], place: "Arizona", level: "" }, board);
  assert.equal(none.matches.length, 0);
  assert.deepEqual(none.relaxed, []);
});
