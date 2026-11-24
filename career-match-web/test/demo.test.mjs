import test from "node:test";
import assert from "node:assert/strict";
import { api, score } from "../src/api.mjs";
import { account } from "../src/account.mjs";
import { fetchListings, jobText } from "../src/listings.mjs";
import { localDatabase } from "../scripts/sqlite.mjs";
import { createAgent } from "../web/agent.mjs";
import { detectInvitation } from "../web/career-steps.mjs";

test("uses the existing Career Coach job-fit point system", () => {
  const result = score([
    { category: "skills", status: "match", priority: "required" },
    { category: "experience", status: "partial", priority: "required" },
    { category: "projects", status: "gap", priority: "preferred" },
  ]);
  assert.equal(result.score, 60);
  assert.equal(result.earned, 3);
  assert.equal(result.possible, 5);
  assert.throws(() => score([{ category: "skills", status: "gap", priority: "__proto__" }]));
});

test("three real posting walkthroughs return reference scores and grounded excerpts", async () => {
  const source = await (await api(new Request("https://example.com/api/dataset"))).json();
  for (const [id, expected] of [["web", 83], ["intern", 71], ["senior", 36]]) {
    const listing = source.jobs.find(job => job.id === id);
    const response = await api(new Request("https://example.com/api/walkthrough?id=" + id));
    const result = await response.json();
    assert.match(listing.url, /^https:\/\/www.usajobs.gov\/job\//);
    assert.equal(result.rubric.score, expected);
    assert.equal(result.actions.length, 5);
    assert(result.rows.every(row => listing.description.includes(row.jobQuote) &&
      (row.status === "gap" || source.resume.includes(row.evidence))));
  }
});

test("the agent retries an ungrounded model response before calling its scoring tool", async () => {
  const stages = [];
  const resume = "Built a Python reporting tool.";
  const job = "Python experience is required.";
  const row = { category: "skills", requirement: "Python experience", jobQuote: job, status: "match", priority: "required", evidence: resume };
  const responses = [
    { rows: [{ ...row, evidence: "Five years with Python." }] }, { rows: [row] },
    { actions: ["Document the reporting project", "Add a relevant project link", "Summarize the key report users", "Review the original requirement", "Practice explaining one design choice"] },
  ];
  const agent = createAgent(async () => JSON.stringify(responses.shift()), async rows => {
    assert.deepEqual(rows, [{ category: "skills", status: "match", priority: "required" }]);
    return score(rows);
  });
  const result = await agent(resume, job, stage => stages.push(stage));
  assert.deepEqual(stages, ["compare", "compare", "score", "recommend"]);
  assert.equal(result.rubric.score, 100);
});

test("normalizes and filters Greenhouse listings, keeping the official URL", async () => {
  assert.equal(jobText("&lt;p&gt;Python &amp; SQL&lt;/p&gt;"), "Python & SQL");
  const job = { id: 17, title: "Data Intern", location: { name: "Remote" }, content: "<p>Python &amp; SQL</p>", absolute_url: "https://job-boards.greenhouse.io/figma/jobs/17" };
  const fake = async url => {
    assert.match(url, /figma\/jobs\?content=true$/);
    return Response.json({ jobs: [job, { ...job, title: "IT Manager" }] });
  };
  const result = await fetchListings("figma", "data remote", fake);
  assert.equal(result.total, 1);
  assert.equal(result.jobs[0].url, job.absolute_url);
  assert.equal(result.jobs[0].excerpt, "Python & SQL");
});

test("SQLite records are scoped to each candidate and can be deleted", async () => {
  const env = { DB: localDatabase(":memory:") };
  const origin = "https://example.com";
  const access = (path, method, owner, data, requestOrigin = origin) => account(new Request(origin + "/api/" + path, {
    method, headers: { "oai-authenticated-user-id": owner, "content-type": "application/json", origin: requestOrigin },
    body: JSON.stringify(data),
  }), env);
  const profile = { name: "Jordan", email: "jordan@example.com", phone: "", resume: "Built a Python reporting tool." };
  assert.equal((await access("account", "PUT", "one", profile, "https://wrong.com")).status, 403);
  assert.equal((await access("account", "PUT", "one", profile)).status, 200);
  assert.equal((await access("saved-jobs", "POST", "one", { id: 17, company: "Figma", title: "Data Intern", url: "https://job-boards.greenhouse.io/figma/jobs/17", location: "Remote", excerpt: "Python" })).status, 200);
  assert.deepEqual(await (await access("account", "GET", "two")).json(), { available: "ready", candidate: null, jobs: [] });
  assert.equal((await (await access("account", "GET", "one")).json()).jobs.length, 1);
  assert.equal((await access("account", "DELETE", "one")).status, 200);
  assert.deepEqual(await (await access("account", "GET", "one")).json(), { available: "ready", candidate: null, jobs: [] });
});

test("invitation triage distinguishes a sample invitation and rejection", () => {
  assert.equal(detectInvitation("We would like to invite you to an interview. Please send your availability."), true);
  assert.equal(detectInvitation("Unfortunately, we will not be moving forward with an interview."), false);
  assert.equal(detectInvitation("Thanks for applying. We have received your resume."), false);
});
