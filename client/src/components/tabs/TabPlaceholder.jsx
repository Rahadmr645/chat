import "./TabPlaceholder.css";

const copy = {
  updates: {
    title: "Updates",
    subtitle: "Status and channels will appear here.",
  },
  communities: {
    title: "Communities",
    subtitle: "Join groups about topics you care about.",
  },
  calls: {
    title: "Calls",
    subtitle: "Your voice and video calls will show up here.",
  },
};

const TabPlaceholder = ({ tab, variant = "" }) => {
  const { title, subtitle } = copy[tab] || { title: tab, subtitle: "" };
  const cls = ["tabPlaceholder", variant === "solo" ? "tabPlaceholder--solo" : ""]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls}>
      <h2>{title}</h2>
      <p>{subtitle}</p>
      <span className="tabPlaceholderBadge">Coming soon</span>
    </div>
  );
};

export default TabPlaceholder;
