import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import "./App.css";
import TestHistory from "./TestHistory";

// Backend серверийн хаяг - Өөрийн backend ажиллаж буй порттой тааруулаарай!
// Таны өмнөх backend код 3000 порт дээр ажиллаж байсан тул 3000 болгож байна.
const BACKEND_URL = "http://localhost:5001";

export default function App() {
  // const [url, setUrl] = useState(""); // Энэ state-г ашиглахгүй болно
  const [stepsInput, setStepsInput] = useState(
    // Зассан жишээ утга
    JSON.stringify(
      [
        { action: "NAVIGATE", value: "https://ulms.msue.edu.mn/auth/login" },
        // Нэвтрэх нэрний талбарыг placeholder-р нь олох (CSS Selector ашиглав)
        {
          action: "SEND_KEYS",
          by: "css",
          value: "input[placeholder='Нэвтрэх нэр']",
          keys: "Нэврэх нэрээ энд бичээрэй",
        },
        // Нууц үгний талбарыг placeholder-р нь олох (CSS Selector ашиглав)
        {
          action: "SEND_KEYS",
          by: "css",
          value: "input[placeholder='Нууц үг']",
          keys: "Нууц үгээ энд зөвөөр бичээрэй",
        },
        // CLICK алхам (Анхныхаар үлдээв - энэ сонгогч зөв гэж үзье)
        { action: "CLICK", by: "id", value: "submit" }, // Энэ сонгогч зөв эсэхийг шалгаарай
        // Нэвтэрсний дараах хуудасны гарчгийг шалгах (Жишээ)
        { action: "WAIT_TITLE_IS", value: "Хянах самбар" }, // Эсвэл "Expected Page Title After Login"
      ],
      null,
      2
    ) // null, 2 нь JSON.stringify-г уншихад эвтэйхэн форматлана
  );
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [testId, setTestId] = useState(null);
  const [testResult, setTestResult] = useState(null);
  const pollingIntervalRef = useRef(null);
  // Polling зогсоох функц
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
      console.log("Polling зогслоо.");
    }
  };

  // Үр дүнг backend-с авах функц
  const fetchResult = async (id) => {
    try {
      console.log(`Үр дүнг асууж байна (ID: ${id})...`);
      // ---> Зөв Template Literal ашигласан хэсэг <---
      const response = await axios.get(`${BACKEND_URL}/api/tests/${id}`);
      setTestResult(response.data); // Үр дүнг state-д хадгалах

      // Хэрэв тест дууссан бол polling зогсоох
      if (
        response.data.status === "Success" ||
        response.data.status === "Failure"
      ) {
        stopPolling();
        setIsLoading(false); // Ачаалж дууссан гэж үзэх
      }
    } catch (fetchError) {
      console.error("Үр дүн авахад алдаа гарлаа:", fetchError);
      setError("Тестийн үр дүнг авахад алдаа гарлаа.");
      stopPolling();
      setIsLoading(false);
    }
  };

  // Polling эхлүүлэх функц
  const startPolling = (id) => {
    stopPolling(); // Хуучин polling байвал зогсоох
    setTestResult(null); // Хуучин үр дүнг цэвэрлэх
    setIsLoading(true); // Ачаалж байна гэж үзэх
    console.log(`Polling эхэлж байна (ID: ${id})`);

    // Эхний удаа шууд дуудах
    fetchResult(id);

    // Дараа нь тодорхой хугацааны давтамжтай дуудах
    pollingIntervalRef.current = setInterval(() => {
      fetchResult(id);
    }, 3000); // 3 секунд тутамд
  };

  // Тест эхлүүлэх функц
  const handleStartTest = async (event) => {
    event.preventDefault();
    stopPolling();
    setIsLoading(true);
    setMessage("");
    setError("");
    setTestId(null);
    setTestResult(null);

    let steps;
    try {
      // Textarea-с авсан текстийг JSON.parse хийж массив болгох
      steps = JSON.parse(stepsInput);
      if (!Array.isArray(steps)) {
        throw new Error("Оруулсан утга массив байх ёстой.");
      }
      if (steps.length === 0) {
        throw new Error("Ядаж нэг алхам оруулна уу.");
      }
      // TODO: Алхам бүрийн бүтцийг шалгах нэмэлт validation хийж болно
    } catch (parseError) {
      setError(
        `Оруулсан алхмын формат буруу байна (JSON). Алдаа: ${parseError.message}`
      );
      setIsLoading(false);
      return;
    }

    try {
      console.log("Тест эхлүүлж байна, Алхмууд:", steps);
      // Backend руу 'url'-н оронд 'steps' массивыг илгээх
      const response = await axios.post(`${BACKEND_URL}/api/tests/start`, {
        steps,
      }); // <-- Энд өөрчилсөн

      setMessage(response.data.message || "Тест эхэллээ!");
      setTestId(response.data.testId);

      if (response.data.testId) {
        startPolling(response.data.testId);
      } else {
        setError("Тестийн ID авч чадсангүй.");
        setIsLoading(false);
      }
    } catch (err) {
      console.error("API дуудах үед алдаа:", err);
      if (err.response && err.response.data && err.response.data.message) {
        setError(`Алдаа: ${err.response.data.message}`);
      } else {
        setError(
          `Тест эхлүүлэхэд алдаа гарлаа. Backend сервер (${BACKEND_URL}) ажиллаж байгаа эсэхийг шалгана уу.`
        );
      }
      setIsLoading(false);
    }
  };

  // Компонент unmount болоход polling зогсоох
  useEffect(() => {
    return () => {
      stopPolling();
    };
  }, []); // Хоосон хамаарлын массив

  return (
    <div className="App">
      <h1>Selenium Вэб Тест</h1>
      <form onSubmit={handleStartTest}>
        <label htmlFor="stepsInput">Тестийн Алхмууд (JSON Формат):</label>
        <textarea
          id="stepsInput"
          value={stepsInput}
          onChange={(e) => setStepsInput(e.target.value)}
          placeholder='[{"action": "NAVIGATE", "value": "URL"}, ...]'
          required
          disabled={isLoading}
          rows={6} // Талбарын өндөр
          style={{ fontFamily: "monospace", fontSize: "0.9em" }} // JSON харагдахад эвтэйхэн фонт
        />
        <button type="submit" disabled={isLoading}>
          {isLoading ? "Тестэлж байна..." : "Тест Эхлүүлэх"}
        </button>
      </form>

      {/* Статус/Үр дүнгийн хэсэг */}
      <div className="status-section">
        {isLoading && <p>Ачаалж байна...</p>}
        {!isLoading && message && !testResult && (
          <p className="info-message">{message}</p>
        )}{" "}
        {/* Зөвхөн анхны мессеж */}
        {!isLoading && error && <p className="error-message">{error}</p>}
        {/* Тестийн үр дүнг харуулах */}
        {testResult && (
          <div className="test-result">
            <h2>Тестийн Үр Дүн (ID: {testResult._id})</h2>
            <p>
              <strong>Статус:</strong> {testResult.status}
            </p>
            <p>
              <strong>URL:</strong> {testResult.url}
            </p>
            <p>
              <strong>Эхэлсэн:</strong>
              {new Date(testResult.startTime).toLocaleString()}
            </p>

            {/* Дууссан тестүүдийн мэдээлэл */}
            {testResult.endTime && (
              <>
                <p>
                  <strong>Дууссан:</strong>
                  {new Date(testResult.endTime).toLocaleString()}
                </p>
                <p>
                  <strong>Үргэлжилсэн хугацаа:</strong>
                  {(testResult.duration / 1000).toFixed(2)} секунд
                </p>
              </>
            )}

            {/* Амжилттай үр дүн */}
            {testResult.status === "Success" && testResult.results && (
              <p>
                <strong>Үр дүн:</strong> {testResult.results}
              </p>
            )}

            {/* Алдааны мэдээлэл */}
            {testResult.status === "Failure" && testResult.errorMessage && (
              <p className="error-message">
                <strong>Алдаа:</strong> {testResult.errorMessage}
              </p>
            )}

            {/* Screenshot харуулах */}
            {testResult.status === "Failure" && testResult.screenshotUrl && (
              <p>
                <strong>Дэлгэцийн зураг:</strong>
                <a
                  href={`${BACKEND_URL}${testResult.screenshotUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Энд дарж харна уу
                </a>
              </p>
            )}
          </div>
        )}
      </div>
      <TestHistory />
    </div>
  );
}
