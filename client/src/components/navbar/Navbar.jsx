import React from "react";
import "./Navbar.css";

const Navbar = () => {
  return (
    <nav className="nav">
      <div className="left">
        <h2 className="logo">ChatApp</h2>
      </div>

      <div className="middle">
        <input
          type="text"
          placeholder="Search users..."
          className="search"
        />
      </div>

      <div className="right">
        <span className="status">Online</span>
        <img
          src="https://i.pravatar.cc/40"
          alt="user"
          className="avatar"
        />
      </div>
    </nav>
  );
};

export default Navbar;