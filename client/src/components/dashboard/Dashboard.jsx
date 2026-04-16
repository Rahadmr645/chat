import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Dashboard.css";
import { NotificationProvider, useNotifications } from "../../context/NotificationContext.jsx";
import WaRail from "../layout/WaRail.jsx";
import BottomNav from "../bottomnav/BottomNav";
import TabPlaceholder from "../tabs/TabPlaceholder";
import Sidebar from "../sidebar/Sidebar";
import ChatWindow from "../chat/ChatWindow";
import ChatSettingsPanel from "../settings/ChatSettingsPanel.jsx";
import { apiRequest } from "../../services/api.js";
import { useMediaQuery } from "../../hooks/useMediaQuery.js";

const matchQuery = (userLike, q) => {
  if (!q) return true;
  if (!userLike) return false;
  const blob = `${userLike.name ?? ""} ${userLike.email ?? ""}`.toLowerCase();
  return blob.includes(q);
};

const DashboardInner = ({ currentUser, token, onLogout, onProfileUpdate }) => {
  const [users, setUsers] = useState([]);
  const [friends, setFriends] = useState([]);
  const [incomingRequests, setIncomingRequests] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [activeUserId, setActiveUserId] = useState("");
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [error, setError] = useState("");
  const [friendActionError, setFriendActionError] = useState("");
  const isMobile = useMediaQuery("(max-width: 768px)");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [mainTab, setMainTab] = useState("chats");
  const [searchQuery, setSearchQuery] = useState("");
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    if (mainTab !== "chats") setSidebarOpen(false);
  }, [mainTab]);

  const refreshLists = useCallback(async () => {
    const [usersData, friendsData, incomingData, blockedData] = await Promise.all([
      apiRequest({ path: "/api/auth/users", token }),
      apiRequest({ path: "/api/auth/friends", token }),
      apiRequest({ path: "/api/auth/friends/requests/incoming", token }),
      apiRequest({ path: "/api/auth/users/blocked", token }),
    ]);
    setUsers(usersData.users || []);
    setFriends(friendsData.friends || []);
    setIncomingRequests(incomingData.requests || []);
    setBlockedUsers(blockedData.blocked || []);
  }, [token]);

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
    if (!friends.length) {
      setActiveUserId("");
      return;
    }
    if (!activeUserId) return;
    const stillFriend = friends.some((f) => f._id === activeUserId);
    if (!stillFriend) {
      setActiveUserId("");
    }
  }, [friends, activeUserId]);

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
        setActiveUserId(String(userId));
        if (isMobile) setSidebarOpen(false);
      },
      onOpenSettings: () => setSettingsOpen(true),
    });
  }, [registerHandlers, isMobile]);

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
    setActiveUserId(userId);
    if (isMobile) setSidebarOpen(false);
  };

  const shellClass = ["waShell", mainTab === "chats" ? "waShell--chatsTab" : ""]
    .filter(Boolean)
    .join(" ");

  const mainClass = ["waMain", !isMobile ? "waMain--desk" : ""].filter(Boolean).join(" ");

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
              <TabPlaceholder tab={mainTab} variant="solo" />
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
            <div className="dashboard">
              {isMobile && sidebarOpen && (
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
                sidebarOpen={sidebarOpen}
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
                isMobile={isMobile}
                onOpenChats={() => setSidebarOpen(true)}
                onPresence={handlePresence}
                getContactLabel={getContactLabel}
              />
            </div>
          </div>
        </div>
      </div>
      <BottomNav active={mainTab} onSelect={setMainTab} />

      <ChatSettingsPanel
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
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
