import express from "express";
import { sendMessage } from "../controller/messageController.js";
import { markAsSeen } from "../controller/messageController.js";

const router = express.Router();

router.post("/send", sendMessage);
router.put("/seen/:messageId", markAsSeen);
export default router;