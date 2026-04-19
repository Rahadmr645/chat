import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Dashboard.css";
import { NotificationProvider, useNotifications } from "../../context/NotificationContext.jsx";
import WaRail from "../layout/WaRail.jsx";
import BottomNav from "../bottomnav/BottomNav";
import TabPlaceholder from "../tabs/TabPlaceholder";
import CallsTab from "../calls/CallsTab.jsx";
import StoriesTab from "../stories/StoriesTab.jsx";
import Sidebar from "../sidebar/Sidebar";
import ChatWindow from "../chat/ChatWindow";
import ChatSettingsPanel from "../settings/ChatSettingsPanel.jsx";
import { apiRequest } from "../../services/api.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";
import { useMobileDashHistory } from "../../hooks/useMobileDashHistory.js";
import {
  startCallRingtone,
  stopCallRingtone,
  startVibration,
  stopVibration,
} from "../../utils/callRingtone.js";

const matchQuery = (userLike, q) => {
  if (!q) return true;
  if (!userLike) return false;
  const blob = `${userLike.name ?? ""} ${userLike.email ?? ""}`.toLowerCase();
  return blob.includes(q);
};

const dashStorageKey = (userId) =>
  `rchat_dashboard_state_${userId || "anon"}`;

const readDashState = (userId) => {
  try {
    const raw = localStorage.getItem(dashStorageKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
};

const DashboardInner = ({ currentUser, token, onLogout, onProfileUpdate }) => {
  const userIdKey = currentUser?._id ? String(currentUser._id) : "";
  const initialDashState = useMemo(
    () => readDashState(userIdKey) || {},
    [userIdKey]
  );

  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState(
    typeof initialDashState.activeUserId === "string"
      ? initialDashState.activeUserId
      : ""
  );
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [friendActionError, setFriendActionError] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mainTab, setMainTab] = useState(
    typeof initialDashState.mainTab === "string"
      ? initialDashState.mainTab
      : "chats"
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [callActive, setCallActive] = useState(false);
  const [pendingOutgoingCall, setPendingOutgoingCall] = useState(null);
  const [callLogItems, setCallLogItems] = useState([]);
  const [callRecoveryPrompt, setCallRecoveryPrompt] = useState(null);
  const callNotificationRef = useRef(null);
  const ringingActiveRef = useRef(false);
  const settingsNestedPopRef = useRef(null);

  const {
    rememberTabBeforeChat,
    clearTabBeforeChatIfClosing,
    onMobileOpenChats,
    onMobileCloseSettings,
    onMobileSelectTab,
    onMobileDismissCallRecovery,
  } = useMobileDashHistory({
    isMobile,
    activeUserId,
    settingsOpen,
    mainTab,
    callRecoveryPrompt,
    setActiveUserId,
    setSidebarOpen,
    setSettingsOpen,
    setMainTab,
    setCallRecoveryPrompt,
    settingsNestedBackRef: settingsNestedPopRef,
  });

  const closeCallNotification = useCallback(() => {
    if (callNotificationRef.current) {
      try {
        callNotificationRef.current.close();
      } catch {
        /* ignore */
      }
      callNotificationRef.current = null;
    }
  }, []);

  const stopRinging = useCallback(() => {
    if (!ringingActiveRef.current) return;
    ringingActiveRef.current = false;
    stopCallRingtone();
    stopVibration();
    closeCallNotification();
  }, [closeCallNotification]);

  useEffect(() => {
    return () => {
      stopRinging();
    };
  }, [stopRinging]);

  useEffect(() => {
    if (!userIdKey) return;
    try {
      localStorage.setItem(
        dashStorageKey(userIdKey),
        JSON.stringify({ activeUserId, mainTab })
      );
    } catch {
      /* ignore quota */
    }
  }, [userIdKey, activeUserId, mainTab]);

  const {
    registerHandlers,
    notifyFriendRequest,
  } = useNotifications();

  const friendRequestBaselineRef = useRef(null);

  const q = searchQuery.trim().toLowerCase();

  const displayFriends = useMemo(
    () => friends.filter((u) => matchQuery(u, q)),
    [friends, q]
  );

  const resolveFriendPublicKey = useCallback(
    (userId) => {
      const f = friends.find((u) => String(u._id) === String(userId));
      return f?.encryptionPublicKey || "";
    },
    [friends]
  );

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (mainTab !== "chats") setSidebarOpen(false);
  }, [mainTab]);

  const refreshLists = useCallback(async () => {
    const data = await apiRequest({ path: "/api/auth/dashboard", token });
    setUsers(data.users || []);
    setFriends(data.friends || []);
    setIncomingRequests(data.requests || []);
    setBlockedUsers(data.blocked || []);
    setCallLogItems(data.callLogs || []);
  }, [token]);

  useEffect(() => {
    if (mainTab !== "calls" || !token || loadingUsers) return;
    const onVis = () => {
      if (document.visibilityState !== "visible") return;
      void refreshLists();
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [mainTab, token, loadingUsers, refreshLists]);

  useEffect(() => {
    const load = async () => {
      setLoadingUsers(true);
      setError("");
      setFriendActionError("");
      try {
        await refreshLists();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoadingUsers(false);
      }
    };
    load();
  }, [refreshLists]);

  useEffect(() => {
    if (!userIdKey || loadingUsers || friends.length === 0) return;
    try {
      const key = `rchat_call_recovery_${userIdKey}`;
      const raw = sessionStorage.getItem(key);
      if (!raw) return;
      sessionStorage.removeItem(key);
      const data = JSON.parse(raw);
      if (!data?.peerId || typeof data.at !== "number") return;
      if (Date.now() - data.at > 3 * 60 * 1000) return;
      const f = friends.find((u) => String(u._id) === String(data.peerId));
      if (!f) return;
      setCallRecoveryPrompt({
        peerId: String(data.peerId),
        isVideo: Boolean(data.isVideo),
        label: f.name || f.email || "Contact",
      });
    } catch {
      /* ignore */
    }
  }, [userIdKey, loadingUsers, friends]);

  useEffect(() => {
    if (loadingUsers) return;
    if (!friends.length) {
      if (activeUserId) setActiveUserId("");
      return;
    }
    if (!activeUserId) return;
    const stillFriend = friends.some((f) => f._id === activeUserId);
    if (!stillFriend) {
      setActiveUserId("");
    }
  }, [friends, activeUserId, loadingUsers]);

  const sendFriendRequest = async (userId) => {
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: "/api/auth/friends/request",
        token,
        body: { userId },
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const sendFriendRequestByEmail = async () => {
    const email = window.prompt("Enter email to send a friend request");
    if (!email) return;
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: "/api/auth/friends/request-by-email",
        token,
        body: { email: email.trim() },
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const acceptRequest = async (requestId) => {
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/friends/requests/${requestId}/accept`,
        token,
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const rejectRequest = async (requestId) => {
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/friends/requests/${requestId}/reject`,
        token,
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const blockFromRequest = async (requestId) => {
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/friends/requests/${requestId}/block`,
        token,
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const blockUser = async (userId) => {
    if (!window.confirm("Block this user? They will be removed from friends.")) return;
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/users/${userId}/block`,
        token,
      });
      if (activeUserId === userId) setActiveUserId("");
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const unfriendUser = async (userId) => {
    if (!window.confirm("Remove this person from your friends?")) return;
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/users/${userId}/unfriend`,
        token,
      });
      if (activeUserId === userId) setActiveUserId("");
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const unblockUser = async (userId) => {
    setFriendActionError("");
    try {
      await apiRequest({
        method: "POST",
        path: `/api/auth/users/${userId}/unblock`,
        token,
      });
      await refreshLists();
    } catch (err) {
      setFriendActionError(err.message);
    }
  };

  const activeUser = useMemo(
    () => friends.find((u) => u._id === activeUserId) || null,
    [friends, activeUserId]
  );

  const getContactLabel = useCallback(
    (userId) => {
      if (!userId) return "Someone";
      const row = friends.find((u) => String(u._id) === String(userId));
      return row?.name || row?.email || "Someone";
    },
    [friends]
  );

  useEffect(() => {
    registerHandlers({
      onOpenChat: (userId) => {
        if (!userId) return;
        setMainTab("chats");
        rememberTabBeforeChat(String(userId));
        clearTabBeforeChatIfClosing(String(userId));
        setActiveUserId(String(userId));
        if (isMobile) setSidebarOpen(false);
      },
      onOpenSettings: () => setSettingsOpen(true),
    });
  }, [
    registerHandlers,
    isMobile,
    rememberTabBeforeChat,
    clearTabBeforeChatIfClosing,
  ]);

  useEffect(() => {
    if (loadingUsers) return;
    const ids = new Set(incomingRequests.map((r) => String(r._id)));
    if (friendRequestBaselineRef.current === null) {
      friendRequestBaselineRef.current = ids;
      return;
    }
    for (const req of incomingRequests) {
      const id = String(req._id);
      if (!friendRequestBaselineRef.current.has(id)) {
        notifyFriendRequest(req);
        friendRequestBaselineRef.current.add(id);
      }
    }
    for (const old of [...friendRequestBaselineRef.current]) {
      if (!ids.has(old)) friendRequestBaselineRef.current.delete(old);
    }
  }, [incomingRequests, loadingUsers, notifyFriendRequest]);

  const handlePresence = useCallback((payload) => {
    if (!payload?.userId) return;
    const uid = String(payload.userId);
    const online = Boolean(payload.online);
    const lastSeenAt =
      payload.lastSeenAt != null && String(payload.lastSeenAt).trim() !== ""
        ? String(payload.lastSeenAt)
        : undefined;

    const patchUser = (row) => {
      if (String(row._id) !== uid) return row;
      return {
        ...row,
        isOnline: online,
        ...(lastSeenAt !== undefined ? { lastSeenAt } : {}),
      };
    };

    setFriends((prev) => prev.map(patchUser));
    setUsers((prev) => prev.map(patchUser));
  }, []);

  const selectUser = (userId) => {
    clearTabBeforeChatIfClosing(userId || "");
    if (userId) rememberTabBeforeChat(userId);
    setActiveUserId(userId);
    if (isMobile) setSidebarOpen(false);
  };

  const clearPendingOutgoingCall = useCallback(() => {
    setPendingOutgoingCall(null);
  }, []);

  const shellClass = ["waShell", mainTab === "chats" ? "waShell--chatsTab" : ""]
    .filter(Boolean)
    .join(" ");

  const mainClass = ["waMain", !isMobile ? "waMain--desk" : ""].filter(Boolean).join(" ");
  const showBottomNav = !isMobile || !activeUserId;

  return (
    <div className={shellClass}>
      <div className={mainClass}>
        {!isMobile && (
          <WaRail
            mainTab={mainTab}
            onTabChange={setMainTab}
            user={currentUser}
            onLogout={onLogout}
            onOpenSettings={() => setSettingsOpen(true)}
            pendingRequestCount={incomingRequests.length}
          />
        )}
        <div className="waMainPane waMainPane--layered">
          {mainTab !== "chats" && (
            <div className="waMainPaneTabOverlay">
              {mainTab === "calls" ? (
                <CallsTab
                  items={callLogItems}
                  loading={loadingUsers}
                  error={error}
                  friends={friends}
                  onRetry={() => void refreshLists()}
                  onOpenChat={(userId) => {
                    selectUser(userId);
                    setMainTab("chats");
                  }}
                  onVoiceCall={(peerId) => {
                    setPendingOutgoingCall({ peerId: String(peerId), isVideo: false });
                    selectUser(peerId);
                    setMainTab("chats");
                  }}
                  onVideoCall={(peerId) => {
                    setPendingOutgoingCall({ peerId: String(peerId), isVideo: true });
                    selectUser(peerId);
                    setMainTab("chats");
                  }}
                />
              ) : mainTab === "updates" ? (
                <StoriesTab token={token} currentUser={currentUser} />
              ) : (
                <TabPlaceholder tab={mainTab} variant="solo" />
              )}
            </div>
          )}
          <div
            className={[
              "waMainPaneChatKeepalive",
              mainTab === "chats" ? "waMainPaneChatKeepalive--active" : "",
            ]
              .filter(Boolean)
              .join(" ")}
            aria-hidden={mainTab !== "chats"}
          >
            <div
              className={[
                "dashboard",
                isMobile && !activeUserId && !callActive
                  ? "dashboard--listOnly"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
            >
              {isMobile && sidebarOpen && activeUserId && (
                <button
                  type="button"
                  className="sidebarBackdrop"
                  aria-label="Close chat list"
                  onClick={() => setSidebarOpen(false)}
                />
              )}
              <Sidebar
                friends={displayFriends}
                loading={loadingUsers}
                error={error}
                friendActionError={friendActionError}
                activeUserId={activeUserId}
                isMobile={isMobile}
                sidebarOpen={
                  sidebarOpen || (isMobile && !activeUserId && !callActive)
                }
                onSelectUser={selectUser}
                onSendFriendRequestByEmail={sendFriendRequestByEmail}
                onBlockFriend={blockUser}
                onUnfriend={unfriendUser}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                onLogout={onLogout}
                onOpenSettings={() => setSettingsOpen(true)}
              />
              <ChatWindow
                currentUser={currentUser}
                selectedUser={activeUser}
                token={token}
                onProfileUpdate={onProfileUpdate}
                resolveFriendPublicKey={resolveFriendPublicKey}
                isMobile={isMobile}
                pendingOutgoingCall={pendingOutgoingCall}
                onPendingOutgoingCallConsumed={clearPendingOutgoingCall}
                hidePlaceholder={
                  isMobile ||
                  Boolean(activeUserId) ||
                  callActive
                }
                onOpenChats={onMobileOpenChats}
                onRefreshDashboard={refreshLists}
                onPresence={handlePresence}
                getContactLabel={getContactLabel}
                onCallActiveChange={(active) => {
                  setCallActive(active);
                  if (active) {
                    setMainTab("chats");
                    if (isMobile) setSidebarOpen(false);
                  } else {
                    stopRinging();
                  }
                }}
                onCallPhaseChange={(phase) => {
                  if (phase !== "incoming") {
                    stopRinging();
                  }
                }}
                onIncomingCall={(info) => {
                  setMainTab("chats");
                  if (isMobile) setSidebarOpen(false);

                  ringingActiveRef.current = true;
                  startCallRingtone();
                  startVibration();

                  if (
                    typeof Notification !== "undefined" &&
                    Notification.permission === "granted"
                  ) {
                    try {
                      closeCallNotification();
                      const notif = new Notification(
                        info.isVideo
                          ? "Incoming video call"
                          : "Incoming voice call",
                        {
                          body: info.peerLabel || "Tap to answer",
                          icon: "/favicon.svg",
                          tag: "rchat-incoming-call",
                          requireInteraction: true,
                          renotify: true,
                          silent: false,
                          vibrate: [600, 400, 600, 400, 600],
                        }
                      );
                      notif.onclick = () => {
                        try {
                          window.focus();
                        } catch {
                          /* ignore */
                        }
                        try {
                          notif.close();
                        } catch {
                          /* ignore */
                        }
                      };
                      callNotificationRef.current = notif;
                    } catch {
                      /* ignore */
                    }
                  }
                }}
              />
            </div>
          </div>
        </div>
      </div>
      {showBottomNav && <BottomNav active={mainTab} onSelect={onMobileSelectTab} />}

      {callRecoveryPrompt && (
        <div
          className="callRecoveryOverlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="callRecoveryTitle"
        >
          <div className="callRecoveryCard">
            <h3 id="callRecoveryTitle" className="callRecoveryTitle">
              Call interrupted
            </h3>
            <p className="callRecoveryText">
              Reloading or closing the tab ended your{" "}
              {callRecoveryPrompt.isVideo ? "video" : "voice"} call with{" "}
              <strong>{callRecoveryPrompt.label}</strong>. Browsers cannot keep an active call after a
              full reload — you can start a new call with one tap.
            </p>
            <div className="callRecoveryActions">
              <button
                type="button"
                className="callRecoveryPrimary"
                onClick={() => {
                  const { peerId, isVideo } = callRecoveryPrompt;
                  setCallRecoveryPrompt(null);
                  setPendingOutgoingCall({ peerId, isVideo });
                  selectUser(peerId);
                  setMainTab("chats");
                }}
              >
                Call again
              </button>
              <button
                type="button"
                className="callRecoverySecondary"
                onClick={onMobileDismissCallRecovery}
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      <ChatSettingsPanel
        open={settingsOpen}
        onClose={onMobileCloseSettings}
        isMobile={isMobile}
        settingsNestedBackRef={settingsNestedPopRef}
        currentUser={currentUser}
        token={token}
        onLogout={onLogout}
        loading={loadingUsers}
        error={error}
        friendActionError={friendActionError}
        users={users}
        incomingRequests={incomingRequests}
        blockedUsers={blockedUsers}
        onSendFriendRequest={sendFriendRequest}
        onSendFriendRequestByEmail={sendFriendRequestByEmail}
        onAcceptRequest={acceptRequest}
        onRejectRequest={rejectRequest}
        onBlockFromRequest={blockFromRequest}
        onUnblock={unblockUser}
        onProfileUpdate={onProfileUpdate}
      />
    </div>
  );
};

const Dashboard = (props) => (
  <NotificationProvider>
    <DashboardInner {...props} />
  </NotificationProvider>
);

export default Dashboard;
