import mongoose from "mongoose";

const callLogSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    peerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    isVideo: { type: Boolean, default: false },
    direction: {
      type: String,
      enum: ["incoming", "outgoing"],
      required: true,
    },
    outcome: {
      type: String,
      enum: ["completed", "missed", "declined", "cancelled", "unavailable"],
      required: true,
    },
    durationSec: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

callLogSchema.index({ userId: 1, createdAt: -1 });

const CallLog = mongoose.models.CallLog || mongoose.model("CallLog", callLogSchema);
export default CallLog;
