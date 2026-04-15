import { useEffect, useMemo, useState } from "react";
import "../sidebar/Sidebar.css";
import "./ChatSettingsPanel.css";

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

const ChatSettingsPanel = ({
  open,
  onClose,
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
}) => {
  const [view, setView] = useState(VIEWS.HOME);
  const [q, setQ] = useState("");

  useEffect(() => {
    if (!open) {
      setView(VIEWS.HOME);
      setQ("");
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

  if (!open) return null;

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
            ←
          </button>
          <h2 id="chat-settings-title" className="chatSettingsTitle">
            {titles[view]}
          </h2>
        </header>

        <div className="chatSettingsBody">
          {friendActionError && <p className="sidebarError">{friendActionError}</p>}
          {error && <p className="sidebarError">{error}</p>}
          {loading && view !== VIEWS.HOME && <p className="sidebarInfo">Loading…</p>}

          {view === VIEWS.HOME && (
            <>
              <nav className="stHomeNav" aria-label="Settings sections">
                <button
                  type="button"
                  className="stHomeRow"
                  onClick={() => setView(VIEWS.REQUESTS)}
                >
                  <span className="stHomeRowLabel">Friend requests</span>
                  {incomingRequests.length > 0 && (
                    <span className="stHomeBadge">{incomingRequests.length}</span>
                  )}
                  <span className="stHomeChevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="stHomeRow"
                  onClick={() => setView(VIEWS.BLOCKED)}
                >
                  <span className="stHomeRowLabel">Blocked accounts</span>
                  {blockedUsers.length > 0 && (
                    <span className="stHomeBadge">{blockedUsers.length}</span>
                  )}
                  <span className="stHomeChevron" aria-hidden="true">
                    ›
                  </span>
                </button>
                <button
                  type="button"
                  className="stHomeRow"
                  onClick={() => setView(VIEWS.DISCOVER)}
                >
                  <span className="stHomeRowLabel">Discover people</span>
                  <span className="stHomeChevron" aria-hidden="true">
                    ›
                  </span>
                </button>
              </nav>
              <div className="chatSettingsAddRow">
                <button
                  type="button"
                  className="chatSettingsAddBtn"
                  onClick={onSendFriendRequestByEmail}
                >
                  Add friend by email
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
                    <div className="avatarStub">
                      {req.from?.name?.charAt(0)?.toUpperCase() ?? "?"}
                    </div>
                    <div>
                      <h4>{req.from?.name}</h4>
                      <p>{req.from?.email}</p>
                    </div>
                  </div>
                  <div className="requestActions">
                    <button
                      type="button"
                      className="btnAccept"
                      onClick={() => onAcceptRequest(req._id)}
                    >
                      Accept
                    </button>
                    <button
                      type="button"
                      className="btnIgnore"
                      onClick={() => onRejectRequest(req._id)}
                    >
                      Ignore
                    </button>
                    <button
                      type="button"
                      className="btnBlock"
                      onClick={() => onBlockFromRequest(req._id)}
                    >
                      Block
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
                    <div className="avatarStub">{user.name?.charAt(0)?.toUpperCase() ?? "U"}</div>
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
                      className="addFriendBtn"
                      onClick={() => onSendFriendRequest(user._id)}
                    >
                      Send request
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
                    <div className="avatarStub blockedAvatar">
                      {user.name?.charAt(0)?.toUpperCase() ?? "U"}
                    </div>
                    <div>
                      <h4>{user.name}</h4>
                      <p>{user.email}</p>
                    </div>
                  </div>
                  <button type="button" className="btnUnblock" onClick={() => onUnblock(user._id)}>
                    Unblock
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
