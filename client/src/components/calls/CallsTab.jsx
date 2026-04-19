import { useMemo } from "react";
import { formatRecordingClock } from "../../utils/chatFormat.js";
import "./CallsTab.css";

function startOfDay(d) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x.getTime();
}

function dayHeading(ts) {
  const d = new Date(ts);
  const today = startOfDay(Date.now());
  const y = startOfDay(d.getTime());
  const diff = Math.round((today - y) / 86400000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  return d.toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: d.getFullYear() !== new Date().getFullYear() ? "numeric" : undefined,
  });
}

function formatRowTime(ts) {
  const d = new Date(ts);
  return d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function buildSubtitle(row) {
  const kind = row.isVideo ? "Video call" : "Voice call";
  const arrow = row.direction === "outgoing" ? "↗" : "↙";
  const dir = row.direction === "outgoing" ? "Outgoing" : "Incoming";

  if (row.outcome === "completed" && row.durationSec > 0) {
    return { text: `${arrow} ${dir} · ${kind} · ${formatRecordingClock(row.durationSec)}`, missed: false };
  }
  if (row.outcome === "missed") {
    return {
      text: `${arrow} Missed ${row.isVideo ? "video" : "voice"} call`,
      missed: true,
    };
  }
  if (row.outcome === "declined") {
    return { text: `${arrow} ${dir} · Declined`, missed: false };
  }
  if (row.outcome === "unavailable") {
    return { text: `${arrow} ${dir} · Unavailable`, missed: false };
  }
  if (row.outcome === "cancelled") {
    return { text: `${arrow} ${dir} · Cancelled`, missed: false };
  }
  return { text: `${arrow} ${dir} · ${kind}`, missed: false };
}

const CallsTab = ({
  items = [],
  loading = false,
  error = "",
  friends = [],
  onRetry,
  onOpenChat,
  onVoiceCall,
  onVideoCall,
}) => {
  const friendMap = useMemo(() => {
    const m = new Map();
    for (const f of friends) {
      if (f?._id) m.set(String(f._id), f);
    }
    return m;
  }, [friends]);

  const grouped = useMemo(() => {
    const map = [];
    let lastHeading = "";
    for (const row of items) {
      const h = dayHeading(row.createdAt);
      if (h !== lastHeading) {
        lastHeading = h;
        map.push({ type: "heading", key: h + row._id, label: h });
      }
      map.push({ type: "row", key: row._id, row });
    }
    return map;
  }, [items]);

  const resolvePeer = (row) => {
    if (row.peer?.name) return row.peer;
    const f = friendMap.get(String(row.peerId));
    if (f) return { name: f.name, email: f.email, avatarUrl: f.avatarUrl };
    return { name: "Unknown", email: "", avatarUrl: "" };
  };

  return (
    <section className="callsTab" aria-label="Calls">
      <header className="callsTabHeader">
        <h1>Calls</h1>
        <p className="callsTabHint">Tap a row to open chat. Use icons to call back.</p>
      </header>
      <div className="callsTabBody">
        {loading && <p className="callsTabState">Loading…</p>}
        {!loading && error && (
          <div className="callsTabState callsTabState--errorWrap">
            <p className="callsTabState callsTabState--error">{error}</p>
            <button type="button" className="callsTabRetryBtn" onClick={() => onRetry?.()}>
              Try again
            </button>
          </div>
        )}
        {!loading && !error && items.length === 0 && (
          <p className="callsTabState">No calls yet. Start a voice or video call from a chat.</p>
        )}
        {!loading &&
          !error &&
          grouped.map((entry) => {
            if (entry.type === "heading") {
              return (
                <div key={entry.key} className="callsDayGroup">
                  <h2 className="callsDayLabel">{entry.label}</h2>
                </div>
              );
            }
            const { row } = entry;
            const peer = resolvePeer(row);
            const letter = (peer.name || peer.email || "?").charAt(0).toUpperCase();
            const sub = buildSubtitle(row);

            return (
              <div
                key={entry.key}
                className="callsRow"
                role="button"
                tabIndex={0}
                onClick={() => onOpenChat?.(String(row.peerId))}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    onOpenChat?.(String(row.peerId));
                  }
                }}
              >
                <div className="callsRowAvatar" aria-hidden="true">
                  {peer.avatarUrl ? (
                    <img src={peer.avatarUrl} alt="" />
                  ) : (
                    letter
                  )}
                </div>
                <div className="callsRowMain">
                  <div className="callsRowTop">
                    <h3 className="callsRowName">{peer.name || peer.email || "Unknown"}</h3>
                    <time className="callsRowTime" dateTime={new Date(row.createdAt).toISOString()}>
                      {formatRowTime(row.createdAt)}
                    </time>
                  </div>
                  <p className={`callsRowSub ${sub.missed ? "callsRowSub--missed" : ""}`}>
                    <span className="callsRowSubIcon" aria-hidden="true">
                      {row.isVideo ? "📹" : "📞"}
                    </span>
                    <span>{sub.text}</span>
                  </p>
                </div>
                <div className="callsRowActions">
                  <button
                    type="button"
                    className="callsRowCallBtn"
                    title="Voice call"
                    aria-label={`Voice call ${peer.name || "contact"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onVoiceCall?.(String(row.peerId));
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M20 15.5c-1.25 0-2.45-.2-3.57-.57a1.02 1.02 0 0 0-1.02.24l-2.2 2.2a15.1 15.1 0 0 1-6.59-6.59l2.2-2.21c.28-.27.36-.66.25-1.01A11.36 11.36 0 0 1 8.5 4c0-.83-.67-1.5-1.5-1.5H4.83C4 2.5 3.33 3.17 3.33 4 3.33 13.17 10.83 20.5 20 20.5c.83 0 1.5-.67 1.5-1.5v-3.18c0-.82-.67-1.5-1.5-1.5z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    className="callsRowCallBtn callsRowCallBtn--video"
                    title="Video call"
                    aria-label={`Video call ${peer.name || "contact"}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      onVideoCall?.(String(row.peerId));
                    }}
                  >
                    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17 10.5V7a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-3.5l4 4v-11l-4 4z" />
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
      </div>
    </section>
  );
};

export default CallsTab;
