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

test("the agent retries unknown evidence IDs and scores the original quotes", async () => {
  const stages = [];
  const resume = "Built a Python reporting tool.";
  const job = "Python experience is required.";
  const responses = [
    { rows: [["J1", "skills", "match", "required", "R99"]] },
    { rows: [["J1", "skills", "match", "required", "R1"]] },
  ];
  const agent = createAgent(async (_system, _prompt, input) => {
    assert.deepEqual(input, { job: [["J1", job]], resume: [["R1", resume]] });
    return JSON.stringify(responses.shift());
  }, async rows => {
    assert.deepEqual(rows, [{ category: "skills", status: "match", priority: "required" }]);
    return score(rows);
  });
  const result = await agent(resume, job, stage => stages.push(stage));
  assert.deepEqual(stages, ["compare", "compare", "score", "recommend"]);
  assert.equal(result.mode, "live");
  assert.equal(result.rubric.score, 100);
  assert.equal(result.rows[0].evidence, resume);
  assert.equal(result.rows[0].jobQuote, job);
  assert.equal(result.actions.length, 5);
});

test("Job Match keeps verified rows even when another row has an invalid reference", async () => {
  let calls = 0;
  const agent = createAgent(async () => {
    calls++;
    return 'Here is the result. {"rows":[["J1","skills","match","required","R1"],["J2","skills","match","required","R90"]]}';
  }, score);
  const result = await agent("Built a Python script.", "Python is required. SQL is required.", () => {});
  assert.equal(calls, 1);
  assert.equal(result.mode, "live");
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].jobQuote, "Python is required.");
});

test("Job Match returns a labeled source comparison when AI fails validation or cannot load", async () => {
  const resume = "Created weekly Python reports.\nNo experience with Tableau.";
  const job = "Required qualifications\nExperience using Python.\nPreferred qualifications\nExperience using Tableau.";
  for (const generate of [
    async () => "incomplete model output",
    async () => { throw new Error("WebGPU unavailable"); },
  ]) {
    const agent = createAgent(generate, score);
    const result = await agent(resume, job, () => {});
    assert.equal(result.mode, "source");
    assert.equal(result.actions.length, 5);
    assert.deepEqual(result.rows.map(({ status, priority, evidence }) => [status, priority, evidence]), [
      ["partial", "required", "Created weekly Python reports."],
      ["gap", "preferred", ""],
    ]);
    assert.equal(result.rubric.score, 33);
  }
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
