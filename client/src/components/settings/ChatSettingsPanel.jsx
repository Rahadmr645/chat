import { useEffect, useMemo, useState } from "react";
import { IconChevronLeft } from "../../assets/icons/chatIcons.jsx";
import "../sidebar/Sidebar.css";
import "./ChatSettingsPanel.css";
import { apiUploadProfilePhoto } from "../../services/api.js";

const VIEWS = {
  HOME: "home",
  REQUESTS: "requests",
  BLOCKED: "blocked",
  DISCOVER: "discover",
};

const match = (userLike, q) => {
  if (!q) return true;
  if (!userLike) return false;
  const blob = `${userLike.name ?? ""} ${userLike.email ?? ""}`.toLowerCase();
  return blob.includes(q);
};

const titles = {
  [VIEWS.HOME]: "Settings",
  [VIEWS.REQUESTS]: "Friend requests",
  [VIEWS.BLOCKED]: "Blocked accounts",
  [VIEWS.DISCOVER]: "Discover people",
};

const SETTINGS_HOME_ITEMS = [
  {
    id: "general",
    icon: "🖥️",
    title: "General",
    subtitle: "Startup and close",
    action: "soon",
  },
  {
    id: "account",
    icon: "🔑",
    title: "Account",
    subtitle: "Security notifications, account info",
    action: "soon",
  },
  {
    id: "privacy",
    icon: "🔒",
    title: "Privacy",
    subtitle: "Blocked contacts, disappearing messages",
    action: "view",
    view: VIEWS.BLOCKED,
  },
  {
    id: "chats",
    icon: "💬",
    title: "Chats",
    subtitle: "Theme, wallpaper, chat settings",
    action: "soon",
  },
  {
    id: "media",
    icon: "🎥",
    title: "Video & voice",
    subtitle: "Camera, microphone & speakers",
    action: "soon",
  },
  {
    id: "notifications",
    icon: "🔔",
    title: "Notifications",
    subtitle: "Messages, groups, sounds",
    action: "soon",
  },
  {
    id: "shortcuts",
    icon: "⌨️",
    title: "Keyboard shortcuts",
    subtitle: "Quick actions",
    action: "soon",
  },
  {
    id: "help",
    icon: "❓",
    title: "Help and feedback",
    subtitle: "Help center, contact us, privacy policy",
    action: "soon",
  },
];

const Avatar = ({ userLike, className = "avatarStub", fallback = "U" }) => {
  const label = userLike?.name?.charAt(0)?.toUpperCase() || fallback;
  if (userLike?.avatarUrl) {
    return (
      <img
        src={userLike.avatarUrl}
        alt={`${userLike?.name || "User"} avatar`}
        className={`${className} avatarPhoto`}
      />
    );
  }
  return <div className={className}>{label}</div>;
};

