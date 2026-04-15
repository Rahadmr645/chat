import { useEffect, useState } from "react";
import { API_URL } from "../../config.js";
import { formatRecordingClock } from "../../utils/chatFormat.js";

export default function VoiceMessagePlayer({ messageId, token, durationSec }) {
  const [src, setSrc] = useState(null);
  const [loadErr, setLoadErr] = useState(false);

  useEffect(() => {
    let blobUrl;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/api/messages/audio/${messageId}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) throw new Error("fetch failed");
        const blob = await res.blob();
        if (cancelled) return;
        blobUrl = URL.createObjectURL(blob);
        setSrc(blobUrl);
      } catch {
        if (!cancelled) setLoadErr(true);
      }
    })();
    return () => {
      cancelled = true;
      if (blobUrl) URL.revokeObjectURL(blobUrl);
    };
  }, [messageId, token]);

  if (loadErr) {
    return <span className="voiceMsgFallback">Voice unavailable</span>;
  }

  const durationLabel =
    durationSec > 0 ? formatRecordingClock(durationSec) : "0:00";

  if (!src) {
    return (
      <div className="voiceMsgWrap voiceMsgWrap--pending">
        <span className="voiceMsgFallback">Loading…</span>
        <span className="voiceMsgDurationBadge">{durationLabel}</span>
      </div>
    );
  }

  const label =
    durationSec > 0 ? `Voice message, ${durationSec}s` : "Voice message";

  return (
    <div className="voiceMsgWrap">
      <audio
        className="voiceMsgAudio"
        controls
        preload="metadata"
        src={src}
        aria-label={label}
      />
    </div>
  );
}
