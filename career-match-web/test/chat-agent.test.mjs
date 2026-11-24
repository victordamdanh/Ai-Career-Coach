import test from "node:test";
import assert from "node:assert/strict";
import { createCareerChatAgent } from "../web/chat-agent.mjs";
import { attachChat } from "../web/chat.mjs";

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

test("Career Chat answers a live job lookup directly with official links", async () => {
  const elements = new Map();
  const make = (tag, text, className) => ({
    tag, text, className, children: [], events: {},
    append(...children) { this.children.push(...children); },
    addEventListener(name, handler) { this.events[name] = handler; },
  });
  const field = id => {
    if (!elements.has(id)) elements.set(id, make(id));
    return elements.get(id);
  };
  const url = "https://job-boards.greenhouse.io/figma/jobs/12345";
  attachChat({
    $: field,
    status: () => {},
    el: make,
    onDeviceOnly: false,
    officialLink: (href, title) => ({ href, title }),
    browserModel: () => assert.fail("A live lookup should render without calling a language model"),
    request: async route => {
      assert.match(route, /^recommend\?/);
      return { checked: ["Figma"], matches: [{ jobs: [{ title: "Data Analyst", company: "Figma", location: "Remote", url }] }] };
    },
  });
  field("chat-input").value = "Find me data analyst jobs";
  await field("chat-form").events.submit({ preventDefault() {} });
  const [question, answer] = field("chat-history").children;
  assert.equal(question.className, "chat-message user");
  assert.equal(answer.className, "chat-message assistant");
  assert.match(answer.children[1].text, /Data Analyst at Figma/);
  assert.equal(answer.children[2].children[0].children[0].href, url);
  assert.equal(field("chat-submit").disabled, false);
});

test("Career Chat links to the next incomplete or explicitly requested workflow step", async () => {
  const agent = createCareerChatAgent(async () => assert.fail("Workflow guidance uses the shared step order"));
  const progress = { active: "chat", completed: ["upload", "preferences", "review", "chat"] };
  const next = await agent("What should I do next?", undefined, progress);
  assert.equal(next.direct, true);
  assert.deepEqual(next.links, [{ text: "Open Find Jobs", href: "#jobs" }]);
  assert.match(next.summary, /connected company boards/);
  const explicit = await agent("What comes after Interview Inbox?", undefined, progress);
  assert.equal(explicit.links[0].href, "#interview");
  const overview = await agent("Show the career flow", undefined, progress);
  assert.match(overview.summary, /Resume → Preferences → Resume Review → Find Jobs → Job Match → Application Draft → Interview Inbox → Interview Practice → Career Chat → Saved Profile and Jobs/);
});
