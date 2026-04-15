import { useEffect, useRef, useState } from "react";
import "./WaListChrome.css";

const IconNewChat = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M19 3H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h4l3 3 3-3h4c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-2 10h-4v4h-2v-4H7v-2h4V7h2v4h4v2z"
    />
  </svg>
);

const IconMore = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
    />
  </svg>
);

const IconSearch = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
    />
  </svg>
);

const comingSoon = (label) => () => window.alert(`${label} — coming soon.`);

const FILTERS = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "favourites", label: "Favourites" },
  { id: "groups", label: "Groups" },
];

const WaListChrome = ({
  searchQuery,
  onSearchChange,
  onNewChat,
  isMobile = false,
  onLogout,
  onOpenSettings,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [listFilter, setListFilter] = useState("all");
  const menuRef = useRef(null);
  const cameraRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  return (
    <div className="waListChrome">
      <div className="waListHeader">
        <h1 className="waListTitle">RChat</h1>
        <div className="waListHeaderActions">
          <button
            type="button"
            className="waListIconBtn"
            title="New chat"
            aria-label="New chat"
            onClick={onNewChat}
          >
            <IconNewChat />
          </button>
          <div className="waListMenuWrap" ref={menuRef}>
            <button
              type="button"
              className="waListIconBtn"
              aria-label="Menu"
              aria-expanded={menuOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMenuOpen((v) => !v);
              }}
            >
              <IconMore />
            </button>
            {menuOpen && (
              <div className="waListDropdown" role="menu">
                <button type="button" role="menuitem" onClick={comingSoon("New group")}>
                  New group
                </button>
                <button type="button" role="menuitem" onClick={comingSoon("New community")}>
                  New community
                </button>
                <button type="button" role="menuitem" onClick={comingSoon("Broadcast lists")}>
                  Broadcast lists
                </button>
                <button type="button" role="menuitem" onClick={comingSoon("Linked devices")}>
                  Linked devices
                </button>
                <button type="button" role="menuitem" onClick={comingSoon("Starred")}>
                  Starred
                </button>
                <button type="button" role="menuitem" onClick={comingSoon("Read all")}>
                  Read all
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    onOpenSettings?.();
                  }}
                >
                  Settings
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMenuOpen(false);
                    cameraRef.current?.click();
                  }}
                >
                  Take photo
                </button>
                {isMobile && (
                  <>
                    <button type="button" role="menuitem" onClick={comingSoon("Profile")}>
                      Profile
                    </button>
                    <button
                      type="button"
                      role="menuitem"
                      onClick={() => {
                        setMenuOpen(false);
                        onLogout?.();
                      }}
                    >
                      Log out
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="waHiddenFile"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                window.alert(`Photo: ${f.name} (sending photos coming soon)`);
              }
              e.target.value = "";
            }}
          />
        </div>
      </div>

      <div className="waListSearchWrap">
        <label className="waListSearch">
          <IconSearch />
          <input
            type="search"
            className="waListSearchInput"
            placeholder="Search or start a new chat"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
      </div>

      <div className="waFilterRow" role="tablist" aria-label="Chat filters">
        {FILTERS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={listFilter === id}
            className={`waFilterChip ${listFilter === id ? "waFilterChip--active" : ""}`}
            onClick={() => {
              if (id === "all") {
                setListFilter("all");
              } else {
                window.alert(`${label} — coming soon.`);
              }
            }}
          >
            {label}
          </button>
        ))}
        <button
          type="button"
          className="waFilterChipMore"
          aria-label="More filters"
          onClick={comingSoon("More filters")}
        >
          +
        </button>
      </div>
    </div>
  );
};

export default WaListChrome;
