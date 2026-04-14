import Message from "../models/message.js";

export const sendMessage = async (req, res) => {
  
  console.log('data ', req.body)
  try {
    const { senderId, receiverId, text } = req.body;

    const newMessage = new Message({
      senderId,
      receiverId,
      text,
    });

    await newMessage.save();

    res.status(201).json(newMessage);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};



//marks seen
export const markAsSeen = async (req, res) => {
  try {
    const { messageId } = req.params;

    const message = await Message.findByIdAndUpdate(
      messageId,
      { seen: true },
      { new: true }
    );

    res.json(message);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};