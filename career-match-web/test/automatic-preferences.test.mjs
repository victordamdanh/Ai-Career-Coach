import test from "node:test";
import assert from "node:assert/strict";
import { automaticPreferences, rankDepartmentRoles, stateName } from "../web/automatic-preferences.mjs";
import { listingWorkArrangement, matchesSearchLocation, matchesSearchLevel } from "../web/job-preferences.mjs";
import { recommendCompanies, fetchListings } from "../src/listings.mjs";
import { attachCareerSteps } from "../web/career-steps.mjs";

test("AI preferences fill every field using the selected department, resume and experience", () => {
  const resume = "MIS student. Built SQL dashboards with Excel, Tableau and Power BI. Completed data analysis projects.";
  const base = { work: "Hybrid", relocation: "stay", state: "az", department: "tech", years: 0 };
  const entry = automaticPreferences(resume, base, "Recruiter");
  assert.equal(entry.role, "Data Analyst");
  assert.equal(entry.place, "Arizona");
  assert.equal(entry.work, "Hybrid");
  assert.equal(entry.level, "Entry level");
  assert.match(entry.pay, /\$[\d,]+–\$[\d,]+/);
  assert.match(entry.description, /Data Analyst.*Role focus: sql/);
  assert.ok(entry.evidence.includes("sql"));
  assert.ok(!entry.roles.includes("Recruiter"));
  const senior = automaticPreferences(resume, { ...base, work: "Remote", relocation: "relocate", department: "hr", years: 7 });
  assert.equal(senior.place, "Any location");
  assert.equal(senior.level, "Senior");
  assert.equal(senior.work, "Remote");
  assert.notEqual(senior.pay, entry.pay);
  assert.equal(senior.role, "HR Coordinator");
  assert.equal(stateName("new york"), "New York");
  assert.throws(() => automaticPreferences(resume, { ...base, state: "invalid" }), /valid state/);
  assert.equal(rankDepartmentRoles(resume, "invalid").length, 0);
});

test("work arrangement and nationwide remote eligibility follow explicit posting evidence", () => {
  assert.equal(listingWorkArrangement({ location: "New York, NY (hybrid)", title: "Analyst" }), "Hybrid");
  assert.equal(listingWorkArrangement({ location: "Phoenix, AZ", title: "Analyst", workplace: "On-site" }), "In-person");
  assert.equal(listingWorkArrangement({ location: "Phoenix, AZ", title: "Analyst" }), "");
  assert.equal(listingWorkArrangement({ location: "Phoenix, AZ", title: "Analyst", description: "This role is a hybrid position." }), "Hybrid");
  assert.equal(listingWorkArrangement({ location: "United States (not remote)", title: "Analyst" }), "");
  assert.ok(matchesSearchLocation("Arizona", { location: "Remote · United States" }, "Remote"));
  assert.ok(!matchesSearchLocation("Arizona", { location: "Remote · California, United States" }, "Remote"));
  assert.ok(!matchesSearchLocation("Arizona", { location: "Remote · Canada" }, "Remote"));
  assert.ok(!matchesSearchLocation("Arizona", { location: "Remote" }, "Remote"));
  assert.ok(matchesSearchLevel("Mid-level", { title: "Data Analyst", description: "3+ years of professional experience in analysis." }, true));
  assert.ok(!matchesSearchLevel("Entry level", { title: "Senior Data Analyst", description: "2 years of experience." }, true));
});

test("guided search does not widen work, state, level or related department titles", async () => {
  const make = (id, title, location, content = "<p>Analyze data and prepare reports.</p>") => ({
    id, title, location: { name: location },
    absolute_url: "https://job-boards.greenhouse.io/cloudflare/jobs/" + id, content,
  });
  const entries = [
    make(1, "Junior Data Analyst", "Phoenix, AZ (Hybrid)"),
    make(2, "Junior Data Analyst", "San Francisco, CA (Hybrid)"),
    make(3, "Junior Data Analyst", "Remote, United States"),
    make(4, "Junior Data Analyst", "Phoenix, AZ (On-site)"),
    make(5, "Senior Data Analyst", "Phoenix, AZ (Hybrid)"),
    make(6, "Junior Business Analyst", "Phoenix, AZ (Hybrid)"),
    make(7, "Data Analyst", "Phoenix, AZ", "<p>This role is a hybrid position. Two weeks of training. 2 years of experience.</p>"),
    make(8, "Junior Data Analyst", "Remote, CA, United States"),
    make(9, "Junior Data Analyst", "Phoenix, AZ"),
  ];
  const fetcher = async input => Response.json({ jobs: new URL(input).pathname.includes("/cloudflare/") ? entries : [] });
  const input = { roles: ["Data Analyst"], place: "Arizona", level: "Entry level", strict: true, includeRemote: false };
  const ids = result => result.matches.flatMap(group => group.jobs.map(job => job.id)).sort((a,b) => a-b);
  const hybrid = await recommendCompanies({ ...input, work: "Hybrid" }, fetcher);
  assert.deepEqual(ids(hybrid), [1, 7]);
  assert.deepEqual(hybrid.relaxed, []);
  assert.deepEqual(ids(await recommendCompanies({ ...input, work: "Remote" }, fetcher)), [3]);
  assert.deepEqual(ids(await recommendCompanies({ ...input, work: "In-person" }, fetcher)), [4]);
  const none = await recommendCompanies({ ...input, place: "Nevada", work: "Hybrid" }, fetcher);
  assert.deepEqual(none.matches, []);
  assert.deepEqual(none.relaxed, []);
  const any = await recommendCompanies({ ...input, place: "Any location", work: "Hybrid" }, fetcher);
  assert.deepEqual(ids(any), [1, 2, 7]);
  const company = await fetchListings("cloudflare", "Data Analyst", fetcher, { place: "Arizona", work: "Hybrid", level: "Entry level" });
  assert.deepEqual(company.jobs.map(job => job.id).sort((a,b) => a-b), [1,7]);
});

