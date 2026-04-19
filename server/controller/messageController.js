import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import Message from "../models/message.js";
import User from "../models/user.js";
import { isBlockedEitherWay } from "../utils/blocking.js";
import { emitToUser } from "../socket/socketServer.js";
import { uploadBufferToCloudinary } from "../utils/cloudinary.js";

const plainMessage = (doc) => (doc?.toObject ? doc.toObject() : doc);

/** Normalized payload for API + socket (string ids, plain JSON). */
export const messagePayloadForSocket = (doc) => {
  const o = plainMessage(doc);
  const base = {
    _id: String(o._id),
    senderId: String(o.senderId),
    receiverId: String(o.receiverId),
    kind: o.kind || "text",
    text: o.text ?? "",
    seen: Boolean(o.seen),
    durationSec: o.durationSec ?? 0,
    voiceMime: o.voiceMime ?? "",
    mediaUrl: o.mediaUrl ?? "",
    mediaMime: o.mediaMime ?? "",
    mediaWidth: o.mediaWidth ?? 0,
    mediaHeight: o.mediaHeight ?? 0,
    mediaDurationSec: o.mediaDurationSec ?? 0,
    mediaName: o.mediaName ?? "",
    mediaSizeBytes: o.mediaSizeBytes ?? 0,
    deletedForEveryone: Boolean(o.deletedForEveryone),
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
  if (base.deletedForEveryone) {
    return {
      ...base,
      kind: "text",
      text: "This message was deleted.",
      durationSec: 0,
      voiceMime: "",
      mediaUrl: "",
      mediaMime: "",
      mediaWidth: 0,
      mediaHeight: 0,
      mediaDurationSec: 0,
      mediaName: "",
      mediaSizeBytes: 0,
    };
  }
  return base;
};

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

    emitToUser(String(receiverId), "getMessage", messagePayloadForSocket(newMessage));

    return res.status(201).json(messagePayloadForSocket(newMessage));
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

    emitToUser(String(receiverId), "getMessage", messagePayloadForSocket(msg));

    return res.status(201).json(messagePayloadForSocket(msg));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const sendMediaMessage = async (req, res) => {
  try {
    const senderId = req.user._id;
    const receiverId = req.body?.receiverId;
    const caption = String(req.body?.text || "").trim();
    const file = req.file;

    if (!receiverId) {
      return res.status(400).json({ error: "receiverId is required" });
    }
    if (!file || !file.buffer || file.buffer.length < 16) {
      return res.status(400).json({ error: "Attachment file is required" });
    }

    const mime = String(file.mimetype || "").toLowerCase();
    const isImage = mime.startsWith("image/");
    const isVideo = mime.startsWith("video/");
    const isAudio = mime.startsWith("audio/");
    const kind = isImage ? "image" : isVideo ? "video" : isAudio ? "audio" : "file";

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

    const uploaded = await uploadBufferToCloudinary(file.buffer, {
      folder: "rchat/messages",
      resource_type: "auto",
    });

    const newMessage = await Message.create({
      senderId,
      receiverId,
      kind,
      text: caption,
      mediaUrl: uploaded.secure_url || "",
      mediaPublicId: uploaded.public_id || "",
      mediaMime: mime,
      mediaWidth: Number(uploaded.width || 0),
      mediaHeight: Number(uploaded.height || 0),
      mediaDurationSec: Number(uploaded.duration || 0),
      mediaName: String(file.originalname || ""),
      mediaSizeBytes: Number(file.size || 0),
    });

    emitToUser(String(receiverId), "getMessage", messagePayloadForSocket(newMessage));

    return res.status(201).json(messagePayloadForSocket(newMessage));
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
    if (message.deletedForEveryone) {
      return res.status(410).json({ error: "Message was deleted" });
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
      $and: [
        {
          $or: [
            { senderId: currentUserId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: currentUserId },
          ],
        },
        { $nor: [{ hiddenFromUsers: currentUserId }] },
      ],
    }).sort({ createdAt: 1 });

    return res.json(messages.map((doc) => messagePayloadForSocket(doc)));
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

export const deleteMessage = async (req, res) => {
  try {
    const me = req.user._id;
    const my = String(me);
    const { messageId } = req.params;
    const scope = String(req.body?.scope || "me").toLowerCase();

    const message = await Message.findById(messageId);
    if (!message) {
      return res.status(404).json({ error: "Message not found" });
    }

    const s = String(message.senderId);
    const r = String(message.receiverId);
    if (s !== my && r !== my) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const otherId = s === my ? message.receiverId : message.senderId;
    const gate = await assertFriendAndNotBlocked(req, otherId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    if (scope === "me") {
      await Message.updateOne(
        { _id: message._id },
        { $addToSet: { hiddenFromUsers: me } }
      );
      return res.json({ success: true });
    }

    if (scope !== "everyone") {
      return res.status(400).json({ error: "Invalid scope" });
    }

    if (s !== my) {
      return res.status(403).json({
        error: "Only the person who sent this message can delete it for everyone",
      });
    }

    if (message.deletedForEveryone) {
      return res.json({ message: messagePayloadForSocket(message) });
    }

    const wasVoice = message.kind === "voice";
    const msgIdStr = String(message._id);

    message.deletedForEveryone = true;
    message.text = "";
    message.kind = "text";
    message.durationSec = 0;
    message.voiceMime = "";
    message.mediaUrl = "";
    message.mediaPublicId = "";
    message.mediaMime = "";
    message.mediaWidth = 0;
    message.mediaHeight = 0;
    message.mediaDurationSec = 0;
    message.mediaName = "";
    message.mediaSizeBytes = 0;
    await message.save();

    if (wasVoice) {
      for (const ext of [".webm", ".m4a"]) {
        const p = path.join(VOICE_DIR, `${msgIdStr}${ext}`);
        try {
          await fs.unlink(p);
        } catch {
          /* ignore missing file */
        }
      }
    }

    const payload = messagePayloadForSocket(message);
    emitToUser(r, "messageRevoked", { message: payload });

    return res.json({ message: payload });
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

    return res.json(messagePayloadForSocket(message));
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
