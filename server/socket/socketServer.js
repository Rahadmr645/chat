import { Server } from "socket.io";
import User from "../models/user.js";

let ioRef;
const onlineUsers = new Map();
const socketToUser = new Map();

const getUserSocketIds = (userId) => {
  const key = String(userId);
  const set = onlineUsers.get(key);
  if (!set || set.size === 0) return [];
  return [...set];
};

const addUserSocket = (userId, socketId) => {
  const key = String(userId);
  const existing = onlineUsers.get(key) ?? new Set();
  existing.add(socketId);
  onlineUsers.set(key, existing);
  socketToUser.set(socketId, key);
};

const removeUserSocket = (socketId) => {
  const userId = socketToUser.get(socketId);
  if (!userId) return { userId: "", wentOffline: false };
  socketToUser.delete(socketId);
  const set = onlineUsers.get(userId);
  if (!set) return { userId, wentOffline: false };
  set.delete(socketId);
  if (set.size === 0) {
    onlineUsers.delete(userId);
    return { userId, wentOffline: true };
  }
  return { userId, wentOffline: false };
};

const emitToUserSockets = (io, userId, event, payload) => {
  for (const socketId of getUserSocketIds(userId)) {
    io.to(socketId).emit(event, payload);
  }
};

export function isUserOnline(userId) {
  return getUserSocketIds(userId).length > 0;
}

export function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  emitToUserSockets(ioRef, userId, event, payload);
}

export function attachSocket(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
    },
  });

  ioRef = io;

  io.on("connection", (socket) => {
    socket.on("addUser", (userId) => {
      const key = String(userId);
      const wasOnline = isUserOnline(key);
      addUserSocket(key, socket.id);
      if (!wasOnline) {
        io.emit("presence", { userId: key, online: true });
      }
    });

    socket.on("typing", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "typingStatus", {
        senderId: String(senderId),
        isTyping: true,
      });
    });

    socket.on("stopTyping", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "typingStatus", {
        senderId: String(senderId),
        isTyping: false,
      });
    });

    socket.on("voiceRecordingStart", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "voiceRecordingStatus", {
        senderId: String(senderId),
        active: true,
      });
    });

    socket.on("voiceRecordingStop", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "voiceRecordingStatus", {
        senderId: String(senderId),
        active: false,
      });
    });

    socket.on("callOffer", (data) => {
      const { senderId, receiverId, offer, isVideo } = data || {};
      if (!senderId || !receiverId || !offer) return;
      const receiverSocketIds = getUserSocketIds(receiverId);
      if (!receiverSocketIds.length) {
        io.to(socket.id).emit("callUnavailable", {
          receiverId: String(receiverId),
        });
        return;
      }
      emitToUserSockets(io, receiverId, "incomingCall", {
        senderId: String(senderId),
        receiverId: String(receiverId),
        isVideo: Boolean(isVideo),
        offer,
      });
      io.to(socket.id).emit("callRinging", {
        senderId: String(senderId),
        receiverId: String(receiverId),
        isVideo: Boolean(isVideo),
      });
    });

    socket.on("callAnswer", (data) => {
      const { senderId, receiverId, answer } = data || {};
      if (!senderId || !receiverId || !answer) return;
      emitToUserSockets(io, receiverId, "callAnswered", {
        senderId: String(senderId),
        receiverId: String(receiverId),
        answer,
      });
    });

    /** Mid-call SDP (e.g. screen share on audio-only calls). */
    socket.on("callRenegotiate", (data) => {
      const { senderId, receiverId, description } = data || {};
      if (!senderId || !receiverId || !description?.sdp || !description?.type) return;
      emitToUserSockets(io, receiverId, "callRenegotiate", {
        senderId: String(senderId),
        receiverId: String(receiverId),
        description: {
          type: String(description.type),
          sdp: String(description.sdp),
        },
      });
    });

    socket.on("callIceCandidate", (data) => {
      const { senderId, receiverId, candidate } = data || {};
      if (!senderId || !receiverId || !candidate) return;
      emitToUserSockets(io, receiverId, "callIceCandidate", {
        senderId: String(senderId),
        receiverId: String(receiverId),
        candidate,
      });
    });

    socket.on("callReject", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "callRejected", {
        senderId: String(senderId),
        receiverId: String(receiverId),
      });
    });

    socket.on("callEnd", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      emitToUserSockets(io, receiverId, "callEnded", {
        senderId: String(senderId),
        receiverId: String(receiverId),
      });
    });

    socket.on("callMuteStatus", (data) => {
      const { senderId, receiverId, muted, cameraOff } = data || {};
      if (!senderId || !receiverId) return;
      const payload = {
        senderId: String(senderId),
        receiverId: String(receiverId),
      };
      if (muted !== undefined) payload.muted = Boolean(muted);
      if (cameraOff !== undefined) payload.cameraOff = Boolean(cameraOff);
      if (Object.keys(payload).length <= 2) return;
      emitToUserSockets(io, receiverId, "callMuteStatus", payload);
    });

    socket.on("disconnect", () => {
      const { userId, wentOffline } = removeUserSocket(socket.id);
      if (!userId || !wentOffline) return;
      const lastSeenAt = new Date();
      void User.findByIdAndUpdate(userId, { lastSeenAt }).catch((err) =>
        console.error("lastSeenAt update failed:", err)
      );
      io.emit("presence", {
        userId: String(userId),
        online: false,
        lastSeenAt: lastSeenAt.toISOString(),
      });
    });
  });

  return io;
}
