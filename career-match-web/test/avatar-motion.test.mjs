import test from "node:test";
import assert from "node:assert/strict";
import { blinkFrame, createAvatarMotion, EYE_FRAMES, MOUTH_FRAMES, speechMouthWeight } from "../web/avatar-motion.mjs";

function harness() {
  const properties = new Map();
  const frames = new Map();
  let id = 0;
  let timestamp = 0;
  let seed = 7;
  const environment = {
    performance: { now: () => timestamp },
    matchMedia: () => ({ matches: false }),
    random: () => (seed = (seed * 16807) % 2147483647) / 2147483647,
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(frame) { frames.delete(frame); },
  };
  const motion = createAvatarMotion({ style: { setProperty: (name, value) => properties.set(name, value) } }, environment);
  const get = name => parseFloat(properties.get(name));
  const mouthFrame = () => get("--maya-mouth-a") + get("--maya-mouth-mix");
  function run(until, each = () => {}) {
    while (timestamp < until) {
      timestamp += 33;
      const [frame, callback] = frames.entries().next().value;
      frames.delete(frame);
      callback(timestamp);
      each();
    }
  }
  return { motion, properties, frames, get, mouthFrame, run, time: () => timestamp };
}

test("mouth shapes: open vowels widest, lips together on b, m and p, closed between words", () => {
  assert.ok(speechMouthWeight("a", 0) > speechMouthWeight("e", 0));
  assert.ok(speechMouthWeight("e", 0) > speechMouthWeight("u", 0));
  assert.equal(speechMouthWeight("m", 0), 0);
  assert.equal(speechMouthWeight("a b", 1.4), 0);
  assert.equal(speechMouthWeight("a", 0.05), speechMouthWeight("a", 0.9));
});

test("an unhurried blink closes and reopens the eyelids through in-between frames", () => {
  const seen = [0, 100, 200, 330, 420, 470].map(blinkFrame);
  assert.deepEqual(seen, [1, 2, 3, 2, 1, 0]);
  assert.ok(Math.max(...seen) === EYE_FRAMES - 1);
});

test("Maya talks with a moving mouth, then returns to her resting smile", () => {
  const { motion, frames, get, mouthFrame, run, time } = harness();
  motion.setActive(true);
  motion.setMode("speaking");
  // Word timing like the macOS Samantha voice: about 20 letters per second.
  const text = "Tell me about a time you solved a hard problem at work.";
  motion.startSpeech(text, 1);
  const starts = [...text.matchAll(/\S+/g)].map(word => [word.index, time() + 100 + word.index * 50]);
  const seen = [];
  run(time() + 3200, () => {
    while (starts.length && time() >= starts[0][1]) motion.speechBoundary(starts.shift()[0]);
    seen.push(mouthFrame());
  });
  const speaking = seen.slice(5, 85);
  assert.ok(Math.max(...speaking) > 6, "opens on vowels");
  assert.ok(Math.min(...speaking) < 5, "closes between syllables");
  let peaks = 0;
  for (let i = 1; i < speaking.length - 1; i++) if (speaking[i] > speaking[i - 1] && speaking[i] >= speaking[i + 1] && speaking[i] > 5.2) peaks++;
  const perSecond = peaks / (speaking.length * 0.033);
  assert.ok(perSecond >= 1.5 && perSecond <= 5, "moves at syllable pace, not letter pace: " + perSecond.toFixed(1));
  for (let i = 1; i < speaking.length; i++) assert.ok(Math.abs(speaking[i] - speaking[i - 1]) < 1.3, "no sudden mouth jumps");
  assert.ok(speaking.every(frame => frame >= 0 && frame <= MOUTH_FRAMES - 1));
  motion.endSpeech();
  motion.setMode("waiting");
  run(time() + 2500);
  assert.equal(get("--maya-mouth-a"), 0);
  assert.equal(get("--maya-mouth-mix"), 0);
  motion.setActive(false);
  assert.equal(frames.size, 0);
});

