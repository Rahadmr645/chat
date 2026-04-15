/**
 * True when a message belongs to the 1:1 thread between the current user and the selected peer.
 */
export function isMessageInThread(message, peerUserId, currentUserId) {
  const s = String(message.senderId);
  const r = String(message.receiverId);
  const p = String(peerUserId);
  const me = String(currentUserId);
  return (s === p && r === me) || (s === me && r === p);
}
