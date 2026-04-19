import mongoose from "mongoose";
import CallLog from "../models/callLog.js";
import User from "../models/user.js";
import { isBlockedEitherWay } from "../utils/blocking.js";

const assertFriendAndNotBlocked = async (req, otherUserId) => {
  const currentUserId = req.user._id;
  const isFriend = (req.user.friends ?? []).some((id) => String(id) === String(otherUserId));
  if (!isFriend) {
    return { ok: false, status: 403, error: "Calls are only logged with friends" };
  }
  if (await isBlockedEitherWay(currentUserId, otherUserId)) {
    return { ok: false, status: 403, error: "Call log is not available for this contact" };
  }
  return { ok: true };
};

export const createCallLog = async (req, res) => {
  try {
    const userId = req.user._id;
    const { peerId, isVideo, direction, outcome, durationSec } = req.body || {};

    if (!peerId || !mongoose.Types.ObjectId.isValid(String(peerId))) {
      return res.status(400).json({ error: "peerId is required" });
    }
    if (String(peerId) === String(userId)) {
      return res.status(400).json({ error: "Invalid peer" });
    }
    if (!["incoming", "outgoing"].includes(direction)) {
      return res.status(400).json({ error: "direction must be incoming or outgoing" });
    }
    if (!["completed", "missed", "declined", "cancelled", "unavailable"].includes(outcome)) {
      return res.status(400).json({ error: "Invalid outcome" });
    }

    const gate = await assertFriendAndNotBlocked(req, peerId);
    if (!gate.ok) {
      return res.status(gate.status).json({ error: gate.error });
    }

    const peer = await User.findById(peerId).select("_id");
    if (!peer) {
      return res.status(404).json({ error: "Contact not found" });
    }

    const dur = Number(durationSec);
    const safeDur = Number.isFinite(dur) && dur >= 0 ? Math.min(Math.floor(dur), 86400) : 0;

    await CallLog.create({
      userId,
      peerId,
      isVideo: Boolean(isVideo),
      direction,
      outcome,
      durationSec: outcome === "completed" ? safeDur : 0,
    });

    return res.status(201).json({ ok: true });
  } catch (err) {
    console.error("createCallLog:", err);
    return res.status(500).json({ error: "Could not save call log" });
  }
};

export const listCallLogs = async (req, res) => {
  try {
    const userId = req.user._id;
    const raw = Number(req.query.limit);
    const limit = Number.isFinite(raw) ? Math.min(Math.max(raw, 1), 300) : 120;

    const rows = await CallLog.find({ userId })
      .sort({ createdAt: -1 })
      .limit(limit)
      .populate({ path: "peerId", select: "name email avatarUrl" })
      .lean();

    const items = rows.map((r) => ({
      _id: String(r._id),
      peerId: r.peerId ? String(r.peerId._id || r.peerId) : String(r.peerId),
      peer: r.peerId && typeof r.peerId === "object"
        ? {
            _id: String(r.peerId._id),
            name: r.peerId.name || "",
            email: r.peerId.email || "",
            avatarUrl: r.peerId.avatarUrl || "",
          }
        : null,
      isVideo: Boolean(r.isVideo),
      direction: r.direction,
      outcome: r.outcome,
      durationSec: r.durationSec || 0,
      createdAt: r.createdAt,
    }));

    return res.json({ items });
  } catch (err) {
    console.error("listCallLogs:", err);
    return res.status(500).json({ error: "Could not load calls" });
  }
};
