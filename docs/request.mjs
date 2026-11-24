import { api } from "./api.mjs";

export function createClassroomRequest() {
  let candidate = null;
  let jobs = [];
  return async function request(path, options) {
    const method = options?.method ?? "GET";
    if (path === "chat") return Response.json({ error: "This classroom edition uses on-device AI." }, { status: 503 });
    if (path === "account") {
      if (method === "GET") return Response.json({ available: "ready", candidate, jobs });
      if (method === "PUT") candidate = JSON.parse(options.body);
      if (method === "DELETE") {
        candidate = null;
        jobs = [];
      }
      return Response.json({ ok: true });
    }
    if (path === "saved-jobs" && method === "POST") {
      const listing = JSON.parse(options.body);
      jobs = [listing, ...jobs.filter(job => job.company !== listing.company || job…5188 tokens truncated…h(calls[1], /gemini-3\.1-flash-lite:generateContent$/);
});

test("Career Chat bounds provider calls during rate limits", async () => {
  let calls = 0;
  const response = await careerChat(chatRequest(), env, async () => {
    calls++;
    return new Response(null, { status: 429 });
  });
  assert.equal(calls, 2);
  assert.equal(response.status, 503);
});

test("Career Chat rejects invalid origins and inputs before calling Gemini", async () => {
  const deny = async () => assert.fail("Unexpected Gemini call");
  assert.equal((await careerChat(chatRequest(undefined, "https://other.example"), env, deny)).status, 403);
  assert.equal((await careerChat(chatRequest({ messages: [{ role: "assistant", text: "Invalid." }] }), env, deny)).status, 400);
  assert.equal((await careerChat(chatRequest(), {}, deny)).status, 503);
});

test("Career Chat returns a primary Gemini answer without calling the backup", async () => {
  let calls = 0;
  const response = await careerChat(chatRequest(), env, async () => {
    calls++;
    return Response.json({ candidates: [{ content: { parts: [{ text: "Describe the tool and what changed." }] } }] });
  });
  assert.equal(calls, 1);
  assert.equal((await response.json()).backup, false);
});
