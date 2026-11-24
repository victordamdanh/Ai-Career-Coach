import assert from "node:assert/strict";
import test from "node:test";
import { sourceExcerpts } from "../web/match-evidence.mjs";

test("section headings and benefits are not compared as qualifications or evidence", () => {
  const job = "Experience: \n\n1+ year of experience in an in-person customer service role like retail\n\nBenefits:\n\nGreat medical, dental, and vision insurance options";
  const resume = "PROFESSIONAL SUMMARY\nMotivated business student seeking an entry-level operations role.\nWORK EXPERIENCE\n- Resolved customer issues in a busy retail environment.";
  const { job: posting, resume: evidence } = sourceExcerpts(resume, job);
  assert.deepEqual(posting.map(entry => entry.text), ["1+ year of experience in an in-person customer service role like retail"]);
  assert(evidence.every(entry => !/^(?:PROFESSIONAL SUMMARY|WORK EXPERIENCE)$/.test(entry.text)));
  assert.equal(evidence.length, 2);
});
