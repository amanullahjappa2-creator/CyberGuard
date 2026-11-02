import { GameEngine, SKILL_TAGS, validateLevel } from "./engine.js";
import { buildPerformanceReport } from "./adaptive.js";
import { renderScenarioItems } from "./levels/renderers.js";
import { fetchLeaderboard, submitScore } from "./scoreboard.js";
import {
  clearProgress,
  exportProgress as serializeProgress,
  importProgress as saveImportedProgress,
} from "./storage.js";

const app = document.querySelector("#app");
const languageButton = document.querySelector("#language-toggle");
const themeButton = document.querySelector("#theme-toggle");
const homeLink = document.querySelector("#home-link");
let engine;
let locales;
let language = "en";
let screen = "home";
let feedback = null;
let summaryResult = null;
let theme = "dark";
let soundEnabled = false;
let textSize = "normal";
let reducedMotion = false;
let dictionarySearch = "";
let difficulty = "defender";
let timerHandle = null;
let activeAudioContext = null;

function readPreference(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch (error) {
    console.error(`Could not read preference: ${key}`, error);
    return fallback;
  }
}

function readTextPreference(key, fallback, maxLength) {
  try {
    const value = localStorage.getItem(key);
    return typeof value === "string" && value.length <= maxLength ? value : fallback;
  } catch (error) {
    console.error(`Could not read preference: ${key}`, error);
    return fallback;
  }
}

function writePreference(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    console.error(`Could not save preference: ${key}`, error);
  }
}

function text(value) {
  return document.createTextNode(value);
}

function element(tag, className, content) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (content !== undefined) node.textContent = content;
  return node;
}

function button(label, action, className = "button") {
  const node = element("button", className, label);
  node.type = "button";
  node.addEventListener("click", async () => {
    try {
      await action();
    } catch (error) {
      console.error("CyberGuard action failed.", error);
      showError(error.message);
    }
  });
  return node;
}

function currentLocale() {
  return locales[language];
}

function applyPreferences() {
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  document.body.dataset.theme = theme;
  const copy = currentLocale()?.ui;
  if (!copy) return;
  languageButton.textContent = language === "en" ? "اردو" : "English";
  languageButton.setAttribute("aria-label", copy.switchLanguage);
  themeButton.textContent = theme === "light" ? copy.darkTheme : copy.lightTheme;
  themeButton.setAttribute("aria-label", themeButton.textContent);
  document.querySelector("#footer-copy").textContent = copy.footer;
  document.querySelector("#offline-copy").textContent = copy.offline;
  homeLink.setAttribute("aria-label", copy.home);
  document.title = copy.appTitle;
  document.querySelectorAll(".nav-link").forEach((navLink) => {
    const label = copy[navLink.dataset.labelKey];
    if (label) navLink.textContent = label;
    const active =
      navLink.dataset.screen === screen || (screen === "level" && navLink.dataset.screen === "levels");
    navLink.classList.toggle("is-active", active);
    navLink.setAttribute("aria-current", active ? "page" : "false");
  });
}

function showError(message) {
  app.replaceChildren(element("section", "panel error-panel"));
  const panel = app.firstElementChild;
  panel.setAttribute("role", "alert");
  panel.append(element("h1", "", "CyberGuard could not start"));
  panel.append(element("p", "", message));
  panel.append(
    element(
      "p",
      "muted",
      "Serve this folder with a static file server, then open its local index.html page.",
    ),
  );
}

function openHome() {
  screen = "home";
  feedback = null;
  render();
}

async function startLevel(id, options = {}) {
  const level = engine.levels.find((entry) => entry.id === id);
  if (!level?.issues) {
    const response = await fetch(`./levels/level${String(id).padStart(2, "0")}.json`);
    if (!response.ok) throw new Error(`Could not load level ${id}.`);
    const data = await response.json();
    const errors = validateLevel(data, locales);
    if (errors.length) throw new Error(`Level ${id}: ${errors.join("; ")}`);
    engine.levels[id - 1] = data;
  }
  const variant = options.variant ?? (options.mode === "practice" ? Math.floor(Math.random() * 3) : 0);
  if (!engine.beginLevel(id, { difficulty, ...options, variant })) return;
  screen = "level";
  feedback = null;
  render();
}

function addTrust(parent, trust, trustMax, trustLabel) {
  const row = element("div", "status-row");
  row.append(element("span", "", trustLabel));
  const dots = element("span", "trust-dots");
  dots.setAttribute("aria-label", `${trust} ${trustLabel}`);
  for (let index = 0; index < trustMax; index += 1) {
    const dot = element("span", `trust-dot${index >= trust ? " is-empty" : ""}`);
    dot.setAttribute("aria-hidden", "true");
    dots.append(dot);
  }
  row.append(dots);
  parent.append(row);
}

