import crypto from "crypto";
import { jwtSecret } from "../config/env.js";

/** Stored as prefix + base64(iv12 | tag16 | ciphertext) */
const PREFIX = "rchat-ar1.";
const MIN_SECRET_LEN = 8;

function keyBytes() {
  const raw = String(process.env.MESSAGE_AT_REST_SECRET || jwtSecret || "").trim();
  if (raw.length < MIN_SECRET_LEN) return null;
  return crypto.createHash("sha256").update(raw, "utf8").digest();
}

/**
 * Server-side encryption for the `text` field in MongoDB.
 * Not a one-way hash — the app must decrypt to show chat. Protects raw DB dumps.
 */
export function encryptAtRestForStorage(text) {
  const s = String(text ?? "");
  if (!s) return s;
  const key = keyBytes();
  if (!key) return s;

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const enc = Buffer.concat([cipher.update(s, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const blob = Buffer.concat([iv, tag, enc]);
  return `${PREFIX}${blob.toString("base64")}`;
}

export function decryptAtRestFromStorage(stored) {
  const s = String(stored ?? "");
  if (!s.startsWith(PREFIX)) return s;
  const key = keyBytes();
  if (!key) return "[Message locked: set MESSAGE_AT_REST_SECRET or JWT_SECRET on server]";

  try {
    const buf = Buffer.from(s.slice(PREFIX.length), "base64");
    if (buf.length < 12 + 16 + 1) return s;
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const data = buf.subarray(28);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const out = Buffer.concat([decipher.update(data), decipher.final()]);
    return out.toString("utf8");
  } catch {
    return "[Could not decrypt stored message]";
  }
}
