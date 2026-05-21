import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { extname, join, normalize, resolve, sep } from "node:path";

const ROOT = resolve(".");
const REQUESTED_PORT = Number(process.env.GEOQUIZ_TEST_PORT || 0);
let baseUrl = "";

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".png", "image/png"],
  [".svg", "image/svg+xml; charset=utf-8"]
]);

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  try {
    return require("playwright");
  } catch (error) {
    throw new Error("Playwright is required for app flow tests. Run with NODE_PATH pointing to a node_modules that includes playwright.");
  }
}

function startServer() {
  const server = createServer(async (request, response) => {
    try {
      const url = new URL(request.url || "/", baseUrl || "http://127.0.0.1");
      const rawPath = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
      const filePath = normalize(join(ROOT, rawPath));
      if (!filePath.startsWith(ROOT + sep) && filePath !== ROOT) {
        response.writeHead(403);
        response.end("Forbidden");
        return;
      }

      const content = await readFile(filePath);
      response.writeHead(200, {
        "content-type": MIME_TYPES.get(extname(filePath)) || "application/octet-stream",
        "cache-control": "no-store"
      });
      response.end(content);
    } catch {
      response.writeHead(404);
      response.end("Not found");
    }
  });

  return new Promise((resolveServer, reject) => {
    server.once("error", reject);
    server.listen(REQUESTED_PORT, "127.0.0.1", () => {
      const address = server.address();
      baseUrl = `http://127.0.0.1:${address.port}`;
      resolveServer(server);
    });
  });
}

async function launchBrowser(chromium) {
  try {
    return await chromium.launch({ channel: "msedge", headless: true });
  } catch {
    return chromium.launch({ headless: true });
  }
}

async function newTestPage(browser, name) {
  const page = await browser.newPage({ viewport: { width: 1366, height: 900 } });
  const messages = [];
  page.on("console", (message) => {
    if (["error", "warning"].includes(message.type())) {
      messages.push(`${message.type()}: ${message.text()}`);
    }
  });
  page.on("pageerror", (error) => messages.push(`pageerror: ${error.message}`));
  await page.goto(`${baseUrl}/index.html?flow=${encodeURIComponent(name)}`, { waitUntil: "load" });
  return { page, messages };
}

async function clickCurrentMunicipalityAnswer(page) {
  const clicked = await page.evaluate(() => {
    const text = document.querySelector("#questionText")?.textContent || "";
    const name = text.replace(" をクリック", "").trim();
    const item = window.SAITAMA_MUNICIPALITIES.municipalities.find((municipality) => municipality.name === name);
    if (!item) return false;
    const path = document.querySelector(`path[data-feature-id="${item.id}"]`);
    if (!path) return false;
    path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  });
  assert(clicked, "current municipality question did not map to a clickable answer path");
}

async function clickCurrentAreaCodeAnswer(page) {
  const clicked = await page.evaluate(() => {
    const text = document.querySelector("#questionText")?.textContent || "";
    const areaCode = text.replace(" のエリアをクリック", "").trim();
    if (!areaCode || areaCode === "終了") return false;
    const path = document.querySelector(`path[data-area-code="${areaCode}"]`);
    if (!path) return false;
    path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    return true;
  });
  assert(clicked, "current area-code question did not map to a clickable answer path");
}

