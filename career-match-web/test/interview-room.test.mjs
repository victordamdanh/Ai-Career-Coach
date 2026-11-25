import test from "node:test";
import assert from "node:assert/strict";
import { attachInterview } from "../web/interview.mjs";
import { reviewInterviewAnswer } from "../web/career-steps.mjs";

async function settle() {
  for (let count = 0; count < 30; count++) await Promise.resolve();
}

function setup(t, { modelUnavailable = false, cameraPromise } = {}) {
  const nodes = new Map();
  const timers = new Map();
  const speech = [];
  const listeners = [];
  let stopped = 0;
  let timerId = 0;
  const el = (tag, text) => ({
    tag, textContent: text || "", children: [], open: false, hidden: false, dataset: {}, events: {},
    addEventListener(name, callback) { this.events[name] = callback; },
    click() { return this.events.click?.(); },
    append(...items) { this.children.push(...items); },
    replaceChildren(...items) { this.children = items; },
    showModal() { this.open = true; },
    close() { this.open = false; },
    focus() {},
    closest() { return { hidden: false }; },
  });
  const $ = id => {
    if (!nodes.has(id)) nodes.set(id, el(id));
    return nodes.get(id);
  };
  const stream = { getTracks: () => [{ stop() { stopped++; } }] };

  class Recognition {
    constructor() { listeners.push(this); }
    start() { this.onstart?.(); }
    stop() { this.onend?.(); }
    abort() { this.onend?.(); }
    result(text) { this.onresult?.({ results: [[{ transcript: text }]] }); }
  }

  // Keep browser permissions and timing independent of the developer's devices.
  const fixtures = {
    window: {
      SpeechRecognition: Recognition,
      SpeechSynthesisUtterance: class { constructor(text) { this.text = text; } },
      speechSynthesis: { speak(utterance) { speech.push(utterance); utterance.onstart?.(); }, cancel() {} },
      setTimeout(callback, milliseconds) { const id = ++timerId; timers.set(id, { callback, milliseconds }); return id; },
      clearTimeout(id) { timers.delete(id); },
    },
    navigator: { mediaDevices: { getUserMedia: () => cameraPromise || Promise.resolve(stream) } },
  };
  for (const [name, value] of Object.entries(fixtures)) {
    const original = Object.getOwnPropertyDescriptor(globalThis, name);
    Object.defineProperty(globalThis, name, { configurable: true, writable: true, value });
    t.after(() => {
      if (original) Object.defineProperty(globalThis, name, original);
      else delete globalThis[name];
    });
  }

  const generate = async (_system, prompt, input) => prompt.includes("Evaluate the interview")
    ? JSON.stringify({ scores: { relevance: 19, specificity: 17, structure: 16, action: 18, result: 15 },
      feedback: ["Strong example.", "Add context.", "Describe the result."] })
    : JSON.stringify({ question: "Follow-up on " + input.previous.answer.slice(0, 45) });
  generate.warmup = async () => {};
  const stop = attachInterview({
    $, el, status: (id, text) => { $(id).textContent = text; },
    browserModel: async () => {
      if (modelUnavailable) throw new Error("No WebGPU");
      return generate;
    },
    getInterviewContext: () => ({ role: "Data Analyst" }),
    reviewAnswer: reviewInterviewAnswer,
  });

  function silence() {
    const timer = [...timers].find(([, item]) => item.milliseconds === 4200);
    assert.ok(timer, "automatic answer timer");
    timers.delete(timer[0]);
    timer[1].callback();
  }
  return { $, stop, stream, speech, listeners, silence, stopped: () => stopped };
}

test("three spoken answers automatically open and close the room and generate feedback", async t => {
  const room = setup(t);
  room.$("make-question").click();
  await settle();
  assert.equal(room.$("interview-room").open, true);
  assert.equal(room.$("camera").hidden, false);
  assert.match(room.speech[0].text, /Data Analyst/);
  assert.equal(room.listeners.length, 0);
  for (const answer of ["I used SQL to analyze customer data.", "I tested the dashboard with my team.", "I improved processing by 25 percent."]) {
    room.speech.at(-1).onend();
    room.listeners.at(-1).result(answer);
    room.silence();
    await settle();
  }
  assert.equal(room.speech.length, 3);
  assert.equal(room.$("interview-room").open, false);
  assert.equal(room.stopped(), 1);
  assert.match(room.$("feedback-result").children[0].textContent, /85\/100/);
});

test("pause retains the transcript and end produces feedback when the model is unavailable", async t => {
  const room = setup(t, { modelUnavailable: true });
  room.$("make-question").click();
  await settle();
  room.speech.at(-1).onend();
  room.listeners.at(-1).result("I created a report using SQL.");
  room.$("pause-interview").click();
  assert.equal(room.$("camera").hidden, true);
  assert.equal(room.$("voice-indicator").textContent, "Microphone off");
  assert.match(room.$("interview-transcript").textContent, /SQL/);
  room.$("pause-interview").click();
  await settle();
  assert.equal(room.listeners.length, 2);
  room.listeners.at(-1).result("It helped my team.");
  await room.$("end-interview").click();
  assert.equal(room.$("interview-room").open, false);
  assert.match(room.$("feedback-result").children[1].textContent, /Checklist feedback/);
});

test("a late camera stream is released if the interview was paused during permission", async t => {
  let release;
  const cameraPromise = new Promise(resolve => { release = resolve; });
  const room = setup(t, { cameraPromise });
  room.$("make-question").click();
  room.$("pause-interview").click();
  release(room.stream);
  await settle();
  assert.equal(room.stopped(), 1);
  assert.equal(room.$("camera").hidden, true);
  room.stop();
  assert.equal(room.$("interview-room").open, false);
});
