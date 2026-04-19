import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { socketEntityId } from "../utils/socketEntityId.js";

const STORAGE_KEY = "rchat_notifications_v1";
const MAX_ITEMS = 80;

/**
 * @typedef {'message' | 'friend_request' | 'system'} NotificationType
 * @typedef {{ kind: 'open_chat'; userId: string } | { kind: 'open_settings' }} NotificationAction
 * @typedef {{
 *   id: string;
 *   type: NotificationType;
 *   title: string;
 *   preview: string;
 *   createdAt: number;
 *   read: boolean;
 *   action?: NotificationAction;
 * }} NotificationItem
 */

function loadStoredItems() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (x) =>
          x &&
          typeof x.id === "string" &&
          typeof x.title === "string" &&
          typeof x.createdAt === "number"
      )
      .slice(0, MAX_ITEMS);
  } catch {
    return [];
  }
}

function persistItems(items) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items.slice(0, MAX_ITEMS)));
  } catch {
    /* ignore quota */
  }
}

function formatTimeAgo(ts) {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const NotificationContext = createContext(null);

export function NotificationProvider({ children }) {
  const [items, setItems] = useState(() => loadStoredItems());
  const handlersRef = useRef({
    onOpenChat: null,
    onOpenSettings: null,
  });

  useEffect(() => {
    persistItems(items);
  }, [items]);

  const registerHandlers = useCallback((next) => {
    handlersRef.current = {
      ...handlersRef.current,
      ...next,
    };
  }, []);

  const unreadCount = useMemo(() => items.filter((n) => !n.read).length, [items]);

  const pushItem = useCallback((item) => {
    setItems((prev) => {
      if (prev.some((p) => p.id === item.id)) return prev;
      return [item, ...prev].slice(0, MAX_ITEMS);
    });
  }, []);

  const notifyIncomingMessage = useCallback(
    (incoming, senderLabel, currentUserId) => {
      const me = String(currentUserId);
      const from = socketEntityId(incoming.senderId);
      const to = socketEntityId(incoming.receiverId);
      if (!from || !to || from === me || to !== me) return;

      const msgId = incoming._id != null ? String(incoming._id) : `${from}-${Date.now()}`;
      const id = `msg-${msgId}`;
      const preview =
        incoming.kind === "voice"
          ? "Voice message"
          : incoming.textE2ee
            ? "Encrypted message"
            : (incoming.text || "").trim() || "Message";

      pushItem({
        id,
        type: "message",
        title: senderLabel || "New message",
        preview: preview.slice(0, 140),
        createdAt: Date.now(),
        read: false,
        action: { kind: "open_chat", userId: from },
      });

      if (typeof Notification !== "undefined" && document.hidden) {
        if (Notification.permission === "granted") {
          try {
            new Notification(senderLabel || "New message", {
              body: preview.slice(0, 120),
              icon: "/favicon.svg",
            });
          } catch {
            /* ignore */
          }
        }
      }
    },
    [pushItem]
  );

  const notifyFriendRequest = useCallback(
    (request) => {
      const id = `fr-${String(request._id)}`;
      const name = request.from?.name || request.from?.email || "Someone";
      pushItem({
        id,
        type: "friend_request",
        title: "Friend request",
        preview: `${name} wants to connect`,
        createdAt: Date.now(),
        read: false,
        action: { kind: "open_settings" },
      });

      if (typeof Notification !== "undefined" && document.hidden) {
        if (Notification.permission === "granted") {
          try {
            new Notification("Friend request", {
              body: `${name} wants to connect`,
              icon: "/favicon.svg",
            });
          } catch {
            /* ignore */
          }
        }
      }
    },
    [pushItem]
  );

  const markRead = useCallback((id) => {
    setItems((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
  }, []);

  const markAllRead = useCallback(() => {
    setItems((prev) => prev.map((n) => ({ ...n, read: true })));
  }, []);

  const remove = useCallback((id) => {
    setItems((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearAll = useCallback(() => {
    setItems([]);
  }, []);

  const runAction = useCallback(
    (item) => {
      if (!item?.action) return;
      if (item.action.kind === "open_chat") {
        handlersRef.current.onOpenChat?.(item.action.userId);
      } else if (item.action.kind === "open_settings") {
        handlersRef.current.onOpenSettings?.();
      }
    },
    []
  );

  const value = useMemo(
    () => ({
      items,
      unreadCount,
      formatTimeAgo,
      registerHandlers,
      notifyIncomingMessage,
      notifyFriendRequest,
      markRead,
      markAllRead,
      remove,
      clearAll,
      runAction,
    }),
    [
      items,
      unreadCount,
      registerHandlers,
      notifyIncomingMessage,
      notifyFriendRequest,
      markRead,
      markAllRead,
      remove,
      clearAll,
      runAction,
    ]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) {
    throw new Error("useNotifications must be used within NotificationProvider");
  }
  return ctx;
}
