var express = require("express");
var router = express.Router();
const { connectToDB, ObjectId } = require("../utils/db");
const axios = require("axios");

// WhatsApp API 配置
const whatsapp_access_token =
  "EAATk1ZC2RFN8BOwmnhl1L20Gg3JaxGpxw0zyPp2rsBf5VtOUdBircZBeuCE9FZBNCjVP2bSgCXAFkGLQCHwQj5WuZBqZCQXNWS6UpjgYhokPP2oXNQPPiVSZAnzwv5NeEsZC3j43vgQ02BBgSRddYLSnGvdr61ZAZCdhWzW5M1xZCMBpUfCdJ51EtJ6VrdRWdewi9YVwZDZD";
const whatsapp_phone_number_id = "374603729065639";

router.get("/rooms", async function (req, res, next) {
  let client;
  try {
    client = await connectToDB();
    const db = client.db("wts");
    const chatHistory = await db.collection("chatHistory").find().toArray();
    // Set O(n) vs Array O(n^2) （如果有重複）
    // .new Set() - 創建一個新的空 Set
    // .add(value) - 添加一個值到 Set 中
    // .delete(value) - 從 Set 中刪除指定值
    // .has(value) - 檢查 Set 是否包含指定值
    // .clear() - 移除 Set 中所有元素
    const phoneNumbersSet = new Set();
    for (let i = 0; i < chatHistory.length; i++) {
      const chat = chatHistory[i];
      if (chat.PHONE_NO) {
        phoneNumbersSet.add(String(chat.PHONE_NO));
      }
    }

    const phoneNumbers = Array.from(phoneNumbersSet);

    const allUsers = await db.collection("user").find().toArray();
    const rooms = [];

    for (const phoneNo of phoneNumbers) {
      if (!phoneNo) continue;

      const messagesForNumber = [];
      for (let i = 0; i < chatHistory.length; i++) {
        if (String(chatHistory[i].PHONE_NO) === String(phoneNo)) {
          messagesForNumber.push(chatHistory[i]);
        }
      }

      let lastMessage = null;
      if (messagesForNumber.length > 0) {
        lastMessage = messagesForNumber.sort((a, b) => {
          return (
            new Date(b.MESSAGE_DATETIME || 0) -
            new Date(a.MESSAGE_DATETIME || 0)
          );
        })[0];
      }

      let userInfo = allUsers.find(
        (u) => String(u["Phone Number"]) === String(phoneNo)
      );

      const room = {
        roomId: phoneNo,
        phoneNo: phoneNo,
        roomName: userInfo
          ? userInfo["updated full name"] ||
            userInfo.Name ||
            `${userInfo["First NAME"] || ""} ${userInfo["LAST NAME"] || ""}`.trim() ||
            phoneNo
          : phoneNo,
        userInfo: userInfo || { "Phone Number": phoneNo },
        caseCode: userInfo ? userInfo["Case Code"] : "",
        lastMessage: {
          content: lastMessage
            ? lastMessage.MESSAGE_TEXT || "暫無訊息"
            : "暫無訊息",
          timestamp: lastMessage ? lastMessage.MESSAGE_DATETIME : "",
        },
      };

      rooms.push(room);
    }
    res.json({ success: true, data: rooms });
  } catch (error) {
    console.error("router.get /rooms:", error);
    res.status(500).json({
      success: false,
      message: "獲取聊天室列表錯誤: " + error.message,
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

router.get("/rooms/:roomId/messages", async function (req, res, next) {
  const roomId = req.params.roomId;
  let client;

  try {
    client = await connectToDB();
    const db = client.db("wts");

    const allUsers = await db.collection("user").find().toArray();
    let userInfo = allUsers.find(
      (u) => String(u["Phone Number"]) === String(roomId)
    );

    if (!userInfo) {
      userInfo = allUsers.find((u) => {
        return (
          String(u._id) === String(roomId) ||
          String(u["Case Code"]) === String(roomId)
        );
      });
    }

    let messages = await db
      .collection("chatHistory")
      .find({ PHONE_NO: Number(roomId) })
      .sort({ MESSAGE_DATETIME: 1 })
      .toArray();

    const formattedMessages = messages.map((msg) => {
      const isUserSelf = msg.RECEIVER && msg.RECEIVER.includes("浸會大學");
      return {
        _id: msg._id.toString(),
        content: msg.MESSAGE_TEXT || "",
        timestamp: msg.MESSAGE_DATETIME || new Date().toISOString(),
        senderId: msg.SENDER === "user" || isUserSelf ? "1" : "2",
        sender: msg.SENDER,
        receiver: msg.RECEIVER,
        isSelf: isUserSelf,
      };
    });

    res.json({
      success: true,
      data: {
        userInfo: userInfo || { "Phone Number": roomId },
        messages: formattedMessages,
      },
    });
  } catch (error) {
    console.error("獲取聊天消息錯誤:", error);
    res
      .status(500)
      .json({ success: false, message: "獲取聊天消息錯誤: " + error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

router.delete("/rooms/:roomId", async function (req, res, next) {
  const roomId = req.params.roomId;
  const client = await connectToDB();

  try {
    const db = client.db("wts");
    const result = await db
      .collection("chatHistory")
      .deleteMany({ PHONE_NO: Number(roomId) });

    res.json({
      success: true,
      message: `已刪除 ${result.deletedCount} 條消息`,
      roomId: roomId,
    });
  } catch (error) {
    console.error("刪除聊天室錯誤:", error);
    res
      .status(500)
      .json({ success: false, message: "刪除聊天室錯誤: " + error.message });
  } finally {
    await client.close();
  }
});

/**
 * 發送訊息 API
 * 請求格式:
 * {
 *   "phoneNo": "85292226322", // 接收者電話號碼
 *   "sender": "浸會大學 SEE - 西貢/將軍澳社區", // 發送者名稱
 *   "message": "您好！這是測試訊息" // 訊息內容
 * }
 */
router.post("/send-message", async function (req, res, next) {
  const { phoneNo, sender, message } = req.body;
  let client;

  try {
    // 驗證必要參數
    if (!phoneNo || !message) {
      return res.status(400).json({
        success: false,
        message: "缺少必要參數：電話號碼和訊息內容",
      });
    }

    console.log(`嘗試發送訊息到 ${phoneNo}: ${message}`);

    // 標準化電話號碼 (確保有國碼)
    let formattedPhoneNo = phoneNo;
    if (!phoneNo.startsWith("852") && !phoneNo.startsWith("+852")) {
      formattedPhoneNo = "852" + phoneNo;
    }
    formattedPhoneNo = formattedPhoneNo.replace("+", "");

    // 嘗試發送 WhatsApp 訊息
    const whatsappResponse = await sendWhatsAppMessage(
      formattedPhoneNo,
      message
    );
    console.log("WhatsApp API 回應:", whatsappResponse);

    // 連接資料庫儲存訊息記錄
    client = await connectToDB();
    const db = client.db("wts");

    // 準備訊息記錄
    const messageRecord = {
      PHONE_NO: Number(phoneNo.replace(/\D/g, "")), // 移除非數字字符
      SENDER: sender || "浸會大學 SEE - 西貢/將軍澳社區",
      RECEIVER: phoneNo,
      MESSAGE_TYPE: "S", // S 表示系統發送的訊息
      MESSAGE_TEXT: message,
      MESSAGE_DATETIME: new Date()
        .toISOString()
        .replace("T", " ")
        .substring(0, 19),
      REF_IMPORT_FILE_NAME: "system-generated-message",
    };

    // 儲存訊息記錄到資料庫
    const result = await db.collection("chatHistory").insertOne(messageRecord);
    console.log("訊息已儲存到資料庫:", result);

    res.json({
      success: true,
      message: "訊息已發送並儲存",
      whatsappResponse: whatsappResponse,
      messageId: result.insertedId,
    });
  } catch (error) {
    console.error("發送訊息錯誤:", error);
    res.status(500).json({
      success: false,
      message: "發送訊息錯誤: " + error.message,
      error: error.response?.data || error.message,
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 發送 WhatsApp 訊息的輔助函數
async function sendWhatsAppMessage(to, body) {
  try {
    const response = await axios({
      url: `https://graph.facebook.com/v22.0/${whatsapp_phone_number_id}/messages`,
      method: "post",
      headers: {
        Authorization: `Bearer ${whatsapp_access_token}`,
        "Content-Type": "application/json",
      },
      data: {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: {
          body: body,
        },
      },
    });
    return response.data;
  } catch (error) {
    console.error("WhatsApp API 錯誤:", error.response?.data || error.message);
    throw error;
  }
}

module.exports = router;
