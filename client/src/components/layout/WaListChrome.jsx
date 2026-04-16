import { useEffect, useRef, useState } from "react";
import NotificationCenter from "../notifications/NotificationCenter.jsx";
import { IconListMore, IconListSearch, IconNewChat } from "../../assets/icons/waListChromeIcons.jsx";
import "./WaListChrome.css";

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
          <NotificationCenter />
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
              <IconListMore />
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
          <IconListSearch />
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
