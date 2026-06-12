import express from "express";
import { middleware, messagingApi } from "@line/bot-sdk";

const app = express();

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

// 首頁測試
app.get("/", (req, res) => {
  res.send("LINE Sports AI Bot is running!");
});

// LINE Webhook
app.post("/webhook", middleware(config), async (req, res) => {
  try {
    const events = req.body.events;

    await Promise.all(events.map(handleEvent));

    res.status(200).end();
  } catch (err) {
    console.error(err);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (
    event.type !== "message" ||
    event.message.type !== "text"
  ) {
    return;
  }

  await client.replyMessage({
    replyToken: event.replyToken,
    messages: [
      {
        type: "text",
        text: `你說的是：${event.message.text}`
      }
    ]
  });
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
