import { Server } from "socket.io";
import User from "../models/user.js";

let ioRef;
const onlineUsers = new Map();

export function isUserOnline(userId) {
  return onlineUsers.has(String(userId));
}

export function emitToUser(userId, event, payload) {
  if (!ioRef) return;
  const socketId = onlineUsers.get(String(userId));
  if (socketId) {
    ioRef.to(socketId).emit(event, payload);
  }
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
      onlineUsers.set(key, socket.id);
      io.emit("presence", { userId: key, online: true });
    });

    socket.on("sendMessage", (data) => {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(String(receiverId));

      if (receiverSocketId) {
        io.to(receiverSocketId).emit("getMessage", data);
      }
    });

    socket.on("typing", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typingStatus", {
          senderId: String(senderId),
          isTyping: true,
        });
      }
    });

    socket.on("stopTyping", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("typingStatus", {
          senderId: String(senderId),
          isTyping: false,
        });
      }
    });

    socket.on("voiceRecordingStart", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("voiceRecordingStatus", {
          senderId: String(senderId),
          active: true,
        });
      }
    });

    socket.on("voiceRecordingStop", (data) => {
      const { senderId, receiverId } = data || {};
      if (!senderId || !receiverId) return;
      const receiverSocketId = onlineUsers.get(String(receiverId));
      if (receiverSocketId) {
        io.to(receiverSocketId).emit("voiceRecordingStatus", {
          senderId: String(senderId),
          active: false,
        });
      }
    });

    socket.on("disconnect", () => {
      for (const [userId, socketId] of onlineUsers) {
        if (socketId === socket.id) {
          onlineUsers.delete(userId);
          const lastSeenAt = new Date();
          void User.findByIdAndUpdate(userId, { lastSeenAt }).catch((err) =>
            console.error("lastSeenAt update failed:", err)
          );
          io.emit("presence", {
            userId: String(userId),
            online: false,
            lastSeenAt: lastSeenAt.toISOString(),
          });
          break;
        }
      }
    });
  });

  return io;
}
