import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Chat.css";
import {
  connectSocket,
  disconnectSocket,
  emitChatMessage,
  emitStopTyping,
  emitTyping,
  emitVoiceRecordingStart,
  emitVoiceRecordingStop,
  subscribeIncomingMessages,
  subscribeMessagesSeen,
  subscribePresence,
  subscribeTypingStatus,
  subscribeVoiceRecordingStatus,
} from "../../socket/Socket.js";
import { apiRequest, apiUploadVoice } from "../../services/api.js";
import {
  formatLastSeen,
  formatMessageTime,
  formatRecordingClock,
} from "../../utils/chatFormat.js";
import { isMessageInThread } from "../../utils/chatThread.js";
import {
  getPreferredVoiceMimeType,
  MIN_VOICE_RECORD_MS,
} from "../../utils/voiceRecording.js";
import {
  IconAttach,
  IconEmoji,
  IconMic,
  IconSearch,
  IconSend,
  IconTrash,
  IconVideo,
} from "./ChatIcons.jsx";
import VoiceMessagePlayer from "./VoiceMessagePlayer.jsx";

const LAST_SEEN_REFRESH_MS = 60_000;
const RECORDING_UI_TICK_MS = 100;
const TYPING_STOP_MS = 2000;
const MARK_READ_DEBOUNCE_MS = 400;

