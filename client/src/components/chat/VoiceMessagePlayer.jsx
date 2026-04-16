import { useEffect, useRef, useState } from "react";
import { API_URL } from "../../config.js";
import { formatRecordingClock } from "../../utils/chatFormat.js";

const WAVE_BARS = [
  6, 14, 8, 18, 10, 20, 9, 16, 7, 19, 8, 15, 11, 17, 7, 13, 9, 18, 8, 14, 10, 20, 9, 16,
];

export default function VoiceMessagePlayer({ messageId, token, durationSec }) {
  const [src, setSrc] = useState(null);
  const [loadErr, setLoadErr] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [mediaDuration, setMediaDuration] = useState(0);
  const audioRef = useRef(null);

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

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return undefined;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onLoaded = () => {
      if (Number.isFinite(audio.duration)) setMediaDuration(audio.duration);
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    const onEnded = () => setPlaying(false);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onLoaded);
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("ended", onEnded);
    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onLoaded);
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("ended", onEnded);
    };
  }, [src]);

  if (loadErr) {
    return <span className="voiceMsgFallback">Voice unavailable</span>;
  }

  const pendingDurationLabel =
    durationSec > 0 ? formatRecordingClock(durationSec) : "0:00";

  if (!src) {
    return (
      <div className="voiceMsgWrap voiceMsgWrap--pending">
        <span className="voiceMsgFallback">Loading…</span>
        <span className="voiceMsgDurationBadge">{pendingDurationLabel}</span>
      </div>
    );
  }

  const totalDuration = mediaDuration > 0 ? mediaDuration : durationSec || 0;
  const progress = totalDuration > 0 ? Math.min(1, currentTime / totalDuration) : 0;
  const durationLabel = formatRecordingClock(totalDuration || 0);
  return (
    <div className="voiceMsgWrap">
      <audio
        ref={audioRef}
        className="voiceMsgHiddenAudio"
        preload="metadata"
        src={src}
        aria-label="Voice message"
      />
      <button
        type="button"
        className="voiceMsgPlayBtn"
        aria-label={playing ? "Pause voice message" : "Play voice message"}
        onClick={() => {
          if (!audioRef.current) return;
          if (audioRef.current.paused) {
            void audioRef.current.play().catch(() => {});
          } else {
            audioRef.current.pause();
          }
        }}
      >
        {playing ? "❚❚" : "▶"}
      </button>
      <div className="voiceMsgWave" aria-hidden="true">
        {WAVE_BARS.map((h, idx) => {
          const active = idx / WAVE_BARS.length <= progress;
          return (
            <span
              key={`${idx}-${h}`}
              className={`voiceMsgWaveBar ${active ? "voiceMsgWaveBar--active" : ""}`}
              style={{ height: `${h}px` }}
            />
          );
        })}
      </div>
      <span className="voiceMsgDot" aria-hidden="true" />
      <span className="voiceMsgDurationBadge">{durationLabel}</span>
    </div>
  );
}
