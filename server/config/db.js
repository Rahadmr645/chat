import mongoose from "mongoose";
import { mongoUri } from "./env.js";

const connectDB = async () => {
  try {
    await mongoose.connect(mongoUri, {});
    console.log("MongoDB Connected ");
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
};

export default connectDB;
