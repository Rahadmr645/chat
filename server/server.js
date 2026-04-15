import "./config/env.js";
import http from "http";
import { createApp } from "./app.js";
import connectDB from "./config/db.js";
import { attachSocket } from "./socket/socketServer.js";
import { port } from "./config/env.js";

const app = createApp();
await connectDB();

const server = http.createServer(app);
attachSocket(server);

server.listen(port, () => {
  console.log(`app is running on http://localhost:${port}`);
});
