import mongoose from "mongoose";

const TWENTY_FOUR_H_MS = 24 * 60 * 60 * 1000;

const storySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    kind: {
      type: String,
      enum: ["text", "image", "video"],
      default: "text",
    },
    text: {
      type: String,
      trim: true,
      default: "",
      maxlength: 2000,
    },
    mediaUrl: { type: String, trim: true, default: "" },
    mediaPublicId: { type: String, trim: true, default: "" },
    mediaMime: { type: String, trim: true, default: "" },
    mediaWidth: { type: Number, default: 0 },
    mediaHeight: { type: Number, default: 0 },
    /** One reaction per user: { userId, emoji } */
    reactions: {
      type: [
        {
          userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
          emoji: { type: String, required: true, maxlength: 24 },
        },
      ],
      default: [],
    },
    expiresAt: {
      type: Date,
      required: true,
    },
  },
  { timestamps: true }
);

storySchema.index({ authorId: 1, createdAt: -1 });
storySchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const storyExpiresAtFromNow = () => new Date(Date.now() + TWENTY_FOUR_H_MS);

const Story = mongoose.model("Story", storySchema);

export default Story;
