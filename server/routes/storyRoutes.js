import express from "express";
import multer from "multer";
import { protect } from "../middleware/authMiddleware.js";
import {
  createStory,
  deleteStory,
  listStories,
  setStoryReaction,
} from "../controller/storyController.js";

const storyUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
});

const router = express.Router();
router.use(protect);

router.get("/", listStories);
router.post("/", storyUpload.single("media"), createStory);
router.put("/:storyId/reactions", setStoryReaction);
router.delete("/:storyId", deleteStory);

export default router;
