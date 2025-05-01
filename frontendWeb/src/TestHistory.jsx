import React, { useState, useEffect } from "react";
import axios from "axios";
import "./TestHistory.css"; // Загварчлалд зориулж CSS файл импортлох

// Backend серверийн хаяг (App.jsx-тэй ижил байх ёстой)
// TODO: Үүнийг тусдаа config файл болгож хоёр газраас импортловол илүү цэвэрхэн
const BACKEND_URL = "http://localhost:5001";

function TestHistory() {
  const [history, setHistory] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchHistory = async () => {
      setIsLoading(true);
      setError(null);
      try {
        console.log("Тестийн түүхийг татаж байна...");
        const response = await axios.get(`${BACKEND_URL}/api/tests`);
        setHistory(response.data);
        console.log("Түүх амжилттай татагдлаа:", response.data.length);
      } catch (err) {
        console.error("Түүх татахад алдаа гарлаа:", err);
        setError("Тестийн түүхийг татахад алдаа гарлаа.");
      } finally {
        setIsLoading(false);
      }
    };

    fetchHistory();
  }, []); // Хоосон массивтай тул зөвхөн анх mount болоход ажиллана

  const getStatusClassName = (status) => {
    switch (status) {
      case "Success":
        return "status-success";
      case "Failure":
        return "status-failure";
      case "Running":
        return "status-running";
      case "Pending":
        return "status-pending";
      default:
        return "";
    }
  };

  if (isLoading) {
    return <p>Түүхийг ачаалж байна...</p>;
  }

  if (error) {
    return <p className="error-message">{error}</p>;
  }

  return (
    <div className="test-history">
      <h2>Тестийн Түүх</h2>
      {history.length === 0 ? (
        <p>Тестийн түүх олдсонгүй.</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Статус</th>
              <th>URL</th>
              <th>Эхэлсэн Цаг</th>
              <th>Үргэлжилсэн (сек)</th>
              <th>Үр дүн / Алдаа</th>
            </tr>
          </thead>
          <tbody>
            {history.map((run) => (
              <tr key={run._id}>
                <td>
                  <span
                    className={`status-badge ${getStatusClassName(run.status)}`}
                  >
                    {run.status}
                  </span>
                </td>
                <td className="url-cell" title={run.url}>
                  {run.url}
                </td>
                <td>{new Date(run.createdAt).toLocaleString()}</td>
                <td>{run.duration ? (run.duration / 1000).toFixed(2) : "-"}</td>
                <td className="result-cell">
                  {run.status === "Success" ? run.results : ""}
                  {run.status === "Failure" ? run.errorMessage : ""}
                  {run.screenshotUrl && run.status === "Failure" ? (
                    <>
                      {" "}
                      <br />{" "}
                      <a
                        href={`<span class="math-inline">\{BACKEND\_URL\}</span>{run.screenshotUrl}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        (Screenshot)
                      </a>{" "}
                    </>
                  ) : (
                    ""
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default TestHistory;
