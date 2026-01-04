import express from "express";
import mongoose from "mongoose";
import cron from "node-cron";
import dotenv from "dotenv";
import path from "path";
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
    const { url, keyword, phoneNumber } = req.body;
    console.log("Received data:", { url, keyword, phoneNumber });

    const newTask = new Task({ url, keyword, phoneNumber });
    await newTask.save();

    res.json({ message: "Tracking started successfully!" });
  } catch (error) {
    console.error("SERVER ERROR:", error);
    res.status(500).json({ error: "Failed to save task" });
  }
});

cron.schedule("0 * * * * *", async () => {
  console.log("Running check...");

  try {
    const tasks = await Task.find({ isActive: true });

    for (const task of tasks) {
      const found = await checkWebsiteForKeyword(task.url, task.keyword);

      if (found) {
        console.log(`MATCH FOUND: ${task.keyword}`);

        await sendWhatsApp(
          task.phoneNumber,
          `Found "${task.keyword}"! Check link: ${task.url}`
        );

        // Stop tracking
        task.isActive = false;
        await task.save();
      } else {
        console.log(`... No match for "${task.keyword}" yet`);
      }
    }
  } catch (error) {
    console.error("Cron Job Error:", error);
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
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
