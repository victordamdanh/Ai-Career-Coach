import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createAgent } from "../web/agent.mjs";
import { createApplicationQueue, applicationKey } from "../web/guided.mjs";
import { applicationEvidence, draftFromEvidence, resumeContact } from "../web/match-evidence.mjs";
import { resumeExcerpt, resumeLimit, resumeProfile } from "../web/resume-review.mjs";
import { automaticPreferences, departmentChoices, rankDepartmentRoles, stateName } from "../web/automatic-preferences.mjs";
import { states } from "../web/job-preferences.mjs";
import { attachCareerSteps } from "../web/career-steps.mjs";
import { canNavigateWorkflow } from "../web/workflow.mjs";

test("guided draft opens even for zero matched evidence and preserves edits between jobs and match retries", async t => {
  const nodes = new Map();
  const node = (tag, text = "") => ({
    tag, textContent: text, value: "", children: [], dataset: {}, hidden: false, disabled: false, open: false, events: {},
    classList: { toggle() {}, add() {}, remove() {} },
    addEventListener(name, handler) { (this.events[name] ??= []).push(handler); },
    dispatchEvent(event) { for (const handler of this.events[event.type] || []) handler({ ...event, currentTarget: this, preventDefault() {} }); },
    click() { this.dispatchEvent({ type: "click" }); },
    append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
    querySelectorAll() { return []; }, querySelector() { return node("heading", this.dataset.page); },
    setAttribute() {}, removeAttribute() {}, setCustomValidity() {}, reportValidity() {}, focus() {},
    showModal() { this.open = true; }, close() { this.open = false; },
  });
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, node(id));
    return nodes.get(id);
  };
  const pages = ["upload","preferences","review","jobs","match","application","inbox","interview","chat","profile"].map(page => ({ ...node("section"), dataset: { page } }));
  let hash = "#upload";
  const eventHandlers = {};
  const location = { get hash() { return hash; }, set hash(value) { hash = value.startsWith("#") ? value : "#" + value; queueMicrotask(() => eventHandlers.hashchange?.()); }, get href() { return "https://example.invalid/" + hash; } };
  const window = { location, history: { state: {}, replaceState(state) { this.state = state; } },
    addEventListener(name, callback) { eventHandlers[name] = callback; }, scrollTo() {} };
  const document = { getElementById: $, querySelector: selector => $(selector), querySelectorAll: () => pages, createElement: node };

  const resumeText = "Alex Morgan\nalex@example.invalid\n(520) 555-0199\nEducation\nBuilt SQL dashboards and analyzed 100 records.\nDeveloped a Python reporting tool.";
  const posting = { id: 10, companyId: "fixture", company: "First Company", title: "Data Analyst", url: "https://example.invalid/job/10", location: "Phoenix, AZ", arrangement: "Hybrid", excerpt: "Required qualifications\nExperience in aerospace manufacturing and aircraft certification.", description: "Experience in aerospace manufacturing and aircraft certification." };
  let scoreAvailable = true;
  let scoreCalls = 0;
  let copied;
  let resolveRefinement;
  const navigator = { clipboard: { writeText: async text => { copied = text; } } };
  const fetch = async (input, options = {}) => {
    const url = new URL(input, "https://example.invalid/");
    if (url.pathname.endsWith("/recommend")) return Response.json({ matches: [{company:posting.company,total:1,jobs:[posting]}], checked:["Fixture"], unavailable:[], relaxed:[] });
    if (url.pathname.endsWith("/listing")) return Response.json(posting);
    if (url.pathname.endsWith("/score")) {
      scoreCalls++;
      if (!scoreAvailable) return Response.json({error:"Score temporarily unavailable"}, {status:503});
      const rows = JSON.parse(options.body);
      return Response.json({score:0,earned:0,possible:rows.length * 2,categories:[{category:"skills",rate:0,count:rows.length}]});
    }
    if (url.pathname.endsWith("/account")) return Response.json({available:"ready",candidate:null,jobs:[]});
    if (url.pathname.endsWith("/dataset")) return Response.json({jobs:[]});
    return Response.json({});
  };
  const globalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  t.after(() => globalWindow ? Object.defineProperty(globalThis, "window", globalWindow) : delete globalThis.window);
  const noop = () => {};
  const browserModel = async () => async (_system, prompt) => {
    if (prompt.includes("Select exactly one")) return '{"role":"Data Analyst"}';
    if (prompt.includes("Choose up to three distinct excerpt IDs")) return new Promise(resolve => { resolveRefinement = resolve; });
    return "Strength: SQL dashboards. Clarify results.";
  };
  const bindings = { window, document, fetch, navigator, browserModel, createAgent, attachCareerSteps, resumeExcerpt, resumeLimit, resumeProfile,
    attachChat: noop, attachInbox: noop, attachRecruiterEmail: noop, applicationKey, createApplicationQueue,
    canNavigateWorkflow, attachPreferencePickers: noop, draftFromEvidence, applicationEvidence, resumeContact, automaticPreferences,
    departmentChoices, rankDepartmentRoles, stateName, states };
  const source = await readFile(new URL("../web/app.mjs", import.meta.url), "utf8");
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  const app = await new AsyncFunction(...Object.keys(bindings), source.replace(/^import .*\n/gm, "") + "\nreturn {chooseListing, compareResume, prepareCurrentDraft};")(...Object.values(bindings));
  $("resume").value = resumeText;
  $("resume").dispatchEvent({ type:"input" });
  $("start-ai").click();
  $("ai-relocation").value = "stay";
  $("ai-relocation").dispatchEvent({ type:"change" });
  $("ai-work").value = "Hybrid";
  $("ai-state").value = "AZ";
  $("ai-department").value = "tech";
  $("ai-years").value = "2";
  $("ai-setup-form").dispatchEvent({type:"submit"});
  for(let i=0; i<150 && location.hash !== "#application"; i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(location.hash, "#application");
  assert.match($("draft").value,/Data Analyst opening at First Company/);
  assert.match($("draft").value,/SQL dashboards|Python reporting/);
  assert.match($("draft").value,/Best,\nAlex Morgan$/);
  assert.match($("draft-status").textContent,/No aligned excerpts/);
  assert.equal($("draft-email").value,"alex@example.invalid");
  assert.equal($("draft-button").disabled,false);
  $("packet").click();
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal(JSON.parse(copied).email,"alex@example.invalid");
  assert.equal(JSON.parse(copied).firstName,"Alex");
  const pendingRefinement = app.prepareCurrentDraft({ force:true, refine:true });
  for (let i=0;i<100 && !resolveRefinement;i++) await new Promise(resolve=>setImmediate(resolve));
  assert.ok(resolveRefinement, "the optional model is running after the draft appears");
  assert.match($("draft").value,/First Company/);
  const edited = $("draft").value + "\nMy reviewed addition.";
  $("draft").value=edited;
  $("draft").dispatchEvent({type:"input"});
  resolveRefinement('{"ids":[2]}');
  await pendingRefinement;
  assert.equal($("draft").value,edited,"late AI output does not overwrite user edits");
  location.hash="#match";
  await new Promise(resolve=>setImmediate(resolve));
  const prior = scoreCalls;
  app.compareResume(false);
  for(let i=0;i<100 && (scoreCalls===prior || $("quick-match").disabled);i++) await new Promise(resolve=>setImmediate(resolve));
  location.hash="#application";
  await new Promise(resolve=>setImmediate(resolve));
  assert.equal($("draft").value,edited,"rerunning the same match keeps user edits");
  const second = {...posting,id:11,company:"Second Company",url:"https://example.invalid/job/11"};
  app.chooseListing(second,undefined,"application");
  await new Promise(resolve=>setImmediate(resolve));
  await app.prepareCurrentDraft();
  assert.match($("draft").value,/Second Company/);
  assert.doesNotMatch($("draft").value,/My reviewed addition/);
  app.chooseListing(posting,undefined,"application");
  await new Promise(resolve=>setImmediate(resolve));
  await app.prepareCurrentDraft();
  assert.equal($("draft").value,edited,"returning to the original posting restores its edits");

  // A scoring outage does not prevent preparation for a verified live posting.
  scoreAvailable=false;
  $("resume").value=resumeText+"\nVolunteered at a university event.";
  $("resume").dispatchEvent({type:"input"});
  location.hash="#upload";
  await new Promise(resolve=>setImmediate(resolve));
  $("start-ai").click();
  $("ai-setup-form").dispatchEvent({type:"submit"});
  for(let i=0;i<150 && location.hash!=="#application";i++) await new Promise(resolve=>setImmediate(resolve));
  assert.equal(location.hash,"#application");
  assert.match($("automatic-draft-summary").textContent,/Match score unavailable/);
  assert.match($("draft").value,/First Company/);
  assert.match($("draft-status").textContent,/Run Job Match/);
});
