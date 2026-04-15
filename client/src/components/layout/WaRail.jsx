import { useEffect, useRef, useState } from "react";
import "./WaRail.css";

const IconChats = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"
    />
  </svg>
);

const IconStatus = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" strokeWidth="1.75" />
    <circle cx="12" cy="12" r="3.5" fill="currentColor" />
  </svg>
);

const IconCommunities = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.96 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
    />
  </svg>
);

const IconCalls = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M20.01 15.38c-1.23 0-2.42-.2-3.53-.56a.977.977 0 0 0-1.01.24l-1.57 1.97c-2.83-1.35-5.48-3.9-6.89-6.83l1.95-1.66c.27-.28.35-.67.24-1.02-.37-1.11-.56-2.3-.56-3.53 0-.54-.45-.99-.99-.99H4.19C3.65 3 3 3.24 3 3.99 3 13.28 10.73 21 20.01 21c.71 0 .99-.63.99-1.18v-3.45c0-.54-.45-.99-.99-.99z"
    />
  </svg>
);

const IconStar = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z"
    />
  </svg>
);

const IconArchive = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M20.54 5.23l-1.39-1.68C18.88 3.21 18.47 3 18 3H6c-.47 0-.88.21-1.16.55L3.46 5.23C3.17 5.57 3 6.02 3 6.5V19c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V6.5c0-.48-.17-.93-.46-1.27zM12 17.5L6.5 12H10V8h4v4h3.5L12 17.5z"
    />
  </svg>
);

const IconSettings = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19.14 12.94c.04-.31.06-.63.06-.94 0-.31-.02-.63-.06-.94l2.03-1.58c.18-.14.23-.41.12-.61l-1.92-3.32c-.12-.22-.37-.29-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54c-.04-.24-.24-.41-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94l-2.03 1.58c-.18.14-.23.41-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
    />
  </svg>
);

const comingSoon = (label) => () => window.alert(`${label} — coming soon.`);

const WaRail = ({
  mainTab,
  onTabChange,
  user,
  onLogout,
  onOpenSettings,
  pendingRequestCount = 0,
}) => {
  const [profileOpen, setProfileOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setProfileOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <nav className="waRail" aria-label="Primary">
      <div className="waRailTop">
        <button
          type="button"
          className={`waRailBtn ${mainTab === "chats" ? "waRailBtn--active" : ""}`}
          title="Chats"
          aria-label="Chats"
          onClick={() => onTabChange("chats")}
        >
          <IconChats />
          {pendingRequestCount > 0 && (
            <span className="waRailBadge">
              {pendingRequestCount > 9 ? "9+" : pendingRequestCount}
            </span>
          )}
        </button>
        <button
          type="button"
          className={`waRailBtn ${mainTab === "updates" ? "waRailBtn--active" : ""}`}
          title="Updates"
          aria-label="Updates"
          onClick={() => onTabChange("updates")}
        >
          <IconStatus />
        </button>
        <button
          type="button"
          className={`waRailBtn ${mainTab === "communities" ? "waRailBtn--active" : ""}`}
          title="Communities"
          aria-label="Communities"
          onClick={() => onTabChange("communities")}
        >
          <IconCommunities />
        </button>
        <button
          type="button"
          className={`waRailBtn ${mainTab === "calls" ? "waRailBtn--active" : ""}`}
          title="Calls"
          aria-label="Calls"
          onClick={() => onTabChange("calls")}
        >
          <IconCalls />
        </button>
        <button
          type="button"
          className="waRailAiBtn"
          title="AI"
          aria-label="AI assistant"
          onClick={comingSoon("AI assistant")}
        >
          AI
        </button>
      </div>

      <div className="waRailSpacer" />

      <div className="waRailBottom">
        <button
          type="button"
          className="waRailBtn"
          title="Starred"
          aria-label="Starred"
          onClick={comingSoon("Starred")}
        >
          <IconStar />
        </button>
        <button
          type="button"
          className="waRailBtn"
          title="Archived"
          aria-label="Archived"
          onClick={comingSoon("Archived")}
        >
          <IconArchive />
        </button>
        <button
          type="button"
          className="waRailBtn"
          title="Settings"
          aria-label="Settings"
          onClick={() => onOpenSettings?.()}
        >
          <IconSettings />
        </button>
        <div className="waRailMenu" ref={menuRef}>
          <button
            type="button"
            className="waRailProfile"
            aria-label="Profile menu"
            aria-expanded={profileOpen}
            onClick={(e) => {
              e.stopPropagation();
              setProfileOpen((v) => !v);
            }}
          >
            {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
          </button>
          {profileOpen && (
            <div className="waRailDropdown" role="menu">
              <button type="button" role="menuitem" onClick={comingSoon("Profile")}>
                Profile
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  onOpenSettings?.();
                }}
              >
                Settings
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setProfileOpen(false);
                  onLogout();
                }}
              >
                Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );
};

export default WaRail;
