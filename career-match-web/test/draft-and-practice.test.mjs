import assert from "node:assert/strict";
import test from "node:test";
import { reviewInterviewAnswer } from "../web/career-steps.mjs";
import { applicationEvidence, draftFromEvidence, resumeContact } from "../web/match-evidence.mjs";
import { applicationMessage } from "../web/inbox.mjs";

test("the cover note can only copy verified resume excerpts", () => {
  const inputs = { title: "Data Engineer", company: "Example Employer", excerpts: ["Built SQL reports.", "Automated Python pipelines."] };
  const selected = draftFromEvidence(inputs, [2, 2, 3, "Invented Fivetran experience"]);
  assert.match(selected, /Data Engineer opening at Example Employer/);
  assert.equal(selected.match(/Automated Python pipelines\./g).length, 1);
  assert.doesNotMatch(selected, /Fivetran|Built SQL reports/);
  assert.match(draftFromEvidence(inputs, { draft: "Invented experience" }), /Built SQL reports/);
});

test("incomplete interview model output still yields five checklist scores and actionable feedback", () => {
  const question = "Describe how you improved a slow dashboard.";
  const answer = "During an analytics project, I tested SQL queries and added a filter. The change reduced dashboard load time by 30 percent.";
  for (const response of [undefined, { scores: { result: 25 }, feedback: [] }]) {
    const result = reviewInterviewAnswer(question, answer, response);
    assert.equal(result.mode, "Checklist feedback");
    assert.deepEqual(result.criteria.map(({ name }) => name), ["relevance", "specificity", "structure", "action", "result"]);
    assert.equal(result.feedback.length, 3);
    assert.ok(result.criteria.every(({ points }) => Number.isInteger(points) && points >= 0 && points <= 20));
  }
  const ai = reviewInterviewAnswer(question, answer, {
    scores: { relevance: 15, specificity: 16, structure: 17, action: 18, result: 19 },
    feedback: ["Name the filter.", "Describe your test.", "State the timing baseline."],
  });
  assert.equal(ai.mode, "AI feedback");
  assert.equal(ai.criteria.reduce((total, { points }) => total + points, 0), 85);
});

test("drafts fall back to actual resume content when the job match has no aligned excerpts", () => {
  const resume = "Alex Morgan\nhello@example.invalid\n(520) 555-0199\nEducation\nBuilt SQL dashboards and analyzed 100 records.\nDeveloped a Python reporting tool.";
  const report = { rows: [{ status: "gap", evidence: "" }, { status: "match", evidence: "Invented aerospace degree." }] };
  const evidence = applicationEvidence(report, resume, "Data Analyst SQL reporting");
  assert.equal(evidence.source, "resume");
  assert.ok(evidence.excerpts.some(line => line.includes("SQL dashboards")));
  assert.ok(evidence.excerpts.every(line => resume.includes(line)));
  assert.ok(!evidence.excerpts.some(line => line.includes("@")));
  const contacts = resumeContact(resume);
  assert.deepEqual(contacts, { name: "Alex Morgan", email: "hello@example.invalid", phone: "(520) 555-0199" });
  assert.equal(resumeContact("Business Analyst\nhello@example.invalid").name, "");
  const draft = draftFromEvidence({ title: "Data Analyst", company: "Example", excerpts: evidence.excerpts, name: contacts.name });
  assert.match(draft, /Best,\nAlex Morgan$/);
  assert.doesNotMatch(draft, /Invented|hello@example/);
  const neutral = draftFromEvidence({ title: "Data Analyst", company: "Example", excerpts: [], name: "" });
  assert.match(neutral, /discuss my background/);
  assert.doesNotMatch(neutral, /Here are examples|•/);
});

test("email MIME preparation rejects an unresolved applicant-name placeholder", async () => {
  const inputs = { address: "recruiter@example.invalid", subject: "Application", draft: "Best,\n[Your name]", file: new File(["resume"], "resume.txt") };
  await assert.rejects(applicationMessage(inputs, "career-fixture"), /Enter your name/);
  const valid = await applicationMessage({ ...inputs, draft: "Best,\nAlex Morgan" }, "career-fixture");
  assert.equal(typeof valid, "string");
  assert.ok(valid.length > 100);
});
