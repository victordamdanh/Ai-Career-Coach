import test from "node:test";
import assert from "node:assert/strict";
import { companyBoards, recommendCompanies } from "../src/listings.mjs";
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
