import { io } from "socket.io-client";

const SOCKET_URL = "http://localhost:5000";

// create socket instance
let socket;

export const connectSocket = (userId) => {
  socket = io(SOCKET_URL, {
    transports: ["websocket"],
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);

    // send user to backend
    socket.emit("addUser", userId);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });
};

export const sendMessage = (data) => {
  if (socket) {
    socket.emit("sendMessage", data);
  }
};

export const onReceiveMessage = (callback) => {
  if (!socket) return;

  socket.on("getMessage", (data) => {
    callback(data);
  });
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
  }
};