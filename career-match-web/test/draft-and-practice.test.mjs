import assert from "node:assert/strict";
import test from "node:test";
import { reviewInterviewAnswer } from "../web/career-steps.mjs";
import { draftFromEvidence } from "../web/match-evidence.mjs";

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
