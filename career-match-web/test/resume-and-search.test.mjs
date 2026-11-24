import test from "node:test";
import assert from "node:assert/strict";
import { checkRemoteListing, companyBoards, recommendCompanies } from "../src/listings.mjs";
import { resumeExcerpt, resumeLimit, resumeProfile, reviewResume } from "../web/resume-review.mjs";

test("scoring always produces all five categories for typical resume styles", () => {
  const resumes = [
    "Education\nB.S. in Business Analytics\nProjects\nAnalyzed 480 surveys using SQL and Excel to recommend staffing changes.",
    "Retail associate | 2022–2025 — Served 40 customers daily, reconciled receipts, and trained new staff.",
    "SUMMARY\nProduct designer with 8 years of experience\nEXPERIENCE\nDesigned onboarding in Figma and reduced completion time by 25%.",
    "Nursing student. Completed supervised rotations and prepared clinical documentation.",
  ];
  for (const resume of resumes) {
    const report = reviewResume(resume);
    assert.deepEqual(report.criteria.map(item => item.name), ["Organization", "Clarity", "Impact", "Relevance", "Skills"]);
    assert.equal(report.total, report.criteria.reduce((total, item) => total + item.points, 0));
    assert(report.criteria.every(item => item.points >= 0 && item.points <= 20));
  }
});

test("the full resume informs the profile and relevant later text reaches the model excerpt", () => {
  const resume = ("Led a community workshop and maintained participant records.\n").repeat(190)
    + "\nFinal project: built SQL dashboards with Power BI.";
  assert(resume.length > 3000 && resume.length < resumeLimit);
  assert(resumeProfile(resume).skills.includes("Power BI"));
  const summary = resumeExcerpt(resume, "Power BI and SQL dashboard", 550);
  assert(summary.length <= 550);
  assert(summary.includes("built SQL dashboards with Power BI"));
});

test("resume-based search includes all reachable companies with matching opening titles", async () => {
  const checked = [];
  const data = company => ({
    id: 42,
    title: company === "reddit" ? "Marketing Intern" : "Data Analyst Intern",
    location: { name: company === "stripe" ? "New York" : "Remote" },
    absolute_url: "https://job-boards.greenhouse.io/" + company + "/jobs/42",
  });
  const result = await recommendCompanies({ roles: ["Data Analyst"], place: "Remote", level: "intern" }, async url => {
    const company = new URL(url).pathname.split("/")[3];
    checked.push(company);
    if (company === "dropbox") return new Response(null, { status: 503 });
    return Response.json({ jobs: [data(company)] });
  });
  assert.equal(checked.length, Object.keys(companyBoards).length);
  assert.equal(result.matches.length, checked.length - 3);
  assert.deepEqual(result.unavailable, ["Dropbox"]);
  assert(result.matches.some(group => group.company === "Cloudflare"));
  assert(result.matches.every(group => group.jobs[0].title === "Data Analyst Intern"));
});

test("broad search discovers employers from live feed pages and ranks posting skills", async () => {
  const calls = [];
  const job = id => ({ id, jobTitle: "Financial Analyst", companyName: "Employer " + id,
    jobGeo: "USA", jobLevel: "Entry-level", url: "https://jobicy.com/jobs/" + id + "-financial-analyst",
    jobDescription: id === 18 ? "<p>Skills: Excel and financial modeling.</p>" : "<p>Experience in corporate budget analysis.</p>" });
  const result = await recommendCompanies({ roles: ["Financial Analyst"], skills: ["Excel"], place: "Remote", level: "entry", includeRemote: true }, async input => {
    const url = new URL(input);
    if (url.hostname !== "jobicy.com") return Response.json({ jobs: [] });
    calls.push(url.searchParams.get("cursor"));
    assert.equal(url.searchParams.get("tag"), "financial");
    if (!url.searchParams.has("cursor")) return Response.json({ jobs: Array.from({ length: 10 }, (_, index) => job(index + 1)), nextCursor: "next-page" });
    return Response.json({ jobs: [job(10), ...Array.from({ length: 8 }, (_, index) => job(index + 11)), { ...job(30), jobTitle: "Software Engineer" }] });
  });
  assert.deepEqual(calls, [null, "next-page"]);
  assert.ok(result.checked.includes("Jobicy"));
  assert.equal(result.matches.length, 18);
  assert.equal(result.matches[0].company, "Employer 18");
  const posting = result.matches[0].jobs[0];
  assert.equal(posting.url, job(18).url);
  assert.equal(posting.excerpt, "Skills: Excel and financial modeling.");
  assert.deepEqual(posting.matchedSkills, ["Excel"]);
});

test("a remote job selected for matching is checked by provider ID", async () => {
  const fetcher = async input => {
    const url = new URL(input);
    assert.equal(url.origin + url.pathname, "https://jobicy.com/api/jobs/status");
    assert.equal(url.searchParams.get("ids"), "84");
    return Response.json({ jobs: [{ id: 3, status: "active" }, { id: 84, status: "closed" }] });
  };
  assert.equal(await checkRemoteListing("84", fetcher), "closed");
  await assert.rejects(checkRemoteListing("https://somewhere.invalid/", fetcher), /valid listing/);
});
