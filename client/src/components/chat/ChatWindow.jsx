import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import "./Chat.css";
import {
  connectSocket,
  disconnectSocket,
  emitCallAnswer,
  emitCallEnd,
  emitCallIceCandidate,
  emitCallOffer,
  emitCallReject,
  emitStopTyping,
  emitTyping,
  emitVoiceRecordingStart,
  emitVoiceRecordingStop,
  subscribeCallAnswered,
  subscribeCallEnded,
  subscribeCallIceCandidate,
  subscribeCallRejected,
  subscribeCallUnavailable,
  subscribeIncomingCall,
  subscribeIncomingMessages,
  subscribeMessagesSeen,
  subscribePresence,
  subscribeTypingStatus,
  subscribeVoiceRecordingStatus,
} from "../../socket/Socket.js";
import { apiRequest, apiUploadMediaMessage, apiUploadVoice } from "../../services/api.js";
import {
  formatLastSeen,
  formatMessageTime,
  formatRecordingClock,
} from "../../utils/chatFormat.js";
import { isMessageInThread } from "../../utils/chatThread.js";
import { socketEntityId } from "../../utils/socketEntityId.js";
import {
  getPreferredVoiceMimeType,
  MIN_VOICE_RECORD_MS,
} from "../../utils/voiceRecording.js";
import {
  IconAttach,
  IconCall,
  IconEmoji,
  IconMic,
  IconSearch,
  IconSend,
  IconTrash,
  IconVideo,
} from "../../assets/icons/chatIcons.jsx";
import VoiceMessagePlayer from "./VoiceMessagePlayer.jsx";
import { useNotifications } from "../../context/NotificationContext.jsx";

const LAST_SEEN_REFRESH_MS = 60_000;
const RECORDING_UI_TICK_MS = 100;
const TYPING_STOP_MS = 2000;
const MARK_READ_DEBOUNCE_MS = 400;
const DEFAULT_RTC_CONFIG = {
  iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
};

