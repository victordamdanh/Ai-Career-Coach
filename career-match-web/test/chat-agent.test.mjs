import test from "node:test";
import assert from "node:assert/strict";
import { createCareerChatAgent } from "../web/chat-agent.mjs";

test("career agent returns actual posting links for a job-search question", async () => {
  const url = "https://job-boards.greenhouse.io/figma/jobs/12345";
  const agent = createCareerChatAgent(async route => {
    const request = new URL("https://example.com/" + route);
    assert.equal(request.pathname, "/recommend");
    assert.equal(request.searchParams.get("role"), "data analyst");
    return { checked: ["Figma"], matches: [{ jobs: [{ title: "Data Analyst", company: "Figma", location: "Remote", url }] }] };
  });
  const result = await agent("Find me data analyst roles");
  assert.equal(result.label, "Live job search");
  assert.deepEqual(result.links[0], { text: "Data Analyst · Figma", href: url });
});

test("career agent can review an uploaded resume, with opt-in context", async () => {
  const agent = createCareerChatAgent(async () => assert.fail("Resume scores use the on-device checklist"));
  assert.match((await agent("Review my resume")).summary, /No resume was included/);
  const answer = await agent("Review my resume", { resume: "Projects\nAnalyzed 130 surveys using SQL and wrote a report.", role: "Data Analyst" });
  assert.match(answer.summary, /Organization \d+\/20/);
  assert.match(answer.summary, /Skills \d+\/20/);
  assert.equal(await agent("How do I answer an interview question?"), null);
});
