// Maya is built from layers cut from one photo: the room stays still, her body
// breathes, her head moves on its own layer, and her mouth and eyes swap between
// pre-rendered frames (see scripts/build-maya-layers.py). Frames are swapped
// rather than faded between different photos, so lips and eyelids never ghost.

export const MOUTH_FRAMES = 9; // 0 resting smile, 1-2 into speech, 3 lips together ... 8 fully open
const SPEECH_CLOSED = 3;
export const EYE_FRAMES = 4; // 0 open, 1-2 eyelid sliding down, 3 closed

// Blink timing in milliseconds: an unhurried blink, closing, resting shut, then opening.
const BLINK = [[80, 1], [160, 2], [290, 3], [370, 2], [460, 1]];
const BLINK_MS = BLINK[BLINK.length - 1][0];
const NOD_MS = 900;
const LEAD_MS = 100;

// How wide the mouth opens for a word. In real speech the visible openings come on
// stressed words, about twice a second; short words like "a", "to" and "at" barely move
// the lips. Openness 1 is the widest frame (inner lips about 18% of mouth width).
const SMALL_WORDS = new Set("a an the to at of in on it is as be by do or and but me my i you we he she for from with your our".split(" "));
export function wordOpenness(word) {
  const clean = String(word).toLowerCase().replace(/[^a-z']/g, "");
  if (!clean) return 0;
  if (SMALL_WORDS.has(clean)) return 0.25;
  const vowel = clean.match(/[aeiouy]/)?.[0];
  const base = vowel === "a" || vowel === "o" ? 0.8 : vowel === "e" || vowel === "i" ? 0.64 : 0.5;
  return Math.min(1, base + Math.min(0.2, Math.max(0, clean.length - 4) * 0.035));
}

export function blinkFrame(elapsed) {
  if (elapsed < 0 || elapsed >= BLINK_MS) return 0;
  return BLINK.find(([until]) => elapsed < until)[1];
}

// Smooth, non-repeating drift: a few slow waves with random phases.
function drift(random) {
  const waves = [0.31, 0.53, 0.97].map((speed, index) => ({ speed, phase: random() * 6.283, weight: [1, 0.55, 0.25][index] }));
  return seconds => waves.reduce((sum, wave) => sum + wave.weight * Math.sin(seconds * wave.speed + wave.phase), 0) / 1.8;
}

const approach = (value, target, ms, step) => value + (target - value) * (1 - Math.exp(-step / ms));

export function createAvatarMotion(element, environment = window) {
  const style = element?.style;
  const reduced = environment.matchMedia?.("(prefers-reduced-motion: reduce)");
  const enabled = Boolean(style && environment.requestAnimationFrame);
  const random = environment.random ?? Math.random;
  const now = () => environment.performance?.now() ?? 0;
  const sway = { x: drift(random), y: drift(random), turn: drift(random), body: drift(random) };
  let active = false;
  let raf;
  let lastFrame = 0;
  let mode = "ready";
  let blinkAt = 0;
  let nextBlink = 0;
  let nodAt = -Infinity;
  let nodSize = 0;
  let nextListenNod = 0;
  let speakingText = "";
  let anchor = 0;
  let anchorAt = 0;
  let charactersPerSecond = 13;
  let lastWord = -1;
  let heardBoundary = false; // the voice has reported a word in this question
  let voiceReportsWords = false; // the voice reported words before, so wait for them
  let wordEnd = 0;
  let wordOpen = 0;
  let wordLabial = false;
  let mouth = 0;
  let talk = 0; // 0 resting smile, 1 speaking face
  let tilt = 0;
  let lean = 0;
  let energy = 1;

  const set = (name, value) => style?.setProperty(name, value);
  const scheduleBlink = (from, soon = false) => {
    nextBlink = from + (soon ? 650 : 4500 + random() * 4500);
  };
  const blink = (timestamp, double = random() < 0.08) => {
    if (timestamp - blinkAt < BLINK_MS + 120) return;
    blinkAt = timestamp;
    scheduleBlink(timestamp, double);
  };
  const nod = (timestamp, size = 1) => {
    if (timestamp - nodAt < NOD_MS * 0.8) return;
    nodAt = timestamp;
    nodSize = size;
  };

  function neutral() {
    set("--maya-head-x", "0%");
    set("--maya-head-y", "0%");
    set("--maya-head-angle", "0deg");
    set("--maya-head-scale", "1");
    set("--maya-body-x", "0%");
    set("--maya-breath", "1");
    set("--maya-eyes", "0");
    set("--maya-mouth-a", "0");
    set("--maya-mouth-b", "0");
    set("--maya-mouth-mix", "0");
  }

  // Where in the text the voice is now. Commas and sentence ends take extra time,
  // like a real voice pausing.
  function textPosition(timestamp) {
    let left = Math.max(0, timestamp - anchorAt) / 1000;
    let position = anchor;
    while (position < speakingText.length) {
      const character = speakingText[Math.floor(position)];
      const seconds = 1 / charactersPerSecond + (character === "," || character === ";" ? 0.22 : /[.?!:]/.test(character) ? 0.42 : 0);
      if (left < seconds) return position + left / seconds;
      left -= seconds;
      position = Math.floor(position) + 1;
    }
    return position;
  }

  function mouthTarget(timestamp) {
    if (!speakingText) return 0;
    // Lips shape a sound about 100 ms before it is heard (measured from our recordings).
    const position = textPosition(timestamp + LEAD_MS);
    const index = Math.floor(position);
    if (index >= speakingText.length) return 0;
    // Before the first word is heard, keep the lips together: voices can take up to a
    // second to start. Voices that never report words get 1.2 seconds, then run on timing.
    if (!heardBoundary && (voiceReportsWords || timestamp - anchorAt < 1200)) return 0;
    const between = heardBoundary ? index >= wordEnd : !/[a-z0-9']/i.test(speakingText[index]);
    if (between) {
      // Inside a phrase the lips stay slightly parted; they close at punctuation or a long wait.
      const gap = heardBoundary ? wordEnd : index;
      const phraseContinues = /\s/.test(speakingText[gap] ?? "") && !(heardBoundary && timestamp - anchorAt > 650);
      return phraseContinues ? 0.18 : 0;
    }
    const wordStart = speakingText.slice(0, index + 1).search(/[a-z0-9']+$/i);
    if (wordStart !== lastWord) {
      lastWord = wordStart;
      const word = speakingText.slice(wordStart).match(/^[a-z0-9']+/i)?.[0] ?? "";
      wordOpen = wordOpenness(word) * (0.85 + random() * 0.15);
      wordLabial = /^[bmp]/i.test(word);
      if (mode === "speaking" && wordOpen > 0.5 && random() < 0.35) nod(timestamp, 0.45 + random() * 0.35);
      if (/[.?!]/.test(speakingText[wordStart - 2] ?? "") && random() < 0.35) blink(timestamp);
    }
    // Words starting with b, m or p begin with the lips pressed together.
    if (wordLabial && position - wordStart < 0.8) return 0;
    return wordOpen;
  }

  function draw(timestamp) {
    if (!active) return;
    raf = environment.requestAnimationFrame(draw);
    const step = Math.min(timestamp - lastFrame, 70);
    if (step < 30) return;
    lastFrame = timestamp;
    if (reduced?.matches) {
      neutral();
      return;
    }
    const seconds = timestamp / 1000;

    // Mouth: open quickly on a vowel, close a little more slowly.
    const target = mouthTarget(timestamp);
    // About 0.2 s to open and to close, as in our recordings.
    mouth = approach(mouth, target, target > mouth ? 70 : 80, step);
    talk = approach(talk, speakingText ? 1 : 0, speakingText ? 180 : 450, step);
    if (!speakingText && mouth < 0.01) mouth = 0;
    if (!speakingText && talk < 0.01) talk = 0;
    const frame = Math.min(MOUTH_FRAMES - 1, SPEECH_CLOSED * talk + (MOUTH_FRAMES - 1 - SPEECH_CLOSED) * mouth * talk);
    const frameA = Math.floor(frame);
    set("--maya-mouth-a", String(frameA));
    set("--maya-mouth-b", String(Math.min(MOUTH_FRAMES - 1, frameA + 1)));
    set("--maya-mouth-mix", (frame - frameA).toFixed(2));

    // Eyes: blink every few seconds, sometimes twice.
    if (timestamp >= nextBlink && timestamp - blinkAt > BLINK_MS) blink(timestamp);
    set("--maya-eyes", String(blinkFrame(timestamp - blinkAt)));

    // Head and body: slow drift, bigger while talking, a tilt and lean while listening.
    if (mode === "listening" && timestamp >= nextListenNod) {
      nod(timestamp, 0.7 + random() * 0.5);
      nextListenNod = timestamp + 3600 + random() * 3800;
    }
    energy = approach(energy, mode === "speaking" ? 1.5 : mode === "listening" ? 0.8 : 1, 600, step);
    tilt = approach(tilt, mode === "listening" ? 1.1 : mode === "thinking" ? -0.7 : 0, 900, step);
    lean = approach(lean, mode === "listening" ? 1 : 0, 900, step);
    const nodPhase = (timestamp - nodAt) / NOD_MS;
    const nodding = nodPhase >= 0 && nodPhase < 1 ? Math.sin(Math.PI * nodPhase) ** 2 * nodSize : 0;
    const breath = Math.sin(seconds * 2 * Math.PI / 4.4);

    set("--maya-head-angle", (0.45 * energy * sway.turn(seconds) + tilt + 0.25 * nodding).toFixed(3) + "deg");
    set("--maya-head-x", (0.32 * energy * sway.x(seconds)).toFixed(3) + "%");
    set("--maya-head-y", (0.2 * energy * sway.y(seconds) + 0.45 * nodding + 0.12 * lean - 0.08 * breath).toFixed(3) + "%");
    set("--maya-head-scale", (1 + 0.006 * lean).toFixed(4));
    set("--maya-body-x", (0.12 * energy * sway.body(seconds)).toFixed(3) + "%");
    set("--maya-breath", (1 + 0.0028 * breath).toFixed(4));
  }

  function endSpeech() {
    speakingText = "";
    if (!active) {
      mouth = 0;
      talk = 0;
      set("--maya-mouth-a", "0");
      set("--maya-mouth-b", "0");
      set("--maya-mouth-mix", "0");
    }
  }

  return {
    setActive(value) {
      if (active === value || !enabled) return;
      active = value;
      if (value) {
        lastFrame = now();
        scheduleBlink(lastFrame);
        nextListenNod = lastFrame + 2000;
        raf = environment.requestAnimationFrame(draw);
      } else {
        environment.cancelAnimationFrame?.(raf);
        nodAt = -Infinity;
        mouth = 0;
        talk = 0;
        tilt = 0;
        lean = 0;
        endSpeech();
        neutral();
      }
    },

    setMode(value) {
      if (value === mode) return;
      mode = value;
      if (value === "listening") nextListenNod = now() + 1800 + random() * 1500;
    },

    startSpeech(text, rate = 1) {
      speakingText = String(text);
      anchor = 0;
      anchorAt = now();
      lastWord = -1;
      heardBoundary = false;
      wordEnd = speakingText.length;
      charactersPerSecond = Math.max(10, Math.min(26, 16 * rate));
      if (random() < 0.35) blink(anchorAt);
    },

    speechBoundary(index) {
      if (!speakingText || !Number.isInteger(index) || index < anchor || index >= speakingText.length) return;
      const timestamp = now();
      const elapsed = timestamp - anchorAt;
      if (index > anchor && elapsed > 100) {
        const rate = (index - anchor) * 1000 / elapsed;
        if (rate >= 6 && rate <= 34) charactersPerSecond = Math.max(10, Math.min(28, charactersPerSecond * 0.6 + rate * 0.4));
      }
      anchor = index;
      anchorAt = timestamp;
      heardBoundary = true;
      voiceReportsWords = true;
      const after = speakingText.slice(index).search(/[\s.,;:?!]/);
      wordEnd = after < 0 ? speakingText.length : index + after;
    },

    endSpeech,

    // A small nod when the candidate finishes an answer, or while they are talking.
    acknowledge() {
      nod(now(), 1);
    },
  };
}
