import { useEffect, useRef, useState } from "react";
import "./Navbar.css";

const IconSearch = () => (
  <svg className="navIconSvg" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M15.5 14h-.79l-.28-.27A6.471 6.471 0 0 0 16 9.5 6.5 6.5 0 1 0 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"
    />
  </svg>
);

const IconCamera = () => (
  <svg className="navIconSvg" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 15.2a3.2 3.2 0 1 0 0-6.4 3.2 3.2 0 0 0 0 6.4zm9-7.2h-3.2l-1-2H7.2l-1 2H3L1 20h22L21 8z"
    />
  </svg>
);

const IconMore = () => (
  <svg className="navIconSvg" viewBox="0 0 24 24" aria-hidden="true">
    <path
      fill="currentColor"
      d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"
    />
  </svg>
);

const comingSoon = (label) => () => {
  window.alert(`${label} — coming soon.`);
};

const Navbar = ({ user, onLogout, searchOpen, onSearchOpenChange }) => {
  const [moreOpen, setMoreOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const moreRef = useRef(null);
  const profileRef = useRef(null);
  const cameraInputRef = useRef(null);

  useEffect(() => {
    const close = (e) => {
      const t = e.target;
      if (moreRef.current && !moreRef.current.contains(t)) setMoreOpen(false);
      if (profileRef.current && !profileRef.current.contains(t)) setProfileOpen(false);
    };
    document.addEventListener("click", close);
    return () => document.removeEventListener("click", close);
  }, []);

  const toggleSearch = (e) => {
    e.stopPropagation();
    onSearchOpenChange(!searchOpen);
  };

  return (
    <header className="waNav">
      <div className="waNavBar">
        <div className="waNavLeft">
          <h1 className="waLogo waLogo--rchat">RCHAT</h1>
        </div>
        <div className="waNavRight">
          <button
            type="button"
            className="waIconBtn"
            aria-label="Camera"
            onClick={() => cameraInputRef.current?.click()}
          >
            <IconCamera />
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="waHiddenInput"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) {
                window.alert(`Photo selected: ${f.name} (sending photos coming soon)`);
              }
              e.target.value = "";
            }}
          />
          <div className="waMenuWrap" ref={profileRef}>
            <button
              type="button"
              className="waIconBtn waProfileBtn"
              aria-label="Profile"
              aria-expanded={profileOpen}
              onClick={(e) => {
                e.stopPropagation();
                setProfileOpen((v) => !v);
                setMoreOpen(false);
              }}
            >
              <span className="waProfileLetter" title={user?.name}>
                {user?.name?.charAt(0)?.toUpperCase() ?? "U"}
              </span>
            </button>
            {profileOpen && (
              <div className="waDropdown waDropdown--profile" role="menu">
                <div className="waDropdownHeader">
                  <strong>{user?.name}</strong>
                  <span className="waDropdownEmail">{user?.email}</span>
                </div>
                <button type="button" role="menuitem" onClick={comingSoon("Profile")}>
                  Profile
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
          <div className="waMenuWrap" ref={moreRef}>
            <button
              type="button"
              className="waIconBtn"
              aria-label="More options"
              aria-expanded={moreOpen}
              onClick={(e) => {
                e.stopPropagation();
                setMoreOpen((v) => !v);
                setProfileOpen(false);
              }}
            >
              <IconMore />
            </button>
            {moreOpen && (
              <div className="waDropdown" role="menu">
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
                <button type="button" role="menuitem" onClick={comingSoon("Settings")}>
                  Settings
                </button>
              </div>
            )}
          </div>
          <button
            type="button"
            className={`waIconBtn ${searchOpen ? "waIconBtn--active" : ""}`}
            aria-label="Search"
            onClick={toggleSearch}
          >
            <IconSearch />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
