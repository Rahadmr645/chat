import { io } from "socket.io-client";
import { SOCKET_URL } from "../config.js";

let socket;

export const connectSocket = (userId) => {
  if (!userId) return;

  if (socket?.connected) {
    socket.emit("addUser", String(userId));
    return;
  }

  socket = io(SOCKET_URL, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 500,
  });

  socket.on("connect", () => {
    socket.emit("addUser", String(userId));
  });
};

export const emitTyping = (senderId, receiverId) => {
  if (socket) {
    socket.emit("typing", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitStopTyping = (senderId, receiverId) => {
  if (socket) {
    socket.emit("stopTyping", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitVoiceRecordingStart = (senderId, receiverId) => {
  if (socket) {
    socket.emit("voiceRecordingStart", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitVoiceRecordingStop = (senderId, receiverId) => {
  if (socket) {
    socket.emit("voiceRecordingStop", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitCallOffer = ({ senderId, receiverId, offer, isVideo }) => {
  if (socket) {
    socket.emit("callOffer", {
      senderId: String(senderId),
      receiverId: String(receiverId),
      offer,
      isVideo: Boolean(isVideo),
    });
  }
};

export const emitCallAnswer = ({ senderId, receiverId, answer }) => {
  if (socket) {
    socket.emit("callAnswer", {
      senderId: String(senderId),
      receiverId: String(receiverId),
      answer,
    });
  }
};

export const emitCallIceCandidate = ({ senderId, receiverId, candidate }) => {
  if (socket) {
    socket.emit("callIceCandidate", {
      senderId: String(senderId),
      receiverId: String(receiverId),
      candidate,
    });
  }
};

export const emitCallReject = ({ senderId, receiverId }) => {
  if (socket) {
    socket.emit("callReject", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitCallEnd = ({ senderId, receiverId }) => {
  if (socket) {
    socket.emit("callEnd", {
      senderId: String(senderId),
      receiverId: String(receiverId),
    });
  }
};

export const emitCallMuteStatus = ({ senderId, receiverId, muted }) => {
  if (socket) {
    socket.emit("callMuteStatus", {
      senderId: String(senderId),
      receiverId: String(receiverId),
      muted: Boolean(muted),
    });
  }
};

export const subscribeIncomingMessages = (callback) => {
  if (!socket) return () => {};

  const handler = (data) => callback(data);
  socket.on("getMessage", handler);

  return () => socket?.off("getMessage", handler);
};

export const subscribeTypingStatus = (callback) => {
  if (!socket) return () => {};

  const handler = (data) => callback(data);
  socket.on("typingStatus", handler);

  return () => socket?.off("typingStatus", handler);
};

export const subscribeVoiceRecordingStatus = (callback) => {
  if (!socket) return () => {};

  const handler = (data) => callback(data);
  socket.on("voiceRecordingStatus", handler);

  return () => socket?.off("voiceRecordingStatus", handler);
};

export const subscribeMessagesSeen = (callback) => {
  if (!socket) return () => {};

  const handler = (data) => callback(data);
  socket.on("messagesSeen", handler);

  return () => socket?.off("messagesSeen", handler);
};

export const subscribePresence = (callback) => {
  if (!socket) return () => {};

  const handler = (data) => callback(data);
  socket.on("presence", handler);

  return () => socket?.off("presence", handler);
};

export const subscribeIncomingCall = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("incomingCall", handler);
  return () => socket?.off("incomingCall", handler);
};

export const subscribeCallAnswered = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callAnswered", handler);
  return () => socket?.off("callAnswered", handler);
};

export const subscribeCallIceCandidate = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callIceCandidate", handler);
  return () => socket?.off("callIceCandidate", handler);
};

export const subscribeCallRejected = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callRejected", handler);
  return () => socket?.off("callRejected", handler);
};

export const subscribeCallEnded = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callEnded", handler);
  return () => socket?.off("callEnded", handler);
};

export const subscribeCallUnavailable = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callUnavailable", handler);
  return () => socket?.off("callUnavailable", handler);
};

export const subscribeCallMuteStatus = (callback) => {
  if (!socket) return () => {};
  const handler = (data) => callback(data);
  socket.on("callMuteStatus", handler);
  return () => socket?.off("callMuteStatus", handler);
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