const ChatWindow = ({
  currentUser,
  selectedUser,
  token,
  isMobile = false,
  onOpenChats,
  onPresence,
}) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerVoiceRecording, setPeerVoiceRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [recordingTick, setRecordingTick] = useState(0);
  const [, setLastSeenTick] = useState(0);

  const mediaRecorderRef = useRef(null);
  const streamRef = useRef(null);
  const chunksRef = useRef([]);
  const recordStartRef = useRef(0);
  const startingRecordRef = useRef(false);
  const stopVoiceRecordingRef = useRef(async () => {});
  const voiceNotifyPeerRef = useRef(null);

  const selectedUserId = selectedUser?._id;
  const selectedUserIdRef = useRef(selectedUserId);
  const currentUserIdRef = useRef(currentUser?._id);
  const typingStopTimerRef = useRef(null);
  const markReadTimerRef = useRef(null);
  const onPresenceRef = useRef(onPresence);

  useEffect(() => {
    onPresenceRef.current = onPresence;
  }, [onPresence]);

  useEffect(() => {
    selectedUserIdRef.current = selectedUserId;
  }, [selectedUserId]);

  useEffect(() => {
    currentUserIdRef.current = currentUser?._id;
  }, [currentUser?._id]);

  useEffect(() => {
    if (!selectedUserId || selectedUser?.isOnline || !selectedUser?.lastSeenAt) {
      return undefined;
    }
    const id = setInterval(() => setLastSeenTick((n) => n + 1), LAST_SEEN_REFRESH_MS);
    return () => clearInterval(id);
  }, [selectedUserId, selectedUser?.isOnline, selectedUser?.lastSeenAt]);

  const peerIsOnline = Boolean(selectedUser?.isOnline);
  const peerLastSeenAt = selectedUser?.lastSeenAt ?? null;
  const presenceSubtitle = !selectedUser
    ? ""
    : peerIsOnline
      ? "online"
      : peerLastSeenAt
        ? formatLastSeen(peerLastSeenAt)
        : "offline";

  const markConversationRead = useCallback(async () => {
    const peer = selectedUserIdRef.current;
    if (!peer || !token) return;
    try {
      const res = await apiRequest({
        method: "PUT",
        path: `/api/messages/conversation/${peer}/seen`,
        token,
      });
      if (res.messageIds?.length) {
        const idSet = new Set(res.messageIds);
        setMessages((prev) =>
          prev.map((m) =>
            idSet.has(String(m._id)) ? { ...m, seen: true } : m
          )
        );
      }
    } catch {
      /* ignore */
    }
  }, [token]);

  const emitVoiceRecordingEndToPeer = useCallback(() => {
    const peer = voiceNotifyPeerRef.current;
    voiceNotifyPeerRef.current = null;
    const me = currentUserIdRef.current;
    if (peer && me) {
      emitVoiceRecordingStop(String(me), String(peer));
    }
  }, []);

  useEffect(() => {
    if (!currentUser?._id) return;

    connectSocket(String(currentUser._id));

    const unsubMsg = subscribeIncomingMessages((incoming) => {
      const peer = selectedUserIdRef.current;
      const me = currentUserIdRef.current;
      if (!peer || !me) return;
      if (!isMessageInThread(incoming, peer, me)) return;

      setMessages((prev) => [...prev, incoming]);

      const fromPeer =
        String(incoming.senderId) === String(peer) &&
        String(incoming.receiverId) === String(me);
      if (fromPeer) {
        clearTimeout(markReadTimerRef.current);
        markReadTimerRef.current = setTimeout(() => {
          markConversationRead();
        }, MARK_READ_DEBOUNCE_MS);
      }
    });

    const unsubTyping = subscribeTypingStatus((payload) => {
      if (String(payload.senderId) === String(selectedUserIdRef.current)) {
        setPeerTyping(Boolean(payload.isTyping));
      }
    });

    const unsubVoiceRec = subscribeVoiceRecordingStatus((payload) => {
      if (String(payload.senderId) !== String(selectedUserIdRef.current)) return;
      const active = Boolean(payload.active);
      setPeerVoiceRecording(active);
      if (active) setPeerTyping(false);
    });

    const unsubSeen = subscribeMessagesSeen(({ messageIds }) => {
      if (!messageIds?.length) return;
      const idSet = new Set(messageIds);
      setMessages((prev) =>
        prev.map((m) =>
          idSet.has(String(m._id)) ? { ...m, seen: true } : m
        )
      );
    });

    const unsubPresence = subscribePresence((payload) => {
      onPresenceRef.current?.(payload);
    });

    return () => {
      unsubMsg();
      unsubTyping();
      unsubVoiceRec();
      unsubSeen();
      unsubPresence();
      disconnectSocket();
    };
  }, [currentUser?._id, markConversationRead]);

  useEffect(() => {
    setPeerTyping(false);
    setPeerVoiceRecording(false);
  }, [selectedUserId]);

  useEffect(() => {
    return () => {
      const mr = mediaRecorderRef.current;
      const stream = streamRef.current;
      if (mr && mr.state !== "inactive") {
        try {
          mr.stop();
        } catch {
          /* ignore */
        }
      }
      stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      emitVoiceRecordingEndToPeer();
    };
  }, [selectedUserId, emitVoiceRecordingEndToPeer]);

  const cancelVoiceRecording = () => {
    const mr = mediaRecorderRef.current;
    const stream = streamRef.current;
    if (mr && mr.state !== "inactive") {
      try {
        mr.stop();
      } catch {
        /* ignore */
      }
    }
    stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    chunksRef.current = [];
    setIsRecording(false);
    setVoiceError("");
    setRecordingTick(0);
    emitVoiceRecordingEndToPeer();
  };

  const startVoiceRecording = async () => {
    if (!selectedUserId || !token || startingRecordRef.current || isRecording) return;
    startingRecordRef.current = true;
    setVoiceError("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;
      chunksRef.current = [];
      const mime = getPreferredVoiceMimeType();
      const mr = new MediaRecorder(
        stream,
        mime ? { mimeType: mime } : undefined
      );
      mr.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      mr.start(250);
      mediaRecorderRef.current = mr;
      recordStartRef.current = Date.now();
      setRecordingTick(0);
      setIsRecording(true);
      const me = String(currentUser._id);
      const peer = String(selectedUserId);
      voiceNotifyPeerRef.current = peer;
      emitStopTyping(me, peer);
      emitVoiceRecordingStart(me, peer);
    } catch {
      setVoiceError("Microphone access denied or not available.");
      streamRef.current?.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    } finally {
      startingRecordRef.current = false;
    }
  };

  const stopVoiceRecordingAndSend = async () => {
    const mr = mediaRecorderRef.current;
    const stream = streamRef.current;
    const mimeType = mr?.mimeType || "audio/webm";

    if (!mr || mr.state === "inactive") {
      stream?.getTracks().forEach((t) => t.stop());
      mediaRecorderRef.current = null;
      streamRef.current = null;
      setIsRecording(false);
      emitVoiceRecordingEndToPeer();
      return;
    }

    const durationMs = Date.now() - recordStartRef.current;
    const durationSec = Math.max(1, Math.round(durationMs / 1000));

    await new Promise((resolve) => {
      mr.onstop = resolve;
      try {
        mr.stop();
      } catch {
        resolve();
      }
    });
    stream?.getTracks().forEach((t) => t.stop());
    mediaRecorderRef.current = null;
    streamRef.current = null;
    setIsRecording(false);
    emitVoiceRecordingEndToPeer();

    if (durationMs < MIN_VOICE_RECORD_MS) {
      setVoiceError("Recording too short — try again (hold at least ~1s).");
      return;
    }

    const blob = new Blob(chunksRef.current, { type: mimeType });
    chunksRef.current = [];
    if (blob.size < 64) {
      setVoiceError("No audio captured.");
      return;
    }

    try {
      const savedMessage = await apiUploadVoice({
        token,
        receiverId: selectedUserId,
        durationSec,
        blob,
      });
      setMessages((prev) => [...prev, savedMessage]);
      emitChatMessage({
        ...savedMessage,
        senderId: String(savedMessage.senderId),
        receiverId: String(savedMessage.receiverId),
      });
      setVoiceError("");
    } catch (err) {
      setVoiceError(err.message || "Could not send voice message.");
    }
  };

  stopVoiceRecordingRef.current = stopVoiceRecordingAndSend;

  useEffect(() => {
    if (!isRecording) return undefined;
    const id = setInterval(() => {
      setRecordingTick((n) => n + 1);
    }, RECORDING_UI_TICK_MS);
    return () => clearInterval(id);
  }, [isRecording]);

  const recordingSeconds =
    isRecording && recordingTick >= 0
      ? (Date.now() - recordStartRef.current) / 1000
      : 0;

  const onMicPress = () => {
    if (text.trim()) return;
    if (isRecording) {
      void stopVoiceRecordingAndSend();
    } else {
      void startVoiceRecording();
    }
  };

  useEffect(() => {
    const loadConversation = async () => {
      if (!selectedUserId) {
        setMessages([]);
        return;
      }

      setLoading(true);
      setError("");

      try {
        const data = await apiRequest({
          path: `/api/messages/conversation/${selectedUserId}`,
          token,
        });
        setMessages(data);
        await markConversationRead();
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    loadConversation();
  }, [selectedUserId, token, markConversationRead]);

  const handleSend = async () => {
    if (!text.trim() || !selectedUserId) return;

    const peer = String(selectedUserId);
    const me = String(currentUser._id);
    emitStopTyping(me, peer);
    clearTimeout(typingStopTimerRef.current);

    try {
      const payload = { receiverId: selectedUserId, text: text.trim() };
      const savedMessage = await apiRequest({
        method: "POST",
        path: "/api/messages/send",
        token,
        body: payload,
      });

      setMessages((prev) => [...prev, savedMessage]);
      emitChatMessage({
        ...savedMessage,
        senderId: String(savedMessage.senderId),
        receiverId: String(savedMessage.receiverId),
      });
      setText("");
    } catch (err) {
      setError(err.message);
    }
  };

  const onTextChange = (e) => {
    const v = e.target.value;
    setText(v);
    if (!selectedUserId || !currentUser?._id) return;
    const me = String(currentUser._id);
    const peer = String(selectedUserId);
    emitTyping(me, peer);
    clearTimeout(typingStopTimerRef.current);
    typingStopTimerRef.current = setTimeout(() => {
      emitStopTyping(me, peer);
    }, TYPING_STOP_MS);
  };

  const normalizedMessages = useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        senderId: String(message.senderId),
      })),
    [messages]
  );

  const comingSoon = (label) => () => window.alert(`${label} — coming soon.`);

  if (!selectedUser) {
    return (
      <div className="chatWindow chatWindow--fill chatPlaceholder">
        <div className="chatPlaceholderInner">
          <p>
            {isMobile
              ? "Open your chat list and tap a friend to start chatting."
              : "Select a chat to start messaging"}
          </p>
          {isMobile && onOpenChats && (
            <button type="button" className="openChatsBtn" onClick={onOpenChats}>
              Open chats
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="chatWindow chatWindow--fill">
      <div className="chatHeader">
        {isMobile && onOpenChats && (
          <button
            type="button"
            className="chatBackBtn"
            onClick={onOpenChats}
            aria-label="Back to chat list"
          >
            ←
          </button>
        )}
        <div className="chatHeaderAvatar" aria-hidden="true">
          {selectedUser.name?.charAt(0)?.toUpperCase() ?? "?"}
        </div>
        <div className="chatHeaderText">
          <div className="chatTitleRow">
            <h3>{selectedUser.name}</h3>
            {selectedUser.isOnline && (
              <span className="onlineDot" title="Online" aria-label="Online" />
            )}
          </div>
          {peerVoiceRecording ? (
            <p className="typingLabel">speaking…</p>
          ) : peerTyping ? (
            <p className="typingLabel">typing…</p>
          ) : (
            <p className="chatHeaderSub">{presenceSubtitle}</p>
          )}
        </div>
        <div className="chatHeaderActions">
          <button
            type="button"
            className="chatHeaderIconBtn"
            aria-label="Video call"
            onClick={comingSoon("Video call")}
          >
            <IconVideo />
          </button>
          <button
            type="button"
            className="chatHeaderIconBtn"
            aria-label="Search in chat"
            onClick={comingSoon("Search in chat")}
          >
            <IconSearch />
          </button>
        </div>
      </div>

      <div className="messages">
        {loading && <p className="chatInfo">Loading conversation...</p>}
        {error && <p className="chatError">{error}</p>}
        {!loading && !error && normalizedMessages.length === 0 && (
          <p className="chatInfo">No messages yet. Say hello.</p>
        )}

        {normalizedMessages.map((msg) => {
          const isSent = msg.senderId === String(currentUser._id);
          const time = formatMessageTime(msg.createdAt);
          const isVoice = msg.kind === "voice";
          return (
            <div
              key={msg._id}
              className={`messageRow ${isSent ? "sent" : "received"}`}
            >
              <div className={`bubble ${isSent ? "bubbleSent" : "bubbleReceived"}`}>
                {isVoice ? (
                  <div className="bubbleVoice">
                    <VoiceMessagePlayer
                      messageId={String(msg._id)}
                      token={token}
                      durationSec={msg.durationSec ?? 0}
                    />
                  </div>
                ) : (
                  <div className="bubbleText">{msg.text}</div>
                )}
                <div className="bubbleFooter">
                  {isVoice && (
                    <span className="msgVoiceDuration">
                      {formatRecordingClock(msg.durationSec ?? 0)}
                    </span>
                  )}
                  <span className="msgTime">{time}</span>
                  {isSent && (
                    <span
                      className={`ticks ${msg.seen ? "ticksRead" : "ticksSent"}`}
                      title={msg.seen ? "Read" : "Delivered"}
                    >
                      <span className="tick">✓</span>
                      <span className="tick">✓</span>
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="chatInput">
        {voiceError && <p className="chatVoiceError">{voiceError}</p>}
        {isRecording ? (
          <div className="waVoiceDock" role="status" aria-live="polite">
            <button
              type="button"
              className="waVoiceDockTrash"
              aria-label="Delete recording"
              title="Cancel"
              onClick={cancelVoiceRecording}
            >
              <IconTrash />
            </button>
            <div className="waVoiceDockCenter">
              <div className="waVoiceWave" aria-hidden="true">
                {Array.from({ length: 32 }, (_, i) => (
                  <span
                    key={i}
                    className="waVoiceWaveBar"
                    style={{ animationDelay: `${(i % 10) * 0.07}s` }}
                  />
                ))}
              </div>
              <div className="waVoiceDockMetaRow">
                <span className="waVoiceDockDot" aria-hidden="true" />
                <span className="waVoiceDockTimer" title="Recording length">
                  {formatRecordingClock(recordingSeconds)}
                </span>
              </div>
              <p className="waVoiceDockHint">Tap the green button to send</p>
            </div>
            <button
              type="button"
              className="waVoiceDockSend"
              aria-label="Send voice message"
              title="Send"
              onClick={() => void stopVoiceRecordingAndSend()}
            >
              <IconSend />
            </button>
          </div>
        ) : (
          <div className="chatInputRow">
            <button
              type="button"
              className="chatComposeBtn"
              aria-label="Attach"
              onClick={comingSoon("Attachments")}
            >
              <IconAttach />
            </button>
            <button
              type="button"
              className="chatComposeBtn"
              aria-label="Emoji"
              onClick={comingSoon("Emoji")}
            >
              <IconEmoji />
            </button>
            <textarea
              className="chatTextarea"
              rows={1}
              placeholder="Type a message"
              value={text}
              onChange={onTextChange}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
            />
            <button
              type="button"
              className={`chatComposeBtn chatComposeBtn--primary ${text.trim() ? "chatComposeBtn--send" : ""}`}
              aria-label={text.trim() ? "Send" : "Record voice message"}
              onClick={() => {
                if (text.trim()) handleSend();
                else onMicPress();
              }}
            >
              {text.trim() ? <IconSend /> : <IconMic />}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ChatWindow;
