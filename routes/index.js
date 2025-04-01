var express = require("express");
var router = express.Router();
const axios = require("axios");
const { connectToDB } = require("../utils/db");

router.get("/", function (req, res, next) {
  res.render("index", { title: "Express" });
});
const webhookToken = "sendmsg-webhook-token";
const whatsapp_access_token =
  "EAATk1ZC2RFN8BOwmnhl1L20Gg3JaxGpxw0zyPp2rsBf5VtOUdBircZBeuCE9FZBNCjVP2bSgCXAFkGLQCHwQj5WuZBqZCQXNWS6UpjgYhokPP2oXNQPPiVSZAnzwv5NeEsZC3j43vgQ02BBgSRddYLSnGvdr61ZAZCdhWzW5M1xZCMBpUfCdJ51EtJ6VrdRWdewi9YVwZDZD";

router.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === webhookToken) {
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// router.post('/webhook', (req, res) => {
//   const { entry } = req.body;

//   try {
//       entry.forEach(item => {
//           const messageObj = item.changes[0].value.messages[0];

//           const textBody = messageObj.text.body;
//           const sender = messageObj.from;
//           const timestamp = messageObj.timestamp;

//           console.log("訊息內容:", textBody);
//           console.log("發送者:", sender);
//           console.log("時間戳記:", timestamp);

//       });
//   } catch (error) {
//       console.error("處理訊息時出錯:", error);
//   }

//   console.log(JSON.stringify(req.body, null, 2));
//   res.status(200).send('ok');
// });

// router.post("/webhook", async (req, res) => {
//   const { entry } = req.body;
//   let client;

//   try {
//     client = await connectToDB();
//     const db = client.db("wts");

//     // 處理每個訊息
//     for (const item of entry) {
//       try {
//         const messageObj = item.changes[0].value.messages[0];

//         // 提取訊息資訊
//         const textBody = messageObj.text.body;
//         const sender = messageObj.from;

//         console.log("訊息內容:", textBody);
//         console.log("發送者:", sender);
//         console.log("時間戳記:", timestamp);

//         // 格式化日期時間 (從 UNIX 時間戳轉換為 YYYY-MM-DD HH:MM:SS)
//         const date = new Date(parseInt(timestamp) * 1000);
//         const formattedDateTime = date
//           .toISOString()
//           .replace("T", " ")
//           .substring(0, 19);

//         // 從聯絡人資訊中找出發送者名稱 (如果有)
//         let senderName = sender;

//         if (
//           item.changes[0].value.contacts &&
//           item.changes[0].value.contacts.length > 0
//         ) {
//           const contact = item.changes[0].value.contacts[0];
//           if (contact.profile && contact.profile.name) {
//             senderName = contact.profile.name;
//           }
//         }

//         // 轉換電話號碼格式 (移除國碼前綴)
//         let phoneNumber = sender;
//         if (phoneNumber.startsWith("852")) {
//           phoneNumber = phoneNumber.substring(3);
//         }

//         // 創建資料庫記錄
//         const messageRecord = {
//           PHONE_NO: Number(phoneNumber),
//           SENDER: senderName,
//           RECEIVER: "浸會大學 SEE - 西貢/將軍澳社區",
//           MESSAGE_TYPE: "R", // R 表示接收到的訊息
//           MESSAGE_TEXT: textBody,
//           MESSAGE_DATETIME: formattedDateTime,
//           REF_IMPORT_FILE_NAME: "WhatsApp Webhook",
//         };

//         // 儲存到資料庫
//         const result = await db
//           .collection("chatHistory")
//           .insertOne(messageRecord);
//         console.log("訊息已保存到資料庫，ID:", result.insertedId);
//       } catch (error) {
//         console.error("處理單一訊息時出錯:", error);
//       }
//     }
//   } catch (error) {
//     console.error("處理訊息時出錯:", error);
//   } finally {
//     if (client) {
//       await client.close();
//     }
//   }

//   console.log(JSON.stringify(req.body, null, 2));
//   res.status(200).send("ok");
// });

// 修改 webhook 處理函數
router.post("/webhook", async (req, res) => {
  const { entry } = req.body;
  let client;

  try {
    client = await connectToDB();
    const db = client.db("wts");

    for (const item of entry) {
      try {
        if (item.changes[0].value.messages && item.changes[0].value.messages.length > 0) {
          const messageObj = item.changes[0].value.messages[0];
          
          if (messageObj.type === 'text' && messageObj.text) {
            const textBody = messageObj.text.body;
            const sender = messageObj.from;
            const timestamp = messageObj.timestamp;

            console.log("訊息內容:", textBody);
            console.log("發送者:", sender);
            console.log("時間戳記:", timestamp);

            const date = new Date(parseInt(timestamp) * 1000);
            const formattedDateTime = date
              .toISOString()
              .replace("T", " ")
              .substring(0, 19);

            let senderName = sender;

            if (
              item.changes[0].value.contacts &&
              item.changes[0].value.contacts.length > 0
            ) {
              const contact = item.changes[0].value.contacts[0];
              if (contact.profile && contact.profile.name) {
                senderName = contact.profile.name;
              }
            }

            let phoneNumber = sender;
            if (phoneNumber.startsWith("852")) {
              phoneNumber = phoneNumber.substring(3);
            }

            const messageRecord = {
              PHONE_NO: Number(phoneNumber),
              SENDER: senderName,
              RECEIVER: "浸會大學 SEE - 西貢/將軍澳社區",
              MESSAGE_TYPE: "R",
              MESSAGE_TEXT: textBody,
              MESSAGE_DATETIME: formattedDateTime,
              REF_IMPORT_FILE_NAME: "WhatsApp Webhook",
            };

            const result = await db
              .collection("chatHistory")
              .insertOne(messageRecord);
            console.log("訊息已保存到資料庫，ID:", result.insertedId);
            
            const io = req.app.get('io');
            if (io) {
              io.to(String(phoneNumber)).emit('new-message', {
                roomId: String(phoneNumber),
                message: {
                  _id: result.insertedId.toString(),
                  content: textBody,
                  timestamp: formattedDateTime,
                  senderId: "1", 
                  sender: senderName,
                  receiver: "浸會大學 SEE - 西貢/將軍澳社區",
                  isSelf: false
                }
              });
              
              io.emit('message-notification', {
                roomId: String(phoneNumber),
                lastMessage: {
                  content: textBody,
                  timestamp: formattedDateTime
                }
              });
            }
          }
        }
      } catch (error) {
        console.error("處理單一訊息時出錯:", error);
      }
    }
  } catch (error) {
    console.error("處理訊息時出錯:", error);
  } finally {
    if (client) {
      await client.close();
    }
  }

  console.log(JSON.stringify(req.body, null, 2));
  res.status(200).send("ok");
});

router.post("/sendMessage", async (req, res) => {
  try {
    const { to, body } = req.body;
    await sendMessage(to, body);
    res.json({ success: true, message: "消息已發送" });
  } catch (error) {
    console.error("sendMessage:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get("/whatsapp-test", (req, res) => {
  res.render("whatsapp-test", { title: "WhatsApp API 測試" });
});

async function sendMessage(to, body) {
  console.log("sendMessage", to, body);
  try {
    const response = await axios({
      url: "https://graph.facebook.com/v22.0/374603729065639/messages",
      method: "post",
      headers: {
        Authorization: `Bearer ${whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      data: JSON.stringify({
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: body,
        },
      }),
    });
    return response.data;
  } catch (error) {
    console.error("WhatsApp API 錯誤:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;
