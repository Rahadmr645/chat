import express from "express";
import multer from "multer";
import {
  deleteMessage,
  getConversation,
  getVoiceAudio,
  markAsSeen,
  markConversationSeen,
  sendMediaMessage,
  sendMessage,
  sendVoiceMessage,
  setMessageReaction,
} from "../controller/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});
const mediaUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();

router.use(protect);

router.post("/voice", voiceUpload.single("audio"), sendVoiceMessage);
router.post("/media", mediaUpload.single("media"), sendMediaMessage);
router.get("/audio/:messageId", getVoiceAudio);
router.post("/send", sendMessage);
router.get("/conversation/:otherUserId", getConversation);
router.put("/conversation/:otherUserId/seen", markConversationSeen);
router.put("/seen/:messageId", markAsSeen);
router.put("/:messageId/reactions", setMessageReaction);
router.delete("/:messageId", deleteMessage);

export default router;
