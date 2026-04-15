import express from "express";
import cors from "cors";
import messageRoutes from "./routes/messageRoutes.js";
import authRoutes from "./routes/authRoutes.js";

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/messages", messageRoutes);

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  return app;
}