function renderHome() {
  const copy = currentLocale();
  const ui = copy.ui;
  const hero = element("section", "hero");
  hero.append(element("p", "level-number", ui.academyLabel));
  hero.append(element("h1", "", ui.welcomeTitle));
  hero.append(element("p", "", ui.welcomeBody));
  const actions = element("div", "hero-actions");
  const savedLevel = engine.progress.current?.levelId;
  if (savedLevel) {
    actions.append(
      button(
        ui.resumeLevel,
        () => startLevel(savedLevel, { mode: engine.progress.current.mode ?? "campaign" }),
        "button button-primary",
      ),
    );
  } else if (engine.progress.finished) {
    actions.append(
      button(
        ui.openCertificate,
        () => {
          screen = "final";
          render();
        },
        "button button-primary",
      ),
    );
  } else {
    actions.append(
      button(ui.startLearning, () => startLevel(engine.progress.unlocked), "button button-primary"),
    );
  }
  const daily = engine.getDailyChallenge();
  actions.append(
    button(
      ui.dailyChallenge,
      () => startLevel(daily.levelId, { mode: "daily", variant: daily.variant }),
      "button button-quiet",
    ),
  );
  actions.append(
    button(
      ui.timedChallenge,
      () => startLevel(engine.progress.unlocked, { mode: "timed" }),
      "button button-quiet",
    ),
  );
  hero.append(actions);
  app.replaceChildren(hero);

  const sectionHeading = element("div", "section-heading");
  sectionHeading.append(element("h2", "", ui.chaptersHeading));
  sectionHeading.append(
    element("span", "muted", `${ui.unlocked}: ${engine.progress.unlocked} / ${engine.levels.length}`),
  );
  app.append(sectionHeading);
  const chapterId = engine.progress.current?.levelId ?? engine.progress.unlocked;
  const chapter = Math.min(6, Math.ceil(chapterId / 5));
  const chapterName = currentLocale().chapters?.[chapter - 1] ?? ui.foundations;
  const dashboard = element("div", "dashboard-grid");
  const campaign = element("section", "dashboard-card");
  campaign.append(element("h2", "", ui.currentChapter));
  campaign.append(element("p", "rank-value", `${ui.chapter} ${chapter}: ${chapterName}`));
  campaign.append(
    element("p", "muted", `${ui.unlocked}: ${engine.progress.unlocked} / ${engine.levels.length}`),
  );
  campaign.append(button(ui.navLevels, () => navigate("levels"), "button button-primary"));
  dashboard.append(campaign);
  const dashboardRank = element("section", "dashboard-card rank-card");
  const scoreCopy = element("div");
  const completedLevels = Object.keys(engine.progress.levels).length;
  const progressPercent = Math.round((completedLevels / engine.levels.length) * 100);
  scoreCopy.append(element("p", "muted", ui.overallProgress));
  scoreCopy.append(element("strong", "rank-value", `${progressPercent}%`));
  scoreCopy.append(
    element("p", "muted", `${completedLevels} / ${engine.levels.length} ${ui.levelsCompleted}`),
  );
  dashboardRank.append(scoreCopy);
  dashboard.append(dashboardRank);
  dashboard.append(renderSkillRadar());
  app.append(dashboard);
  const recommendation = engine.recommendLevel();
  if (recommendation) {
    const card = element("section", "dashboard-card recommendation-card");
    const levelCopy = copy.levels[recommendation.id - 1];
    const skillName = copy.skills[recommendation.skillTag] ?? recommendation.skillTag;
    card.append(element("p", "eyebrow", ui.recommendedLevel));
    card.append(element("h2", "", `${ui.level} ${recommendation.id}: ${levelCopy.title}`));
    const reason =
      recommendation.accuracy === null
        ? ui.recommendationNewSkill.replace("{skill}", skillName)
        : ui.recommendationReason
            .replace("{skill}", skillName)
            .replace("{mastery}", String(recommendation.mastery))
            .replace("{accuracy}", String(recommendation.accuracy));
    card.append(element("p", "", reason));
    card.append(
      button(
        ui.openLevel,
        () =>
          startLevel(recommendation.id, {
            mode: recommendation.id < engine.progress.unlocked ? "practice" : "campaign",
          }),
        "button button-primary",
      ),
    );
    app.append(card);
  }
  if (engine.progress.unlocked > 1) {
    const progressSection = element("section", "panel level-header");
    progressSection.append(element("h2", "", ui.overallProgress));
    const track = element("div", "progress-track");
    const fill = element("div", "progress-fill");
    fill.style.width = `${(Object.keys(engine.progress.levels).length / engine.levels.length) * 100}%`;
    track.append(fill);
    progressSection.append(track);
    app.append(progressSection);
  }
}

function showToast(message) {
  const region = document.querySelector("#toast-region");
  const toast = element("div", "toast", message);
  region.replaceChildren(toast);
  window.setTimeout(() => {
    if (toast.parentNode === region) region.replaceChildren();
  }, 3600);
}

function navigate(nextScreen) {
  screen = nextScreen;
  feedback = null;
  render();
}

function renderLevels() {
  const copy = currentLocale();
  const ui = copy.ui;
  const heading = element("header", "page-heading");
  heading.append(element("p", "eyebrow", ui.academyLabel));
  heading.append(element("h1", "", ui.navLevels));
  heading.append(element("p", "", ui.levelsIntro));
  const chapterList = element("div", "chapter-list");
  for (let chapter = 1; chapter <= 6; chapter += 1) {
    const chapterLevels = engine.levels.filter((level) => level.chapter === chapter);
    if (!chapterLevels.length) continue;
    const section = element("section", "panel chapter-levels");
    const sectionHeading = element("div", "section-heading");
    sectionHeading.append(element("h2", "", `${ui.chapter} ${chapter}: ${copy.chapters[chapter - 1]}`));
    const completed = chapterLevels.filter((level) => engine.progress.levels[level.id]).length;
    sectionHeading.append(
      element("span", "muted", `${completed} / ${chapterLevels.length} ${ui.levelsCompleted}`),
    );
    section.append(sectionHeading);
    const grid = element("div", "level-grid");
    chapterLevels.forEach((level) => {
      const id = level.id;
      const result = engine.progress.levels[id];
      const unlocked = id <= engine.progress.unlocked;
      const levelCopy = copy.levels[id - 1];
      const status = result ? ui.levelCompleted : unlocked ? ui.available : ui.lockedLevel;
      const isAssessment = [10, 20, 25, 30].includes(id);
      const card = button(
        "",
        () =>
          startLevel(id, {
            mode: result || id < engine.progress.unlocked ? "practice" : "campaign",
          }),
        `level-card${result ? " is-complete" : ""}${isAssessment ? " is-assessment" : ""}`,
      );
      card.disabled = !unlocked;
      card.setAttribute(
        "aria-label",
        `${ui.level} ${String(id).padStart(2, "0")}: ${levelCopy.title}. ${status}`,
      );
      card.append(element("span", "level-number", `${ui.level} ${String(id).padStart(2, "0")}`));
      card.append(element("strong", "", levelCopy.title));
      card.append(element("span", "", copy.skills[level.skillTag] ?? level.skillTag));
      card.append(element("span", "level-status", isAssessment ? `${ui.assessment} · ${status}` : status));
      grid.append(card);
    });
    section.append(grid);
    chapterList.append(section);
  }
  app.replaceChildren(heading, chapterList);
}