const ChatSettingsPanel = ({
  open,
  onClose,
  currentUser,
  token,
  onLogout,
  loading,
  error,
  friendActionError,
  users,
  incomingRequests,
  blockedUsers,
  onSendFriendRequest,
  onSendFriendRequestByEmail,
  onAcceptRequest,
  onRejectRequest,
  onBlockFromRequest,
  onUnblock,
  onProfileUpdate,
}) => {
  const [view, setView] = useState(VIEWS.HOME);
  const [q, setQ] = useState("");
  const [profileUploading, setProfileUploading] = useState(false);
  const [profileError, setProfileError] = useState("");
  const [pendingActions, setPendingActions] = useState({});

  const isPending = (key) => Boolean(pendingActions[key]);

  const runWithLoading = async (key, fn) => {
    if (pendingActions[key]) return;
    setPendingActions((prev) => ({ ...prev, [key]: true }));
    try {
      await fn();
    } finally {
      setPendingActions((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  useEffect(() => {
    if (!open) {
      setView(VIEWS.HOME);
      setQ("");
      setProfileError("");
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (view === VIEWS.HOME) onClose();
      else setView(VIEWS.HOME);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, view]);

  const discoverUsers = useMemo(
    () => users.filter((u) => !u.isFriend && u.requestStatus !== "received"),
    [users]
  );

  const qn = q.trim().toLowerCase();
  const filteredIncoming = useMemo(
    () => incomingRequests.filter((req) => match(req.from, qn)),
    [incomingRequests, qn]
  );
  const filteredBlocked = useMemo(
    () => blockedUsers.filter((u) => match(u, qn)),
    [blockedUsers, qn]
  );
  const filteredDiscover = useMemo(
    () => discoverUsers.filter((u) => match(u, qn)),
    [discoverUsers, qn]
  );

  const handleHeaderBack = () => {
    if (view === VIEWS.HOME) onClose();
    else setView(VIEWS.HOME);
  };

  const comingSoon = (label) => () => {
    window.alert(`${label} — coming soon.`);
  };

  if (!open) return null;

  const uploadProfilePhoto = async (file) => {
    if (!file || !token) return;
    setProfileUploading(true);
    setProfileError("");
    try {
      const data = await apiUploadProfilePhoto({ token, file });
      onProfileUpdate?.(data.user);
    } catch (err) {
      setProfileError(err.message || "Could not update profile photo.");
    } finally {
      setProfileUploading(false);
    }
  };

  const showSearch =
    view === VIEWS.REQUESTS || view === VIEWS.BLOCKED || view === VIEWS.DISCOVER;

  return (
    <div
      className="chatSettingsOverlay"
      role="presentation"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="chatSettingsPanel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="chat-settings-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="chatSettingsHeader">
          <button
            type="button"
            className="chatSettingsBack"
            aria-label={view === VIEWS.HOME ? "Close settings" : "Back to settings home"}
            onClick={handleHeaderBack}
          >
            <IconChevronLeft />
          </button>
          <h2 id="chat-settings-title" className="chatSettingsTitle">
            {titles[view]}
          </h2>
        </header>

        <div className="chatSettingsBody">
          {friendActionError && <p className="sidebarError">{friendActionError}</p>}
          {error && <p className="sidebarError">{error}</p>}
          {profileError && <p className="sidebarError">{profileError}</p>}
          {loading && view !== VIEWS.HOME && <p className="sidebarInfo">Loading…</p>}

          {view === VIEWS.HOME && (
            <>
              <div className="stSearchWrap">
                <input
                  type="search"
                  className="chatSettingsSearch stSearchHome"
                  placeholder="Search"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  autoComplete="off"
                />
              </div>
              <section className="stProfileSection stProfileSection--wa" aria-label="Profile settings">
                <Avatar userLike={currentUser} className="stProfileAvatar stProfileAvatar--wa" fallback="U" />
                <div className="stProfileMeta">
                  <h3>{currentUser?.name || "You"}</h3>
                  <p>{currentUser?.email || ""}</p>
                </div>
                <label className="stProfileUploadBtn">
                  {profileUploading ? "Uploading..." : "Change photo"}
                  <input
                    type="file"
                    accept="image/*"
                    disabled={profileUploading}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) void uploadProfilePhoto(f);
                      e.target.value = "";
                    }}
                  />
                </label>
              </section>
              <nav className="stHomeNav stHomeNav--wa" aria-label="Settings sections">
                {SETTINGS_HOME_ITEMS.filter((item) => {
                  const query = q.trim().toLowerCase();
                  if (!query) return true;
                  return `${item.title} ${item.subtitle}`.toLowerCase().includes(query);
                }).map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    className="stHomeRow stHomeRow--wa"
                    onClick={
                      item.action === "view"
                        ? () => setView(item.view)
                        : comingSoon(item.title)
                    }
                  >
                    <span className="stHomeIcon" aria-hidden="true">
                      {item.icon}
                    </span>
                    <span className="stHomeInfo">
                      <span className="stHomeRowLabel">{item.title}</span>
                      <span className="stHomeSub">{item.subtitle}</span>
                    </span>
                    <span className="stHomeChevron" aria-hidden="true">
                      ›
                    </span>
                  </button>
                ))}
                <button
                  type="button"
                  className="stHomeRow stHomeRow--wa"
                  onClick={() => setView(VIEWS.REQUESTS)}
                >
                  <span className="stHomeIcon" aria-hidden="true">
                    📨
                  </span>
                  <span className="stHomeInfo">
                    <span className="stHomeRowLabel">Friend requests</span>
                    <span className="stHomeSub">Manage incoming requests</span>
                  </span>
                  {incomingRequests.length > 0 && (
                    <span className="stHomeBadge">{incomingRequests.length}</span>
                  )}
                  <span className="stHomeChevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="stHomeRow stHomeRow--wa"
                  onClick={() => setView(VIEWS.DISCOVER)}
                >
                  <span className="stHomeIcon" aria-hidden="true">
                    👥
                  </span>
                  <span className="stHomeInfo">
                    <span className="stHomeRowLabel">Discover people</span>
                    <span className="stHomeSub">Find users and send requests</span>
                  </span>
                  <span className="stHomeChevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="stHomeRow stHomeRow--wa stHomeRow--danger"
                  onClick={onLogout}
                >
                  <span className="stHomeIcon" aria-hidden="true">
                    ⎋
                  </span>
                  <span className="stHomeInfo">
                    <span className="stHomeRowLabel">Log out</span>
                    <span className="stHomeSub">Sign out from this device</span>
                  </span>
                </button>
              </nav>
              <div className="chatSettingsAddRow">
                <button
                  type="button"
                  className="chatSettingsAddBtn actionBtn"
                  onClick={() =>
                    runWithLoading("addByEmail", () => onSendFriendRequestByEmail())
                  }
                  disabled={isPending("addByEmail")}
                >
                  {isPending("addByEmail") ? (
                    <>
                      <span className="actionSpinner" aria-hidden="true" />
                      Adding...
                    </>
                  ) : (
                    "Add friend by email"
                  )}
                </button>
              </div>
            </>
          )}

          {showSearch && (
            <input
              type="search"
              className="chatSettingsSearch"
              placeholder={
                view === VIEWS.REQUESTS
                  ? "Search by name or email…"
                  : view === VIEWS.BLOCKED
                    ? "Search blocked users…"
                    : "Search people…"
              }
              value={q}
              onChange={(e) => setQ(e.target.value)}
              autoComplete="off"
            />
          )}

          {view === VIEWS.REQUESTS && (
            <>
              {!loading && filteredIncoming.length === 0 && (
                <p className="sidebarInfo muted">No pending requests</p>
              )}
              {filteredIncoming.map((req) => (
                <div key={req._id} className="requestRow">
                  <div className="requestInfo">
                    <Avatar userLike={req.from} />
                    <div>
                      <h4>{req.from?.name}</h4>
                      <p>{req.from?.email}</p>
                    </div>
                  </div>
                  <div className="requestActions">
                    <button
                      type="button"
                      className="btnAccept actionBtn"
                      onClick={() =>
                        runWithLoading(`accept:${req._id}`, () =>
                          onAcceptRequest(req._id)
                        )
                      }
                      disabled={
                        isPending(`accept:${req._id}`) ||
                        isPending(`reject:${req._id}`) ||
                        isPending(`block:${req._id}`)
                      }
                    >
                      {isPending(`accept:${req._id}`) ? (
                        <>
                          <span className="actionSpinner actionSpinner--light" aria-hidden="true" />
                          Accepting...
                        </>
                      ) : (
                        "Accept"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btnIgnore actionBtn"
                      onClick={() =>
                        runWithLoading(`reject:${req._id}`, () =>
                          onRejectRequest(req._id)
                        )
                      }
                      disabled={
                        isPending(`accept:${req._id}`) ||
                        isPending(`reject:${req._id}`) ||
                        isPending(`block:${req._id}`)
                      }
                    >
                      {isPending(`reject:${req._id}`) ? (
                        <>
                          <span className="actionSpinner" aria-hidden="true" />
                          Ignoring...
                        </>
                      ) : (
                        "Ignore"
                      )}
                    </button>
                    <button
                      type="button"
                      className="btnBlock actionBtn"
                      onClick={() =>
                        runWithLoading(`block:${req._id}`, () =>
                          onBlockFromRequest(req._id)
                        )
                      }
                      disabled={
                        isPending(`accept:${req._id}`) ||
                        isPending(`reject:${req._id}`) ||
                        isPending(`block:${req._id}`)
                      }
                    >
                      {isPending(`block:${req._id}`) ? (
                        <>
                          <span className="actionSpinner actionSpinner--light" aria-hidden="true" />
                          Blocking...
                        </>
                      ) : (
                        "Block"
                      )}
                    </button>
                  </div>
                </div>
              ))}
            </>
          )}

          {view === VIEWS.DISCOVER && (
            <>
              {filteredDiscover.length === 0 && (
                <p className="sidebarInfo">No one to discover right now.</p>
              )}
              {filteredDiscover.map((user) => (
                <div key={user._id} className="discoverItem">
                  <div className="discoverInfo">
                    <Avatar userLike={user} />
                    <div className="friendMeta">
                      <div className="friendNameRow">
                        <h4>{user.name}</h4>
                        {user.isOnline && (
                          <span className="onlineDot" title="Online" aria-label="Online" />
                        )}
                      </div>
                      <p>{user.email}</p>
                    </div>
                  </div>
                  {user.requestStatus === "sent" ? (
                    <span className="pendingLabel">Pending</span>
                  ) : (
                    <button
                      type="button"
                      className="addFriendBtn actionBtn"
                      onClick={() =>
                        runWithLoading(`send:${user._id}`, () =>
                          onSendFriendRequest(user._id)
                        )
                      }
                      disabled={isPending(`send:${user._id}`)}
                    >
                      {isPending(`send:${user._id}`) ? (
                        <>
                          <span className="actionSpinner actionSpinner--light" aria-hidden="true" />
                          Sending...
                        </>
                      ) : (
                        "Send request"
                      )}
                    </button>
                  )}
                </div>
              ))}
            </>
          )}

          {view === VIEWS.BLOCKED && (
            <>
              {!loading && filteredBlocked.length === 0 && (
                <p className="sidebarInfo muted">No blocked users</p>
              )}
              {filteredBlocked.map((user) => (
                <div key={user._id} className="blockedRow">
                  <div className="blockedInfo">
                    <Avatar userLike={user} className="avatarStub blockedAvatar" />
                    <div>
                      <h4>{user.name}</h4>
                      <p>{user.email}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    className="btnUnblock actionBtn"
                    onClick={() =>
                      runWithLoading(`unblock:${user._id}`, () => onUnblock(user._id))
                    }
                    disabled={isPending(`unblock:${user._id}`)}
                  >
                    {isPending(`unblock:${user._id}`) ? (
                      <>
                        <span className="actionSpinner" aria-hidden="true" />
                        Unblocking...
                      </>
                    ) : (
                      "Unblock"
                    )}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatSettingsPanel;
