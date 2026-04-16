import { useEffect, useRef, useState } from "react";
import { IconBell } from "../../assets/icons/notificationIcons.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";
import "./NotificationCenter.css";

const NotificationCenter = () => {
  const {
    items,
    unreadCount,
    formatTimeAgo,
    markRead,
    markAllRead,
    remove,
    clearAll,
    runAction,
  } = useNotifications();

  const [open, setOpen] = useState(false);
  const wrapRef = useRef(null);

  useEffect(() => {
    const onDoc = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("click", onDoc);
    return () => document.removeEventListener("click", onDoc);
  }, []);

  const requestDesktopPermission = () => {
    if (typeof Notification === "undefined") return;
    void Notification.requestPermission();
  };

  return (
    <div className="notifCenter" ref={wrapRef}>
      <button
        type="button"
        className="waListIconBtn notifCenter__btn"
        aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
        aria-expanded={open}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <IconBell />
        {unreadCount > 0 && (
          <span className="notifCenter__badge">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div className="notifCenter__panel" role="dialog" aria-label="Notifications">
          <div className="notifCenter__head">
            <h2 className="notifCenter__title">Notifications</h2>
            <div className="notifCenter__headActions">
              {items.length > 0 && (
                <>
                  <button type="button" className="notifCenter__linkBtn" onClick={markAllRead}>
                    Read all
                  </button>
                  <button type="button" className="notifCenter__linkBtn" onClick={clearAll}>
                    Clear
                  </button>
                </>
              )}
            </div>
          </div>

          {typeof Notification !== "undefined" && Notification.permission === "default" && (
            <button type="button" className="notifCenter__banner" onClick={requestDesktopPermission}>
              Turn on desktop alerts — get notified when the tab is in the background
            </button>
          )}

          <div className="notifCenter__list">
            {items.length === 0 && (
              <p className="notifCenter__empty">No notifications yet. Messages and friend requests
                appear here when you are not in that chat.</p>
            )}
            {items.map((n) => (
              <div
                key={n.id}
                className={`notifCenter__row ${n.read ? "notifCenter__row--read" : ""}`}
              >
                <button
                  type="button"
                  className="notifCenter__rowMain"
                  onClick={() => {
                    markRead(n.id);
                    runAction(n);
                    setOpen(false);
                  }}
                >
                  {!n.read && <span className="notifCenter__dot" aria-hidden="true" />}
                  <div className="notifCenter__rowText">
                    <div className="notifCenter__rowTop">
                      <span className="notifCenter__rowTitle">{n.title}</span>
                      <span className="notifCenter__rowTime">{formatTimeAgo(n.createdAt)}</span>
                    </div>
                    <p className="notifCenter__rowPreview">{n.preview}</p>
                    <span className="notifCenter__rowTag">
                      {n.type === "message" ? "Message" : n.type === "friend_request" ? "Request" : "Info"}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  className="notifCenter__rowDismiss"
                  aria-label="Dismiss"
                  onClick={(e) => {
                    e.stopPropagation();
                    remove(n.id);
                  }}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationCenter;