function makeSettingRow(title, description, control) {
  const row = element("section", "setting-row");
  const copy = element("div");
  copy.append(element("h3", "", title));
  copy.append(element("p", "", description));
  row.append(copy);
  const controlWrap = element("div", "setting-control");
  controlWrap.append(control);
  row.append(controlWrap);
  return row;
}

function selectSetting(label, options, selected, onChange) {
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  options.forEach(([value, name]) => {
    const option = element("option", "", name);
    option.value = value;
    option.selected = value === selected;
    select.append(option);
  });
  select.addEventListener("change", () => onChange(select.value));
  return select;
}

function renderSettings() {
  const ui = currentLocale().ui;
  const heading = element("header", "page-heading");
  heading.append(element("p", "eyebrow", ui.academyLabel));
  heading.append(element("h1", "", ui.settingsTitle));
  const list = element("div", "settings-list");
  list.append(
    makeSettingRow(
      ui.languageSetting,
      ui.switchLanguage,
      selectSetting(
        ui.languageSetting,
        [
          ["en", "English"],
          ["ur", "اردو"],
        ],
        language,
        (value) => {
          language = value;
          writePreference("cyberguard-language", language);
          render();
        },
      ),
    ),
  );
  list.append(
    makeSettingRow(
      ui.themeSetting,
      ui.themeSetting,
      selectSetting(
        ui.themeSetting,
        [
          ["dark", ui.themeDark],
          ["light", ui.themeLight],
        ],
        theme,
        (value) => {
          theme = value;
          writePreference("cyberguard-theme", theme);
          applyPreferences();
        },
      ),
    ),
  );
  list.append(
    makeSettingRow(
      ui.soundSetting,
      ui.soundSetting,
      selectSetting(
        ui.soundSetting,
        [
          ["off", ui.soundOff],
          ["on", ui.soundOn],
        ],
        soundEnabled ? "on" : "off",
        (value) => {
          soundEnabled = value === "on";
          writePreference("cyberguard-sound", value);
          showToast(soundEnabled ? ui.soundOn : ui.soundOff);
        },
      ),
    ),
  );
  list.append(
    makeSettingRow(
      ui.textSizeSetting,
      ui.textSizeSetting,
      selectSetting(
        ui.textSizeSetting,
        [
          ["normal", ui.normalText],
          ["large", ui.largeText],
        ],
        textSize,
        (value) => {
          textSize = value;
          writePreference("cyberguard-text-size", value);
          app.classList.toggle("text-large", textSize === "large");
        },
      ),
    ),
  );
  list.append(
    makeSettingRow(
      ui.difficultySetting,
      ui.difficultyDescription,
      selectSetting(
        ui.difficultySetting,
        [
          ["learner", ui.difficultyLearner],
          ["defender", ui.difficultyDefender],
          ["expert", ui.difficultyExpert],
        ],
        difficulty,
        (value) => {
          difficulty = value;
          writePreference("cyberguard-difficulty", value);
        },
      ),
    ),
  );
  const motion = document.createElement("input");
  motion.type = "checkbox";
  motion.checked = reducedMotion;
  motion.setAttribute("aria-label", ui.reducedMotionSetting);
  motion.addEventListener("change", () => {
    reducedMotion = motion.checked;
    writePreference("cyberguard-reduced-motion", String(reducedMotion));
    app.classList.toggle("motion-reduced", reducedMotion);
  });
  list.append(makeSettingRow(ui.reducedMotionSetting, ui.reducedMotionSetting, motion));
  list.append(
    makeSettingRow(ui.exportProgress, ui.exportProgress, button(ui.exportProgress, exportProgress, "button")),
  );
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = "application/json,.json";
  fileInput.setAttribute("aria-label", ui.importProgress);
  fileInput.addEventListener("change", () => handleProgressImport(fileInput.files?.[0]));
  list.append(makeSettingRow(ui.importProgress, ui.importProgress, fileInput));
  list.append(
    makeSettingRow(
      ui.resetProgress,
      ui.resetConfirm,
      button(ui.resetProgress, resetProgress, "button button-danger"),
    ),
  );
  app.replaceChildren(heading, list);
}

