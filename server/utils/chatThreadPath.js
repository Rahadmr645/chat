/**
 * Stable folder name for a 1:1 thread (same string for both participants).
 * Used for Cloudinary paths and voice file subdirs so media is grouped per chat.
 */
export function chatThreadFolderName(userIdA, userIdB) {
  const a = String(userIdA);
  const b = String(userIdB);
  return a < b ? `${a}_${b}` : `${b}_${a}`;
}
