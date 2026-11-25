const MOUTH_OPEN = /[aeiouy]/i;
const MOUTH_CLOSED = /[bmp]/i;
const MOUTH_NARROW = /[fvw]/i;

// Word boundaries correct the timing when the browser provides them. Between
// boundaries, the text position gives an approximate sequence of mouth shapes.
export function speechMouthWeight(text, position) {
  const index = Math.floor(position);
  if (index < 0 || index >= text.length) return 0;
  const character = text[index];
  if (!/[a-z]/i.test(character)) return 0;
  if (MOUTH_CLOSED.test(character)) return 0.04;
  const amplitude = MOUTH_OPEN.test(character) ? 0.96 : MOUTH_NARROW.test(character) ? 0.37 : 0.58;
  const pulse = 0.3 + 0.7 * Math.sin(Math.PI * (position - index));
  return amplitude * pulse;
}

function blinkWeight(elapsed) {
  if (elapsed < 0 || elapsed > 215) return 0;
  if (elapsed < 75) return elapsed / 75;
  if (elapsed < 105) return 1;
  return 1 - (elapsed - 105) / 110;
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
  let charactersPerSecond = 13;
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
    if (timestamp - lastFrame < 32) return;
    lastFrame = timestamp;
    if (reduced?.matches) {
      neutral();
      return;
    }
    const time = timestamp - startedAt;
    if (timestamp > blinkAt + 215) blinkAt = timestamp + 2400 + Math.random() * 2600;
    const blink = closedEyes?.naturalWidth ? blinkWeight(timestamp - blinkAt) : 0;
    const position = anchor + Math.max(0, timestamp - anchorAt) * charactersPerSecond / 1000;
    const target = openMouth?.naturalWidth && speakingText ? speechMouthWeight(speakingText, position) : 0;
    mouth += (target - mouth) * 0.63;
    const elapsedNod = timestamp - nodAt;
    const nod = elapsedNod >= 0 && elapsedNod < 680 ? Math.sin(Math.PI * elapsedNod / 680) : 0;

    setStyle("--maya-mouth", mouth.toFixed(3));
    setStyle("--maya-mouth-height", (0.96 + 0.10 * mouth).toFixed(3));
    setStyle("--maya-blink", blink.toFixed(3));
    setStyle("--maya-head-angle", (0.28 * Math.sin(time / 1700) + 0.58 * nod).toFixed(2) + "deg");
    setStyle("--maya-head-x", (1.6 * Math.sin(time / 2400)).toFixed(2) + "px");
    setStyle("--maya-head-y", (0.75 * Math.sin(time / 1550) + 1.6 * nod).toFixed(2) + "px");
    setStyle("--maya-breath", (1 + 0.007 * Math.sin(time / 700)).toFixed(4));
    setStyle("--maya-eye-x", (0.75 * Math.sin(time / 1900)).toFixed(2) + "px");
    setStyle("--maya-eye-y", (0.35 * Math.sin(time / 2750)).toFixed(2) + "px");
  }

  function endSpeech() {
    speakingText = "";
    mouth = 0;
    setStyle("--maya-mouth", "0");
  }

  return {
    setActive(value) {
      if (active === value || !enabled) return;
      active = value;
      if (value) {
        startedAt = now();
        lastFrame = 0;
        blinkAt = startedAt + 1800 + Math.random() * 1600;
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
      charactersPerSecond = 13 * rate;
    },

    speechBoundary(index) {
      if (!speakingText || !Number.isInteger(index) || index < anchor || index >= speakingText.length) return;
      const timestamp = now();
      const elapsed = timestamp - anchorAt;
      if (index > anchor && elapsed > 100) {
        const rate = (index - anchor) * 1000 / elapsed;
        if (rate >= 6 && rate <= 24) charactersPerSecond = charactersPerSecond * 0.6 + rate * 0.4;
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
