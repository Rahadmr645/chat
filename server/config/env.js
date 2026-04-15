import dotenv from "dotenv";

dotenv.config();

export const port = Number(process.env.PORT) || 5000;
export const mongoUri = process.env.MONGO_URI;
export const jwtSecret = process.env.JWT_SECRET;

if (!mongoUri) {
  console.error("Missing MONGO_URI. Set it in server/.env");
  process.exit(1);
}

if (!jwtSecret) {
  console.error("Missing JWT_SECRET. Set it in server/.env");
  process.exit(1);
}