import mongoose from "mongoose";
import User from "../models/user.js";
import FriendRequest from "../models/friendRequest.js";
import { isBlockedEitherWay } from "../utils/blocking.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || "",
});

const isFriendWith = (user, otherId) =>
  (user.friends ?? []).some((id) => String(id) === String(otherId));

const removeMutualFriendship = async (userIdA, userIdB) => {
  await User.findByIdAndUpdate(userIdA, { $pull: { friends: userIdB } });
  await User.findByIdAndUpdate(userIdB, { $pull: { friends: userIdA } });
};

const deleteRequestsBetween = async (userIdA, userIdB) => {
  await FriendRequest.deleteMany({
    $or: [
      { from: userIdA, to: userIdB },
      { from: userIdB, to: userIdA },
    ],
  });
};

export const sendFriendRequest = async (req, res) => {
  try {
    const fromId = String(req.user._id);
    const toId = req.body?.userId || req.params.userId;

    if (!toId) {
      return res.status(400).json({ error: "userId is required" });
    }
    if (fromId === String(toId)) {
      return res.status(400).json({ error: "You cannot send a request to yourself" });
    }

    const target = await User.findById(toId).select(
      "name email friends blockedUsers avatarUrl"
    );
    if (!target) {
      return res.status(404).json({ error: "User not found" });
    }

    if (isFriendWith(req.user, toId)) {
      return res.status(409).json({ error: "You are already friends" });
    }

    if (await isBlockedEitherWay(fromId, toId)) {
      return res.status(403).json({ error: "Cannot send request" });
    }

    const existing = await FriendRequest.findOne({
      $or: [
        { from: fromId, to: toId },
        { from: toId, to: fromId },
      ],
      status: "pending",
    });

    if (existing) {
      if (String(existing.from) === fromId) {
        return res.status(409).json({ error: "Friend request already sent" });
      }
      return res.status(409).json({
        error: "This user already sent you a request. Check your requests.",
      });
    }

    const request = await FriendRequest.create({
      from: fromId,
      to: toId,
      status: "pending",
    });

    await request.populate("from", "name email avatarUrl");
    await request.populate("to", "name email avatarUrl");

    return res.status(201).json({
      message: "Friend request sent",
      request: {
        _id: request._id,
        from: sanitizeUser(request.from),
        to: sanitizeUser(request.to),
        status: request.status,
        createdAt: request.createdAt,
      },
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ error: "A request between you already exists" });
    }
    return res.status(500).json({ error: error.message });
  }
};

export const sendFriendRequestByEmail = async (req, res) => {
  try {
    const email = req.body?.email?.toLowerCase()?.trim();
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const target = await User.findOne({ email }).select("_id");
    if (!target) {
      return res.status(404).json({ error: "User not found with that email" });
    }

    req.body = { ...req.body, userId: String(target._id) };
    return sendFriendRequest(req, res);
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getIncomingRequests = async (req, res) => {
  try {
    const list = await FriendRequest.find({
      to: req.user._id,
      status: "pending",
    })
      .populate("from", "name email avatarUrl")
      .sort({ createdAt: -1 });

    return res.json({
      requests: list.map((r) => ({
        _id: r._id,
        from: sanitizeUser(r.from),
        createdAt: r.createdAt,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const acceptFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      to: req.user._id,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const fromId = String(request.from);
    const toId = String(request.to);

    if (await isBlockedEitherWay(fromId, toId)) {
      await FriendRequest.deleteOne({ _id: request._id });
      return res.status(403).json({ error: "Cannot accept this request" });
    }

    await User.findByIdAndUpdate(fromId, { $addToSet: { friends: toId } });
    await User.findByIdAndUpdate(toId, { $addToSet: { friends: fromId } });
    await FriendRequest.deleteOne({ _id: request._id });

    const friend = await User.findById(fromId).select("name email avatarUrl");
    return res.json({
      message: "Friend request accepted",
      friend: sanitizeUser(friend),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const rejectFriendRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const result = await FriendRequest.deleteOne({
      _id: requestId,
      to: req.user._id,
      status: "pending",
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Request not found" });
    }

    return res.json({ message: "Request ignored" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const unfriendUser = async (req, res) => {
  try {
    const me = String(req.user._id);
    const otherId = req.params.userId;

    if (!otherId || otherId === me) {
      return res.status(400).json({ error: "Invalid user" });
    }

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    if (!isFriendWith(req.user, otherId)) {
      return res.status(400).json({ error: "You are not friends with this user" });
    }

    await removeMutualFriendship(me, otherId);
    await deleteRequestsBetween(me, otherId);

    return res.json({ message: "Unfriended" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const blockUser = async (req, res) => {
  try {
    const me = String(req.user._id);
    const otherId = req.params.userId;

    if (!otherId || otherId === me) {
      return res.status(400).json({ error: "Invalid user" });
    }

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const other = await User.findById(otherId).select("_id");
    if (!other) {
      return res.status(404).json({ error: "User not found" });
    }

    await User.findByIdAndUpdate(me, { $addToSet: { blockedUsers: otherId } });
    await removeMutualFriendship(me, otherId);
    await deleteRequestsBetween(me, otherId);

    return res.json({ message: "User blocked" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getBlockedUsers = async (req, res) => {
  try {
    const ids = req.user.blockedUsers ?? [];
    if (!ids.length) {
      return res.json({ blocked: [] });
    }

    const list = await User.find({ _id: { $in: ids } })
      .select("name email avatarUrl")
      .sort({ name: 1 });

    return res.json({
      blocked: list.map((u) => sanitizeUser(u)),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const unblockUser = async (req, res) => {
  try {
    const me = String(req.user._id);
    const otherId = req.params.userId;

    if (!otherId) {
      return res.status(400).json({ error: "User id is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(otherId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    await User.findByIdAndUpdate(me, { $pull: { blockedUsers: otherId } });
    return res.json({ message: "User unblocked" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const blockFromRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(requestId)) {
      return res.status(400).json({ error: "Invalid request id" });
    }

    const request = await FriendRequest.findOne({
      _id: requestId,
      to: req.user._id,
      status: "pending",
    });

    if (!request) {
      return res.status(404).json({ error: "Request not found" });
    }

    const fromId = String(request.from);
    await FriendRequest.deleteOne({ _id: request._id });

    const me = String(req.user._id);
    await User.findByIdAndUpdate(me, { $addToSet: { blockedUsers: fromId } });
    await removeMutualFriendship(me, fromId);
    await deleteRequestsBetween(me, fromId);

    return res.json({ message: "User blocked" });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
