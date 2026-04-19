let audioContext = null;
let activeNodes = null;
let intervalId = null;
let primed = false;

const ensureContext = () => {
  if (audioContext) return audioContext;
  try {
    const Ctx =
      window.AudioContext || window.webkitAudioContext || null;
    if (!Ctx) return null;
    audioContext = new Ctx();
  } catch {
    audioContext = null;
  }
  return audioContext;
};

export const primeRingtone = () => {
  if (primed) return;
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  try {
    const buffer = ctx.createBuffer(1, 1, 22050);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.start(0);
    primed = true;
  } catch {
    /* ignore */
  }
};

if (typeof window !== "undefined") {
  const onFirstInteract = () => {
    primeRingtone();
    window.removeEventListener("pointerdown", onFirstInteract);
    window.removeEventListener("keydown", onFirstInteract);
    window.removeEventListener("touchstart", onFirstInteract);
  };
  window.addEventListener("pointerdown", onFirstInteract, { passive: true });
  window.addEventListener("keydown", onFirstInteract);
  window.addEventListener("touchstart", onFirstInteract, { passive: true });
}

const playOneRing = () => {
  const ctx = audioContext;
  if (!ctx) return;
  const now = ctx.currentTime;

  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.25, now + 0.05);
  gain.gain.setValueAtTime(0.25, now + 0.9);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.0);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(440, now);
  o1.connect(gain);
  o1.start(now);
  o1.stop(now + 1.05);

  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(480, now);
  o2.connect(gain);
  o2.start(now);
  o2.stop(now + 1.05);

  activeNodes = { gain, o1, o2 };
};

export const startCallRingtone = () => {
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }
  if (intervalId) return;
  playOneRing();
  intervalId = setInterval(playOneRing, 2000);
};

let lastEndChimeAt = 0;
const END_CHIME_DEBOUNCE_MS = 500;

/** Short two-tone “hang up” cue so the user notices the call ended (debounced). */
export const playCallEndChime = () => {
  const now = Date.now();
  if (now - lastEndChimeAt < END_CHIME_DEBOUNCE_MS) return;
  lastEndChimeAt = now;

  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state === "suspended") {
    ctx.resume().catch(() => {});
  }

  const t0 = ctx.currentTime;
  const gain = ctx.createGain();
  gain.connect(ctx.destination);
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.14, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);

  const o1 = ctx.createOscillator();
  o1.type = "sine";
  o1.frequency.setValueAtTime(520, t0);
  o1.frequency.exponentialRampToValueAtTime(340, t0 + 0.12);
  o1.connect(gain);
  o1.start(t0);
  o1.stop(t0 + 0.14);

  const o2 = ctx.createOscillator();
  o2.type = "sine";
  o2.frequency.setValueAtTime(380, t0 + 0.12);
  o2.frequency.exponentialRampToValueAtTime(260, t0 + 0.32);
  o2.connect(gain);
  o2.start(t0 + 0.11);
  o2.stop(t0 + 0.36);
};

export const stopCallRingtone = () => {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
  }
  if (activeNodes) {
    try {
      activeNodes.o1.stop();
      activeNodes.o2.stop();
      activeNodes.gain.disconnect();
    } catch {
      /* ignore */
    }
    activeNodes = null;
  }
};

export const startVibration = () => {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate([600, 400, 600, 400, 600, 400, 600, 400, 600]);
  } catch {
    /* ignore */
  }
};

export const stopVibration = () => {
  if (typeof navigator === "undefined" || !navigator.vibrate) return;
  try {
    navigator.vibrate(0);
  } catch {
    /* ignore */
  }
};
