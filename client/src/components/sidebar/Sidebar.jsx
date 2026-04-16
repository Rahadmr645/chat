import { useEffect } from "react";
import WaListChrome from "../layout/WaListChrome.jsx";
import "./Sidebar.css";

const Sidebar = ({
  friends,
  loading,
  error,
  friendActionError,
  activeUserId,
  isMobile = false,
  sidebarOpen = false,
  onSelectUser,
  onSendFriendRequestByEmail,
  onBlockFriend,
  onUnfriend,
  searchQuery = "",
  onSearchQueryChange,
  onLogout,
  onOpenSettings,
}) => {
  useEffect(() => {
    const closeKebabMenus = (e) => {
      document.querySelectorAll("details.friendRowKebab[open]").forEach((el) => {
        if (!el.contains(e.target)) {
          el.removeAttribute("open");
        }
      });
    };
    document.addEventListener("pointerdown", closeKebabMenus, true);
    return () => document.removeEventListener("pointerdown", closeKebabMenus, true);
  }, []);

  const sidebarClass = [
    "sidebar",
    isMobile && sidebarOpen ? "sidebar--open" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <aside className={sidebarClass}>
      <WaListChrome
        searchQuery={searchQuery}
        onSearchChange={onSearchQueryChange}
        onNewChat={onSendFriendRequestByEmail}
        isMobile={isMobile}
        onLogout={onLogout}
        onOpenSettings={onOpenSettings}
      />

      <div className="chatList">
        {loading && <p className="sidebarInfo">Loading...</p>}
        {error && <p className="sidebarError">{error}</p>}
        {friendActionError && <p className="sidebarError">{friendActionError}</p>}

        {!loading && !error && friends.length === 0 && (
          <p className="sidebarInfo">
            No chats yet. Tap + to invite by email, or open Settings for requests and blocked
            accounts.
          </p>
        )}

        {friends.map((user) => {
          const isActive = activeUserId === user._id;
          const avatarLetter = user.name?.charAt(0)?.toUpperCase() ?? "U";
          return (
            <div key={user._id} className={`friendRow ${isActive ? "active" : ""}`}>
              <button
                type="button"
                className="friendMain"
                onClick={() => onSelectUser(user._id)}
              >
                {user.avatarUrl ? (
                  <img
                    src={user.avatarUrl}
                    alt={`${user.name} avatar`}
                    className="avatarStub avatarPhoto"
                  />
                ) : (
                  <div className="avatarStub">{avatarLetter}</div>
                )}
                <div className="friendMeta">
                  <div className="friendTopLine">
                    <div className="friendNameRow">
                      <h4>{user.name}</h4>
                      {user.isOnline && (
                        <span className="onlineDot" title="Online" aria-label="Online" />
                      )}
                    </div>
                    <span className="friendRowTime" aria-hidden="true">
                      {"\u00a0"}
                    </span>
                  </div>
                  <p className="friendPreview">{user.email}</p>
                </div>
              </button>
              <details className="friendRowKebab" onClick={(e) => e.stopPropagation()}>
                <summary className="friendRowKebabBtn" aria-label="Chat options">
                  ⋮
                </summary>
                <div className="friendRowKebabPanel">
                  <button
                    type="button"
                    className="friendRowKebabItem"
                    onClick={() => onUnfriend(user._id)}
                  >
                    Unfriend
                  </button>
                  <button
                    type="button"
                    className="friendRowKebabItem friendRowKebabItem--danger"
                    onClick={() => onBlockFriend(user._id)}
                  >
                    Block
                  </button>
                </div>
              </details>
            </div>
          );
        })}
      </div>
    </aside>
  );
};

export default Sidebar;
