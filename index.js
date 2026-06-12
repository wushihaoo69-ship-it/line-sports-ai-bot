import express from "express";
import line from "@line/bot-sdk";
import { createClient } from "@supabase/supabase-js";
import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const app = express();

const lineConfig = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
  channelSecret: process.env.LINE_CHANNEL_SECRET
};

const client = new line.messagingApi.MessagingApiClient({
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN
});

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
});

app.get("/", (req, res) => {
  res.send("LINE Sports AI Bot is running.");
});

app.post("/webhook", line.middleware(lineConfig), async (req, res) => {
  try {
    const events = req.body.events;

    await Promise.all(events.map(handleEvent));

    res.status(200).end();
  } catch (error) {
    console.error("Webhook error:", error);
    res.status(500).end();
  }
});

async function handleEvent(event) {
  if (event.type !== "message" || event.message.type !== "text") {
    return;
  }

  const userId = event.source.userId;
  const text = event.message.text.trim();

  if (text === "選單" || text === "menu") {
    return reply(event.replyToken, mainMenu());
  }

  if (text.startsWith("/開通")) {
    return adminOpenVip(event, text);
  }

  const isVip = await checkVip(userId);

  if (!isVip) {
    return reply(event.replyToken, {
      type: "text",
      text:
        "你目前還不是 VIP 會員。\n\n請聯繫管理員開通會員後，就可以使用：\n1. 世足 AI\n2. MLB AI\n3. NBA AI"
    });
  }

  if (text.includes("NBA") || text.includes("MLB") || text.includes("世足")) {
    const answer = await sportsAI(text);
    return reply(event.replyToken, {
      type: "text",
      text: answer
    });
  }

  return reply(event.replyToken, {
    type: "text",
    text:
      "請輸入你想查詢的體育問題，例如：\n\nNBA 今天賽事分析\nMLB 洋基近況\n世足 法國隊分析\n\n輸入「選單」可查看功能。"
  });
}

function mainMenu() {
  return {
    type: "template",
    altText: "主選單",
    template: {
      type: "buttons",
      title: "體育 AI 主選單",
      text: "請選擇你要使用的功能",
      actions: [
        {
          type: "message",
          label: "NBA AI",
          text: "NBA 今天賽事分析"
        },
        {
          type: "message",
          label: "MLB AI",
          text: "MLB 今日賽事分析"
        },
        {
          type: "message",
          label: "世足 AI",
          text: "世足 強隊分析"
        }
      ]
    }
  };
}

async function checkVip(lineUserId) {
  const now = new Date().toISOString();

  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("line_user_id", lineUserId)
    .eq("status", "active")
    .gt("vip_until", now)
    .maybeSingle();

  if (error) {
    console.error("VIP check error:", error);
    return false;
  }

  return !!data;
}

async function adminOpenVip(event, text) {
  const adminId = process.env.ADMIN_LINE_USER_ID;

  if (event.source.userId !== adminId) {
    return reply(event.replyToken, {
      type: "text",
      text: "你沒有管理員權限。"
    });
  }

  const parts = text.split(" ");

  if (parts.length < 3) {
    return reply(event.replyToken, {
      type: "text",
      text: "格式錯誤。\n\n請輸入：\n/開通 LINE_USER_ID 天數\n\n例如：\n/開通 Uxxxxxxxx 30"
    });
  }

  const lineUserId = parts[1];
  const days = Number(parts[2]);

  const vipUntil = new Date();
  vipUntil.setDate(vipUntil.getDate() + days);

  const { error } = await supabase.from("members").upsert({
    line_user_id: lineUserId,
    status: "active",
    vip_until: vipUntil.toISOString()
  });

  if (error) {
    console.error(error);
    return reply(event.replyToken, {
      type: "text",
      text: "開通失敗，請檢查 Supabase。"
    });
  }

  return reply(event.replyToken, {
    type: "text",
    text: `已成功開通 VIP：${days} 天`
  });
}

async function sportsAI(question) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "system",
        content:
          "你是專業體育分析助理，請用繁體中文回答。分析 NBA、MLB、世足時，請用新手也看得懂的方式，包含近況、重點球員、風險提醒。不要保證勝率。"
      },
      {
        role: "user",
        content: question
      }
    ]
  });

  return response.choices[0].message.content;
}

function reply(replyToken, message) {
  return client.replyMessage({
    replyToken,
    messages: [message]
  });
}

const port = process.env.PORT || 3000;

app.listen(port, () => {
  console.log(`Bot running on port ${port}`);
});
