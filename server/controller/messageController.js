import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Message from "../models/message.js";
import User from "../models/user.js";
import { isBlockedEitherWay } from "../utils/blocking.js";
import { emitToUser } from "../socket/socketServer.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const VOICE_DIR = path.join(__dirname, "../uploads/voice");

const assertFriendAndNotBlocked = async (req, otherUserId) => {
  const currentUserId = req.user._id;
  const isFriend = (req.user.friends ?? []).some(
    (id) => String(id) === String(otherUserId)
  );
  if (!isFriend) {
    return { ok: false, status: 403, error: "Conversation is allowed only with friends" };
  }
  if (await isBlockedEitherWay(currentUserId, otherUserId)) {
    return { ok: false, status: 403, error: "Conversation is not available" };
  }
  return { ok: true };
};

export const sendMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const { receiverId, text } = req.body;

    if (!receiverId || !text?.trim()) {
      return res.status(400).json({ error: "receiverId and text are required" });
    }

    const sender = await User.findById(senderId).select("friends");
    const isFriend = (sender?.friends ?? []).some(
      (id) => String(id) === String(receiverId)
    );

    if (!isFriend) {
      return res.status(403).json({ error: "You can only message your friends" });
    }

    if (await isBlockedEitherWay(senderId, receiverId)) {
      return res.status(403).json({ error: "Messaging is not allowed" });
    }

    const newMessage = await Message.create({
      senderId,
      receiverId,
      kind: "text",
      text: text.trim(),
    });

    return res.status(201).json(newMessage);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const sendVoiceMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.body?.receiverId;
    const raw = parseInt(String(req.body?.durationSec ?? "0"), 10);
    const durationSec = Math.max(
      0,
      Number.isFinite(raw) ? raw : 0
    );

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }

    const buf = req.file?.buffer;
    if (!buf || buf.length < 32) {
      return res.status(400).json({ error: "Audio file is required" });
    }

    const sender = await User.findById(senderId).select("friends");
    const isFriend = (sender?.friends ?? []).some(
      (id) => String(id) === String(receiverId)
    );
    if (!isFriend) {
      return res.status(403).json({ error: "You can only message your friends" });
    }
    if (await isBlockedEitherWay(senderId, receiverId)) {
      return res.status(403).json({ error: "Messaging is not allowed" });
    }

    await fs.mkdir(VOICE_DIR, { recursive: true });

    const mime = String(req.file.mimetype || "audio/webm");
    const ext = /mp4|m4a|aac|mpeg|video\/mp4/i.test(mime) ? "m4a" : "webm";

    const msg = await Message.create({
      senderId,
      receiverId,
      kind: "voice",
      text: "",
      durationSec,
      voiceMime: mime,
    });

    const filePath = path.join(VOICE_DIR, `${msg._id}.${ext}`);
    try {
      await fs.writeFile(filePath, buf);
    } catch (err) {
      await Message.deleteOne({ _id: msg._id });
      throw err;
    }

    return res.status(201).json(msg);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getVoiceAudio = async (req, res) => {
  try {
    const message = await Message.findById(req.params.messageId);
    if (!message || message.kind !== "voice") {
      return res.status(404).json({ error: "Not found" });
    }

    const me = req.user._id;
    const s = String(message.senderId);
    const r = String(message.receiverId);
    const my = String(me);
    if (s !== my && r !== my) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const otherId = s === my ? message.receiverId : message.senderId;
    const gate = await assertFriendAndNotBlocked(req, otherId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const base = path.join(VOICE_DIR, String(message._id));
    const candidates = [
      `${base}.webm`,
      `${base}.m4a`,
    ];
    let filePath = null;
    for (const p of candidates) {
      try {
        await fs.access(p);
        filePath = p;
        break;
      } catch {
        /* try next */
      }
    }
    if (!filePath) {
      return res.status(404).json({ error: "Audio missing" });
    }

    const ct = message.voiceMime || (filePath.endsWith(".m4a") ? "audio/mp4" : "audio/webm");
    res.setHeader("Content-Type", ct);
    res.setHeader("Cache-Control", "private, max-age=3600");
    return res.sendFile(path.resolve(filePath));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getConversation = async (req, res) => {
  try {
    const currentUserId = req.user._id;
    const otherUserId = req.params.otherUserId;
    const gate = await assertFriendAndNotBlocked(req, otherUserId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const messages = await Message.find({
      $or: [
        { senderId: currentUserId, receiverId: otherUserId },
        { senderId: otherUserId, receiverId: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const markConversationSeen = async (req, res) => {
  try {
    const me = req.user._id;
    const otherUserId = req.params.otherUserId;

    const gate = await assertFriendAndNotBlocked(req, otherUserId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const unread = await Message.find({
      senderId: otherUserId,
      receiverId: me,
      seen: false,
    }).select("_id");

    if (!unread.length) {
      return res.json({ updated: 0, messageIds: [] });
    }

    const messageIds = unread.map((m) => m._id);
    await Message.updateMany({ _id: { $in: messageIds } }, { $set: { seen: true } });

    emitToUser(String(otherUserId), "messagesSeen", {
      messageIds: messageIds.map((id) => String(id)),
      readBy: String(me),
    });

    return res.json({
      updated: messageIds.length,
      messageIds: messageIds.map((id) => String(id)),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const markAsSeen = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    if (String(message.receiverId) !== String(req.user._id)) {
      return res.status(403).json({ error: "Only the receiver can mark a message as seen" });
    }

    const gate = await assertFriendAndNotBlocked(req, message.senderId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    message.seen = true;
    await message.save();

    emitToUser(String(message.senderId), "messagesSeen", {
      messageIds: [String(message._id)],
      readBy: String(req.user._id),
    });

    return res.json(message);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