const ChatWindow = ({
  currentUser,
  selectedUser,
  token,
  isMobile = false,
  onOpenChats,
  onPresence,
  getContactLabel,
}) => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [peerTyping, setPeerTyping] = useState(false);
  const [peerVoiceRecording, setPeerVoiceRecording] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [voiceError, setVoiceError] = useState("");
  const [mediaSending, setMediaSending] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [pendingCaption, setPendingCaption] = useState("");
  const [callState, setCallState] = useState({
    phase: "idle",
    peerId: "",
    peerLabel: "",
    isVideo: false,
    direction: "",
  });
  const [callError, setCallError] = useState("");
  const [incomingCall, setIncomingCall] = useState(null);
  const [localCallStream, setLocalCallStream] = useState(null);
  const [remoteCallStream, setRemoteCallStream] = useState(null);
  const [recordingTick, setRecordingTick] = useState(0);
  const [, setLastSeenTick] = useState(0);

  const mediaRecorderRef = useRef(null);
  const attachInputRef = useRef(null);
  const docInputRef = useRef(null);
  const audioInputRef = useRef(null);
  const cameraInputRef = useRef(null);
  const attachMenuRef = useRef(null);
  const streamRef = useRef(null);
  const pcRef = useRef(null);
  const rtcConfigRef = useRef(DEFAULT_RTC_CONFIG);
  const localCallStreamRef = useRef(null);
  const pendingIceCandidatesRef = useRef([]);
  const disconnectCleanupTimerRef = useRef(null);
  const callStateRef = useRef(callState);
  const incomingCallRef = useRef(incomingCall);
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
  const getContactLabelRef = useRef(getContactLabel);
  const { notifyIncomingMessage } = useNotifications();
  const notifyIncomingMessageRef = useRef(notifyIncomingMessage);
  notifyIncomingMessageRef.current = notifyIncomingMessage;

  useEffect(() => {
    callStateRef.current = callState;
  }, [callState]);

  useEffect(() => {
    incomingCallRef.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    const loadRtcConfig = async () => {
      try {
        const data = await apiRequest({ path: "/api/rtc-config" });
        if (Array.isArray(data?.iceServers) && data.iceServers.length) {
          rtcConfigRef.current = { iceServers: data.iceServers };
        }
      } catch {
        rtcConfigRef.current = DEFAULT_RTC_CONFIG;
      }
    };
    void loadRtcConfig();
  }, []);

  useEffect(() => {
    onPresenceRef.current = onPresence;
  }, [onPresence]);

  useEffect(() => {
    getContactLabelRef.current = getContactLabel;
  }, [getContactLabel]);

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
    localCallStreamRef.current = localCallStream;
  }, [localCallStream]);

  const cleanupCall = useCallback(() => {
    clearTimeout(disconnectCleanupTimerRef.current);
    disconnectCleanupTimerRef.current = null;
    try {
      pcRef.current?.close();
    } catch {
      /* ignore */
    }
    pcRef.current = null;
    pendingIceCandidatesRef.current = [];
    if (localCallStreamRef.current) {
      localCallStreamRef.current.getTracks().forEach((t) => t.stop());
    }
    localCallStreamRef.current = null;
    setLocalCallStream(null);
    setRemoteCallStream(null);
    setIncomingCall(null);
    setCallState({
      phase: "idle",
      peerId: "",
      peerLabel: "",
      isVideo: false,
      direction: "",
    });
  }, []);

  const addPendingIceCandidates = useCallback(async () => {
    const pc = pcRef.current;
    if (!pc || !pendingIceCandidatesRef.current.length) return;
    const queued = [...pendingIceCandidatesRef.current];
    pendingIceCandidatesRef.current = [];
    for (const c of queued) {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(c));
      } catch {
        /* ignore invalid candidate */
      }
    }
  }, []);

  const createPeerConnection = useCallback(
    (peerId) => {
      const pc = new RTCPeerConnection(rtcConfigRef.current || DEFAULT_RTC_CONFIG);
      pc.onicecandidate = (event) => {
        if (!event.candidate) return;
        emitCallIceCandidate({
          senderId: String(currentUserIdRef.current),
          receiverId: String(peerId),
          candidate: event.candidate,
        });
      };
      pc.ontrack = (event) => {
        const [stream] = event.streams || [];
        if (stream) setRemoteCallStream(stream);
      };
      pc.onconnectionstatechange = () => {
        if (pc.connectionState === "connected") {
          clearTimeout(disconnectCleanupTimerRef.current);
          disconnectCleanupTimerRef.current = null;
          setCallState((prev) => ({ ...prev, phase: "in-call" }));
        }
        if (pc.connectionState === "disconnected") {
          clearTimeout(disconnectCleanupTimerRef.current);
          disconnectCleanupTimerRef.current = setTimeout(() => {
            cleanupCall();
            setCallError("Call disconnected.");
          }, 8000);
        }
        if (["failed", "closed"].includes(pc.connectionState)) {
          cleanupCall();
          setCallError("Call connection failed.");
        }
      };
      pcRef.current = pc;
      return pc;
    },
    [cleanupCall]
  );

  const endCall = useCallback(() => {
    const me = currentUserIdRef.current;
    const peerId = callState.peerId || incomingCall?.senderId;
    if (me && peerId) {
      emitCallEnd({ senderId: String(me), receiverId: String(peerId) });
    }
    cleanupCall();
    setCallError("");
  }, [callState.peerId, cleanupCall, incomingCall?.senderId]);

  const rejectIncomingCall = useCallback(() => {
    const me = currentUserIdRef.current;
    const peerId = incomingCall?.senderId;
    if (me && peerId) {
      emitCallReject({ senderId: String(me), receiverId: String(peerId) });
    }
    setIncomingCall(null);
    setCallState((prev) => ({ ...prev, phase: "idle" }));
  }, [incomingCall?.senderId]);

  const getCallMediaStream = useCallback(async (preferVideo) => {
    if (!window.isSecureContext) {
      throw new Error("Calling needs HTTPS (or localhost) to access microphone/camera.");
    }
    if (preferVideo) {
      try {
        const videoStream = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: true,
        });
        return { stream: videoStream, isVideo: true };
      } catch {
        const audioOnly = await navigator.mediaDevices.getUserMedia({
          audio: true,
          video: false,
        });
        return { stream: audioOnly, isVideo: false };
      }
    }
    const audioStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    return { stream: audioStream, isVideo: false };
  }, []);

  const startOutgoingCall = useCallback(
    async ({ isVideo }) => {
      const me = currentUserIdRef.current;
      const peerId = selectedUserIdRef.current;
      if (!me || !peerId) return;
      if (callState.phase !== "idle") {
        setCallError("Finish current call first.");
        return;
      }
      try {
        setCallError("");
        setCallState({
          phase: "calling",
          peerId: String(peerId),
          peerLabel: getContactLabelRef.current?.(peerId) || selectedUser?.name || "Contact",
          isVideo: Boolean(isVideo),
          direction: "outgoing",
        });
        const media = await getCallMediaStream(Boolean(isVideo));
        setLocalCallStream(media.stream);
        if (media.isVideo !== Boolean(isVideo)) {
          setCallError("Camera unavailable. Switched to voice call.");
          setCallState((prev) => ({ ...prev, isVideo: false }));
        }
        const pc = createPeerConnection(peerId);
        media.stream.getTracks().forEach((track) => pc.addTrack(track, media.stream));
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        emitCallOffer({
          senderId: String(me),
          receiverId: String(peerId),
          offer,
          isVideo: media.isVideo,
        });
      } catch (err) {
        const name = String(err?.name || "");
        if (name === "NotAllowedError" || name === "PermissionDeniedError") {
          setCallError("Microphone/camera permission denied. Allow it in browser site settings.");
        } else if (name === "NotFoundError") {
          setCallError("No microphone/camera found on this device.");
        } else {
          setCallError(err?.message || "Could not start call.");
        }
        cleanupCall();
      }
    },
    [callState.phase, cleanupCall, createPeerConnection, getCallMediaStream, selectedUser?.name]
  );

  const acceptIncomingCall = useCallback(async () => {
    if (!incomingCall?.offer || !incomingCall?.senderId) return;
    const me = currentUserIdRef.current;
    if (!me) return;
    try {
      setCallError("");
      const peerId = String(incomingCall.senderId);
      const isVideo = Boolean(incomingCall.isVideo);
      setCallState({
        phase: "connecting",
        peerId,
        peerLabel: getContactLabelRef.current?.(peerId) || "Contact",
        isVideo,
        direction: "incoming",
      });
      const media = await getCallMediaStream(isVideo);
      setLocalCallStream(media.stream);
      if (media.isVideo !== isVideo) {
        setCallError("Camera unavailable. Connected as voice call.");
        setCallState((prev) => ({ ...prev, isVideo: false }));
      }
      const pc = createPeerConnection(peerId);
      media.stream.getTracks().forEach((track) => pc.addTrack(track, media.stream));
      await pc.setRemoteDescription(new RTCSessionDescription(incomingCall.offer));
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      emitCallAnswer({
        senderId: String(me),
        receiverId: peerId,
        answer,
      });
      await addPendingIceCandidates();
      setIncomingCall(null);
    } catch (err) {
      setCallError(err?.message || "Could not accept call.");
      cleanupCall();
    }
  }, [addPendingIceCandidates, cleanupCall, createPeerConnection, getCallMediaStream, incomingCall]);

  useEffect(() => {
    if (!currentUser?._id) return;

    connectSocket(String(currentUser._id));

    const unsubMsg = subscribeIncomingMessages((incoming) => {
      const me = currentUserIdRef.current;
      if (!me) return;

      const peer = selectedUserIdRef.current;
      const fromId = socketEntityId(incoming.senderId);
      const toId = socketEntityId(incoming.receiverId);
      const meStr = String(me);

      if (toId === meStr && fromId !== meStr) {
        const activeThread =
          peer && isMessageInThread(incoming, peer, meStr);
        if (!activeThread) {
          const label = getContactLabelRef.current?.(fromId);
          notifyIncomingMessageRef.current(incoming, label, meStr);
        }
      }

      if (!peer) return;
      if (!isMessageInThread(incoming, peer, meStr)) return;

      setMessages((prev) => [...prev, incoming]);

      const fromPeer =
        fromId === String(peer) && toId === meStr;
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

    const unsubIncomingCall = subscribeIncomingCall((payload) => {
      const me = String(currentUserIdRef.current || "");
      if (!payload?.senderId || String(payload.receiverId) !== me) return;
      if (callStateRef.current.phase !== "idle" || incomingCallRef.current) {
        emitCallReject({
          senderId: me,
          receiverId: String(payload.senderId),
        });
        return;
      }
      const fromId = String(payload.senderId);
      setIncomingCall(payload);
      setCallState({
        phase: "incoming",
        peerId: fromId,
        peerLabel: getContactLabelRef.current?.(fromId) || "Incoming call",
        isVideo: Boolean(payload.isVideo),
        direction: "incoming",
      });
    });

    const unsubCallAnswered = subscribeCallAnswered(async (payload) => {
      const me = String(currentUserIdRef.current || "");
      if (!payload?.senderId || String(payload.receiverId) !== me) return;
      try {
        const pc = pcRef.current;
        if (!pc) return;
        await pc.setRemoteDescription(new RTCSessionDescription(payload.answer));
        await addPendingIceCandidates();
        setCallState((prev) => ({ ...prev, phase: "connecting" }));
      } catch {
        setCallError("Call answer failed.");
        cleanupCall();
      }
    });

    const unsubCallIce = subscribeCallIceCandidate(async (payload) => {
      const me = String(currentUserIdRef.current || "");
      if (!payload?.senderId || String(payload.receiverId) !== me) return;
      const pc = pcRef.current;
      if (!pc || !pc.remoteDescription) {
        pendingIceCandidatesRef.current.push(payload.candidate);
        return;
      }
      try {
        await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));
      } catch {
        /* ignore candidate add failure */
      }
    });

    const unsubCallRejected = subscribeCallRejected((payload) => {
      const me = String(currentUserIdRef.current || "");
      if (!payload?.senderId || String(payload.receiverId) !== me) return;
      setCallError("Call declined.");
      cleanupCall();
    });

    const unsubCallEnded = subscribeCallEnded((payload) => {
      const me = String(currentUserIdRef.current || "");
      if (!payload?.senderId || String(payload.receiverId) !== me) return;
      setCallError("Call ended.");
      cleanupCall();
    });

    const unsubCallUnavailable = subscribeCallUnavailable(() => {
      setCallError("User is unavailable.");
      cleanupCall();
    });

    return () => {
      unsubMsg();
      unsubTyping();
      unsubVoiceRec();
      unsubSeen();
      unsubPresence();
      unsubIncomingCall();
      unsubCallAnswered();
      unsubCallIce();
      unsubCallRejected();
      unsubCallEnded();
      unsubCallUnavailable();
      disconnectSocket();
    };
  }, [
    addPendingIceCandidates,
    cleanupCall,
    currentUser?._id,
    markConversationRead,
  ]);

  useEffect(() => {
    setPeerTyping(false);
    setPeerVoiceRecording(false);
  }, [selectedUserId]);

  useEffect(() => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setPendingCaption("");
  }, [selectedUserId]);

  useEffect(() => {
    const onClickOutside = (event) => {
      if (!attachMenuRef.current) return;
      if (!attachMenuRef.current.contains(event.target)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener("pointerdown", onClickOutside, true);
    return () => document.removeEventListener("pointerdown", onClickOutside, true);
  }, []);

  useEffect(() => {
    return () => {
      if (pendingAttachment?.previewUrl) {
        URL.revokeObjectURL(pendingAttachment.previewUrl);
      }
    };
  }, [pendingAttachment]);

  useEffect(() => {
    return () => {
      clearTimeout(disconnectCleanupTimerRef.current);
      disconnectCleanupTimerRef.current = null;
      cleanupCall();
    };
  }, [cleanupCall]);

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

  const onPickMedia = () => {
    if (!selectedUserId || mediaSending) return;
    setAttachMenuOpen((open) => !open);
  };

  const toAttachmentKind = (file) => {
    const mime = String(file?.type || "").toLowerCase();
    if (mime.startsWith("image/")) return "image";
    if (mime.startsWith("video/")) return "video";
    if (mime.startsWith("audio/")) return "audio";
    return "file";
  };

  const toAttachmentPreviewUrl = (file, kind) => {
    if (!file) return "";
    if (kind === "image" || kind === "video" || kind === "audio") {
      return URL.createObjectURL(file);
    }
    return "";
  };

  const setAttachmentDraftFromFile = (file) => {
    if (!file || !selectedUserId) return;
    setAttachMenuOpen(false);
    setError("");
    setPendingCaption("");
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      const kind = toAttachmentKind(file);
      return {
        file,
        kind,
        previewUrl: toAttachmentPreviewUrl(file, kind),
      };
    });
  };

  const closeAttachmentComposer = () => {
    setPendingAttachment((prev) => {
      if (prev?.previewUrl) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });
    setPendingCaption("");
  };

  const handleMediaSelect = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setAttachmentDraftFromFile(file);
  };

  const sendPendingAttachment = async () => {
    if (!pendingAttachment?.file || !selectedUserId) return;
    setError("");
    setMediaSending(true);
    try {
      const savedMessage = await apiUploadMediaMessage({
        token,
        receiverId: selectedUserId,
        file: pendingAttachment.file,
        text: pendingCaption,
      });
      setMessages((prev) => [...prev, savedMessage]);
      closeAttachmentComposer();
    } catch (err) {
      setError(err.message || "Could not send media.");
    } finally {
      setMediaSending(false);
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
    if (!text.trim() || !selectedUserId || mediaSending) return;

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
  const formatFileSize = (n) => {
    const bytes = Number(n || 0);
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

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
          {selectedUser.avatarUrl ? (
            <img src={selectedUser.avatarUrl} alt={`${selectedUser.name} avatar`} />
          ) : (
            selectedUser.name?.charAt(0)?.toUpperCase() ?? "?"
          )}
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
            aria-label="Voice call"
            onClick={() => void startOutgoingCall({ isVideo: false })}
          >
            <IconCall />
          </button>
          <button
            type="button"
            className="chatHeaderIconBtn"
            aria-label="Video call"
            onClick={() => void startOutgoingCall({ isVideo: true })}
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
        {callError && <p className="chatError">{callError}</p>}
        {loading && <p className="chatInfo">Loading conversation...</p>}
        {error && <p className="chatError">{error}</p>}
        {!loading && !error && normalizedMessages.length === 0 && (
          <p className="chatInfo">No messages yet. Say hello.</p>
        )}

        {normalizedMessages.map((msg) => {
          const isSent = msg.senderId === String(currentUser._id);
          const time = formatMessageTime(msg.createdAt);
          const isVoice = msg.kind === "voice";
          const isImage = msg.kind === "image";
          const isVideo = msg.kind === "video";
          const isAudioFile = msg.kind === "audio";
          const isFile = msg.kind === "file";
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
                ) : isImage ? (
                  <div className="bubbleMediaWrap">
                    <img src={msg.mediaUrl} alt="Shared" className="bubbleMedia bubbleMedia--image" />
                    {msg.text ? <div className="bubbleText">{msg.text}</div> : null}
                  </div>
                ) : isVideo ? (
                  <div className="bubbleMediaWrap">
                    <video
                      controls
                      preload="metadata"
                      className="bubbleMedia bubbleMedia--video"
                      src={msg.mediaUrl}
                    />
                    {msg.text ? <div className="bubbleText">{msg.text}</div> : null}
                  </div>
                ) : isAudioFile ? (
                  <div className="bubbleMediaWrap">
                    <audio className="bubbleAudioFile" controls preload="metadata" src={msg.mediaUrl} />
                    {msg.text ? <div className="bubbleText">{msg.text}</div> : null}
                  </div>
                ) : isFile ? (
                  <a
                    className="bubbleFileCard"
                    href={msg.mediaUrl}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <span className="bubbleFileIcon" aria-hidden="true">
                      📄
                    </span>
                    <span className="bubbleFileMeta">
                      <strong>{msg.mediaName || "Attachment"}</strong>
                      <small>{formatFileSize(msg.mediaSizeBytes)}</small>
                    </span>
                  </a>
                ) : (
                  <div className="bubbleText">{msg.text}</div>
                )}
                <div className="bubbleFooter">
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

      {pendingAttachment && (
        <div className="chatComposerOverlay" role="dialog" aria-modal="true" aria-label="Attachment preview">
          <div className="chatComposerTopBar">
            <button
              type="button"
              className="chatComposerCloseBtn"
              aria-label="Close attachment preview"
              onClick={closeAttachmentComposer}
              disabled={mediaSending}
            >
              ×
            </button>
            <h4>Preview</h4>
            <button
              type="button"
              className="chatComposerReplaceBtn"
              onClick={() => attachInputRef.current?.click()}
              disabled={mediaSending}
            >
              Replace
            </button>
          </div>
          <div className="chatComposerBody">
            {pendingAttachment.kind === "image" && (
              <img
                src={pendingAttachment.previewUrl}
                alt="Selected attachment"
                className="chatComposerPreviewMedia chatComposerPreviewMedia--image"
              />
            )}
            {pendingAttachment.kind === "video" && (
              <video
                src={pendingAttachment.previewUrl}
                controls
                className="chatComposerPreviewMedia chatComposerPreviewMedia--video"
              />
            )}
            {pendingAttachment.kind === "audio" && (
              <audio
                src={pendingAttachment.previewUrl}
                controls
                className="chatComposerPreviewAudio"
              />
            )}
            {pendingAttachment.kind === "file" && (
              <div className="chatComposerFileCard">
                <span className="chatComposerFileIcon" aria-hidden="true">
                  📄
                </span>
                <div>
                  <strong>{pendingAttachment.file.name}</strong>
                  <p>{formatFileSize(pendingAttachment.file.size)}</p>
                </div>
              </div>
            )}
          </div>
          <div className="chatComposerFooter">
            <textarea
              className="chatComposerCaption"
              rows={1}
              placeholder="Add a caption"
              value={pendingCaption}
              onChange={(e) => setPendingCaption(e.target.value)}
              disabled={mediaSending}
            />
            <button
              type="button"
              className="chatComposerSendBtn"
              onClick={() => void sendPendingAttachment()}
              disabled={mediaSending}
            >
              {mediaSending ? "Sending..." : "Send"}
            </button>
          </div>
        </div>
      )}

      {(incomingCall || callState.phase !== "idle") && (
        <div className="callOverlay" role="dialog" aria-modal="true" aria-label="Call dialog">
          <div className="callCard">
            <h4 className="callTitle">
              {callState.peerLabel || getContactLabel(callState.peerId) || "Call"}
            </h4>
            {callError && <p className="callErr">{callError}</p>}
            <p className="callStatus">
              {incomingCall
                ? `${incomingCall.isVideo ? "Incoming video call" : "Incoming voice call"}`
                : callState.phase === "calling"
                  ? "Calling..."
                  : callState.phase === "connecting"
                    ? "Connecting..."
                    : "In call"}
            </p>
            <div className="callMediaArea">
              {callState.isVideo && (
                <>
                  <video
                    className="callRemoteVideo"
                    autoPlay
                    playsInline
                    ref={(el) => {
                      if (el && remoteCallStream) el.srcObject = remoteCallStream;
                    }}
                  />
                  <video
                    className="callLocalVideo"
                    autoPlay
                    muted
                    playsInline
                    ref={(el) => {
                      if (el && localCallStream) el.srcObject = localCallStream;
                    }}
                  />
                </>
              )}
              {!callState.isVideo && (
                <div className="callAudioOnly">Audio call</div>
              )}
            </div>
            <div className="callActions">
              {incomingCall ? (
                <>
                  <button type="button" className="callBtn callBtn--decline" onClick={rejectIncomingCall}>
                    Decline
                  </button>
                  <button type="button" className="callBtn callBtn--accept" onClick={() => void acceptIncomingCall()}>
                    Accept
                  </button>
                </>
              ) : (
                <button type="button" className="callBtn callBtn--decline" onClick={endCall}>
                  End call
                </button>
              )}
            </div>
          </div>
        </div>
      )}

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
              aria-label="Attach media"
              disabled={mediaSending}
              onClick={onPickMedia}
            >
              <IconAttach />
            </button>
            {attachMenuOpen && (
              <div className="chatAttachMenu" ref={attachMenuRef} role="menu" aria-label="Attachment menu">
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={() => docInputRef.current?.click()}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--violet">📄</span>
                  Document
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={() => attachInputRef.current?.click()}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--blue">🖼️</span>
                  Photos & videos
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={() => cameraInputRef.current?.click()}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--pink">📷</span>
                  Camera
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={() => audioInputRef.current?.click()}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--orange">🎵</span>
                  Audio
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={comingSoon("Contact")}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--teal">👤</span>
                  Contact
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={comingSoon("Poll")}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--lime">📊</span>
                  Poll
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={comingSoon("Event")}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--purple">📅</span>
                  Event
                </button>
                <button
                  type="button"
                  className="chatAttachItem"
                  onClick={comingSoon("New sticker")}
                >
                  <span className="chatAttachItemDot chatAttachItemDot--green">😊</span>
                  New sticker
                </button>
              </div>
            )}
            <input
              ref={attachInputRef}
              type="file"
              accept="*/*"
              className="chatHiddenInput"
              onChange={(e) => void handleMediaSelect(e)}
            />
            <input
              ref={docInputRef}
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip,.rar,*/*"
              className="chatHiddenInput"
              onChange={(e) => void handleMediaSelect(e)}
            />
            <input
              ref={audioInputRef}
              type="file"
              accept="audio/*"
              className="chatHiddenInput"
              onChange={(e) => void handleMediaSelect(e)}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*,video/*"
              capture="environment"
              className="chatHiddenInput"
              onChange={(e) => void handleMediaSelect(e)}
            />
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
              placeholder={mediaSending ? "Sending media..." : "Type a message"}
              value={text}
              onChange={onTextChange}
              disabled={mediaSending}
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
              disabled={mediaSending}
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
