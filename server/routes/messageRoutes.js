import express from "express";
import multer from "multer";
import {
  getConversation,
  getVoiceAudio,
  markAsSeen,
  markConversationSeen,
  sendMessage,
  sendVoiceMessage,
} from "../controller/messageController.js";
import { protect } from "../middleware/authMiddleware.js";

const voiceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 },
});

const router = express.Router();

router.use(protect);

router.post("/voice", voiceUpload.single("audio"), sendVoiceMessage);
router.get("/audio/:messageId", getVoiceAudio);
router.post("/send", sendMessage);
router.get("/conversation/:otherUserId", getConversation);
router.put("/conversation/:otherUserId/seen", markConversationSeen);
router.put("/seen/:messageId", markAsSeen);

export default router;
