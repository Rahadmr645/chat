import mongoose from "mongoose";
import Story, { storyExpiresAtFromNow } from "../models/story.js";
import User from "../models/user.js";
import { isBlockedEitherWay } from "../utils/blocking.js";
import { emitToUser } from "../socket/socketServer.js";
import { uploadBufferToCloudinary, destroyCloudinaryAsset, isCloudinaryConfigured } from "../utils/cloudinary.js";

const plain = (doc) => (doc?.toObject ? doc.toObject() : doc);

export const storyPayloadForClient = (doc) => {
  const o = plain(doc);
  const author = o.authorId && typeof o.authorId === "object" && o.authorId._id ? o.authorId : null;
  const authorId = author ? String(author._id) : String(o.authorId);
  return {
    _id: String(o._id),
    authorId,
    author: author
      ? {
          _id: String(author._id),
          name: String(author.name || ""),
          avatarUrl: String(author.avatarUrl || ""),
        }
      : { _id: authorId, name: "", avatarUrl: "" },
    kind: o.kind || "text",
    text: o.text ?? "",
    mediaUrl: o.mediaUrl ?? "",
    mediaMime: o.mediaMime ?? "",
    mediaWidth: o.mediaWidth ?? 0,
    mediaHeight: o.mediaHeight ?? 0,
    reactions: (o.reactions || []).map((x) => ({
      userId: String(x.userId),
      emoji: String(x.emoji || ""),
    })),
    createdAt: o.createdAt,
    expiresAt: o.expiresAt instanceof Date ? o.expiresAt.toISOString() : o.expiresAt,
  };
};

async function emitStoryFanout(authorMongoId, event, payload) {
  const u = await User.findById(authorMongoId).select("friends");
  if (!u) return;
  const targets = new Set((u.friends ?? []).map((id) => String(id)));
  targets.add(String(authorMongoId));
  for (const id of targets) {
    emitToUser(id, event, payload);
  }
}

const allowedAuthorIdsForViewer = (reqUser) => {
  const me = String(reqUser._id);
  const friends = (reqUser.friends ?? []).map((id) => String(id));
  return new Set([me, ...friends]);
};

