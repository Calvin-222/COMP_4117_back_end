var createError = require("http-errors");
var path = require("path");
var express = require("express");
var cookieParser = require("cookie-parser");
var logger = require("morgan");
var cors = require("cors");
var indexRouter = require("./routes/index");
var usersRouter = require("./routes/users");
var chatRouter = require("./routes/chat");
var app = express();

const { connectToDB } = require("./utils/db");

app.set("views", path.join(__dirname, "views"));
app.set("view engine", "ejs");
app.set("json spaces", 2);

app.use(logger("dev"));
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, "public")));

app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

app.use("/", indexRouter);
app.use("/api/users", usersRouter);
app.use("/api/chat", chatRouter);

app.get("/test-db", async (req, res) => {
  let client;
  try {
    client = await connectToDB();
    const db = client.db("wts");
    const result = await db.admin().ping();
    res.send(result.ok === 1 ? "DB 連線正常" : "DB 無回應");
  } catch (err) {
    res.status(500).send("DB 連線錯誤: " + err.message);
  } finally {
    if (client) {
      await client.close();
    }
  }
});

// 404 處理中間件（僅保留一份）
app.use(function (req, res, next) {
  next(createError(404));
});

// 錯誤處理中間件（僅保留一份）
app.use(function (err, req, res, next) {
  res.locals.message = err.message;
  res.locals.error = req.app.get("env") === "development" ? err : {};
  res.status(err.status || 500);
  res.render("error");
});

module.exports = app;
