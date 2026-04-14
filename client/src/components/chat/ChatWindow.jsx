import React, { useEffect, useState } from "react";
import "./Chat.css";

import {
  connectSocket,
  sendMessage,
  onReceiveMessage
} from "../../socket/Socket.js";

const ChatWindow = () => {
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");

  useEffect(() => {
    connectSocket("user1");

    onReceiveMessage((data) => {
      setMessages((prev) => [
        ...prev,
        { text: data.message, type: "received" }
      ]);
    });
  }, []);

  const handleSend = () => {
    if (!text) return;

    const messageData = {
      receiverId: "user2",
      message: text
    };

    sendMessage(messageData);

    setMessages((prev) => [
      ...prev,
      { text, type: "sent" }
    ]);

    setText("");
  };

  return (
    <div className="chatWindow">
      <div className="chatHeader">
        <h3>John Doe</h3>
      </div>

      <div className="messages">
        {messages.map((msg, index) => (
          <div
            key={index}
            className={`message ${msg.type}`}
          >
            {msg.text}
          </div>
        ))}
      </div>

      <div className="chatInput">
        <input
          type="text"
          placeholder="Type a message"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />

        <button onClick={handleSend}>
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatWindow;