import User from "../models/user.js";
import FriendRequest from "../models/friendRequest.js";
import CallLog from "../models/callLog.js";
import { isUserOnline } from "../socket/socketServer.js";

const sanitizeUser = (user) => ({
  _id: user._id,
  name: user.name,
  email: user.email,
  avatarUrl: user.avatarUrl || "",
  encryptionPublicKey: user.encryptionPublicKey || "",
});

const mapCallLogRows = (rows) =>
  rows.map((r) => ({
    _id: String(r._id),
    peerId: r.peerId ? String(r.peerId._id || r.peerId) : String(r.peerId),
    peer:
      r.peerId && typeof r.peerId === "object"
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

/** One round-trip: users, friends, incoming requests, blocked list, and call history (server-side aggregation). */
export const getDashboard = async (req, res) => {
  try {
    const me = req.user._id;
    const currentFriends = req.user.friends ?? [];
    const friendIds = new Set(currentFriends.map((id) => String(id)));
    const myBlocked = new Set((req.user.blockedUsers ?? []).map((id) => String(id)));

    const idQuery = { $ne: me };
    if (myBlocked.size) {
      idQuery.$nin = [...myBlocked];
    }

    const blockedIds = req.user.blockedUsers ?? [];

    const [usersRaw, friends, pendingList, incomingList, blockedList, callRows] =
      await Promise.all([
        User.find({
          _id: idQuery,
          blockedUsers: { $nin: [me] },
        })
          .select("name email friends blockedUsers lastSeenAt avatarUrl")
          .sort({ name: 1 })
          .lean(),
        User.find({ _id: { $in: currentFriends } })
          .select("name email lastSeenAt avatarUrl encryptionPublicKey")
          .sort({ name: 1 })
          .lean(),
        FriendRequest.find({
          status: "pending",
          $or: [{ from: me }, { to: me }],
        })
          .select("from to")
          .lean(),
        FriendRequest.find({
          to: me,
          status: "pending",
        })
          .populate("from", "name email avatarUrl")
          .sort({ createdAt: -1 })
          .lean(),
        blockedIds.length
          ? User.find({ _id: { $in: blockedIds } })
              .select("name email avatarUrl")
              .sort({ name: 1 })
              .lean()
          : Promise.resolve([]),
        CallLog.find({ userId: me })
          .sort({ createdAt: -1 })
          .limit(150)
          .populate({ path: "peerId", select: "name email avatarUrl" })
          .lean(),
      ]);

    const outgoingPending = new Set();
    const incomingPending = new Set();
    for (const r of pendingList) {
      if (String(r.from) === String(me)) {
        outgoingPending.add(String(r.to));
      } else {
        incomingPending.add(String(r.from));
      }
    }

    const users = usersRaw.map((user) => {
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
    });

    const friendsOut = friends.map((friend) => ({
      ...sanitizeUser(friend),
      isOnline: isUserOnline(friend._id),
      lastSeenAt: friend.lastSeenAt ? friend.lastSeenAt.toISOString() : null,
    }));

    const requestsOut = incomingList
      .filter((r) => r.from)
      .map((r) => ({
        _id: r._id,
        from: sanitizeUser(r.from),
        createdAt: r.createdAt,
      }));

    const blockedOut = blockedList.map((u) => sanitizeUser(u));

    return res.json({
      users,
      friends: friendsOut,
      requests: requestsOut,
      blocked: blockedOut,
      callLogs: mapCallLogRows(callRows),
    });
  } catch (error) {
    return res.status(500).json({ error: error.message || "Dashboard load failed" });
  }
};
