const MS_PER_DAY = 86400000;

export function formatMessageTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  return d.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

export function formatLastSeen(iso) {
  if (!iso) return "offline";
  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) return "offline";
  const now = new Date();
  const diffMs = now.getTime() - then.getTime();
  if (diffMs < 0) return "offline";
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return "last seen just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `last seen ${diffMin} min ago`;

  const timeStr = then.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
  const startToday = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate()
  ).getTime();
  const startThat = new Date(
    then.getFullYear(),
    then.getMonth(),
    then.getDate()
  ).getTime();
  const dayDiff = Math.round((startToday - startThat) / MS_PER_DAY);

  if (dayDiff === 0) return `last seen today at ${timeStr}`;
  if (dayDiff === 1) return `last seen yesterday at ${timeStr}`;
  if (dayDiff < 7) {
    const dayName = then.toLocaleDateString(undefined, { weekday: "long" });
    return `last seen ${dayName} at ${timeStr}`;
  }
  const datePart = then.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    ...(now.getFullYear() !== then.getFullYear() ? { year: "numeric" } : {}),
  });
  return `last seen ${datePart} at ${timeStr}`;
}

export function formatRecordingClock(totalSec) {
  const s = Math.max(0, Math.floor(Number(totalSec) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
  }
  return `${m}:${String(r).padStart(2, "0")}`;
}
