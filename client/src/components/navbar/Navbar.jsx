import { useEffect, useRef, useState } from "react";
import { IconCamera, IconNavMore, IconNavSearch } from "../../assets/icons/navbarIcons.jsx";
import "./Navbar.css";

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
              <IconNavMore />
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
            <IconNavSearch />
          </button>
        </div>
      </div>
    </header>
  );
};

export default Navbar;
