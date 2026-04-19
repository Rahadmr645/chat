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
