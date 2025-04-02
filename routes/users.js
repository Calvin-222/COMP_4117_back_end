var express = require("express");
var router = express.Router();
const { connectToDB, ObjectId } = require("../utils/db");

router.get("/", async function (req, res, next) {
  let client;

  try {
    console.log("正在獲取所有用戶資料");
    client = await connectToDB();
    const db = client.db("wts");

    const users = await db.collection("user").find().toArray();

    const formattedUsers = users.map((user) => {
      return {
        _id: user._id,
        "Phone Number": user["Phone Number"],
        "Case Code": user["Case Code"] || "",
        Name: user.Name || "",
        "updated full name": user["updated full name"] || "",
        "First NAME": user["First NAME"] || "",
        "LAST NAME": user["LAST NAME"] || "",
        Address: user.Address || "",
        Status: user.Status || "",
      };
    });
    res.json({ success: true, data: formattedUsers });
  } catch (error) {
    console.error("獲取用戶列表錯誤:", error);
    res
      .status(500)
      .json({ success: false, message: "獲取用戶列表錯誤: " + error.message });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// get info of a user by phone number
router.get("/:id", async function (req, res, next) {
  const id = req.params.id;
  let client;

  try {
    client = await connectToDB();
    const db = client.db("wts");

    let user = null;
    user = await db.collection("user").findOne({ "Phone Number": id });

    if (!user && !isNaN(id)) {
      const phoneNoNum = Number(id);
      user = await db
        .collection("user")
        .findOne({ "Phone Number": phoneNoNum });
    }

    res.json({ success: true, data: user });
  } catch (error) {
    console.error("獲取用戶資料錯誤:", error);
    res.status(500).json({
      success: false,
      message: "獲取用戶資料錯誤: " + error.message,
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});

router.put("/:phoneNo", async function (req, res, next) {
  const phoneNo = req.params.phoneNo;
  const userData = req.body;
  const client = await connectToDB();

  try {
    const db = client.db("wts");

    let user = null;
    const phoneNoNum = Number(phoneNo);
    user = await db.collection("user").findOne({ "Phone Number": phoneNoNum });

    if (!user) {
      console.log(`未找到用戶 (${phoneNo})，無法更新`);
      return res.status(404).json({
        success: false,
        message: `找不到用戶 (${phoneNo})，無法更新資料`,
      });
    }

    console.log("找到用戶:", user);

    const fieldMapping = {
      PHONE_NO: "Phone Number",
      CASE_CODE: "Case Code",
      USERNAME: "Name",
      UPDATED_FULL_NAME: "updated full name",
      FIRST_NAME: "First NAME",
      LAST_NAME: "LAST NAME",
      ADDRESS: "Address",
      STATUS: "Status",
      ROLE: "Role",
      TITLE: "Title",
    };

    const updateFields = {};

    for (const [standardField, value] of Object.entries(userData)) {
      if (standardField === "USER_ID") continue;

      const dbField = fieldMapping[standardField];
      if (dbField) {
        updateFields[dbField] = value;
      } else {
        console.log(`not a valid field: ${standardField}`);
      }
    }

    await db
      .collection("user")
      .updateOne({ "Phone Number": phoneNoNum }, { $set: updateFields });

    res.json({ success: true, message: "用戶資料已成功更新" });
  } catch (error) {
    console.error("更新用戶資料錯誤:", error);
    res
      .status(500)
      .json({ success: false, message: "更新用戶資料錯誤: " + error.message });
  } finally {
    await client.close();
  }
});

router.post("/create", async function (req, res, next) {
  const userData = req.body;
  let client;

  try {
    if (!userData.PHONE_NO) {
      return res.status(400).json({
        success: false,
        message: "電話號碼為必填項",
      });
    }

    client = await connectToDB();
    const db = client.db("wts");

    const phoneNo = userData.PHONE_NO;
    const existingUser = await db
      .collection("user")
      .findOne({ "Phone Number": phoneNo });

    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: "該電話號碼已存在",
      });
    }

    // 準備用戶數據
    const fieldMapping = {
      PHONE_NO: "Phone Number",
      CASE_CODE: "Case Code",
      USERNAME: "Name",
      UPDATED_FULL_NAME: "updated full name",
      FIRST_NAME: "First NAME",
      LAST_NAME: "LAST NAME",
      ADDRESS: "Address",
      STATUS: "Status",
      ROLE: "Role",
      TITLE: "Title",
    };

    const newUserData = {};

    for (const [standardField, value] of Object.entries(userData)) {
      const dbField = fieldMapping[standardField];
      if (dbField) {
        newUserData[dbField] = value;
      }
    }

    newUserData.createdAt = new Date();

    const result = await db.collection("user").insertOne(newUserData);

    res.status(201).json({
      success: true,
      message: "用戶創建成功",
      data: {
        _id: result.insertedId,
        ...newUserData,
      },
    });
  } catch (error) {
    console.error("創建用戶錯誤:", error);
    res.status(500).json({
      success: false,
      message: "創建用戶錯誤: " + error.message,
    });
  } finally {
    if (client) {
      await client.close();
    }
  }
});
module.exports = router;