function exportProgress() {
  const data = serializeProgress(engine.progress);
  const blob = new Blob([data], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cyberguard-progress.json";
  link.click();
  URL.revokeObjectURL(url);
}

async function handleProgressImport(file) {
  if (!file) return;
  try {
    saveImportedProgress(await file.text());
    window.location.reload();
  } catch (error) {
    console.error("Could not import progress.", error);
    showToast(currentLocale().ui.importError);
  }
}

function resetProgress() {
  if (!window.confirm(currentLocale().ui.resetConfirm)) return;
  clearProgress();
  const preferenceKeys = [
    "cyberguard-language",
    "cyberguard-theme",
    "cyberguard-sound",
    "cyberguard-text-size",
    "cyberguard-reduced-motion",
    "cyberguard-difficulty",
    "cyberguard-scoreboard-consent",
    "cyberguard-scoreboard-nickname",
    "cyberguard-scoreboard-class",
  ];
  try {
    preferenceKeys.forEach((key) => localStorage.removeItem(key));
  } catch (error) {
    console.error("Could not clear CyberGuard preferences.", error);
    throw new Error("Settings could not be reset in this browser.", { cause: error });
  }
  window.location.reload();
}

function renderBadges() {
  const copy = currentLocale();
  const heading = element("header", "page-heading");
  heading.append(element("p", "eyebrow", copy.ui.academyLabel));
  heading.append(element("h1", "", copy.ui.navBadges));
  const grid = element("div", "level-grid");
  for (const [id, badge] of Object.entries(copy.achievements ?? {})) {
    const earned = engine.progress.achievements.includes(id);
    const card = element("article", `dashboard-card badge-card${earned ? " is-earned" : ""}`);
    card.append(element("p", "eyebrow", earned ? copy.ui.unlocked : copy.ui.lockedLevel));
    card.append(element("h2", "", badge.title));
    card.append(element("p", "muted", badge.description));
    grid.append(card);
  }
  app.replaceChildren(heading, grid);
}

function renderDictionary() {
  const copy = currentLocale();
  const heading = element("header", "page-heading");
  heading.append(element("p", "eyebrow", copy.ui.academyLabel));
  heading.append(element("h1", "", copy.ui.navDictionary));
  const search = document.createElement("input");
  search.className = "search-input";
  search.type = "search";
  search.placeholder = copy.ui.searchDictionary;
  search.setAttribute("aria-label", copy.ui.searchDictionary);
  search.value = dictionarySearch;
  const results = element("div", "summary-list");
  const renderTerms = () => {
    const query = search.value.trim().toLocaleLowerCase(language);
    dictionarySearch = search.value;
    results.replaceChildren();
    Object.entries(copy.glossary ?? {}).forEach(([id, term]) => {
      const unlocked = engine.progress.unlockedTerms.includes(id);
      if (query && !`${term.title} ${term.definition}`.toLocaleLowerCase(language).includes(query)) return;
      const entry = element("article", "summary-issue");
      entry.append(element("h2", "", unlocked ? term.title : copy.ui.lockedLevel));
      entry.append(element("p", "muted", unlocked ? term.definition : copy.ui.lockedTerm));
      results.append(entry);
    });
    if (!results.childElementCount) results.append(element("p", "empty-state", copy.ui.emptyDictionary));
  };
  search.addEventListener("input", renderTerms);
  renderTerms();
  app.replaceChildren(heading, search, results);
}

function renderSkillRadar() {
  const copy = currentLocale();
  const section = element("section", "dashboard-card");
  section.append(element("h2", "", copy.ui.mastery));
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.classList.add("skill-radar");
  svg.setAttribute("viewBox", "0 0 320 280");
  svg.setAttribute("role", "img");
  svg.setAttribute("aria-label", copy.ui.mastery);
  const center = { x: 160, y: 137 };
  const radius = 92;
  const points = SKILL_TAGS.map((skill, index) => {
    const angle = -Math.PI / 2 + (index * Math.PI * 2) / SKILL_TAGS.length;
    return {
      skill,
      x: center.x + Math.cos(angle) * radius,
      y: center.y + Math.sin(angle) * radius,
      value: Math.min(1, (engine.progress.adaptive.masteryScores[skill] ?? 50) / 100),
      angle,
    };
  });
  for (const scale of [0.33, 0.66, 1]) {
    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute(
      "points",
      points
        .map(
          (point) => `${center.x + (point.x - center.x) * scale},${center.y + (point.y - center.y) * scale}`,
        )
        .join(" "),
    );
    polygon.setAttribute("class", "radar-grid");
    svg.append(polygon);
  }
  const data = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
  data.setAttribute(
    "points",
    points
      .map(
        (point) =>
          `${center.x + (point.x - center.x) * point.value},${center.y + (point.y - center.y) * point.value}`,
      )
      .join(" "),
  );
  data.setAttribute("class", "radar-data");
  svg.append(data);
  points.forEach((point) => {
    const label = document.createElementNS("http://www.w3.org/2000/svg", "text");
    const labelRadius = radius + 24;
    label.setAttribute("x", String(center.x + Math.cos(point.angle) * labelRadius));
    label.setAttribute("y", String(center.y + Math.sin(point.angle) * labelRadius));
    label.setAttribute("text-anchor", "middle");
    label.setAttribute("class", "radar-label");
    label.textContent = copy.skills?.[point.skill] ?? point.skill;
    svg.append(label);
  });
  section.append(svg);
  return section;
}

function renderPerformanceReport() {
  const copy = currentLocale();
  const ui = copy.ui;
  const report = buildPerformanceReport(engine.progress);
  const heading = element("header", "page-heading");
  heading.append(element("p", "eyebrow", ui.academyLabel));
  heading.append(element("h1", "", ui.navReport));
  heading.append(element("p", "", ui.reportIntro));
  const actions = element("div", "hero-actions report-actions no-print");
  actions.append(button(ui.exportReport, exportPerformanceReport, "button"));
  actions.append(button(ui.printReport, () => window.print(), "button button-primary"));
  const summary = element("div", "report-grid");
  const accuracyValues = Object.values(report.skillStats).filter((skill) => skill.accuracy !== null);
  const allAccuracy = accuracyValues.length
    ? Math.round(accuracyValues.reduce((sum, skill) => sum + skill.accuracy, 0) / accuracyValues.length)
    : null;
  const overview = element("section", "report-card");
  overview.append(element("h2", "", ui.accuracy));
  overview.append(element("p", "rank-value", allAccuracy === null ? "—" : `${allAccuracy}%`));
  overview.append(element("p", "muted", `${ui.sevenSessionTrend}: ${report.sessions.length}`));
  const delta = report.improvement.change;
  overview.append(
    element("p", "", `${ui.reportImprovement}: ${delta === null ? "—" : `${delta > 0 ? "+" : ""}${delta}%`}`),
  );
  summary.append(overview);
  const hints = element("section", "report-card");
  hints.append(element("h2", "", ui.hintsUsed));
  hints.append(element("p", "rank-value", String(report.totalHints)));
  hints.append(element("p", "muted", `${ui.totalScore}: ${report.totalScore}`));
  summary.append(hints);
  const mastery = renderSkillRadar();
  mastery.classList.add("report-card");
  summary.append(mastery);
  const skillCard = element("section", "report-card");
  skillCard.append(element("h2", "", ui.mastery));
  SKILL_TAGS.forEach((skillTag) => {
    const stats = report.skillStats[skillTag];
    const row = element("div", "report-skill");
    row.append(element("span", "", copy.skills[skillTag]));
    const bar = document.createElement("progress");
    bar.max = 100;
    bar.value = stats.mastery;
    bar.setAttribute("aria-label", `${copy.skills[skillTag]} ${stats.mastery}%`);
    row.append(bar);
    row.append(element("strong", "", `${stats.mastery}%`));
    row.append(
      element("span", "muted", `${ui.accuracy}: ${stats.accuracy === null ? "—" : `${stats.accuracy}%`}`),
    );
    skillCard.append(row);
  });
  summary.append(skillCard);
  const mistakes = element("section", "report-card");
  mistakes.append(element("h2", "", ui.mistakesBySkill));
  for (const [skillTag, count] of Object.entries(report.mistakesByCategory)) {
    mistakes.append(element("p", "", `${copy.skills[skillTag]}: ${count}`));
  }
  summary.append(mistakes);
  const times = element("section", "report-card");
  times.append(element("h2", "", ui.timePerLevel));
  const levels = report.levels.slice().sort((left, right) => left.levelId - right.levelId);
  if (!levels.length) times.append(element("p", "muted", ui.noReportData));
  levels.forEach((level) => {
    const row = element("div", "report-session-row");
    row.append(element("span", "", `${ui.level} ${level.levelId}: ${copy.levels[level.levelId - 1].title}`));
    row.append(element("strong", "", `${level.averageSeconds} ${ui.seconds}`));
    row.append(
      element("span", "muted", `${ui.hintsUsed}: ${level.hints} · ${ui.mistakesBySkill}: ${level.mistakes}`),
    );
    times.append(row);
  });
  summary.append(times);
  const sessions = element("section", "report-card");
  sessions.append(element("h2", "", ui.sevenSessionTrend));
  if (!report.sessions.length) sessions.append(element("p", "muted", ui.noReportData));
  report.sessions.forEach((session) => {
    sessions.append(
      element(
        "p",
        "",
        `${copy.levels[session.levelId - 1].title}: ${session.accuracy}% · ${session.elapsedSeconds} ${ui.seconds}`,
      ),
    );
  });
  summary.append(sessions);
  const tipsCard = element("section", "report-card");
  tipsCard.append(element("h2", "", ui.personalTips));
  const tips = element("ol", "report-tip-list");
  const weakest = SKILL_TAGS.slice().sort(
    (left, right) => report.skillStats[left].mastery - report.skillStats[right].mastery,
  );
  for (const skillTag of weakest.slice(0, 3)) {
    const stats = report.skillStats[skillTag];
    let message;
    if (stats.mistakes > 0) {
      message = ui.reportTipMistakes.replace("{skill}", copy.skills[skillTag]);
    } else if (stats.accuracy === null) {
      message = ui.reportTipLowMastery
        .replace("{skill}", copy.skills[skillTag])
        .replace("{mastery}", String(stats.mastery));
    } else if (stats.hints > 0) {
      message = ui.reportTipHint.replace("{skill}", copy.skills[skillTag]);
    } else {
      message = ui.reportTipSteady
        .replace("{skill}", copy.skills[skillTag])
        .replace("{accuracy}", String(stats.accuracy));
    }
    tips.append(element("li", "", message));
  }
  tipsCard.append(tips);
  summary.append(tipsCard);
  app.replaceChildren(heading, actions, summary, renderScoreboardPanel());
}

function renderScoreboardPanel() {
  const ui = currentLocale().ui;
  const panel = element("section", "report-card scoreboard-panel no-print");
  panel.append(element("h2", "", ui.scoreboardHeading));
  panel.append(element("p", "", ui.scoreboardPrivacy));
  panel.append(element("p", "muted", ui.scoreboardData));
  const form = document.createElement("form");
  form.className = "scoreboard-form";
  const nicknameLabel = element("label", "", ui.scoreboardNickname);
  const nickname = document.createElement("input");
  nickname.name = "nickname";
  nickname.required = true;
  nickname.minLength = 3;
  nickname.maxLength = 24;
  nickname.pattern = "[A-Za-z0-9][A-Za-z0-9_-]{2,23}";
  nickname.autocomplete = "nickname";
  nickname.value = readTextPreference("cyberguard-scoreboard-nickname", "", 24);
  nicknameLabel.append(nickname);
  const classLabel = element("label", "", ui.scoreboardClassCode);
  const classCode = document.createElement("input");
  classCode.name = "classCode";
  classCode.maxLength = 6;
  classCode.autocomplete = "off";
  classCode.value = readTextPreference("cyberguard-scoreboard-class", "", 6);
  classLabel.append(classCode);
  const scopeLabel = element("label", "", ui.scoreboardScope);
  const scope = document.createElement("select");
  for (const [value, label] of [
    ["global", ui.scoreboardGlobal],
    ["weekly", ui.scoreboardWeekly],
    ["class", ui.scoreboardClass],
  ]) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    scope.append(option);
  }
  scopeLabel.append(scope);
  const consentLabel = element("label", "scoreboard-consent");
  const consent = document.createElement("input");
  consent.type = "checkbox";
  consent.required = true;
  consent.checked = readPreference("cyberguard-scoreboard-consent", ["yes"], "no") === "yes";
  consentLabel.append(consent, text(ui.scoreboardConsent));
  const actions = element("div", "hero-actions");
  const syncButton = button(
    consent.checked ? ui.scoreboardSync : ui.scoreboardJoin,
    async () => {
      if (!consent.checked) {
        consent.reportValidity();
        return;
      }
      if (!nickname.reportValidity()) return;
      if (scope.value === "class" && !classCode.value.trim()) {
        classCode.reportValidity();
        return;
      }
      const cleanNickname = nickname.value.trim();
      const cleanClassCode = classCode.value.trim().toUpperCase();
      writePreference("cyberguard-scoreboard-consent", "yes");
      writePreference("cyberguard-scoreboard-nickname", cleanNickname);
      writePreference("cyberguard-scoreboard-class", cleanClassCode);
      try {
        await submitScore(engine.progress, cleanNickname, cleanClassCode);
        await showLeaderboardResults(results, scope.value, cleanClassCode);
        showToast(ui.scoreboardSynced);
      } catch (error) {
        console.error("Could not sync opted-in scoreboard progress.", error);
        results.setAttribute("role", "alert");
        results.textContent = ui.scoreboardPending;
      }
    },
    "button button-primary",
  );
  consent.addEventListener("change", () => {
    syncButton.textContent = consent.checked ? ui.scoreboardSync : ui.scoreboardJoin;
    if (!consent.checked) {
      writePreference("cyberguard-scoreboard-consent", "no");
      writePreference("cyberguard-scoreboard-nickname", "");
      writePreference("cyberguard-scoreboard-class", "");
    }
  });
  actions.append(syncButton);
  const viewButton = button(
    ui.scoreboardView,
    () => showLeaderboardResults(results, scope.value, classCode.value.trim().toUpperCase()),
    "button",
  );
  actions.append(viewButton);
  const results = element("div", "leaderboard-results muted", ui.scoreboardNotLoaded);
  results.setAttribute("aria-live", "polite");
  form.append(nicknameLabel, classLabel, scopeLabel, consentLabel, actions);
  form.addEventListener("submit", (event) => event.preventDefault());
  panel.append(form, results);
  const teacherLink = element("a", "button button-quiet", ui.teacherDashboard);
  teacherLink.href = "./teacher.html";
  panel.append(teacherLink);
  return panel;
}

