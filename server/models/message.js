import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    receiverId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    kind: {
      type: String,
      enum: ["text", "voice", "image", "video", "audio", "file"],
      default: "text",
    },
    text: {
      type: String,
      trim: true,
      default: "",
    },
    durationSec: {
      type: Number,
      default: 0,
    },
    voiceMime: {
      type: String,
      default: "",
    },
    mediaUrl: {
      type: String,
      trim: true,
      default: "",
    },
    mediaPublicId: {
      type: String,
      trim: true,
      default: "",
    },
    mediaMime: {
      type: String,
      trim: true,
      default: "",
    },
    mediaWidth: {
      type: Number,
      default: 0,
    },
    mediaHeight: {
      type: Number,
      default: 0,
    },
    mediaDurationSec: {
      type: Number,
      default: 0,
    },
    mediaName: {
      type: String,
      trim: true,
      default: "",
    },
    mediaSizeBytes: {
      type: Number,
      default: 0,
    },
    seen: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
