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
    /** Base64 AES-GCM IV (12 bytes) when text is end-to-end ciphertext. */
    textCipherIv: {
      type: String,
      default: "",
    },
    textE2ee: {
      type: Boolean,
      default: false,
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
    /** User ids who chose “delete for me” — message hidden for them only. */
    hiddenFromUsers: {
      type: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
      default: [],
    },
    /** Sender revoked message — both peers see a placeholder. */
    deletedForEveryone: {
      type: Boolean,
      default: false,
    },
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
  },
  { timestamps: true }
);

const Message = mongoose.model("Message", messageSchema);

export default Message;