async function showLeaderboardResults(container, scope, classCode) {
  const ui = currentLocale().ui;
  if (scope === "class" && !classCode) {
    container.setAttribute("role", "alert");
    container.textContent = ui.scoreboardClassRequired;
    return;
  }
  try {
    const result = await fetchLeaderboard(scope, classCode);
    container.removeAttribute("role");
    container.replaceChildren(element("h3", "", ui.scoreboardResults));
    if (!result.entries.length) {
      container.append(element("p", "muted", ui.scoreboardEmpty));
      return;
    }
    const list = element("ol", "leaderboard-list");
    result.entries.forEach((entry) => {
      list.append(element("li", "", `${entry.nickname} — ${entry.score}`));
    });
    container.append(list);
  } catch (error) {
    console.error("Could not load scoreboard entries.", error);
    container.setAttribute("role", "alert");
    container.textContent = ui.scoreboardUnavailable;
  }
}

async function syncOptedInScoreboard() {
  if (readPreference("cyberguard-scoreboard-consent", ["yes"], "no") !== "yes") return;
  const ui = currentLocale().ui;
  const nickname = readTextPreference("cyberguard-scoreboard-nickname", "", 24);
  const classCode = readTextPreference("cyberguard-scoreboard-class", "", 6);
  if (!nickname) return;
  try {
    await submitScore(engine.progress, nickname, classCode);
    showToast(ui.scoreboardSynced);
  } catch (error) {
    console.error("Could not sync opted-in scoreboard progress.", error);
    showToast(ui.scoreboardPending);
  }
}

