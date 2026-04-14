import React from "react";
import "./Sidebar.css";

const Sidebar = () => {
  return (
    <div className="sidebar">
      <div className="sidebarHeader">
        <h3>Chats</h3>
      </div>

      <div className="chatList">
        <div className="chatItem">
          <img src="https://i.pravatar.cc/50?img=1" alt="" />
          <div>
            <h4>John Doe</h4>
            <p>Last message here...</p>
          </div>
        </div>

        <div className="chatItem">
          <img src="https://i.pravatar.cc/50?img=2" alt="" />
          <div>
            <h4>Sarah</h4>
            <p>Are you coming?</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;