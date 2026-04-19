import express from "express";
import { protect } from "../middleware/authMiddleware.js";
import { createCallLog, listCallLogs } from "../controller/callLogController.js";

const router = express.Router();
router.use(protect);

router.get("/", listCallLogs);
router.post("/log", createCallLog);

export default router;
