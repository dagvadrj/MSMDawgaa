const express = require("express");
const bodyParser = require("body-parser");
const dotenv = require("dotenv");
const cors = require("cors");
var path = require("path");
const mongoose = require("mongoose");
const colors = require("colors");

dotenv.config({ path: "./config/config.env" });

const connectDB = require("./config/db");

const app = express();

connectDB();

app.use(bodyParser.json());
app.use(cors()); // Бүх origin-г зөвшөөрнө
app.use(
  cors({
    origin: [
      "http://localhost:3000",
      "http://localhost:19002",
      "exp://10.150.32.127:8081",
      "http://10.150.32.127:3000",
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);
const testRoutes = require("./routes/testRoutes");
app.use(express.static(path.join(__dirname, "public")));
app.use("/api/tests", testRoutes);
const userRoutes = require("./routes/userroute");
app.get("/", (req, res) => {
  res.send("Selenium Test Tool Backend ажиллаж байна!");
});
app.use("/user", userRoutes);

const PORT = process.env.PORT || "5001";
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}.`);
});
