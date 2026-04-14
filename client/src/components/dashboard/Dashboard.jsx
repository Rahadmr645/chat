import React from "react";
import "./Dashboard.css";
import Sidebar from "../sidebar/Sidebar";
import ChatWindow from "../chat/ChatWindow";

const Dashboard = () => {
  return (
    <div className="dashboard">
      <Sidebar />
      <ChatWindow />
    </div>
  );
};

export default Dashboard;