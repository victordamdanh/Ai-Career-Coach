import test from "node:test";
import assert from "node:assert/strict";
import { createAvatarMotion, speechMouthWeight } from "../web/avatar-motion.mjs";

test("speech shapes open for vowels, close for labials and pause between words", () => {
  assert.ok(speechMouthWeight("ab", 0.5) > speechMouthWeight("ab", 1.5));
  assert.equal(speechMouthWeight("a b", 1.4), 0);
});

test("Maya animates only while the room is active and closes her mouth after speaking", () => {
  const properties = new Map();
  const frames = new Map();
  let id = 0;
  let timestamp = 0;
  const environment = {
    performance: { now: () => timestamp },
    matchMedia: () => ({ matches: false }),
    requestAnimationFrame(callback) { frames.set(++id, callback); return id; },
    cancelAnimationFrame(frame) { frames.delete(frame); },
  };
  const motion = createAvatarMotion({
    style: { setProperty(name, value) { properties.set(name, value); } },
    querySelector: () => ({ naturalWidth: 1254 }),
  }, environment);
  function nextFrame(time) {
    timestamp = time;
    const [frame, callback] = frames.entries().next().value;
    frames.delete(frame);
    callback(time);
  }
  motion.setActive(true);
  motion.startSpeech("aaaa bbb");
  nextFrame(45);
  const open = Number(properties.get("--maya-mouth"));
  assert.ok(open > 0.3);
  motion.speechBoundary(5);
  nextFrame(90);
  assert.ok(Number(properties.get("--maya-mouth")) < open);
  motion.endSpeech();
  assert.equal(properties.get("--maya-mouth"), "0");
  let blinked = false;
  for (let time = 123; time < 8700; time += 35) {
    nextFrame(time);
    if (Number(properties.get("--maya-blink")) > 0.9) blinked = true;
  }
  assert.ok(blinked);
  assert.notEqual(properties.get("--maya-breath"), "1");
  motion.setActive(false);
  assert.equal(frames.size, 0);
  assert.equal(properties.get("--maya-head-angle"), "0deg");
});
