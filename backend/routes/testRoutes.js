// routes/testRoutes.js
// routes/testRoutes.js
const express = require("express");
const router = express.Router();
const testController = require("../controllers/testController");

// POST /api/tests/start - Шинэ тест эхлүүлэх
router.post("/start", testController.startTest);

// GET /api/tests/:id - Тодорхой тестийн үр дүнг авах (Энэ route-г нэмэх/комментоос гаргах)
router.get("/:id", testController.getTestResult);
router.get("/", testController.getAllTestResults);
// GET /api/tests - Бүх тестийн түүхийг авах (Дараа нэмж болно)
// router.get('/', testController.getAllTestResults);

module.exports = router;