test("idle motion blinks, breathes and drifts gently without large jumps", () => {
  const { motion, get, run } = harness();
  motion.setActive(true);
  let blinks = 0;
  let previous = 0;
  let lastAngle = 0;
  run(30000, () => {
    const eyes = get("--maya-eyes");
    if (eyes === EYE_FRAMES - 1 && previous !== eyes) blinks++;
    previous = eyes;
    const angle = get("--maya-head-angle");
    assert.ok(Math.abs(angle) < 1.2);
    assert.ok(Math.abs(angle - lastAngle) < 0.15, "no sudden head jumps");
    lastAngle = angle;
    assert.ok(Math.abs(get("--maya-head-x")) < 0.6);
    assert.ok(Math.abs(get("--maya-breath") - 1) <= 0.003);
  });
  assert.ok(blinks >= 3 && blinks <= 8, "blinks every several seconds: " + blinks);
});

test("while listening Maya tilts her head and nods now and then", () => {
  const { motion, get, run } = harness();
  motion.setActive(true);
  motion.setMode("listening");
  let deepest = 0;
  run(12000, () => { deepest = Math.max(deepest, get("--maya-head-y")); });
  assert.ok(get("--maya-head-angle") > 0.4, "attentive tilt");
  assert.ok(deepest > 0.45, "nods");
  motion.setActive(false);
  assert.equal(get("--maya-head-angle"), 0);
  assert.equal(get("--maya-eyes"), 0);
});

test("reduced motion keeps Maya still", () => {
  const properties = new Map();
  let callback;
  const motion = createAvatarMotion({ style: { setProperty: (name, value) => properties.set(name, value) } }, {
    performance: { now: () => 0 },
    matchMedia: () => ({ matches: true }),
    requestAnimationFrame(next) { callback = next; return 1; },
  });
  motion.setActive(true);
  motion.startSpeech("Hello there");
  callback(100);
  assert.equal(properties.get("--maya-head-angle"), "0deg");
  assert.equal(properties.get("--maya-mouth-a"), "0");
});

test("the mouth follows the spoken words: it waits for the voice to reach the next word", () => {
  const { motion, mouthFrame, run, time } = harness();
  motion.setActive(true);
  motion.setMode("speaking");
  motion.startSpeech("Hello there, how are you today?", 1);
  let early = 0;
  run(time() + 600, () => { early = Math.max(early, mouthFrame()); });
  assert.ok(early < 3.6, "lips stay together until the voice actually starts");
  motion.speechBoundary(0); // "Hello" starts
  let opened = 0;
  run(time() + 450, () => { opened = Math.max(opened, mouthFrame()); });
  assert.ok(opened > 5, "opens while saying the word");
  // The voice is slow: no new word for 1.2 seconds, so the mouth closes and waits.
  const waiting = [];
  run(time() + 1200, () => waiting.push(mouthFrame()));
  assert.ok(waiting.slice(-15).every(frame => frame < 3.6), "lips stay together until the next word");
  motion.speechBoundary(6); // "there" starts
  let reopened = 0;
  run(time() + 350, () => { reopened = Math.max(reopened, mouthFrame()); });
  assert.ok(reopened > 5, "opens again on the next word");
});

test("after a voice has reported words once, the next question waits for its first word", () => {
  const { motion, mouthFrame, run, time } = harness();
  motion.setActive(true);
  motion.startSpeech("First question.", 1);
  motion.speechBoundary(0);
  run(time() + 1500);
  motion.endSpeech();
  run(time() + 800);
  motion.startSpeech("Second question takes a moment to start.", 1);
  let most = 0;
  run(time() + 2000, () => { most = Math.max(most, mouthFrame()); });
  assert.ok(most < 3.6, "no mouth movement during the silence before the voice starts");
  motion.speechBoundary(0);
  run(time() + 400, () => { most = Math.max(most, mouthFrame()); });
  assert.ok(most > 5);
});

test("voices without word timing still move the mouth after a short wait", () => {
  const { motion, mouthFrame, run, time } = harness();
  motion.setActive(true);
  motion.startSpeech("Tell me about a time you solved a hard problem at work.", 1);
  const seen = [];
  run(time() + 4000, () => seen.push(mouthFrame()));
  assert.ok(seen.slice(0, 30).every(frame => frame < 3.6), "waits first");
  assert.ok(Math.max(...seen.slice(40)) > 5.5, "then talks");
});
