const MOUTH_OPEN = /[aeiouy]/i;
const MOUTH_CLOSED = /[bmp]/i;
const MOUTH_NARROW = /[fvw]/i;
const BLINK_MS = 330;
const NOD_MS = 1350;
const MOUTH_EASE_MS = 180;
const MOUTH_CHANGE_PER_SECOND = 2.6;

// Word boundaries correct the timing when the browser provides them. Between
// boundaries, the text position gives an approximate sequence of mouth shapes.
export function speechMouthWeight(text, position) {
  const index = Math.floor(position);
  if (index < 0 || index >= text.length) return 0;
  const character = text[index];
  if (!/[a-z]/i.test(character)) return 0;
  if (MOUTH_CLOSED.test(character)) return 0.04;
  // Hold a shape across its sound instead of opening and closing on each letter.
  return MOUTH_OPEN.test(character) ? 0.76 : MOUTH_NARROW.test(character) ? 0.26 : 0.43;
}

function blinkWeight(elapsed) {
  if (elapsed < 0 || elapsed > BLINK_MS) return 0;
  const ease = progress => progress * progress * (3 - 2 * progress);
  if (elapsed < 118) return ease(elapsed / 118);
  if (elapsed <= 168) return 1;
  return 1 - ease((elapsed - 168) / (BLINK_MS - 168));
}

export function createAvatarMotion(element, environment = window) {
  const style = element?.style;
  const openMouth = element?.querySelector?.(".maya-mouth");
  const closedEyes = element?.querySelector?.(".maya-blink");
  const reduced = environment.matchMedia?.("(prefers-reduced-motion: reduce)");
  const enabled = Boolean(style && environment.requestAnimationFrame);
  const now = () => environment.performance?.now() ?? 0;
  let active = false;
  let raf;
  let lastFrame = 0;
  let startedAt = 0;
  let blinkAt = 0;
  let nodAt = -Infinity;
  let speakingText = "";
  let anchor = 0;
  let anchorAt = 0;
  let charactersPerSecond = 12;
  let mouth = 0;

  function setStyle(name, value) {
    style?.setProperty(name, value);
  }

  function neutral() {
    setStyle("--maya-mouth", "0");
    setStyle("--maya-blink", "0");
    setStyle("--maya-mouth-height", "1");
    setStyle("--maya-head-angle", "0deg");
    setStyle("--maya-head-x", "0px");
    setStyle("--maya-head-y", "0px");
    setStyle("--maya-breath", "1");
    setStyle("--maya-eye-x", "0px");
    setStyle("--maya-eye-y", "0px");
  }

  function draw(timestamp) {
    if (!active) return;
    raf = environment.requestAnimationFrame(draw);
    const elapsed = timestamp - lastFrame;
    if (elapsed < 32) return;
    lastFrame = timestamp;
    const step = Math.min(elapsed, 65);
    if (reduced?.matches) {
      neutral();
      return;
    }
    const time = timestamp - startedAt;
    if (timestamp > blinkAt + BLINK_MS) blinkAt = timestamp + 4400 + Math.random() * 3200;
    const blink = closedEyes?.naturalWidth ? blinkWeight(timestamp - blinkAt) : 0;
    const position = anchor + Math.max(0, timestamp - anchorAt) * charactersPerSecond / 1000;
    const target = openMouth?.naturalWidth && speakingText ? speechMouthWeight(speakingText, position) : 0;
    const easing = speakingText ? MOUTH_EASE_MS : 110;
    const change = (target - mouth) * (1 - Math.exp(-step / easing));
    const maxChange = MOUTH_CHANGE_PER_SECOND * step / 1000;
    mouth += Math.max(-maxChange, Math.min(maxChange, change));
    if (!speakingText && mouth < 0.008) mouth = 0;
    const elapsedNod = timestamp - nodAt;
    const nod = elapsedNod >= 0 && elapsedNod < NOD_MS ? Math.sin(Math.PI * elapsedNod / NOD_MS) ** 2 : 0;

    setStyle("--maya-mouth", mouth.toFixed(3));
    setStyle("--maya-mouth-height", (0.99 + 0.03 * mouth).toFixed(3));
    setStyle("--maya-blink", blink.toFixed(3));
    setStyle("--maya-head-angle", (0.11 * Math.sin(time / 3900) + 0.28 * nod).toFixed(2) + "deg");
    setStyle("--maya-head-x", (0.6 * Math.sin(time / 4250)).toFixed(2) + "px");
    setStyle("--maya-head-y", (0.3 * Math.sin(time / 3600) + 0.65 * nod).toFixed(2) + "px");
    setStyle("--maya-breath", (1 + 0.0035 * Math.sin(time / 1120)).toFixed(4));
    setStyle("--maya-eye-x", (0.26 * Math.sin(time / 4950)).toFixed(2) + "px");
    setStyle("--maya-eye-y", (0.12 * Math.sin(time / 5650)).toFixed(2) + "px");
  }

  function endSpeech() {
    speakingText = "";
    if (!active) {
      mouth = 0;
      setStyle("--maya-mouth", "0");
    }
  }

  return {
    setActive(value) {
      if (active === value || !enabled) return;
      active = value;
      if (value) {
        startedAt = now();
        lastFrame = startedAt;
        blinkAt = startedAt + 3600 + Math.random() * 2200;
        raf = environment.requestAnimationFrame(draw);
      } else {
        environment.cancelAnimationFrame?.(raf);
        nodAt = -Infinity;
        endSpeech();
        neutral();
      }
    },

    startSpeech(text, rate = 1) {
      speakingText = String(text);
      anchor = 0;
      anchorAt = now();
      charactersPerSecond = Math.max(8, Math.min(16, 12 * rate));
    },

    speechBoundary(index) {
      if (!speakingText || !Number.isInteger(index) || index < anchor || index >= speakingText.length) return;
      const timestamp = now();
      const elapsed = timestamp - anchorAt;
      if (index > anchor && elapsed > 100) {
        const rate = (index - anchor) * 1000 / elapsed;
        if (rate >= 6 && rate <= 24) charactersPerSecond = Math.max(8, Math.min(17, charactersPerSecond * 0.75 + rate * 0.25));
      }
      anchor = index;
      anchorAt = timestamp;
    },

    endSpeech,

    acknowledge() {
      nodAt = now();
    },
  };
}
