const TestRun = require("../models/TestRun");
const { Builder, By, Key, until } = require("selenium-webdriver");
const fs = require("fs"); // Файлын системтэй ажиллах модуль
const path = require("path");
const chrome = require("selenium-webdriver/chrome");

exports.startTest = async (req, res) => {
  // 1. 'steps'-г req.body-оос хүлээж авах
  const { steps } = req.body;

  // 2. 'steps' массив мөн эсэх, хоосон биш эсэхийг шалгах
  if (!steps || !Array.isArray(steps) || steps.length === 0) {
    return res.status(400).json({
      message: "Хүчинтэй тестийн алхмуудын массив илгээнэ үү.",
      example: '[{ "action": "NAVIGATE", "value": "URL" }, ...]',
    });
  }

  let testRun; // TestRun document хадгалах хувьсагч

  try {
    // 3. Эхний NAVIGATE үйлдлээс URL-г олох (байхгүй бол 'N/A')
    const initialUrl = steps.find((step) => step.action === "NAVIGATE")?.value;

    // 4. Шинэ TestRun үүсгэхдээ 'steps'-г болон олсон URL-г ашиглах
    testRun = new TestRun({
      url: initialUrl || "N/A", // Олсон URL эсвэл 'N/A'
      steps: steps, // Хүлээн авсан steps массив
      status: "Pending",
    });
    // 5. DB-д хадгалах
    await testRun.save();

    // 6. Frontend-д амжилттай хүлээж авснаа мэдэгдэх
    res.status(202).json({
      message: "Тестийн хүсэлтийг хүлээж авлаа. Тест эхэлж байна...",
      testId: testRun._id,
    });

    // 7. Selenium тестийг background-д ажиллуулахыг оролдох
    // (Энэ функц дотор өөр алдаа гарч магадгүйг санаарай!)
    await runSeleniumTest(testRun);
  } catch (error) {
    // Алдаа барих хэсэг
    console.error("Тест эхлүүлэх үед алдаа гарлаа:", error); // Алдааг логдох
    if (testRun && testRun._id && !res.headersSent) {
      try {
        // Алдаа гарвал DB дахь бичлэгийн статусыг шинэчлэх оролдлого
        await TestRun.findByIdAndUpdate(testRun._id, {
          status: "Failure",
          errorMessage: error.message || "Серверийн дотоод алдаа.", // Илүү дэлгэрэнгүй алдааг хадгалах
        });
      } catch (dbError) {
        console.error(
          "Алдаатай тестийн статус шинэчлэхэд алдаа гарлаа:",
          dbError
        );
      }
    }
    // Frontend-д хариу илгээгээгүй байсан бол 500 алдаа буцаах
    if (!res.headersSent) {
      res.status(500).json({ message: "Сервер дээр алдаа гарлаа." });
    }
  }
};

exports.getAllTestResults = async (req, res) => {
  try {
    console.log("Бүх тестийн түүхийг авах хүсэлт ирлээ..."); // Энэ лог гарч байна уу?
    const tests = await TestRun.find({}) // <-- Энд DB-тэй харьцаж байна
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`Олдсон тестийн тоо: ${tests.length}`);
    res.status(200).json(tests); // Амжилттай бол үр дүнг буцаана
  } catch (error) {
    // ---> Хэрэв энд алдаа гарвал БААЧАН ТЕРМИНАЛ ДЭЭР алдааны мэдээлэл гарна <---
    console.error("Тестийн түүхийг авахад алдаа гарлаа:", error);
    res.status(500).json({ message: "Тестийн түүхийг авахад алдаа гарлаа." }); // 500 алдаа буцаана
  }
};

exports.getTestResult = async (req, res) => {
  try {
    const testRun = await TestRun.findById(req.params.id);

    if (!testRun) {
      return res.status(404).json({ message: "Тест олдсонгүй." });
    }
    res.status(200).json(testRun);
  } catch (error) {
    console.error("Тестийн үр дүнг авахад алдаа гарлаа:", error);
    if (error.kind === "ObjectId") {
      return res
        .status(404)
        .json({ message: "Тест олдсонгүй (буруу ID формат)." });
    }
    res.status(500).json({ message: "Сервер дээр алдаа гарлаа." });
  }
};

