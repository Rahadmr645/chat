import express from "express";
import cors from "cors";
import messageRoutes from "./routes/messageRoutes.js";
import callRoutes from "./routes/callRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import { turnCredential, turnUrl, turnUsername } from "./config/env.js";

const normalizeTurnUrl = (rawUrl) => {
  const u = String(rawUrl || "").trim();
  if (!u) return "";
  if (/^turns?:/i.test(u)) return u;
  return `turn:${u}`;
};

const expandTurnUrls = (rawUrl) => {
  const normalized = normalizeTurnUrl(rawUrl);
  if (!normalized) return [];
  if (/\?transport=/i.test(normalized)) return [normalized];
  if (!/^turn:/i.test(normalized)) return [normalized];
  return [normalized, `${normalized}?transport=udp`, `${normalized}?transport=tcp`];
};

export function createApp() {
  const app = express();

  app.use(cors());
  app.use(express.json());

  app.use("/api/auth", authRoutes);
  app.use("/api/messages", messageRoutes);
  app.use("/api/calls", callRoutes);

  app.get("/api/rtc-config", (req, res) => {
    const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];
    const turnUrls = expandTurnUrls(turnUrl);
    if (turnUrls.length && turnUsername && turnCredential) {
      iceServers.push({
        urls: turnUrls,
        username: turnUsername,
        credential: turnCredential,
      });
    }
    res.json({ iceServers });
  });

  app.get("/api/health", (req, res) => {
    res.json({ ok: true });
  });

  return app;
}