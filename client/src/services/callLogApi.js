import { apiRequest } from "./api.js";

export async function persistCallLog({
  token,
  peerId,
  isVideo,
  direction,
  outcome,
  durationSec = 0,
}) {
  if (!token || !peerId || !direction || !outcome) return;
  try {
    await apiRequest({
      method: "POST",
      path: "/api/calls/log",
      token,
      body: {
        peerId: String(peerId),
        isVideo: Boolean(isVideo),
        direction,
        outcome,
        durationSec,
      },
    });
  } catch {
    /* best-effort */
  }
}
