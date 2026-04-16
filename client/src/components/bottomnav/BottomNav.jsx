import { createElement } from "react";
import {
  IconCalls,
  IconChats,
  IconCommunities,
  IconUpdates,
} from "../../assets/icons/bottomNavIcons.jsx";
import "./BottomNav.css";

const tabs = [
  { id: "chats", label: "Chats", Icon: IconChats },
  { id: "updates", label: "Updates", Icon: IconUpdates },
  { id: "communities", label: "Communities", Icon: IconCommunities },
  { id: "calls", label: "Calls", Icon: IconCalls },
];

const BottomNav = ({ active, onSelect }) => {
  return (
    <nav className="waBottomNav" aria-label="Main">
      {tabs.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          className={`waBottomNavBtn ${active === id ? "waBottomNavBtn--active" : ""}`}
          onClick={() => onSelect(id)}
        >
          <span className="waBottomNavIcon">{createElement(Icon)}</span>
          <span className="waBottomNavLabel">{label}</span>
        </button>
      ))}
    </nav>
  );
};

export default BottomNav;
