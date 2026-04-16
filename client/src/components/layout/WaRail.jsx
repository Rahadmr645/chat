import { useEffect, useRef, useState } from "react";
import {
  IconArchive,
  IconCalls,
  IconChats,
  IconCommunities,
  IconSettings,
  IconStar,
  IconStatus,
} from "../../assets/icons/waRailIcons.jsx";
import "./WaRail.css";

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
            {user?.avatarUrl ? (
              <img src={user.avatarUrl} alt={`${user?.name || "User"} avatar`} />
            ) : (
              user?.name?.charAt(0)?.toUpperCase() ?? "U"
            )}
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
