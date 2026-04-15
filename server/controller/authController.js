import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User from "../models/user.js";
import FriendRequest from "../models/friendRequest.js";
import { jwtSecret } from "../config/env.js";
import { isUserOnline } from "../socket/socketServer.js";

const signToken = (userId) => {
  return jwt.sign({ userId }, jwtSecret, { expiresIn: "7d" });
};

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
});

export const registerUser = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name?.trim() || !email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }

    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(409).json({ error: "Email is already in use" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: hashedPassword,
    });

    return res.status(201).json({
      user: sanitizeUser(user),
      token: signToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email?.trim() || !password?.trim()) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const passwordMatches = await bcrypt.compare(password, user.password);
    if (!passwordMatches) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    return res.json({
      user: sanitizeUser(user),
      token: signToken(user._id),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getMe = async (req, res) => {
  return res.json({ user: sanitizeUser(req.user) });
};

export const getUsers = async (req, res) => {
  try {
    const me = req.user._id;
    const currentFriends = req.user.friends ?? [];
    const friendIds = new Set(currentFriends.map((id) => String(id)));
    const myBlocked = new Set((req.user.blockedUsers ?? []).map((id) => String(id)));

    const idQuery = { $ne: me };
    if (myBlocked.size) {
      idQuery.$nin = [...myBlocked];
    }

    const users = await User.find({
      _id: idQuery,
      blockedUsers: { $nin: [me] },
    })
      .select("name email friends blockedUsers lastSeenAt")
      .sort({ name: 1 });

    const pending = await FriendRequest.find({
      status: "pending",
      $or: [{ from: me }, { to: me }],
    }).select("from to");

    const outgoingPending = new Set();
    const incomingPending = new Set();
    for (const r of pending) {
      if (String(r.from) === String(me)) {
        outgoingPending.add(String(r.to));
      } else {
        incomingPending.add(String(r.from));
      }
    }

    return res.json({
      users: users.map((user) => {
        const id = String(user._id);
        let requestStatus = "none";
        if (outgoingPending.has(id)) requestStatus = "sent";
        else if (incomingPending.has(id)) requestStatus = "received";

        return {
          ...sanitizeUser(user),
          isFriend: friendIds.has(id),
          requestStatus,
          isOnline: isUserOnline(id),
          lastSeenAt: user.lastSeenAt ? user.lastSeenAt.toISOString() : null,
        };
      }),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};

export const getFriends = async (req, res) => {
  try {
    const currentFriends = req.user.friends ?? [];
    const friends = await User.find({ _id: { $in: currentFriends } })
      .select("name email lastSeenAt")
      .sort({ name: 1 });

    return res.json({
      friends: friends.map((friend) => ({
        ...sanitizeUser(friend),
        isOnline: isUserOnline(friend._id),
        lastSeenAt: friend.lastSeenAt ? friend.lastSeenAt.toISOString() : null,
      })),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message });
  }
};
