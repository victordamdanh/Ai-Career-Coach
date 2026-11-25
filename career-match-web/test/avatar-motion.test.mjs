import test from "node:test";
import assert from "node:assert/strict";
import { createAvatarMotion, speechMouthWeight } from "../web/avatar-motion.mjs";

test("speech shapes open for vowels, close for labials and pause between words", () => {
  assert.ok(speechMouthWeight("ab", 0.5) > speechMouthWeight("ab", 1.5));
  assert.equal(speechMouthWeight("a b", 1.4), 0);
  assert.equal(speechMouthWeight("a", 0.05), speechMouthWeight("a", 0.9));
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
  motion.startSpeech("aaaaaaaa bbb");
  let previous = 0;
  for (const time of [45, 90, 135, 180]) {
    nextFrame(time);
    const openness = Number(properties.get("--maya-mouth"));
    assert.ok(openness > previous && openness - previous <= 0.118);
    previous = openness;
  }
  assert.ok(previous > 0.3);
  motion.speechBoundary(9);
  nextFrame(225);
  assert.ok(Number(properties.get("--maya-mouth")) < previous);
  motion.endSpeech();
  assert.ok(Number(properties.get("--maya-mouth")) > 0);
  for (let time = 270; time <= 990; time += 45) {
    nextFrame(time);
    const openness = Number(properties.get("--maya-mouth"));
    assert.ok(openness <= previous);
    previous = openness;
  }
  assert.equal(Number(properties.get("--maya-mouth")), 0);
  let blinked = false;
  for (let time = 1025; time < 10000; time += 35) {
    nextFrame(time);
    if (Number(properties.get("--maya-blink")) > 0.9) blinked = true;
    assert.ok(Math.abs(parseFloat(properties.get("--maya-head-x"))) <= 0.61);
    assert.ok(Math.abs(parseFloat(properties.get("--maya-eye-x"))) <= 0.27);
    assert.ok(Math.abs(Number(properties.get("--maya-breath")) - 1) <= 0.0036);
  }
  assert.ok(blinked);
  assert.notEqual(properties.get("--maya-breath"), "1");
  motion.acknowledge();
  nextFrame(10300);
  assert.ok(parseFloat(properties.get("--maya-head-y")) > 0);
  motion.setActive(false);
  assert.equal(frames.size, 0);
  assert.equal(properties.get("--maya-head-angle"), "0deg");
  assert.equal(properties.get("--maya-mouth"), "0");
});
