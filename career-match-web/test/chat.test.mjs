import test from "node:test";
import assert from "node:assert/strict";
import { careerChat } from "../src/chat.mjs";

const origin = "https://example.com";
const env = { LOCAL_SQLITE: true, GEMINI_API_KEY: "test-key" };
const messages = [{ role: "user", text: "How should I write a resume bullet?" }];
const chatRequest = (payload = { messages }, requestOrigin = origin) => new Request(origin + "/api/chat", {
  method: "POST",
  headers: { "content-type": "application/json", origin: requestOrigin },
  body: JSON.stringify(payload),
});

test("Career Chat switches to Gemini 3.1 Flash-Lite when the primary is busy", async () => {
  const calls = [];
  const response = await careerChat(chatRequest(), env, async (url, options) => {
    calls.push(url);
    assert.equal(options.headers["x-goog-api-key"], "test-key");
    assert.equal(JSON.parse(options.body).contents[0].parts[0].text, messages[0].text);
    if (calls.length === 1) return new Response(null, { status: 503 });
    return Response.json({ candidates: [{ content: { parts: [{ text: "Start with your action and include an outcome." }] } }] });
  });
  assert.deepEqual(await response.json(), {
    answer: "Start with your action and include an outcome.",
    model: "gemini-3.1-flash-lite",
    backup: true,
  });
  assert.match(calls[0], /gemini-3\.5-flash-lite:generateContent$/);
  assert.match(calls[1], /gemini-3\.1-flash-lite:generateContent$/);
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