test("automatic review returns all five scores and AI feedback (or a labeled fallback)", async t => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {} });
  t.after(() => original ? Object.defineProperty(globalThis, "window", original) : delete globalThis.window);
  const nodes = new Map();
  const el = (tag, text = "") => ({
    tag, textContent: text, value: "", children: [], dataset: {}, disabled: false,
    addEventListener() {}, append(...children) { this.children.push(...children); },
    replaceChildren(...children) { this.children = children; },
  });
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, el(id));
    return nodes.get(id);
  };
  $("resume").value = "Education: MIS. Analyzed 100 records with SQL and built dashboards in Tableau.";
  $("role").value = "Data Analyst";
  let unavailable = false;
  let report;
  const { reviewResumeWithAI } = attachCareerSteps({
    $, el, status: (id, message) => { $(id).textContent = message; },
    browserModel: async () => {
      if (unavailable) throw Error("No WebGPU");
      return async () => "Strength: SQL dashboard work. Improvements: clarify the outcome and show impact.";
    },
    onReview(value) { report = value; },
  });
  await reviewResumeWithAI();
  assert.equal(report.criteria.length, 5);
  assert.match($("resume-analysis").children[0].textContent, /\/100/);
  assert.equal($("review-ai-result").children[0].textContent, "AI feedback");
  unavailable = true;
  await reviewResumeWithAI();
  assert.equal($("review-ai-result").children[0].textContent, "Checklist feedback");
  assert.equal(report.criteria.length, 5);
});

import { readFile } from "node:fs/promises";
import { resumeExcerpt, resumeProfile, resumeLimit } from "../web/resume-review.mjs";
import { departmentChoices } from "../web/automatic-preferences.mjs";
import { states } from "../web/job-preferences.mjs";
import { canNavigateWorkflow } from "../web/workflow.mjs";

test("Start with AI opens the setup and only starts a strict review/search after submission", async t => {
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
  let searchParams;
  const fetch = async input => {
    const url = new URL(input, "https://example.invalid/");
    if (url.pathname.endsWith("/recommend")) { searchParams = url.searchParams; return Response.json({ matches: [], checked: ["Fixture"], unavailable: [], relaxed: [] }); }
    if (url.pathname.endsWith("/account")) return Response.json({ available: "ready", candidate: null, jobs: [] });
    if (url.pathname.endsWith("/dataset")) return Response.json({ jobs: [] });
    return Response.json({});
  };
  const globalWindow = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: window });
  t.after(() => globalWindow ? Object.defineProperty(globalThis, "window", globalWindow) : delete globalThis.window);
  const noop = () => {};
  const browserModel = async () => async (_system, prompt) => prompt.includes('Select exactly one') ? '{"role":"Data Analyst"}' : "Strength: SQL dashboards. Improve: clarify results and quantify scope.";
  const bindings = { window, document, fetch, browserModel, createAgent: noop, attachCareerSteps, resumeExcerpt, resumeLimit, resumeProfile,
    attachChat: noop, attachInbox: noop, attachRecruiterEmail: noop, applicationKey: noop,
    createApplicationQueue: () => ({ clear: noop, update: noop, selectionControl: noop, trackedJobs: () => [], prepareAutomatic: async () => [] }),
    canNavigateWorkflow, attachPreferencePickers: noop, draftFromEvidence: noop, automaticPreferences,
    departmentChoices, rankDepartmentRoles, stateName, states };
  const source = await readFile(new URL("../web/app.mjs", import.meta.url), "utf8");
  const AsyncFunction = Object.getPrototypeOf(async function() {}).constructor;
  await new AsyncFunction(...Object.keys(bindings), source.replace(/^import .*\n/gm, ""))(...Object.values(bindings));
  $("resume").value = "Education: MIS. Built SQL dashboards with Excel, Tableau and Power BI. Analyzed records.";
  $("resume").dispatchEvent({ type: "input" });
  assert.equal($("start-ai").disabled, false);
  $("start-ai").click();
  assert.equal($("ai-setup").open, true);
  assert.equal(searchParams, undefined);
  $("ai-relocation").value = "stay";
  $("ai-relocation").dispatchEvent({ type: "change" });
  assert.equal($("ai-state-field").hidden, false);
  assert.equal($("ai-state").required, true);
  $("ai-work").value = "Hybrid";
  $("ai-state").value = "AZ";
  $("ai-department").value = "tech";
  $("ai-years").value = "2";
  $("ai-setup-form").dispatchEvent({ type: "submit" });
  for (let i = 0; i < 70 && location.hash !== "#jobs"; i++) await new Promise(resolve => setImmediate(resolve));
  assert.equal($("ai-setup").open, false);
  assert.equal($("role").value, "Data Analyst");
  assert.equal($("place").value, "Arizona");
  assert.equal($("work").value, "Hybrid");
  assert.equal($("level").value, "Entry level");
  assert.ok($("target-description").value.includes("Role focus"));
  assert.ok($("pay").value.includes("$"));
  assert.match($("resume-analysis").children[0].textContent, /\/100/);
  assert.equal($("review-ai-result").children[0].textContent, "AI feedback");
  assert.equal(searchParams.get("work"), "Hybrid");
  assert.equal(searchParams.get("place"), "Arizona");
  assert.equal(searchParams.get("strict"), "1");
  assert.ok(searchParams.getAll("role").includes("data analyst"));
  assert.equal(location.hash, "#jobs");
});