async function completeMode(page, mode) {
  const isMunicipality = mode === "municipality";
  const expectedTotal = isMunicipality ? 63 : 8;
  const buttonName = isMunicipality
    ? "市区町村 市町村名から場所を当てる"
    : "市外局番 番号からエリアを当てる";

  await page.getByRole("button", { name: buttonName }).click();
  await page.waitForSelector(".leaflet-container", { timeout: 10000 });

  for (let guard = 0; guard < expectedTotal + 4; guard += 1) {
    const state = await page.evaluate(() => ({
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      question: document.querySelector("#questionText")?.textContent || "",
      correct: Number(document.querySelector("#correctCount")?.textContent || "0")
    }));
    if (state.resultVisible || state.question === "終了") break;
    let advanced = false;
    for (let attempt = 0; attempt < 3 && !advanced; attempt += 1) {
      if (attempt > 0) await page.waitForTimeout(460);
      if (isMunicipality) {
        await clickCurrentMunicipalityAnswer(page);
      } else {
        await clickCurrentAreaCodeAnswer(page);
      }
      advanced = await page.waitForFunction((previousCorrect) => {
        const resultVisible = !document.querySelector("#resultScreen")?.classList.contains("is-hidden");
        const nextCorrect = Number(document.querySelector("#correctCount")?.textContent || "0");
        return resultVisible || nextCorrect > previousCorrect;
      }, state.correct, { timeout: 1200 })
        .then(() => true)
        .catch(() => false);
    }
    assert(advanced, `${mode}: answer click did not advance from question "${state.question}"`);
    await page.waitForTimeout(460);
  }

  await page.waitForFunction(() => !document.querySelector("#resultScreen")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const result = await page.evaluate((currentMode) => ({
    title: document.querySelector("#resultTitle")?.textContent,
    correct: document.querySelector("#resultCorrect")?.textContent,
    mistakes: document.querySelector("#resultMistakes")?.textContent,
    total: document.querySelector("#resultTotal")?.textContent,
    resultHasMap: document.querySelector("#resultMapSlot #map") !== null,
    areaPathCount: document.querySelectorAll("path[data-area-code]").length,
    municipalityPathCount: document.querySelectorAll("path[data-feature-id]").length,
    labels: document.querySelectorAll(".answered-tooltip").length,
    areaLabels: document.querySelectorAll(".area-code-tooltip").length,
    municipalityLabels: document.querySelectorAll(".answered-tooltip:not(.area-code-tooltip)").length,
    coloredMunicipalityPaths: Array.from(document.querySelectorAll("path[data-feature-id]"))
      .filter((path) => path.getAttribute("fill") !== "#2b3036" && path.getAttribute("fill-opacity") !== "0").length,
    hiddenMunicipalityPaths: Array.from(document.querySelectorAll("path[data-feature-id]"))
      .filter((path) => path.getAttribute("fill-opacity") === "0" || path.getAttribute("opacity") === "0").length,
    coloredAreaPaths: Array.from(document.querySelectorAll("path[data-area-code]"))
      .filter((path) => path.getAttribute("fill") !== "#2b3036" && path.getAttribute("fill-opacity") !== "0").length,
    areaStrokeWidths: Array.from(document.querySelectorAll("path[data-area-code]"))
      .map((path) => path.getAttribute("stroke-width")),
    progress: (() => {
      const progress = window.ProgressStore.getDatasetProgress("saitama");
      return progress ? {
        sessions: progress.sessions,
        modePlays: progress.modes[currentMode]?.plays || 0,
        savedStats: Object.keys(progress.stats).length
      } : null;
    })(),
    rankingItems: document.querySelectorAll("#weakRankingList .ranking-item").length,
    rankingText: document.querySelector("#weakRankingList")?.textContent || "",
    practiceButtonEnabled: !document.querySelector("#practiceWeakButton")?.disabled,
    lowAccuracyPracticeEnabled: !document.querySelector("#practiceLowAccuracyButton")?.disabled,
    rankingTabs: Array.from(document.querySelectorAll("[data-ranking-type]")).map((button) => ({
      type: button.dataset.rankingType,
      active: button.classList.contains("is-active"),
      selected: button.getAttribute("aria-selected")
    }))
  }), mode);

  assert(result.title === "Complete", `${mode}: expected Complete, got ${result.title}`);
  assert(result.correct === String(expectedTotal), `${mode}: expected ${expectedTotal} correct, got ${result.correct}`);
  assert(result.mistakes === "0", `${mode}: expected 0 mistakes, got ${result.mistakes}`);
  assert(result.total === String(expectedTotal), `${mode}: expected total ${expectedTotal}, got ${result.total}`);
  assert(result.resultHasMap, `${mode}: result screen should contain the map`);
  assert(result.progress && result.progress.sessions >= 1, `${mode}: cumulative progress should be saved`);
  assert(result.progress.modePlays >= 1, `${mode}: cumulative mode progress should be saved`);
  assert(result.progress.savedStats > 0, `${mode}: cumulative feature stats should be saved`);
  assert(result.rankingItems > 0, `${mode}: weak ranking should be rendered`);
  assert(result.rankingText.includes("正答率"), `${mode}: weak ranking should include accuracy text`);
  assert(result.practiceButtonEnabled, `${mode}: weak practice button should be enabled when ranking exists`);
  assert(result.lowAccuracyPracticeEnabled, `${mode}: low accuracy practice button should be enabled when ranking exists`);
  assert(result.rankingTabs.length === 3, `${mode}: ranking should expose three tabs`);
  assert(result.rankingTabs.some((tab) => tab.type === "weak" && tab.active && tab.selected === "true"), `${mode}: weak ranking tab should be active by default`);
  const tabSwitch = await page.evaluate(() => {
    document.querySelector('[data-ranking-type="accuracy"]')?.click();
    const accuracyTitle = document.querySelector("#rankingTitle")?.textContent || "";
    const accuracyActive = document.querySelector('[data-ranking-type="accuracy"]')?.getAttribute("aria-selected");
    document.querySelector('[data-ranking-type="time"]')?.click();
    const timeTitle = document.querySelector("#rankingTitle")?.textContent || "";
    const timeActive = document.querySelector('[data-ranking-type="time"]')?.getAttribute("aria-selected");
    return { accuracyTitle, accuracyActive, timeTitle, timeActive };
  });
  assert(tabSwitch.accuracyTitle === "正答率ランキング", `${mode}: accuracy tab should update ranking title`);
  assert(tabSwitch.accuracyActive === "true", `${mode}: accuracy tab should become active`);
  assert(tabSwitch.timeTitle === "平均時間ランキング", `${mode}: time tab should update ranking title`);
  assert(tabSwitch.timeActive === "true", `${mode}: time tab should become active`);
  const backToMenu = await page.evaluate(() => {
    document.querySelector("#resultBackToMenuButton")?.click();
    return {
      startVisible: !document.querySelector("#startScreen")?.classList.contains("is-hidden"),
      gameVisible: !document.querySelector("#gameScreen")?.classList.contains("is-hidden"),
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden")
    };
  });
  assert(backToMenu.startVisible, `${mode}: result back-to-menu button should show the start screen`);
  assert(!backToMenu.gameVisible && !backToMenu.resultVisible, `${mode}: result back-to-menu button should hide game and result screens`);
  await page.getByRole("button", { name: buttonName }).click();
  await page.waitForSelector(".leaflet-container", { timeout: 10000 });
  await completeModeToResult(page, mode);
  const practice = await page.evaluate(() => {
    document.querySelector('[data-ranking-type="weak"]')?.click();
    document.querySelector("#practiceWeakButton")?.click();
    return {
      gameVisible: !document.querySelector("#gameScreen")?.classList.contains("is-hidden"),
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      remaining: Number(document.querySelector("#remainingCount")?.textContent || "0"),
      modeLabel: document.querySelector("#modeLabel")?.textContent || "",
      question: document.querySelector("#questionText")?.textContent || ""
    };
  });
  assert(practice.gameVisible && !practice.resultVisible, `${mode}: weak practice should return to the game screen`);
  assert(practice.remaining > 0 && practice.remaining <= 5, `${mode}: weak practice should start with a limited question set, got ${practice.remaining}`);
  assert(practice.modeLabel.includes("再出題"), `${mode}: weak practice should label the practice run`);
  assert(practice.question !== "終了", `${mode}: weak practice should have a question`);
  if (isMunicipality) {
    assert(result.municipalityPathCount >= 63, "municipality result should keep municipality paths");
    assert(result.labels === 63, `municipality result should show 63 labels, got ${result.labels}`);
    assert(result.municipalityLabels === 63, `municipality result should show municipality labels only, got ${result.municipalityLabels}`);
    assert(result.areaLabels === 0, "municipality result should not show area-code labels");
    assert(result.coloredMunicipalityPaths >= 63, `municipality result should color all municipality paths, got ${result.coloredMunicipalityPaths}`);
    assert(result.areaPathCount === 0, `municipality result should not show area-code boundaries, got ${result.areaPathCount}`);
  } else {
    assert(result.areaPathCount === 8, `area-code result should show 8 area-code boundaries, got ${result.areaPathCount}`);
    assert(result.labels === 8, `area-code result should show 8 labels, got ${result.labels}`);
    assert(result.areaLabels === 8, `area-code result should show 8 area-code labels, got ${result.areaLabels}`);
    assert(result.municipalityLabels === 0, "area-code result should not show municipality labels");
    assert(result.coloredAreaPaths === 8, `area-code result should color all area-code paths, got ${result.coloredAreaPaths}`);
    assert(result.hiddenMunicipalityPaths >= 63, `area-code result should hide municipality paths, got ${result.hiddenMunicipalityPaths}`);
    assert(result.areaStrokeWidths.every((width) => width === "1.8"), "area-code result should use result boundary stroke width");
  }

  return result;
}

async function completeModeToResult(page, mode) {
  const isMunicipality = mode === "municipality";
  const expectedTotal = isMunicipality ? 63 : 8;

  for (let guard = 0; guard < expectedTotal + 4; guard += 1) {
    const state = await page.evaluate(() => ({
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      question: document.querySelector("#questionText")?.textContent || "",
      correct: Number(document.querySelector("#correctCount")?.textContent || "0")
    }));
    if (state.resultVisible || state.question === "終了") break;
    if (isMunicipality) {
      await clickCurrentMunicipalityAnswer(page);
    } else {
      await clickCurrentAreaCodeAnswer(page);
    }
    await page.waitForFunction((previousCorrect) => {
      const resultVisible = !document.querySelector("#resultScreen")?.classList.contains("is-hidden");
      const nextCorrect = Number(document.querySelector("#correctCount")?.textContent || "0");
      return resultVisible || nextCorrect > previousCorrect;
    }, state.correct, { timeout: 1200 });
    await page.waitForTimeout(460);
  }

  await page.waitForFunction(() => !document.querySelector("#resultScreen")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForTimeout(500);
}

async function testSuddenDeath(page) {
  await page.getByRole("button", { name: "市区町村 市町村名から場所を当てる" }).click();
  await page.waitForSelector(".leaflet-container", { timeout: 10000 });
  await page.locator("#suddenDeathToggle").check();
  const wrongId = await page.evaluate(() => {
    const text = document.querySelector("#questionText")?.textContent || "";
    const name = text.replace(" をクリック", "").trim();
    const target = window.SAITAMA_MUNICIPALITIES.municipalities.find((municipality) => municipality.name === name);
    const wrong = window.SAITAMA_MUNICIPALITIES.municipalities.find((municipality) => municipality.id !== target.id);
    return wrong && wrong.id;
  });
  assert(wrongId, "sudden death test could not find a wrong answer");
  await page.locator(`path[data-feature-id="${wrongId}"]`).first().dblclick({ force: true });
  await page.waitForSelector("#resultScreen:not(.is-hidden)", { timeout: 10000 });
  const result = await page.evaluate(() => ({
    title: document.querySelector("#resultTitle")?.textContent,
    correct: document.querySelector("#resultCorrect")?.textContent,
    mistakes: document.querySelector("#resultMistakes")?.textContent,
    resultHasMap: document.querySelector("#resultMapSlot #map") !== null,
    unansweredPracticeEnabled: !document.querySelector("#practiceUnansweredButton")?.disabled
  }));
  assert(result.title === "Game Over", `sudden death: expected Game Over, got ${result.title}`);
  assert(result.correct === "0", `sudden death: expected 0 correct, got ${result.correct}`);
  assert(result.mistakes === "1", `sudden death: expected 1 mistake, got ${result.mistakes}`);
  assert(result.resultHasMap, "sudden death result should contain the map");
  assert(result.unansweredPracticeEnabled, "sudden death: unanswered practice should be enabled after game over");
  const practice = await page.evaluate(() => {
    document.querySelector("#practiceUnansweredButton")?.click();
    return {
      gameVisible: !document.querySelector("#gameScreen")?.classList.contains("is-hidden"),
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      remaining: Number(document.querySelector("#remainingCount")?.textContent || "0"),
      modeLabel: document.querySelector("#modeLabel")?.textContent || "",
      question: document.querySelector("#questionText")?.textContent || ""
    };
  });
  assert(practice.gameVisible && !practice.resultVisible, "sudden death: unanswered practice should return to the game screen");
  assert(practice.remaining > 0 && practice.remaining <= 5, `sudden death: unanswered practice should start with a limited question set, got ${practice.remaining}`);
  assert(practice.modeLabel.includes("未正解"), "sudden death: unanswered practice should label the practice run");
  assert(practice.question !== "終了", "sudden death: unanswered practice should have a question");
  return result;
}

async function testAreaCodeJudgementStability(page) {
  await page.getByRole("button", { name: "市外局番 番号からエリアを当てる" }).click();
  await page.waitForSelector("path[data-area-code]", { timeout: 10000 });

  const expectedCodes = await page.evaluate(() => (
    Array.from(new Set(window.SAITAMA_MUNICIPALITIES.municipalities.map((item) => item.area_code))).sort()
  ));
  const checkedCodes = [];

  for (let guard = 0; guard < expectedCodes.length + 3; guard += 1) {
    const state = await page.evaluate(() => ({
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      question: document.querySelector("#questionText")?.textContent || "",
      correct: Number(document.querySelector("#correctCount")?.textContent || "0"),
      mistakes: Number(document.querySelector("#mistakeCount")?.textContent || "0")
    }));
    if (state.resultVisible || state.question === "終了") break;

    const code = state.question.replace(" のエリアをクリック", "").trim();
    const wrongCode = expectedCodes.find((item) => item !== code);
    assert(wrongCode, `area-code stability: could not find wrong code for ${code}`);

    await page.evaluate((targetCode) => {
      const path = document.querySelector(`path[data-area-code="${targetCode}"]`);
      path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }, wrongCode);
    await page.waitForFunction((previousMistakes) => (
      Number(document.querySelector("#mistakeCount")?.textContent || "0") === previousMistakes + 1
    ), state.mistakes, { timeout: 2000 });
    await page.waitForTimeout(340);

    const afterWrong = await page.evaluate(() => ({
      question: document.querySelector("#questionText")?.textContent || "",
      correct: Number(document.querySelector("#correctCount")?.textContent || "0")
    }));
    assert(afterWrong.question === state.question, `area-code stability: wrong click advanced question ${code}`);
    assert(afterWrong.correct === state.correct, `area-code stability: wrong click changed correct count ${code}`);

    await page.evaluate((targetCode) => {
      const path = document.querySelector(`path[data-area-code="${targetCode}"]`);
      path.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    }, code);
    await page.waitForFunction((previousCorrect) => {
      const resultVisible = !document.querySelector("#resultScreen")?.classList.contains("is-hidden");
      const nextCorrect = Number(document.querySelector("#correctCount")?.textContent || "0");
      return resultVisible || nextCorrect === previousCorrect + 1;
    }, state.correct, { timeout: 2500 });
    await page.waitForTimeout(460);

    const fill = await page.evaluate((targetCode) => (
      document.querySelector(`path[data-area-code="${targetCode}"]`)?.getAttribute("fill")
    ), code);
    assert(fill === "#d6c75f", `area-code stability: ${code} should be yellow after one miss, got ${fill}`);
    checkedCodes.push(code);
  }

  await page.waitForFunction(() => !document.querySelector("#resultScreen")?.classList.contains("is-hidden"), null, { timeout: 10000 });
  await page.waitForTimeout(500);
  const result = await page.evaluate((codes) => ({
    title: document.querySelector("#resultTitle")?.textContent,
    correct: document.querySelector("#resultCorrect")?.textContent,
    mistakes: document.querySelector("#resultMistakes")?.textContent,
    total: document.querySelector("#resultTotal")?.textContent,
    areaPathCount: document.querySelectorAll("path[data-area-code]").length,
    areaLabels: document.querySelectorAll(".area-code-tooltip").length,
    lastMistakePracticeEnabled: !document.querySelector("#practiceLastMistakeButton")?.disabled,
    recentMistakePracticeEnabled: !document.querySelector("#practiceRecentMistakeButton")?.disabled,
    fills: Object.fromEntries(codes.map((code) => [
      code,
      document.querySelector(`path[data-area-code="${code}"]`)?.getAttribute("fill")
    ]))
  }), expectedCodes);

  assert(result.title === "Complete", `area-code stability: expected Complete, got ${result.title}`);
  assert(result.correct === "8", `area-code stability: expected 8 correct, got ${result.correct}`);
  assert(result.mistakes === "8", `area-code stability: expected 8 mistakes, got ${result.mistakes}`);
  assert(result.total === "8", `area-code stability: expected total 8, got ${result.total}`);
  assert(result.areaPathCount === 8, `area-code stability: expected 8 area paths, got ${result.areaPathCount}`);
  assert(result.areaLabels === 8, `area-code stability: expected 8 labels, got ${result.areaLabels}`);
  assert(result.lastMistakePracticeEnabled, "area-code stability: last mistake practice should be enabled after missed questions");
  assert(result.recentMistakePracticeEnabled, "area-code stability: recent mistake practice should be enabled after missed questions");
  assert(expectedCodes.every((code) => result.fills[code] === "#d6c75f"), "area-code stability: all result areas should be yellow after one miss each");
  assert(new Set(checkedCodes).size === expectedCodes.length, `area-code stability: expected all 8 codes, checked ${checkedCodes.join(", ")}`);

  const practice = await page.evaluate(() => {
    document.querySelector("#practiceLastMistakeButton")?.click();
    return {
      gameVisible: !document.querySelector("#gameScreen")?.classList.contains("is-hidden"),
      resultVisible: !document.querySelector("#resultScreen")?.classList.contains("is-hidden"),
      remaining: Number(document.querySelector("#remainingCount")?.textContent || "0"),
      modeLabel: document.querySelector("#modeLabel")?.textContent || "",
      question: document.querySelector("#questionText")?.textContent || ""
    };
  });
  assert(practice.gameVisible && !practice.resultVisible, "area-code stability: last mistake practice should return to the game screen");
  assert(practice.remaining > 0 && practice.remaining <= 5, `area-code stability: last mistake practice should start with a limited question set, got ${practice.remaining}`);
  assert(practice.modeLabel.includes("前回ミス"), "area-code stability: last mistake practice should label the practice run");
  assert(practice.question !== "終了", "area-code stability: last mistake practice should have a question");

  return {
    ...result,
    checkedCodes: checkedCodes.sort()
  };
}

async function testPuzzleMode(page) {
  await page.getByRole("button", { name: "パズル ずれた市区町村を元の位置へ戻す" }).click();
  await page.waitForSelector(".leaflet-container", { timeout: 10000 });
  await page.waitForFunction(() => document.querySelectorAll('path[data-puzzle-fixed="false"]').length > 0, null, { timeout: 10000 });
  const initial = await page.evaluate(() => ({
    modeLabel: document.querySelector("#modeLabel")?.textContent || "",
    question: document.querySelector("#questionText")?.textContent || "",
    remaining: Number(document.querySelector("#remainingCount")?.textContent || "0"),
    controlsVisible: !document.querySelector("#puzzleControls")?.classList.contains("is-hidden"),
    optionCount: document.querySelector("#puzzlePieceSelect")?.options.length || 0,
    best: document.querySelector("#puzzleBestTime")?.textContent || "",
    outlines: document.querySelectorAll('path[data-puzzle-outline="true"]').length,
    outlineStroke: document.querySelector('path[data-puzzle-outline="true"]')?.getAttribute("stroke") || "",
    pieceFill: document.querySelector('path[data-puzzle-fixed="false"]')?.getAttribute("fill") || "",
    fixed: document.querySelectorAll('path[data-puzzle-fixed="true"]').length,
    loose: document.querySelectorAll('path[data-puzzle-fixed="false"]').length
  }));
  assert(initial.modeLabel === "パズルモード", `puzzle: expected mode label, got ${initial.modeLabel}`);
  assert(initial.question.includes("ドラッグ"), `puzzle: expected drag instruction, got ${initial.question}`);
  assert(initial.remaining === 63, `puzzle: expected 63 remaining pieces, got ${initial.remaining}`);
  assert(initial.controlsVisible, "puzzle: controls should be visible");
  assert(initial.optionCount > 2, `puzzle: expected all/small/region options, got ${initial.optionCount}`);
  assert(initial.best === "--:--", `puzzle: expected empty best time, got ${initial.best}`);
  assert(initial.outlines >= 63, `puzzle: expected answer outlines, got ${initial.outlines}`);
  assert(initial.outlineStroke === "#f5d98a", `puzzle: expected visible outline stroke, got ${initial.outlineStroke}`);
  assert(initial.pieceFill === "#33515a", `puzzle: expected distinct puzzle piece fill, got ${initial.pieceFill}`);
  assert(initial.fixed === 0, "puzzle: no pieces should be fixed at start");
  assert(initial.loose >= 63, `puzzle: expected loose pieces, got ${initial.loose}`);

  await page.evaluate(() => window.__geoquizRenderer.forceSolvePuzzleForTest());
  await page.waitForSelector("#resultScreen:not(.is-hidden)", { timeout: 10000 });
  const result = await page.evaluate(() => ({
    title: document.querySelector("#resultTitle")?.textContent,
    correct: document.querySelector("#resultCorrect")?.textContent,
    total: document.querySelector("#resultTotal")?.textContent,
    fixed: document.querySelectorAll('path[data-puzzle-fixed="true"]').length,
    labels: document.querySelectorAll(".answered-tooltip").length,
    bestSaved: Number(window.localStorage.getItem("geoquiz:puzzle-best:saitama:all") || "0")
  }));
  assert(result.title === "Complete", `puzzle: expected Complete, got ${result.title}`);
  assert(result.correct === "63", `puzzle: expected 63 correct, got ${result.correct}`);
  assert(result.total === "63", `puzzle: expected total 63, got ${result.total}`);
  assert(result.fixed >= 63, `puzzle: expected fixed pieces after solve, got ${result.fixed}`);
  assert(result.labels === 63, `puzzle: expected labels after solve, got ${result.labels}`);
  assert(result.bestSaved > 0, "puzzle: best time should be saved");

  await page.goto(`${baseUrl}/index.html?mode=puzzle`, { waitUntil: "load" });
  await page.waitForSelector('path[data-puzzle-fixed="false"]', { timeout: 10000 });
  const direct = await page.evaluate(() => ({
    startVisible: !document.querySelector("#startScreen")?.classList.contains("is-hidden"),
    gameVisible: !document.querySelector("#gameScreen")?.classList.contains("is-hidden"),
    modeLabel: document.querySelector("#modeLabel")?.textContent || ""
  }));
  assert(!direct.startVisible && direct.gameVisible, "puzzle: ?mode=puzzle should start the game directly");
  assert(direct.modeLabel === "パズルモード", `puzzle: direct mode label mismatch ${direct.modeLabel}`);

  await page.evaluate(() => {
    const select = document.querySelector("#puzzlePieceSelect");
    select.value = "small";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page.waitForFunction(() => Number(document.querySelector("#remainingCount")?.textContent || "0") === 15, null, { timeout: 10000 });
  const small = await page.evaluate(() => ({
    remaining: Number(document.querySelector("#remainingCount")?.textContent || "0"),
    loose: document.querySelectorAll('path[data-puzzle-fixed="false"]').length,
    outlines: document.querySelectorAll('path[data-puzzle-outline="true"]').length
  }));
  assert(small.remaining === 15, `puzzle: small mode should use 15 pieces, got ${small.remaining}`);
  assert(small.loose >= 15, `puzzle: small mode should show loose pieces, got ${small.loose}`);
  assert(small.outlines >= 15, `puzzle: small mode should show outlines, got ${small.outlines}`);
  return result;
}

async function testLabelEditor(page) {
  await page.goto(`${baseUrl}/index.html?edit=labels`, { waitUntil: "load" });
  await page.waitForSelector("#labelEditorPanel:not(.is-hidden)", { timeout: 10000 });
  await page.waitForSelector(".label-edit-handle", { timeout: 10000 });
  const municipalityResult = await page.evaluate(() => {
    const handle = document.querySelector(".label-edit-handle");
    handle?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    const angle = document.querySelector("#labelAngleInput");
    angle.value = "12";
    angle.dispatchEvent(new Event("input", { bubbles: true }));
    const select = document.querySelector("#labelTargetSelect");
    const selectedBefore = select.value;
    const editedOptionCount = Array.from(select.options).filter((option) => option.textContent.includes("＊")).length;
    return {
      panelVisible: !document.querySelector("#labelEditorPanel")?.classList.contains("is-hidden"),
      handleCount: document.querySelectorAll(".label-edit-handle").length,
      selectedHandleCount: document.querySelectorAll(".label-edit-anchor.is-selected").length,
      dragTitle: document.querySelector(".label-edit-anchor")?.getAttribute("title") || "",
      selectedBefore,
      targetCount: select.options.length,
      editedOptionCount,
      output: document.querySelector("#labelOverrideOutput")?.value || "",
      question: document.querySelector("#questionText")?.textContent || ""
    };
  });
  assert(municipalityResult.panelVisible, "label editor should show the editor panel");
  assert(municipalityResult.handleCount >= 63, `label editor should show municipality handles, got ${municipalityResult.handleCount}`);
  assert(municipalityResult.output.startsWith("window.SAITAMA_LABEL_OVERRIDES = "), "label editor should export paste-ready JS");
  assert(municipalityResult.output.includes('"municipalities"'), "label editor should export municipality overrides separately");
  assert(municipalityResult.output.includes('"areaCodes"'), "label editor should export area-code overrides separately");
  assert(municipalityResult.output.includes('"angle": 12'), "label editor should update the municipality override JSON after slider changes");
  assert(municipalityResult.selectedHandleCount === 1, "label editor should highlight the selected municipality handle");
  assert(municipalityResult.dragTitle.includes("ドラッグして移動"), "label editor should expose a drag tooltip title");
  assert(municipalityResult.targetCount === 63, `label editor should list municipality labels, got ${municipalityResult.targetCount}`);
  assert(municipalityResult.editedOptionCount >= 1, "label editor should mark edited municipality labels in the list");
  assert(municipalityResult.question.includes("文字か丸点をドラッグ"), "label editor should show clearer municipality editing instructions");

  const areaCodeResult = await page.evaluate(() => {
    document.querySelector("#areaCodeLabelEditButton")?.click();
    const handle = document.querySelector(".label-edit-handle");
    handle?.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
    const angle = document.querySelector("#labelAngleInput");
    angle.value = "-9";
    angle.dispatchEvent(new Event("input", { bubbles: true }));
    const visible = document.querySelector("#labelVisibleToggle");
    visible.checked = false;
    visible.dispatchEvent(new Event("change", { bubbles: true }));
    const hiddenHandleCount = document.querySelectorAll(".label-edit-handle").length;
    visible.checked = true;
    visible.dispatchEvent(new Event("change", { bubbles: true }));
    const beforeNudge = JSON.parse(
      (document.querySelector("#labelOverrideOutput")?.value || "")
        .replace("window.SAITAMA_LABEL_OVERRIDES = ", "")
        .replace(/;\s*$/, "")
    );
    const nudgedCode = Object.entries(beforeNudge.areaCodes || {})
      .find(([, value]) => value && value.angle === -9)?.[0];
    const beforeLng = beforeNudge.areaCodes[nudgedCode]?.point?.[1];
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }));
    const afterNudge = JSON.parse(
      (document.querySelector("#labelOverrideOutput")?.value || "")
        .replace("window.SAITAMA_LABEL_OVERRIDES = ", "")
        .replace(/;\s*$/, "")
    );
    const afterLng = afterNudge.areaCodes[nudgedCode]?.point?.[1];
    const select = document.querySelector("#labelTargetSelect");
    return {
      areaHandleCount: document.querySelectorAll(".label-edit-handle").length,
      hiddenHandleCount,
      targetCount: select.options.length,
      output: document.querySelector("#labelOverrideOutput")?.value || "",
      question: document.querySelector("#questionText")?.textContent || "",
      areaActive: document.querySelector("#areaCodeLabelEditButton")?.classList.contains("is-active"),
      selectedHandleCount: document.querySelectorAll(".label-edit-anchor.is-selected").length,
      dragTitle: document.querySelector(".label-edit-anchor")?.getAttribute("title") || "",
      draftStatus: document.querySelector("#labelDraftStatus")?.textContent || "",
      draftSaved: Boolean(window.localStorage.getItem("geoquiz:label-draft:saitama")),
      discardButtonExists: Boolean(document.querySelector("#discardLabelDraftButton")),
      nudgeChanged: typeof beforeLng === "number" && typeof afterLng === "number" && afterLng > beforeLng,
      maLabelPoints: window.MaUnion.buildMaCollections(window.SAITAMA_MUNICIPALITIES, "area_code")
        .filter((feature) => Array.isArray(feature.properties.labelPoint)).length
    };
  });
  assert(areaCodeResult.areaActive, "label editor should activate the area-code tab");
  assert(areaCodeResult.areaHandleCount === 8, `label editor should show 8 area-code handles, got ${areaCodeResult.areaHandleCount}`);
  assert(areaCodeResult.hiddenHandleCount === 0, "label editor visibility toggle should hide handles");
  assert(areaCodeResult.targetCount === 8, `label editor should list area-code labels, got ${areaCodeResult.targetCount}`);
  assert(areaCodeResult.output.includes('"areaCodes"'), "label editor should keep area-code overrides in output");
  assert(areaCodeResult.output.includes('"angle": -9'), "label editor should update the area-code override JSON after slider changes");
  assert(areaCodeResult.nudgeChanged, "label editor should nudge selected labels with arrow keys");
  assert(areaCodeResult.selectedHandleCount === 1, "label editor should highlight the selected area-code handle");
  assert(areaCodeResult.dragTitle.includes("ドラッグして移動"), "label editor should expose an area-code drag tooltip title");
  assert(areaCodeResult.question.includes("文字か丸点をドラッグ"), "label editor should show clearer area-code editing instructions");
  assert(areaCodeResult.draftStatus.includes("一時保存"), "label editor should show unsaved draft status");
  assert(areaCodeResult.draftSaved, "label editor should save draft overrides to localStorage");
  assert(areaCodeResult.discardButtonExists, "label editor should expose a discard draft button");
  assert(areaCodeResult.maLabelPoints === 8, `area-code unions should expose preferred label points, got ${areaCodeResult.maLabelPoints}`);
  return {
    ...municipalityResult,
    areaCode: areaCodeResult
  };
}

async function testLiteMode(page) {
  await page.goto(`${baseUrl}/index.html?lite=1`, { waitUntil: "load" });
  const result = await page.evaluate(() => ({
    lite: document.body.classList.contains("is-lite-mode")
  }));
  assert(result.lite, "lite mode should add the body class");

  await page.getByRole("button", { name: "パズル ずれた市区町村を元の位置へ戻す" }).click();
  await page.waitForSelector('path[data-puzzle-fixed="false"]', { timeout: 10000 });
  const puzzle = await page.evaluate(() => ({
    selected: document.querySelector("#puzzlePieceSelect")?.value || "",
    remaining: Number(document.querySelector("#remainingCount")?.textContent || "0")
  }));
  assert(puzzle.selected === "small", `lite mode should default puzzle to small, got ${puzzle.selected}`);
  assert(puzzle.remaining === 15, `lite mode puzzle should start with 15 pieces, got ${puzzle.remaining}`);

  await page.goto(`${baseUrl}/index.html?lite=1`, { waitUntil: "load" });
  await page.getByRole("button", { name: "市区町村 市町村名から場所を当てる" }).click();
  await page.waitForSelector(".leaflet-container", { timeout: 10000 });
  await page.evaluate(() => window.__geoquizRenderer.forceSolvePuzzleForTest?.());
  return result;
}

const server = await startServer();
const { chromium } = await loadPlaywright();
const browser = await launchBrowser(chromium);

try {
  const municipality = await newTestPage(browser, "municipality-complete");
  const municipalityResult = await completeMode(municipality.page, "municipality");
  assert(municipality.messages.length === 0, municipality.messages.join("\n"));
  await municipality.page.close();

  const areaCode = await newTestPage(browser, "area-code-complete");
  const areaCodeResult = await completeMode(areaCode.page, "ma");
  assert(areaCode.messages.length === 0, areaCode.messages.join("\n"));
  await areaCode.page.close();

  const suddenDeath = await newTestPage(browser, "sudden-death");
  const suddenDeathResult = await testSuddenDeath(suddenDeath.page);
  assert(suddenDeath.messages.length === 0, suddenDeath.messages.join("\n"));
  await suddenDeath.page.close();

  const areaCodeStability = await newTestPage(browser, "area-code-stability");
  const areaCodeStabilityResult = await testAreaCodeJudgementStability(areaCodeStability.page);
  assert(areaCodeStability.messages.length === 0, areaCodeStability.messages.join("\n"));
  await areaCodeStability.page.close();

  const puzzle = await newTestPage(browser, "puzzle");
  const puzzleResult = await testPuzzleMode(puzzle.page);
  assert(puzzle.messages.length === 0, puzzle.messages.join("\n"));
  await puzzle.page.close();

  const labelEditor = await newTestPage(browser, "label-editor");
  const labelEditorResult = await testLabelEditor(labelEditor.page);
  assert(labelEditor.messages.length === 0, labelEditor.messages.join("\n"));
  await labelEditor.page.close();

  const liteMode = await newTestPage(browser, "lite-mode");
  const liteModeResult = await testLiteMode(liteMode.page);
  assert(liteMode.messages.length === 0, liteMode.messages.join("\n"));
  await liteMode.page.close();

  console.log(JSON.stringify({
    municipality: municipalityResult,
    areaCode: areaCodeResult,
    suddenDeath: suddenDeathResult,
    areaCodeStability: areaCodeStabilityResult,
    puzzle: puzzleResult,
    labelEditor: labelEditorResult,
    liteMode: liteModeResult,
    status: "ok"
  }, null, 2));
} finally {
  await browser.close();
  await new Promise((resolveClose) => server.close(resolveClose));
}
