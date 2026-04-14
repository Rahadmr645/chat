import express from "express"
import dotenv from "dotenv";
dotenv.config();
import messageRoutes from "./routes/messageRoutes.js";
import connectDB from './config/db.js'

import http from "http";
import { Server } from "socket.io";


const app = express();
const port = 5000;

app.use(express.json())
connectDB();


// Create HTTP server
const server = http.createServer(app);

// Create Socket server
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// store online users
const onlineUsers = new Map();

// socket connection
io.on("connection", (socket) => {
  console.log("User connected:", socket.id);

  // user comes online
  socket.on("addUser", (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log("Online users:", onlineUsers);
  });

  // send message
  socket.on("sendMessage", (data) => {
    const { receiverId } = data;

    const receiverSocketId = onlineUsers.get(receiverId);

    if (receiverSocketId) {
      io.to(receiverSocketId).emit("getMessage", data);
    }
  });

  socket.on("disconnect", () => {
    console.log("User disconnected:", socket.id);

    // remove user
    for (let [userId, socketId] of onlineUsers) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        break;
      }
    }
  });
});


//routes section 

app.use("/api/messages", messageRoutes);


app.use('/', (req,res) => {
  res.send("hello rahaf")
})

server.listen(port, () => {
  console.log(`app is running on http://localhost:${port}`)
})