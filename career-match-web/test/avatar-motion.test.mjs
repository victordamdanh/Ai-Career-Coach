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

test("a blink closes and reopens the eyelids through in-between frames", () => {
  const seen = [0, 30, 60, 110, 170, 220, 260].map(blinkFrame);
  assert.deepEqual(seen, [1, 1, 2, 3, 2, 1, 0]);
  assert.ok(Math.max(...seen) === EYE_FRAMES - 1);
});

test("Maya talks with a moving mouth, then returns to her resting smile", () => {
  const { motion, frames, get, mouthFrame, run, time } = harness();
  motion.setActive(true);
  motion.setMode("speaking");
  motion.startSpeech("Tell me about a time you solved a hard problem at work.", 1);
  const seen = [];
  run(3500, () => seen.push(mouthFrame()));
  const speaking = seen.slice(8);
  assert.ok(Math.max(...speaking) > 6, "opens wide on vowels");
  assert.ok(Math.min(...speaking) < 4.2, "closes between sounds");
  let changes = 0;
  for (let i = 1; i < speaking.length; i++) if (Math.abs(speaking[i] - speaking[i - 1]) > 0.6) changes++;
  assert.ok(changes > 20, "keeps moving instead of hovering half open");
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
  assert.ok(blinks >= 5 && blinks <= 16, "blinks every few seconds: " + blinks);
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
