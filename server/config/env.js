import dotenv from "dotenv";

dotenv.config();

export const port = Number(process.env.PORT) || 5000;
export const mongoUri = process.env.MONGO_URI;
export const jwtSecret = process.env.JWT_SECRET;
export const turnUrl =
  process.env.TURN_URL || process.env.RTC_TURN_URL || process.env.TURN_SERVER_URL || "";
export const turnUsername =
  process.env.TURN_USERNAME || process.env.RTC_TURN_USERNAME || "";
export const turnCredential =
  process.env.TURN_CREDENTIAL ||
  process.env.RTC_TURN_CREDENTIAL ||
  process.env.TURN_PASSWORD ||
  "";

if (!mongoUri) {
  console.error("Missing MONGO_URI. Set it in server/.env");
  process.exit(1);
}

if (!jwtSecret) {
  console.error("Missing JWT_SECRET. Set it in server/.env");
  process.exit(1);
}