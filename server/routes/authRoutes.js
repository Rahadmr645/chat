import express from "express";
import multer from "multer";
import {
  getFriends,
  getMe,
  getUsers,
  loginUser,
  registerUser,
  updateProfilePhoto,
} from "../controller/authController.js";
import { getDashboard } from "../controller/dashboardController.js";
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
const profileUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

router.post("/register", registerUser);
router.post("/login", loginUser);
router.get("/me", protect, getMe);
router.get("/dashboard", protect, getDashboard);
router.patch(
  "/profile/photo",
  protect,
  profileUpload.single("avatar"),
  updateProfilePhoto
);
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
