import express from "express";
import mongoose from "mongoose";
import cron from "node-cron";
import dotenv from "dotenv";
import path, { resolve } from "path";
import { fileURLToPath } from "url";
import twilio from "twilio";

import Task from "./model/Task.js";
import { checkWebsiteForKeyword } from "./utils/scraper.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(express.json());
app.use(express.static("public"));

mongoose
  .connect(process.env.MONGO_URL) 
  .then(() => console.log("Connected to MongoDB"))
  .catch((err) => console.error("DB Connection Error:", err));

app.post("/api/monitor", async (req, res) => {
  try {
    const { url, keyword, requiredContext, phoneNumber } = req.body;
    console.log("Received data:", {
      url,
      keyword,
      requiredContext,
      phoneNumber,
    });

    const existing = await Task.findOne({
      url,
      keyword,
      requiredContext,
      phoneNumber,
      isActive: true,
    });
    if (existing) { 
      return res.status(400).json({ error: "You have already tracking this item!"})
    }

    const newTask = new Task({ url, keyword, requiredContext, phoneNumber });
    await newTask.save();

    res.json({ message: "Tracking started successfully!" });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ error: "Failed to save task" });
  }
});

let isScanning = false;

cron.schedule("*/2 * * * *", async () => {
  // 1. CHECK LOCK
  if (isScanning) {
    console.log("⚠️ Skipping cycle: Previous scan is still busy.");
    return;
  }

  isScanning = true;
  console.log("⏰ Running check...");

  try {
    const tasks = await Task.find({ isActive: true });

    for (const task of tasks) {
      const found = await checkWebsiteForKeyword(
        task.url,
        task.keyword,
        task.requiredContext
      );

      if (found) {
        console.log("🎉 MATCH FOUND!");
        await sendWhatsApp(task.phoneNumber, `Found it! ${task.url}`);
        task.isActive = false;
        await task.save();
      }
      await new Promise((r) => setTimeout(r, 2000));
    }
  } catch (error) {
    console.error("Loop Error:", error);
  } finally {
    isScanning = false;
  }
});


const sendWhatsApp = async (to, message) => {
  try {
    const client = twilio(
      process.env.TWILIO_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    await client.messages.create({
      from: "whatsapp:+14155238886",
      to: `whatsapp:${to}`,
      body: message,
    });
    console.log("WhatsApp sent!");
  } catch (error) {
    console.error("Twilio Error: ", error.message);
  }
};

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () =>
  console.log(`🚀 Server running on port ${PORT}`)
);
