import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    senderId: {
      type: String, // later ObjectId (user)
      required: true,
    },
    receiverId: {
      type: String,
      required: true,
    },
    text: {
      type: String,
    },
    image: {
      type: String,
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