export const listStories = async (req, res) => {
  try {
    const allowed = allowedAuthorIdsForViewer(req.user);
    if (allowed.size === 0) {
      return res.json({ stories: [] });
    }

    const ids = [...allowed].filter((id) => mongoose.Types.ObjectId.isValid(id));
    const now = new Date();

    const rows = await Story.find({
      authorId: { $in: ids },
      expiresAt: { $gt: now },
    })
      .populate("authorId", "name avatarUrl")
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    const authorIds = [
      ...new Set(rows.map((row) => String(row.authorId?._id || row.authorId))),
    ];
    const blockedAuthors = new Set();
    await Promise.all(
      authorIds.map(async (aid) => {
        if (aid === String(req.user._id)) return;
        if (await isBlockedEitherWay(req.user._id, aid)) blockedAuthors.add(aid);
      })
    );

    const out = [];
    for (const row of rows) {
      const aid = String(row.authorId?._id || row.authorId);
      if (!allowed.has(aid) || blockedAuthors.has(aid)) continue;
      out.push(storyPayloadForClient(row));
    }

    return res.json({ stories: out });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const createStory = async (req, res) => {
  try {
    const authorId = req.user._id;
    const text = String(req.body?.text ?? "").trim();
    const file = req.file;

    if (!text && (!file || !file.buffer || file.buffer.length < 16)) {
      return res.status(400).json({ error: "Add text and/or a photo or video" });
    }

    let kind = "text";
    let mediaUrl = "";
    let mediaPublicId = "";
    let mediaMime = "";
    let mediaWidth = 0;
    let mediaHeight = 0;

    if (file) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({
          error: "Media stories require Cloudinary (CLOUDINARY_* env vars).",
        });
      }
      const mime = String(file.mimetype || "").toLowerCase();
      const isImage = mime.startsWith("image/");
      const isVideo = mime.startsWith("video/");
      if (!isImage && !isVideo) {
        return res.status(400).json({ error: "Only image or video attachments are allowed for stories" });
      }
      kind = isImage ? "image" : "video";
      const uploaded = await uploadBufferToCloudinary(file.buffer, {
        folder: "rchat/stories",
        resource_type: "auto",
      });
      mediaUrl = uploaded.secure_url || "";
      mediaPublicId = uploaded.public_id || "";
      mediaMime = mime;
      mediaWidth = Number(uploaded.width || 0);
      mediaHeight = Number(uploaded.height || 0);
    }

    const doc = await Story.create({
      authorId,
      kind,
      text,
      mediaUrl,
      mediaPublicId,
      mediaMime,
      mediaWidth,
      mediaHeight,
      expiresAt: storyExpiresAtFromNow(),
    });

    const populated = await Story.findById(doc._id).populate("authorId", "name avatarUrl");
    const payload = storyPayloadForClient(populated);
    await emitStoryFanout(authorId, "storyCreated", { story: payload });

    return res.status(201).json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

const isPlausibleReactionEmoji = (raw) => {
  const s = String(raw ?? "").trim();
  if (!s || s.length > 24) return false;
  if (/[\u0000-\u001f<>\\]/.test(s)) return false;
  return true;
};

const assertStoryViewable = async (req, story) => {
  if (!story || story.expiresAt <= new Date()) {
    return { ok: false, status: 404, error: "Story not found" };
  }
  const authorId = String(story.authorId?._id || story.authorId);
  const allowed = allowedAuthorIdsForViewer(req.user);
  if (!allowed.has(authorId)) {
    return { ok: false, status: 403, error: "You can only view friends' stories" };
  }
  if (authorId !== String(req.user._id) && (await isBlockedEitherWay(req.user._id, authorId))) {
    return { ok: false, status: 403, error: "Story is not available" };
  }
  return { ok: true };
};

export const setStoryReaction = async (req, res) => {
  try {
    const me = req.user._id;
    const my = String(me);
    const { storyId } = req.params;
    const emoji = String(req.body?.emoji ?? "").trim();

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }
    if (!isPlausibleReactionEmoji(emoji)) {
      return res.status(400).json({ error: "Invalid reaction" });
    }

    const story = await Story.findById(storyId).populate("authorId", "name avatarUrl");
    const gate = await assertStoryViewable(req, story);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const prev = [...(story.reactions || [])].map((x) => ({
      userId: x.userId,
      emoji: String(x.emoji || ""),
    }));
    const idx = prev.findIndex((x) => String(x.userId) === my);
    let next;
    if (idx >= 0 && prev[idx].emoji === emoji) {
      next = prev.filter((_, i) => i !== idx);
    } else if (idx >= 0) {
      next = prev.map((x, i) => (i === idx ? { userId: me, emoji } : x));
    } else {
      next = [...prev, { userId: me, emoji }];
    }

    story.reactions = next;
    await story.save();

    const populated = await Story.findById(story._id).populate("authorId", "name avatarUrl");
    const payload = storyPayloadForClient(populated);
    const authorKey = story.authorId?._id ?? story.authorId;
    await emitStoryFanout(authorKey, "storyReaction", { story: payload });

    return res.json(payload);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const deleteStory = async (req, res) => {
  try {
    const me = req.user._id;
    const { storyId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(storyId)) {
      return res.status(400).json({ error: "Invalid story id" });
    }

    const story = await Story.findById(storyId);
    if (!story) {
      return res.status(404).json({ error: "Story not found" });
    }
    if (String(story.authorId) !== String(me)) {
      return res.status(403).json({ error: "Only the author can delete this story" });
    }

    const publicId = story.mediaPublicId;
    const kind = story.kind;
    const authorId = story.authorId;

    await Story.deleteOne({ _id: story._id });

    if (publicId && (kind === "image" || kind === "video")) {
      void destroyCloudinaryAsset(publicId, kind === "video" ? "video" : "image").catch(() => {});
    }

    await emitStoryFanout(authorId, "storyDeleted", { storyId: String(storyId) });

    return res.json({ ok: true, storyId: String(storyId) });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