const runSeleniumTest = async (testRun) => {
  let driver; // driver-г энд зарлах нь зөв
  const startTime = Date.now();
  const steps = testRun.steps;
  let stepResultsLog = [];
  let currentStepIndex = 0;

  try {
    testRun.status = "Running";
    await testRun.save();

    // Headless Mode Тохиргоо (хэвээрээ)
    let options = new chrome.Options();
    options.addArguments("--headless=new");
    options.addArguments("--no-sandbox");
    options.addArguments("--disable-dev-shm-usage");
    options.addArguments("--window-size=1920,1080");

    console.log("WebDriver үүсгэж байна (Headless Mode)...");
    driver = await new Builder()
      .forBrowser("chrome")
      .setChromeOptions(options)
      .build();

    console.log(`Тест ${testRun._id}: Алхмуудыг гүйцэтгэж эхэллээ...`);

    for (const step of steps) {
      currentStepIndex++;
      // Үйлдлийг логдохдоо илүү дэлгэрэнгүй болгох
      let logValue = step.value || "";
      if (step.keys) logValue += `, keys: ${step.keys}`;
      if (step.by) logValue = `by ${step.by}='${logValue}'`;
      console.log(
        ` -> Алхам ${currentStepIndex}: ${step.action} (${logValue})`
      );
      stepResultsLog.push(
        `Алхам ${currentStepIndex}: ${step.action} эхэлсэн...`
      );

      // Action төрлөөс хамаарч Selenium үйлдэл хийх
      switch (step.action) {
        case "NAVIGATE":
          if (!step.value)
            throw new Error(
              `Алхам ${currentStepIndex} (NAVIGATE): 'value' (URL) хоосон байна.`
            );
          await driver.get(step.value);
          stepResultsLog[
            stepResultsLog.length - 1
          ] += ` ${step.value} руу орлоо.`;
          break;

        case "CHECK_TITLE":
          if (!step.value)
            throw new Error(
              `Алхам ${currentStepIndex} (CHECK_TITLE): 'value' (хүлээгдэж буй гарчиг) хоосон байна.`
            );
          const actualTitle = await driver.getTitle();
          if (actualTitle !== step.value) {
            throw new Error(
              `Алхам ${currentStepIndex} (CHECK_TITLE): Гарчиг таарсангүй. Хүлээгдэж байсан: "${step.value}", Олдсон: "${actualTitle}"`
            );
          }
          stepResultsLog[
            stepResultsLog.length - 1
          ] += ` Гарчиг "${actualTitle}" зөв байна.`;
          break;

        // ----- ШИНЭЭР НЭМСЭН ҮЙЛДЛҮҮД -----
        case "FIND_ELEMENT": // (Зөвхөн олох үйлдэл, ирээдүйд хэрэгтэй байж магадгүй)
          if (!step.by || !step.value)
            throw new Error(
              `Алхам ${currentStepIndex} (FIND_ELEMENT): 'by' эсвэл 'value' дутуу байна.`
            );
          try {
            await driver.findElement(By[step.by](step.value));
            stepResultsLog[
              stepResultsLog.length - 1
            ] += ` Элемент [${step.by}='${step.value}'] оллоо.`;
          } catch (findErr) {
            if (findErr.name === "NoSuchElementError") {
              throw new Error(
                `Алхам ${currentStepIndex} (FIND_ELEMENT): Элемент [${step.by}='${step.value}'] олдсонгүй.`
              );
            } else {
              throw findErr; // Бусад алдааг дамжуулах
            }
          }
          break;

        case "CLICK":
          if (!step.by || !step.value)
            throw new Error(
              `Алхам ${currentStepIndex} (CLICK): 'by' эсвэл 'value' (сонгогч) дутуу байна.`
            );
          try {
            console.log(`   -> Элемент хайж байна: ${step.by} = ${step.value}`);
            let elementToClick = await driver.findElement(
              By[step.by](step.value)
            );
            console.log(`   -> Дарж байна...`);
            await elementToClick.click();
            stepResultsLog[
              stepResultsLog.length - 1
            ] += ` Элемент [${step.by}='${step.value}'] дээр дарлаа.`;
          } catch (clickErr) {
            if (clickErr.name === "NoSuchElementError") {
              throw new Error(
                `Алхам ${currentStepIndex} (CLICK): Дарах элемент [${step.by}='${step.value}'] олдсонгүй.`
              );
            } else if (clickErr.name === "ElementClickInterceptedError") {
              throw new Error(
                `Алхам ${currentStepIndex} (CLICK): Элемент [${step.by}='${step.value}'] дээр дарах боломжгүй (өөр элемент халхалж байна).`
              );
            } else {
              throw clickErr; // Бусад алдааг дамжуулах
            }
          }
          break;

        case "SEND_KEYS":
          if (!step.by || !step.value || step.keys === undefined)
            throw new Error(
              `Алхам ${currentStepIndex} (SEND_KEYS): 'by', 'value' (сонгогч) эсвэл 'keys' дутуу байна.`
            );
          try {
            console.log(`   -> Элемент хайж байна: ${step.by} = ${step.value}`);
            let elementToInput = await driver.findElement(
              By[step.by](step.value)
            );
            console.log(`   -> Текст оруулж байна: "${step.keys}"`);
            await elementToInput.sendKeys(step.keys);
            stepResultsLog[
              stepResultsLog.length - 1
            ] += ` Элемент [${step.by}='${step.value}'] рүү текст орууллаа.`;
          } catch (sendKeysErr) {
            if (sendKeysErr.name === "NoSuchElementError") {
              throw new Error(
                `Алхам ${currentStepIndex} (SEND_KEYS): Бичих элемент [${step.by}='${step.value}'] олдсонгүй.`
              );
            } else if (sendKeysErr.name === "ElementNotInteractableError") {
              throw new Error(
                `Алхам ${currentStepIndex} (SEND_KEYS): Элемент [${step.by}='${step.value}'] рүү бичих боломжгүй.`
              );
            } else {
              throw sendKeysErr;
            }
          }
          break;
        // ------------------------------------

        default:
          console.warn(`Танигдаагүй үйлдэл: ${step.action}`);
          stepResultsLog[
            stepResultsLog.length - 1
          ] += ` Танигдаагүй үйлдэл тул алгаслаа.`;
        // Эсвэл: throw new Error(`Алхам ${currentStepIndex}: Танигдаагүй үйлдэл "${step.action}"`);
      }
      await driver.sleep(100); // Үйлдэл хооронд түр хүлээх (заавал биш, тест тогтворжуулж магадгүй)
    } // Давталт дуусах
    // Статусыг 'Running' болгох

    // Хэрэв давталт амжилттай дуусвал:
    console.log(`Тест ${testRun._id}: Бүх алхам амжилттай дууслаа.`);
    const endTime = Date.now();
    testRun.status = "Success";
    // testRun.results = `Тест амжилттай. ${steps.length} алхам гүйцэтгэлээ.`; // Энгийн мессеж
    testRun.results = stepResultsLog.join("\n"); // Алхам бүрийн логыг хадгалах
    testRun.endTime = endTime;
    testRun.duration = endTime - startTime;
    testRun.errorMessage = undefined;
    testRun.screenshotUrl = undefined;
    await testRun.save();
    console.log(`Тест амжилттай хадгалагдлаа (ID: ${testRun._id})`);
  } catch (err) {
    // Алдаа гарвал (давталт дундаас эсвэл өмнө нь):
    console.error(
      `Тест ${testRun._id} амжилтгүй боллоо (Алхам ${currentStepIndex}):`,
      err
    );
    const endTime = Date.now();
    testRun.status = "Failure";
    // Алдааны мэдээллийг илүү тодорхой болгох
    testRun.errorMessage = `Алхам ${currentStepIndex} (${
      steps[currentStepIndex - 1]?.action || "Unknown"
    }): ${err.message || "Тодорхойгүй алдаа"}`;
    testRun.endTime = endTime;
    testRun.duration = endTime - startTime;
    testRun.results = stepResultsLog.join("\n"); // Алдаа гарахаас өмнөх лог

    // Screenshot авах (хэвээрээ)
    if (driver) {
      try {
        console.log("Алдааны screenshot авч байна...");
        const screenshotData = await driver.takeScreenshot();
        const filename = `screenshot_${testRun._id}_${Date.now()}.png`;
        const screenshotsDir = path.join(
          __dirname,
          "..",
          "public",
          "screenshots"
        );
        const filePath = path.join(screenshotsDir, filename);
        if (!fs.existsSync(screenshotsDir))
          fs.mkdirSync(screenshotsDir, { recursive: true });
        fs.writeFileSync(filePath, screenshotData, "base64");
        console.log(`Screenshot хадгалагдлаа: ${filePath}`);
        testRun.screenshotUrl = `/screenshots/${filename}`;
      } catch (ssError) {
        console.error(
          "Дэлгэцийн зураг авахад/хадгалахад алдаа гарлаа:",
          ssError
        );
        testRun.errorMessage += " (Screenshot авч чадсангүй)";
      }
    }
    await testRun.save(); // Алдааны мэдээллийг хадгалах
  } finally {
    // Хөтчийг хаах (хэвээрээ)
    if (driver) {
      try {
        await driver.quit();
        console.log("WebDriver хаагдлаа.");
      } catch (quitError) {
        console.error("WebDriver хаахад алдаа гарлаа:", quitError);
      }
    }
  }
};
