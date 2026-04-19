import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  apiDeleteStory,
  apiListStories,
  apiStoryReaction,
  apiUploadStory,
} from "../../services/api.js";
import {
  subscribeStoryCreated,
  subscribeStoryDeleted,
  subscribeStoryReaction,
} from "../../socket/Socket.js";
import { aggregateReactions } from "../../utils/messageReactions.js";
import "./StoriesTab.css";

const STORY_QUICK_REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "🙏"];

function formatTimeLeft(iso) {
  const end = new Date(iso).getTime();
  const ms = end - Date.now();
  if (ms <= 0) return "Expired";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m left`;
  if (m > 0) return `${m}m left`;
  return "Under 1m left";
}

function mergeStory(list, story) {
  const id = String(story._id);
  const i = list.findIndex((s) => String(s._id) === id);
  if (i >= 0) {
    const next = [...list];
    next[i] = story;
    return next;
  }
  return [story, ...list];
}

function buildAuthorRail(stories, myId) {
  const byAuthor = new Map();
  for (const s of stories) {
    const aid = String(s.authorId);
    if (!byAuthor.has(aid)) byAuthor.set(aid, []);
    byAuthor.get(aid).push(s);
  }
  for (const arr of byAuthor.values()) {
    arr.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }
  const me = String(myId);
  const keys = [...byAuthor.keys()];
  keys.sort((a, b) => {
    const mineA = a === me ? 1 : 0;
    const mineB = b === me ? 1 : 0;
    if (mineA !== mineB) return mineB - mineA;
    const latest = (id) => new Date(byAuthor.get(id)[0].createdAt).getTime();
    return latest(b) - latest(a);
  });
  return keys.map((authorId) => ({ authorId, stories: byAuthor.get(authorId) }));
}

const StoriesTab = ({ token, currentUser }) => {
  const myId = currentUser?._id ? String(currentUser._id) : "";
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [postError, setPostError] = useState("");
  const [posting, setPosting] = useState(false);
  const [caption, setCaption] = useState("");
  const [file, setFile] = useState(null);
  const fileRef = useRef(null);
  const [viewer, setViewer] = useState(null);
  const [tick, setTick] = useState(0);

  const loadStories = useCallback(async () => {
    if (!token) return;
    setError("");
    setLoading(true);
    try {
      const data = await apiListStories({ token });
      const list = Array.isArray(data.stories) ? data.stories : [];
      const now = Date.now();
      setStories(list.filter((s) => new Date(s.expiresAt).getTime() > now));
    } catch (e) {
      setError(e.message || "Could not load stories");
      setStories([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void loadStories();
  }, [loadStories]);

  useEffect(() => {
    const t = window.setInterval(() => setTick((x) => x + 1), 15000);
    return () => window.clearInterval(t);
  }, []);

  useEffect(() => {
    const now = Date.now();
    setStories((prev) => prev.filter((s) => new Date(s.expiresAt).getTime() > now));
    setViewer((v) => {
      if (!v) return v;
      const rest = v.stories.filter((s) => new Date(s.expiresAt).getTime() > now);
      if (!rest.length) return null;
      const idx = Math.min(v.index, rest.length - 1);
      return { ...v, stories: rest, index: idx };
    });
  }, [tick]);

  useEffect(() => {
    const unsubs = [
      subscribeStoryCreated(({ story }) => {
        if (!story?._id) return;
        if (new Date(story.expiresAt).getTime() <= Date.now()) return;
        setStories((prev) => mergeStory(prev, story));
      }),
      subscribeStoryReaction(({ story }) => {
        if (!story?._id) return;
        setStories((prev) => mergeStory(prev, story));
      }),
      subscribeStoryDeleted(({ storyId }) => {
        if (!storyId) return;
        setStories((prev) => prev.filter((s) => String(s._id) !== String(storyId)));
        setViewer((v) => {
          if (!v) return v;
          const rest = v.stories.filter((s) => String(s._id) !== String(storyId));
          if (!rest.length) return null;
          const idx = Math.min(v.index, rest.length - 1);
          return { ...v, stories: rest, index: idx };
        });
      }),
    ];
    return () => unsubs.forEach((u) => u());
  }, []);

  const rail = useMemo(() => buildAuthorRail(stories, myId), [stories, myId]);

  const openViewer = (authorId, storyList) => {
    setViewer({ authorId: String(authorId), stories: storyList, index: 0 });
  };

  const closeViewer = () => setViewer(null);

  const currentSlide = viewer?.stories?.[viewer.index];
  const canPrev = viewer && viewer.index > 0;
  const canNext = viewer && viewer.index < viewer.stories.length - 1;

  const goPrev = () => {
    if (!viewer || !canPrev) return;
    setViewer({ ...viewer, index: viewer.index - 1 });
  };

  const goNext = () => {
    if (!viewer || !canNext) return;
    setViewer({ ...viewer, index: viewer.index + 1 });
  };

  const handlePost = async () => {
    if (!token) return;
    const t = caption.trim();
    if (!t && !file) {
      setPostError("Write something or attach a photo or video.");
      return;
    }
    setPostError("");
    setPosting(true);
    try {
      await apiUploadStory({ token, text: t, file: file || undefined });
      setCaption("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await loadStories();
    } catch (e) {
      setPostError(e.message || "Could not post story");
    } finally {
      setPosting(false);
    }
  };

  const handleReact = async (emoji) => {
    if (!token || !currentSlide) return;
    try {
      const updated = await apiStoryReaction({
        token,
        storyId: currentSlide._id,
        emoji,
      });
      setStories((prev) => mergeStory(prev, updated));
      setViewer((v) => {
        if (!v) return v;
        const nextStories = v.stories.map((s) =>
          String(s._id) === String(updated._id) ? updated : s
        );
        return { ...v, stories: nextStories };
      });
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async () => {
    if (!token || !currentSlide || String(currentSlide.authorId) !== myId) return;
    if (!window.confirm("Delete this story for everyone?")) return;
    try {
      await apiDeleteStory({ token, storyId: currentSlide._id });
      setStories((prev) => prev.filter((s) => String(s._id) !== String(currentSlide._id)));
      setViewer((v) => {
        if (!v) return v;
        const rest = v.stories.filter((s) => String(s._id) !== String(currentSlide._id));
        if (!rest.length) return null;
        const idx = Math.min(v.index, rest.length - 1);
        return { ...v, stories: rest, index: idx };
      });
    } catch (e) {
      setPostError(e.message || "Delete failed");
    }
  };

  return (
    <div className="storiesTab">
      <header className="storiesTabHeader">
        <div>
          <h1 className="storiesTabTitle">Updates</h1>
          <p className="storiesTabSubtitle">Stories from friends · disappear after 24 hours</p>
        </div>
        <button type="button" className="storiesTabRefresh" onClick={() => void loadStories()}>
          Refresh
        </button>
      </header>

      <div className="storiesTabBody">
        {loading && <p className="storiesTabMuted">Loading…</p>}
        {error && <p className="storiesTabError">{error}</p>}

        <section className="storiesComposer" aria-label="Add a story">
          <textarea
            className="storiesComposerInput"
            rows={2}
            placeholder="What’s on your mind? (optional if you add media)"
            value={caption}
            onChange={(e) => setCaption(e.target.value)}
            maxLength={2000}
          />
          <div className="storiesComposerRow">
            <input
              ref={fileRef}
              type="file"
              accept="image/*,video/*"
              className="storiesComposerFile"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
            <span className="storiesTabMuted">
              {file ? file.name : "Optional image or video"}
            </span>
            <button
              type="button"
              className="storiesComposerPost"
              disabled={posting}
              onClick={() => void handlePost()}
            >
              {posting ? "Posting…" : "Post story"}
            </button>
          </div>
          {postError && <p className="storiesTabError">{postError}</p>}
        </section>

        <section className="storiesRailSection" aria-label="Friends stories">
          <h2 className="storiesRailHeading">Recent</h2>
          {!loading && !rail.length && !error && (
            <p className="storiesTabMuted">No active stories. Be the first to post.</p>
          )}
          <div className="storiesRail">
            {rail.map(({ authorId, stories: group }) => {
              const latest = group[0];
              const label =
                authorId === myId ? "You" : latest.author?.name || latest.author?.email || "Friend";
              const avatar = latest.author?.avatarUrl;
              return (
                <button
                  key={authorId}
                  type="button"
                  className="storiesRailItem"
                  onClick={() => openViewer(authorId, group)}
                >
                  <span className="storiesRailRing" aria-hidden>
                    {avatar ? (
                      <img src={avatar} alt="" className="storiesRailAvatar" />
                    ) : (
                      <span className="storiesRailInitial">{label.slice(0, 1).toUpperCase()}</span>
                    )}
                  </span>
                  <span className="storiesRailLabel">{label}</span>
                </button>
              );
            })}
          </div>
        </section>
      </div>

      {viewer && currentSlide && (
        <div className="storiesViewerOverlay" role="dialog" aria-modal="true" aria-label="Story viewer">
          <button type="button" className="storiesViewerBackdrop" onClick={closeViewer} aria-label="Close" />
          <div className="storiesViewerCard">
            <div className="storiesViewerTop">
              <div className="storiesViewerAuthor">
                {currentSlide.author?.avatarUrl ? (
                  <img src={currentSlide.author.avatarUrl} alt="" className="storiesViewerAvatar" />
                ) : (
                  <span className="storiesViewerInitial">
                    {(currentSlide.author?.name || "?").slice(0, 1).toUpperCase()}
                  </span>
                )}
                <div>
                  <div className="storiesViewerName">
                    {String(currentSlide.authorId) === myId
                      ? "Your story"
                      : currentSlide.author?.name || "Friend"}
                  </div>
                  <div className="storiesViewerMeta">
                    {formatTimeLeft(currentSlide.expiresAt)} · {viewer.index + 1}/{viewer.stories.length}
                  </div>
                </div>
              </div>
              <div className="storiesViewerActions">
                {String(currentSlide.authorId) === myId && (
                  <button type="button" className="storiesViewerDelete" onClick={() => void handleDelete()}>
                    Delete
                  </button>
                )}
                <button type="button" className="storiesViewerClose" onClick={closeViewer}>
                  ✕
                </button>
              </div>
            </div>

            <div className="storiesViewerNav">
              <button type="button" className="storiesViewerArrow" disabled={!canPrev} onClick={goPrev}>
                ‹
              </button>
              <div className="storiesViewerMedia">
                {currentSlide.kind === "video" && currentSlide.mediaUrl ? (
                  <video
                    key={currentSlide._id}
                    className="storiesViewerVideo"
                    src={currentSlide.mediaUrl}
                    controls
                    playsInline
                  />
                ) : currentSlide.kind === "image" && currentSlide.mediaUrl ? (
                  <img
                    key={currentSlide._id}
                    className="storiesViewerImg"
                    src={currentSlide.mediaUrl}
                    alt=""
                  />
                ) : (
                  <div className="storiesViewerTextOnly">{currentSlide.text || "—"}</div>
                )}
                {currentSlide.text && currentSlide.mediaUrl && (
                  <p className="storiesViewerCaption">{currentSlide.text}</p>
                )}
              </div>
              <button type="button" className="storiesViewerArrow" disabled={!canNext} onClick={goNext}>
                ›
              </button>
            </div>

            <div className="storiesViewerReactions" role="toolbar" aria-label="Reactions">
              {STORY_QUICK_REACTIONS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className="storiesViewerReactionBtn"
                  onClick={() => void handleReact(emoji)}
                >
                  {emoji}
                </button>
              ))}
            </div>
            {aggregateReactions(currentSlide.reactions, myId).length > 0 && (
              <div className="storiesViewerChips">
                {aggregateReactions(currentSlide.reactions, myId).map((chip) => (
                  <button
                    key={chip.emoji}
                    type="button"
                    className={`storiesReactionChip ${chip.mine ? "storiesReactionChip--mine" : ""}`}
                    onClick={() => void handleReact(chip.emoji)}
                  >
                    <span>{chip.emoji}</span>
                    <span className="storiesReactionChipCount">{chip.count}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default StoriesTab;
