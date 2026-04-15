import express from "express";
import {
  getFriends,
  getMe,
  getUsers,
  loginUser,
  registerUser,
} from "../controller/authController.js";
import {
  acceptFriendRequest,
  blockFromRequest,
  blockUser,
  getBlockedUsers,
  getIncomingRequests,
  rejectFriendRequest,
  sendFriendRequest,
  sendFriendRequestByEmail,
  unfriendUser,
  unblockUser,
} from "../controller/friendController.js";
import { protect } from "../middleware/authMiddleware.js";

const router = express.Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/users/blocked", protect, getBlockedUsers);
router.get("/users", protect, getUsers);
router.get("/friends", protect, getFriends);

router.get("/friends/requests/incoming", protect, getIncomingRequests);
router.post("/friends/request", protect, sendFriendRequest);
router.post("/friends/request-by-email", protect, sendFriendRequestByEmail);
router.post("/friends/requests/:requestId/accept", protect, acceptFriendRequest);
router.post("/friends/requests/:requestId/reject", protect, rejectFriendRequest);
router.post("/friends/requests/:requestId/block", protect, blockFromRequest);

router.post("/users/:userId/unfriend", protect, unfriendUser);
router.post("/users/:userId/block", protect, blockUser);
router.post("/users/:userId/unblock", protect, unblockUser);

export default router;
