// models/TestRun.js

const mongoose = require("mongoose");

// Тест гүйцэтгэлийн Schema-г тодорхойлох
const testRunSchema = new mongoose.Schema(
  {
    url: {
      // Энэ талбарыг үлдээж болно (анхны URL-г хадгалах) эсвэл арилгаж болно
      type: String,
      // required: false, // Заавал биш болгох эсвэл арилгах
      trim: true,
    },
    steps: {
      // <-- ШИНЭЭР НЭМСЭН ТАЛБАР
      type: Array, // Алхмуудыг массив хэлбэрээр хадгална
      required: true,
    },
    status: {
      type: String,
      required: true,
      enum: ["Pending", "Running", "Success", "Failure"],
      default: "Pending",
    },
    startTime: {
      type: Date,
      default: Date.now, // Автоматаар үүсгэх үеийн цагийг тавина
    },
    endTime: {
      type: Date, // Тест дууссан цаг
    },
    duration: {
      type: Number, // Тест үргэлжилсэн хугацаа (миллисекундээр)
    },
    results: {
      // Тестийн үр дүнгийн дэлгэрэнгүй (Энгийн текст, алхам, алдаа г.м)
      // Эхний ээлжинд энгийн String байлгаж болно, эсвэл илүү нарийн Object байж болно
      type: String,
    },
    screenshotUrl: {
      // Алдаа гарсан үеийн дэлгэцийн зургийн зам эсвэл URL (заавал биш)
      type: String,
    },
    errorMessage: {
      // Алдааны мэдээлэл (заавал биш)
      type: String,
    },
  },
  {
    timestamps: true, // Автоматаар createdAt болон updatedAt талбаруудыг нэмнэ
  }
);

// Schema-аас Model үүсгэх
// Mongoose нь 'TestRun' нэрийг олон тоонд (TestRuns) хувиргаж collection нэр болгон ашиглана
const TestRun = mongoose.model("TestRun", testRunSchema);

module.exports = TestRun; // Model-г экспортлох
