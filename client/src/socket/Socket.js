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
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    socket.emit("addUser", String(userId));
  });
};

export const emitChatMessage = (payload) => {
  if (socket) {
    socket.emit("sendMessage", {
      ...payload,
      senderId: String(payload.senderId),
      receiverId: String(payload.receiverId),
    });
  }
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

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};