function exportPerformanceReport() {
  const blob = new Blob([JSON.stringify(buildPerformanceReport(engine.progress), null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cyberguard-performance-report.json";
  link.click();
  URL.revokeObjectURL(url);
}

function selectIssue(index) {
  const result = engine.selectIssue(index);
  const locale = currentLocale();
  if (result.type === "decoy") feedback = { kind: "neutral", message: locale.ui.notAnIssue };
  else if (result.type === "order") feedback = { kind: "error", message: locale.ui.wrongOrder };
  else if (result.type === "failed") {
    feedback = null;
    screen = "failed";
  } else if (result.type === "selected") feedback = null;
  render();
}

function playCue(isSuccess) {
  if (!soundEnabled) return;
  try {
    const AudioContextClass = window.AudioContext ?? window.webkitAudioContext;
    if (!AudioContextClass) return;
    activeAudioContext ??= new AudioContextClass();
    const oscillator = activeAudioContext.createOscillator();
    const gain = activeAudioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = isSuccess ? 660 : 220;
    gain.gain.setValueAtTime(0.06, activeAudioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, activeAudioContext.currentTime + 0.12);
    oscillator.connect(gain);
    gain.connect(activeAudioContext.destination);
    oscillator.start();
    oscillator.stop(activeAudioContext.currentTime + 0.12);
  } catch (error) {
    console.error("Could not play the optional sound cue.", error);
  }
}

function answer(choiceId) {
  const result = engine.answer(choiceId);
  const locale = currentLocale();
  if (result.type === "correct") {
    playCue(true);
    feedback = {
      kind: "success",
      message: locale.levels[engine.state.levelId - 1].issues[result.issueIndex].why,
    };
  } else if (result.type === "wrong") {
    playCue(false);
    const level = engine.levels.find((entry) => entry.id === engine.state.levelId);
    const issue = level.issues[result.issueIndex];
    const alternativeIndex = issue.wrongFixes?.indexOf(result.choiceId) ?? -1;
    const issueCopy = locale.levels[engine.state.levelId - 1].issues[result.issueIndex];
    const explanation = alternativeIndex >= 0 ? issueCopy.wrongExplanations[alternativeIndex] : "";
    feedback = {
      kind: "error",
      message: [explanation, issueCopy.mistake].filter(Boolean).join(" "),
    };
  } else if (result.type === "failed") {
    feedback = null;
    screen = "failed";
  } else if (result.type === "levelComplete" || result.type === "gameComplete") {
    summaryResult = result;
    feedback = null;
    screen = "summary";
    void syncOptedInScoreboard();
  }
  render();
}

function renderLevel() {
  const ui = currentLocale().ui;
  const level = engine.levels.find((entry) => entry.id === engine.state.levelId);
  const labels = currentLocale().levels[level.id - 1];
  const completeCount = engine.state.issues.filter((issue) => issue.resolved).length;
  const header = element("section", "panel level-header");
  const heading = element("div", "level-heading");
  const titleGroup = element("div");
  titleGroup.append(element("p", "level-number", `${ui.level} ${level.id} / ${engine.levels.length}`));
  titleGroup.append(element("h1", "", labels.title));
  titleGroup.append(element("p", "", labels.scenario));
  heading.append(titleGroup);
  heading.append(button(ui.home, openHome, "button button-quiet"));
  header.append(heading);
  const briefing = document.createElement("details");
  briefing.className = "briefing";
  const summary = element("summary", "", ui.briefing);
  briefing.append(summary, element("p", "", labels.scenario));
  header.append(briefing);
  const status = element("div", "status-row");
  status.append(
    element("span", "status-pill", `${ui.resolvedIssues}: ${completeCount} / ${level.issues.length}`),
  );
  status.append(
    element("span", "status-pill", `${ui.hintsRemaining}: ${engine.state.hintLimit - engine.state.hints}`),
  );
  status.append(element("span", "status-pill", `${ui.score}: ${engine.state.score}`));
  if (engine.state.timerSeconds !== null) {
    const timer = element("span", "status-pill", `${ui.timer}: ${formatTime(engine.state.timerSeconds)}`);
    timer.id = "timer-pill";
    status.append(timer);
  }
  header.append(status);
  addTrust(header, engine.state.trust, engine.state.trustMax ?? 3, ui.trust);
  const progress = element("div", "issue-progress");
  const progressFill = element("span");
  progressFill.style.width = `${(completeCount / level.issues.length) * 100}%`;
  progress.append(progressFill);
  header.append(progress);

  const layout = element(
    "div",
    `scenario-layout scenario-layout--${level.type}${language === "ur" ? " rtl-content" : ""}`,
  );
  const scenario = element("section", "panel scenario-panel");
  scenario.append(element("h2", "", ui.scenarioHeading));
  scenario.append(element("p", "intro", ui.scenarioInstructions));
  const cards = element("div", "scenario-cards");
  renderScenarioItems(level, currentLocale(), engine.state, { select: selectIssue }).forEach((card) =>
    cards.append(card),
  );
  scenario.append(cards);

  const action = element("aside", "panel action-panel");
  action.append(element("h2", "", ui.actionHeading));
  const selectedIndex = engine.state.selectedIssue;
  if (selectedIndex === null) {
    action.append(element("p", "muted", ui.selectPrompt));
  } else {
    const issueCopy = labels.issues[selectedIndex];
    action.append(element("p", "", issueCopy.title));
    action.append(element("p", "muted", issueCopy.detail));
    action.append(element("p", "", ui.chooseFix));
    const choices = element("div", "choice-list");
    const issue = level.issues[selectedIndex];
    const distractorCount = engine.state.adaptive?.distractors ?? 2;
    const choiceIds = issue.wrongFixes
      ? [issue.fix, ...issue.wrongFixes.slice(0, distractorCount)]
      : level.choices;
    choiceIds.forEach((choiceId) => {
      choices.append(button(labels.choices[choiceId], () => answer(choiceId), "button choice-button"));
    });
    action.append(choices);
  }
  action.append(
    button(
      ui.useHint,
      () => {
        const result = engine.useHint();
        if (result.type === "hint") {
          feedback = { kind: "neutral", message: labels.hints[result.hintNumber] };
        } else {
          feedback = { kind: "neutral", message: ui.noHints };
        }
        render();
      },
      "button button-quiet",
    ),
  );
  action.lastElementChild.disabled = engine.state.hints >= engine.state.hintLimit;
  if (feedback) {
    const feedbackBox = element("div", `feedback feedback-${feedback.kind}`, feedback.message);
    feedbackBox.setAttribute("role", "status");
    action.append(feedbackBox);
  }
  layout.append(scenario, action);
  app.replaceChildren(header, layout);
  ensureTimer();
}

function formatTime(seconds) {
  const safeSeconds = Math.max(0, seconds);
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, "0")}:${String(safeSeconds % 60).padStart(2, "0")}`;
}

function ensureTimer() {
  if (screen !== "level" || engine.state?.timerSeconds === null) {
    if (timerHandle !== null) window.clearInterval(timerHandle);
    timerHandle = null;
    return;
  }
  if (timerHandle !== null) return;
  timerHandle = window.setInterval(() => {
    if (!engine.state || engine.state.timerSeconds === null) return;
    engine.state.timerSeconds = Math.max(0, engine.state.timerSeconds - 1);
    if (engine.state.timerSeconds === 0) {
      engine.state.trust = 0;
      engine.progress.current = null;
      engine.persist();
      screen = "failed";
      feedback = null;
      render();
      return;
    }
    engine.persist();
    const timer = document.querySelector("#timer-pill");
    if (timer) timer.textContent = `${currentLocale().ui.timer}: ${formatTime(engine.state.timerSeconds)}`;
  }, 1000);
}

function renderSummary() {
  const copy = currentLocale();
  const ui = copy.ui;
  const id = summaryResult.levelId;
  const level = engine.levels.find((entry) => entry.id === id);
  const labels = copy.levels[id - 1];
  const panel = element("section", "summary-card");
  panel.append(element("p", "level-number", ui.levelSummary));
  panel.append(element("h1", "", labels.title));
  panel.append(element("p", "intro", ui.levelFinished.replace("{stars}", String(summaryResult.stars))));
  const list = element("div", "summary-list");
  level.issues.forEach((issue, index) => {
    const entry = element("article", "summary-issue");
    const copyIssue = labels.issues[index];
    entry.append(element("h3", "", copyIssue.title));
    entry.append(element("p", "", `${ui.correctFix}: ${labels.choices[issue.fix]}`));
    entry.append(element("p", "", copyIssue.why));
    const tip = element("p");
    tip.append(element("strong", "tip-label", `${ui.realLifeTip}: `), text(copyIssue.tip));
    entry.append(tip);
    const terms = element("div", "glossary-links");
    for (const termId of issue.terms ?? level.glossaryTerms ?? []) {
      const term = copy.glossary?.[termId];
      if (!term) continue;
      terms.append(
        button(
          term.title,
          () => {
            dictionarySearch = term.title;
            screen = "dictionary";
            render();
          },
          "button button-quiet term-link",
        ),
      );
    }
    if (terms.childElementCount) entry.append(terms);
    list.append(entry);
  });
  panel.append(list);
  if (labels.learning) {
    const learning = element("article", "summary-issue learning-card");
    learning.append(element("h2", "", ui.learningCard));
    learning.append(element("p", "", `${ui.whatHappened}: ${labels.learning.whatHappened}`));
    learning.append(element("p", "", `${ui.attackerMay}: ${labels.learning.attacker}`));
    learning.append(element("p", "", `${ui.defend}: ${labels.learning.defend}`));
    learning.append(element("p", "", `${ui.inPakistan}: ${labels.learning.pakistan}`));
    panel.append(learning);
  }
  panel.append(element("p", "status-pill", `${ui.levelScore}: ${summaryResult.score}`));
  const actions = element("div", "hero-actions");
  actions.append(
    button(
      id === engine.levels.length ? ui.viewCertificate : ui.continue,
      async () => {
        if (id === engine.levels.length) screen = "final";
        if (id === engine.levels.length) render();
        else await startLevel(id + 1);
      },
      "button button-primary",
    ),
  );
  actions.append(button(ui.home, openHome, "button button-quiet"));
  panel.append(actions);
  app.replaceChildren(panel);
}

function renderFailed() {
  const copy = currentLocale();
  const failedLevelId = engine.state.levelId;
  const panel = element("section", "summary-card");
  panel.append(element("p", "level-number", `${copy.ui.level} ${failedLevelId}`));
  panel.append(element("h1", "", copy.ui.levelFailed));
  panel.append(element("p", "intro", copy.ui.trustEnded));
  const actions = element("div", "hero-actions");
  actions.append(
    button(
      copy.ui.retry,
      () => {
        engine.abandonCurrent();
        startLevel(failedLevelId);
      },
      "button button-primary",
    ),
  );
  actions.append(button(copy.ui.home, openHome, "button button-quiet"));
  panel.append(actions);
  app.replaceChildren(panel);
}

function renderFinal() {
  const copy = currentLocale();
  const ui = copy.ui;
  const total = engine.getTotalScore();
  const rank = currentLocale().ranks?.[engine.progress.rank] ?? engine.progress.rank;
  const panel = element("section", "summary-card");
  panel.append(element("p", "level-number", ui.gameComplete));
  panel.append(element("h1", "", ui.certificateTitle));
  panel.append(element("p", "intro", ui.certificateIntro));
  const certificate = element("div", "certificate");
  certificate.append(element("p", "level-number", "CyberGuard"));
  certificate.append(element("h2", "", ui.certificateTitle));
  certificate.append(element("p", "", ui.certificateAward));
  const name = document.createElement("input");
  name.className = "certificate-name";
  name.type = "text";
  name.maxLength = 48;
  name.value = engine.progress.name;
  name.placeholder = ui.playerName;
  name.setAttribute("aria-label", ui.playerName);
  name.addEventListener("input", () => {
    try {
      engine.setName(name.value);
    } catch (error) {
      console.error("Could not save the certificate name.", error);
      showError(error.message);
    }
  });
  certificate.append(name);
  certificate.append(element("p", "rank", rank));
  certificate.append(element("p", "", `${ui.totalScore}: ${total}`));
  const date = new Intl.DateTimeFormat(language, { dateStyle: "long" }).format(new Date());
  certificate.append(element("p", "", `${ui.certificateDate}: ${date}`));
  if (!engine.progress.certificateId) {
    const bytes = new Uint8Array(8);
    crypto.getRandomValues(bytes);
    engine.progress.certificateId = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
    engine.persist();
  }
  certificate.append(element("p", "", `${ui.certificateId}: ${engine.progress.certificateId}`));
  certificate.append(element("p", "muted", ui.verifyNote));
  certificate.append(element("p", "muted", ui.certificateFooter));
  panel.append(certificate);
  const actions = element("div", "hero-actions no-print");
  actions.append(button(ui.printCertificate, () => window.print(), "button button-primary"));
  actions.append(button(ui.home, openHome, "button button-quiet"));
  panel.append(actions);
  app.replaceChildren(panel);
}

function render() {
  if (screen !== "level" && timerHandle !== null) {
    window.clearInterval(timerHandle);
    timerHandle = null;
  }
  applyPreferences();
  app.classList.toggle("rtl-content", language === "ur");
  app.classList.toggle("text-large", textSize === "large");
  app.classList.toggle("motion-reduced", reducedMotion);
  if (screen === "level" && engine.state) renderLevel();
  else if (screen === "summary" && summaryResult) renderSummary();
  else if (screen === "failed" && engine.state) renderFailed();
  else if (screen === "final") renderFinal();
  else if (screen === "levels") renderLevels();
  else if (screen === "report") renderPerformanceReport();
  else if (screen === "settings") renderSettings();
  else if (screen === "badges") renderBadges();
  else if (screen === "dictionary") renderDictionary();
  else renderHome();
  app.focus({ preventScroll: true });
}

languageButton.addEventListener("click", () => {
  language = language === "en" ? "ur" : "en";
  feedback = null;
  writePreference("cyberguard-language", language);
  render();
});

window.addEventListener("online", () => {
  void syncOptedInScoreboard();
});
themeButton.addEventListener("click", () => {
  theme = theme === "light" ? "dark" : "light";
  writePreference("cyberguard-theme", theme);
  applyPreferences();
});
homeLink.addEventListener("click", (event) => {
  event.preventDefault();
  if (engine) openHome();
});
document.querySelectorAll(".nav-link").forEach((navLink) => {
  navLink.addEventListener("click", () => navigate(navLink.dataset.screen));
});

async function initialize() {
  try {
    const [enResponse, urResponse, catalogResponse] = await Promise.all([
      fetch("./lang/en.json"),
      fetch("./lang/ur.json"),
      fetch("./level-catalog.json"),
    ]);
    if (!enResponse.ok || !urResponse.ok || !catalogResponse.ok)
      throw new Error("Could not load the language files or level catalog.");
    locales = { en: await enResponse.json(), ur: await urResponse.json() };
    const levels = await catalogResponse.json();
    engine = new GameEngine(levels, locales);
    language = readPreference("cyberguard-language", ["en", "ur"], "en");
    theme = readPreference("cyberguard-theme", ["light", "dark"], "dark");
    soundEnabled = readPreference("cyberguard-sound", ["on", "off"], "off") === "on";
    difficulty = readPreference("cyberguard-difficulty", ["learner", "defender", "expert"], "defender");
    textSize = readPreference("cyberguard-text-size", ["normal", "large"], "normal");
    reducedMotion = readPreference("cyberguard-reduced-motion", ["true", "false"], "false") === "true";
    render();
    void syncOptedInScoreboard();
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("./service-worker.js").catch((error) => {
        console.error("Could not register the offline app worker.", error);
      });
    }
  } catch (error) {
    console.error("CyberGuard failed to initialize.", error);
    showError(error.message);
  }
}

initialize();
