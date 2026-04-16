/** Normalize user/message ids from socket or API (string, ObjectId, or { _id }). */
export function socketEntityId(v) {
  if (v == null) return "";
  if (typeof v === "object" && v._id != null) return String(v._id);
  return String(v);
}
