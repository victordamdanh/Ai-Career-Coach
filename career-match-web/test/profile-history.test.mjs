import test from "node:test";
import assert from "node:assert/strict";
import { normalizeHistory } from "../web/history-records.mjs";
import { createSupabaseStorage } from "../web/supabase-storage.mjs";
import { attachProfileHistory } from "../web/profile-history.mjs";
import { account } from "../src/account.mjs";
import { localDatabase } from "../scripts/sqlite.mjs";

const record = { id: "5e782288-3918-4e6e-8015-7d40c019af00", kind: "resume", name: "Analyst CV", createdAt: "2026-11-24T12:00:00Z", payload: { text: "I built an analytics dashboard with SQL.", filename: "resume.pdf" } };
const interview = { id: "2667c104-a0b8-4c02-8157-10d8eb38668b", kind: "interview", name: "Analyst practice", createdAt: "2026-11-24T13:00:00Z", payload: { role: "Analyst", company: "Example employer", level: "Entry", sourceUrl: "https://example.invalid/job", resumeName: record.name, resumeId: record.id, score: 80, mode: "AI feedback", criteria: [{ name: "relevance", points: 16 }], feedback: ["Explain the outcome."], turns: [{ question: "Describe a project.", answer: "I built a dashboard." }] } };
const json = (method, data) => ({ method, headers: { "content-type": "application/json" }, body: JSON.stringify(data) });

test("history schema accepts all expected fields and rejects malformed or unsafe records", () => {
  assert.equal(normalizeHistory(record).payload.text, record.payload.text);
  assert.equal(normalizeHistory(interview).payload.resumeId, record.id);
  assert.equal(normalizeHistory({ ...interview, payload: { ...interview.payload, sourceUrl: "javascript:alert(1)" } }).payload.sourceUrl, "");
  assert.throws(() => normalizeHistory({ ...record, name: " " }));
  assert.throws(() => normalizeHistory({ ...interview, payload: { ...interview.payload, score: 101 } }));
});

test("Supabase account history requires sign-in, sends owner-scoped records and loads them after a new sign-in", async () => {
  const owner = "cd36b649-051a-4f66-ae0f-11aa303b41c8", rows = new Map();
  const fetcher = async (input, options) => {
    const url = new URL(input);
    assert.equal(options.headers.apikey, "sb_publishable_test");
    if (url.pathname === "/auth/v1/token") return Response.json({ access_token: "user-token", user: { id: owner } });
    assert.equal(options.headers.Authorization, "Bearer user-token");
    if (url.pathname === "/auth/v1/logout") return new Response(null, { status: 204 });
    if (url.pathname === "/rest/v1/rpc/clear_career_account") { rows.clear(); return new Response(null, { status: 204 }); }
    if (url.pathname === "/rest/v1/career_history_records") {
      if (options.method === "POST") {
        const value = JSON.parse(options.body);
        assert.equal(value.user_id, owner); assert.equal(url.searchParams.get("on_conflict"), "user_id,record_id");
        rows.set(value.record_id, value); return new Response(null, { status: 201 });
      }
      assert.equal(url.searchParams.get("user_id"), "eq." + owner);
      if (options.method === "DELETE") { rows.delete(url.searchParams.get("record_id").slice(3)); return new Response(null, { status: 204 }); }
      return Response.json([...rows.values()]);
    }
    return Response.json([]);
  };
  const config = { url: "https://test.example.invalid", key: "sb_publishable_test" };
  const storage = createSupabaseStorage(config, fetcher);
  assert.equal((await (await storage.request("account")).json()).available, "sign-in");
  assert.equal((await storage.request("history", json("POST", record))).status, 401);
  assert.equal(await storage.signIn("test@example.invalid", "test-password"), true);
  assert.equal((await storage.request("history", json("POST", record))).status, 200);
  assert.equal((await storage.request("history", json("POST", interview))).status, 200);
  await storage.signOut();
  const restored = createSupabaseStorage(config, fetcher);
  await restored.signIn("test@example.invalid", "test-password");
  assert.equal((await (await restored.request("history")).json()).records.length, 2);
  assert.equal((await restored.request("history", json("DELETE", { id: record.id }))).status, 200);
  const remaining = (await (await restored.request("history")).json()).records;
  assert.equal(remaining.length, 1); assert.equal(remaining[0].payload.resumeName, record.name);
  await restored.request("account", { method: "DELETE" });
  assert.equal((await (await restored.request("history")).json()).records.length, 0);
});

test("SQLite history uses owner boundaries and clears all user records", async () => {
  const DB = localDatabase(":memory:");
  const origin = "https://example.invalid";
  const access = (path, method, owner, data) => account(new Request(origin + "/api/" + path, {
    method, headers: { origin, "content-type": "application/json", "oai-authenticated-user-id": owner }, ...(data ? { body: JSON.stringify(data) } : {}),
  }), { DB });
  async function list(owner) { return (await (await access("history", "GET", owner)).json()).records; }
  assert.equal((await access("history", "POST", "one", record)).status, 200);
  assert.equal((await access("history", "POST", "one", interview)).status, 200);
  assert.deepEqual(await list("two"), []);
  assert.equal((await access("history", "DELETE", "two", { id: record.id })).status, 200);
  assert.equal((await list("one")).length, 2);
  await access("history", "DELETE", "one", { id: record.id });
  assert.equal((await list("one"))[0].id, interview.id);
  await access("account", "DELETE", "one");
  assert.deepEqual(await list("one"), []);
});

test("history UI names, saves, displays and deletes both uploaded text and interview records", async t => {
  const previous = globalThis.window;
  globalThis.window = { confirm: () => true };
  t.after(() => { if (previous) globalThis.window = previous; else delete globalThis.window; });
  const nodes = new Map(), rows = new Map();
  function el(tag, textContent, className) { return { tag, textContent, className, value: "", children: [], disabled: false, events: {}, append(...nodes) { this.children.push(...nodes); }, replaceChildren(...nodes) { this.children = nodes; }, addEventListener(name, fn) { this.events[name] = fn; } }; }
  const $ = id => { if (!nodes.has(id)) nodes.set(id, el(id)); return nodes.get(id); };
  let resume = record.payload;
  const find = (node, label) => node.textContent === label ? node : node.children.map(child => find(child, label)).find(Boolean);
  const history = attachProfileHistory({ $, el, status() {}, json, officialLink: (url, name) => el("a", name),
    getResume: () => resume, loadResume: item => { resume = item.payload; return true; },
    request: async (_path, options) => {
      if (!options) return { records: [...rows.values()] };
      const data = JSON.parse(options.body);
      if (options.method === "POST") rows.set(data.id, data); else rows.delete(data.id);
      return { ok: true };
    },
  });
  await history.setAccount({ available: "sign-in" });
  assert.equal($("history-panel").hidden, true);
  await history.setAccount({ available: "ready" });
  $("history-resume-name").value = record.name;
  await $("save-resume-record").events.click();
  assert.ok(find($("resume-history"), record.name));
  assert.equal(history.resumeReference().resumeName, record.name);
  history.addInterview({ ...interview.payload, createdAt: interview.createdAt }, history.resumeReference());
  await find($("pending-interviews"), "Save interview").events.click();
  assert.ok(find($("interview-history"), "Analyst · Example employer"));
  assert.equal(rows.size, 2);
  await find($("resume-history"), "Delete").events.click();
  assert.equal(rows.size, 1);
  await find($("interview-history"), "Delete").events.click();
  assert.equal(rows.size, 0);
});
