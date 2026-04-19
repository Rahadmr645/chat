import { useCallback, useEffect, useRef } from "react";

const mergeHistoryState = (patch) => ({
  ...(window.history.state && typeof window.history.state === "object"
    ? window.history.state
    : {}),
  ...patch,
});

/**
 * Keeps extra browser history entries on mobile so the system / in-app "back"
 * walks chat → tabs → list instead of leaving the PWA / browser immediately.
 */
export function useMobileDashHistory({
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
  settingsNestedBackRef,
}) {
  const mainTabBeforeChatRef = useRef(null);
  const chatHistoryPushedRef = useRef(false);
  const settingsHistoryPushedRef = useRef(false);
  const recoveryHistoryPushedRef = useRef(false);
  const prevMainTabRef = useRef(mainTab);

  const snapshotRef = useRef({});
  snapshotRef.current = {
    activeUserId,
    settingsOpen,
    mainTab,
    callRecoveryPrompt,
  };

  const pushMarker = useCallback((marker) => {
    window.history.pushState(mergeHistoryState(marker), "", window.location.href);
  }, []);

  useEffect(() => {
    if (!isMobile) return;
    const prev = prevMainTabRef.current;
    prevMainTabRef.current = mainTab;
    if (prev === "chats" && mainTab !== "chats") {
      pushMarker({ rchatDashLayer: "tab", tab: mainTab });
    }
  }, [isMobile, mainTab, pushMarker]);

  useEffect(() => {
    if (!isMobile) return;
    if (!activeUserId) {
      chatHistoryPushedRef.current = false;
      return;
    }
    if (chatHistoryPushedRef.current) return;
    pushMarker({ rchatDashLayer: "chat", chatId: String(activeUserId) });
    chatHistoryPushedRef.current = true;
  }, [isMobile, activeUserId, pushMarker]);

  useEffect(() => {
    if (!isMobile) return;
    if (!settingsOpen) {
      settingsHistoryPushedRef.current = false;
      return;
    }
    if (settingsHistoryPushedRef.current) return;
    pushMarker({ rchatDashLayer: "settings" });
    settingsHistoryPushedRef.current = true;
  }, [isMobile, settingsOpen, pushMarker]);

  useEffect(() => {
    if (!isMobile) return;
    if (!callRecoveryPrompt) {
      recoveryHistoryPushedRef.current = false;
      return;
    }
    if (recoveryHistoryPushedRef.current) return;
    pushMarker({ rchatDashLayer: "callRecovery" });
    recoveryHistoryPushedRef.current = true;
  }, [isMobile, callRecoveryPrompt, pushMarker]);

  useEffect(() => {
    if (!isMobile) return;

    const onPopState = () => {
      const snap = snapshotRef.current;

      if (snap.callRecoveryPrompt) {
        setCallRecoveryPrompt(null);
        return;
      }

      if (snap.settingsOpen) {
        const nested = settingsNestedBackRef?.current?.();
        if (nested) return;
        setSettingsOpen(false);
        return;
      }

      if (snap.activeUserId) {
        setActiveUserId("");
        setSidebarOpen(true);
        const restore = mainTabBeforeChatRef.current;
        if (restore) {
          setMainTab(restore);
          mainTabBeforeChatRef.current = null;
        }
        return;
      }

      if (snap.mainTab !== "chats") {
        setMainTab("chats");
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [
    isMobile,
    setActiveUserId,
    setSidebarOpen,
    setSettingsOpen,
    setMainTab,
    setCallRecoveryPrompt,
    settingsNestedBackRef,
  ]);

  const rememberTabBeforeChat = useCallback(
    (userId) => {
      if (!isMobile || !userId) return;
      if (!activeUserId && mainTab !== "chats") {
        mainTabBeforeChatRef.current = mainTab;
      }
    },
    [isMobile, activeUserId, mainTab]
  );

  const clearTabBeforeChatIfClosing = useCallback((userId) => {
    if (!userId) mainTabBeforeChatRef.current = null;
  }, []);

  const onMobileOpenChats = useCallback(() => {
    if (isMobile && activeUserId) {
      window.history.back();
      return;
    }
    setActiveUserId("");
    setSidebarOpen(true);
  }, [isMobile, activeUserId, setActiveUserId, setSidebarOpen]);

  const onMobileCloseSettings = useCallback(() => {
    if (isMobile && settingsOpen) {
      window.history.back();
      return;
    }
    setSettingsOpen(false);
  }, [isMobile, settingsOpen, setSettingsOpen]);

  const onMobileSelectTab = useCallback(
    (tab) => {
      if (isMobile && tab === "chats" && mainTab !== "chats") {
        window.history.back();
        return;
      }
      setMainTab(tab);
    },
    [isMobile, mainTab, setMainTab]
  );

  const onMobileDismissCallRecovery = useCallback(() => {
    if (isMobile && callRecoveryPrompt) {
      window.history.back();
      return;
    }
    setCallRecoveryPrompt(null);
  }, [isMobile, callRecoveryPrompt, setCallRecoveryPrompt]);

  return {
    rememberTabBeforeChat,
    clearTabBeforeChatIfClosing,
    onMobileOpenChats,
    onMobileCloseSettings,
    onMobileSelectTab,
    onMobileDismissCallRecovery,
  };
}
