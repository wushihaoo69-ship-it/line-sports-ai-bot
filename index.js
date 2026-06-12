import express from "express";
import { middleware, messagingApi } from "@line/bot-sdk";

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

app.get("/", (req, res) => {
  res.send("LINE Sports AI Bot is running!");
});

app.post("/webhook", middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events || [];

    await Promise.all(events.map(handleEvent));

    res.status(200).end();
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message") return;
  if (event.message.type !== "text") return;

  const userMessage = event.message.text;

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `收到你的訊息：${userMessage}`
      }
    ]
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
