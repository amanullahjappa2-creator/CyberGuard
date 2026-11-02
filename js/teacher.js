import { createClass, fetchClassCsv, fetchClassReport } from "./scoreboard.js";

const app = document.querySelector("#teacher-app");
const languageButton = document.querySelector("#language-toggle");
let locale;
let locales;
let language = "en";
let theme = "dark";
let activeClassCode = "";
let activeTeacherToken = "";

function node(tag, className = "", content) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (content !== undefined) result.textContent = content;
  return result;
}

function labelInput(labelText, name, attributes = {}) {
  const label = node("label", "", labelText);
  const input = document.createElement("input");
  input.name = name;
  Object.entries(attributes).forEach(([key, value]) => input.setAttribute(key, value));
  label.append(input);
  return { label, input };
}

function message(text, isError = false) {
  const panel = node("p", isError ? "teacher-message error-text" : "teacher-message", text);
  panel.setAttribute(isError ? "role" : "aria-live", isError ? "alert" : "polite");
  app.append(panel);
}

function setLanguage(next) {
  language = next;
  locale = locales[language];
  document.documentElement.lang = language;
  document.documentElement.dir = language === "ur" ? "rtl" : "ltr";
  const savedTheme = localStorage.getItem("cyberguard-theme");
  theme = savedTheme === "light" ? "light" : "dark";
  document.body.dataset.theme = theme;
  languageButton.textContent = language === "en" ? "اردو" : "English";
  render();
}

function render() {
  const copy = locale.ui;
  const heading = node("header", "page-heading");
  heading.append(node("p", "eyebrow", "CYBERGUARD"));
  heading.append(node("h1", "", copy.teacherTitle));
  heading.append(node("p", "", copy.teacherIntro));
  const createPanel = node("section", "report-card teacher-card");
  const createButton = node("button", "button button-primary", copy.teacherCreateClass);
  createButton.type = "button";
  createButton.addEventListener("click", async () => {
    try {
      const result = await createClass();
      sessionStorage.setItem(`cyberguard-teacher-${result.classCode}`, result.teacherToken);
      activeClassCode = result.classCode;
      activeTeacherToken = result.teacherToken;
      codeInput.value = result.classCode;
      tokenInput.value = result.teacherToken;
      await loadReport(result.classCode, result.teacherToken);
      message(
        `${copy.teacherCodeLabel}: ${result.classCode} | ${copy.teacherTokenLabel}: ${result.teacherToken}`,
      );
    } catch (error) {
      console.error("Could not create a classroom code.", error);
      message(copy.teacherServerUnavailable, true);
    }
  });
  createPanel.append(createButton);
  const accessPanel = node("section", "report-card teacher-card");
  accessPanel.append(node("h2", "", copy.teacherReport));
  const code = labelInput(copy.teacherCodeLabel, "classCode", {
    required: "",
    maxlength: "6",
    pattern: "[A-Z2-9]{6}",
    autocomplete: "off",
  });
  const token = labelInput(copy.teacherTokenLabel, "teacherToken", {
    required: "",
    autocomplete: "off",
  });
  const codeInput = code.input;
  const tokenInput = token.input;
  const savedCode = new URLSearchParams(location.search).get("classCode") ?? "";
  activeClassCode ||= savedCode.toUpperCase();
  activeTeacherToken ||= sessionStorage.getItem(`cyberguard-teacher-${activeClassCode}`) ?? "";
  codeInput.value = activeClassCode;
  tokenInput.value = activeTeacherToken;
  codeInput.addEventListener("input", () => {
    activeClassCode = codeInput.value.toUpperCase();
  });
  tokenInput.addEventListener("input", () => {
    activeTeacherToken = tokenInput.value;
  });
  const loadButton = node("button", "button button-primary", copy.teacherLoad);
  loadButton.type = "button";
  loadButton.addEventListener("click", async () => {
    if (!codeInput.reportValidity() || !tokenInput.reportValidity()) return;
    await loadReport(codeInput.value.toUpperCase(), tokenInput.value.trim());
  });
  const exportButton = node("button", "button", copy.teacherExport);
  exportButton.type = "button";
  exportButton.addEventListener("click", async () => {
    try {
      const blob = await fetchClassCsv(codeInput.value.toUpperCase(), tokenInput.value.trim());
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `cyberguard-class-${codeInput.value.toUpperCase()}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Could not export classroom results.", error);
      message(copy.teacherServerUnavailable, true);
    }
  });
  const actions = node("div", "hero-actions");
  actions.append(loadButton, exportButton);
  const report = node("section", "report-grid");
  report.id = "teacher-report";
  accessPanel.append(code.label, token.label, actions, report);
  app.replaceChildren(heading, createPanel, accessPanel);

  async function loadReport(classCode, teacherToken) {
    const target = document.querySelector("#teacher-report");
    try {
      const data = await fetchClassReport(classCode, teacherToken);
      target.replaceChildren();
      target.append(
        card(copy.teacherStudentCount, String(data.studentCount)),
        card(copy.teacherAverageScore, String(data.averageScore)),
        skillsCard(data.averageSkills),
        listCard(
          copy.teacherHardestLevels,
          data.hardestLevels.map((item) => {
            const title = locale.levels[item.levelId - 1]?.title ?? `${copy.level} ${item.levelId}`;
            return `${title}: ${item.averageAccuracy}%`;
          }),
        ),
        listCard(
          copy.teacherStudentsHelp,
          data.studentsNeedingHelp.map((student) => `${student.nickname}: ${student.averageAccuracy}%`),
          copy.teacherNoHelp,
        ),
      );
    } catch (error) {
      console.error("Could not load classroom report.", error);
      target.replaceChildren(node("p", "error-text", copy.teacherServerUnavailable));
    }
  }

  function card(title, value) {
    const result = node("section", "report-card");
    result.append(node("h2", "", title), node("p", "rank-value", value));
    return result;
  }

  function skillsCard(skills) {
    const result = node("section", "report-card");
    result.append(node("h2", "", copy.teacherAverageSkills));
    for (const [skill, accuracy] of Object.entries(skills)) {
      result.append(node("p", "", `${locale.skills[skill]}: ${accuracy === null ? "—" : `${accuracy}%`}`));
    }
    return result;
  }

  function listCard(title, items, emptyText = copy.teacherNoStudents) {
    const result = node("section", "report-card");
    result.append(node("h2", "", title));
    if (!items.length) result.append(node("p", "muted", emptyText));
    items.forEach((item) => result.append(node("p", "", item)));
    return result;
  }
}

languageButton.addEventListener("click", () => {
  setLanguage(language === "en" ? "ur" : "en");
  localStorage.setItem("cyberguard-language", language);
});

try {
  const storedLanguage = localStorage.getItem("cyberguard-language");
  language = storedLanguage === "ur" ? "ur" : "en";
  const responses = await Promise.all(["en", "ur"].map((code) => fetch(`./lang/${code}.json`)));
  if (responses.some((response) => !response.ok)) throw new Error("Could not load dashboard translations.");
  const [en, ur] = await Promise.all(responses.map((response) => response.json()));
  locales = { en, ur };
  setLanguage(language);
} catch (error) {
  console.error("Could not start the teacher dashboard.", error);
  app.replaceChildren(node("section", "panel error-panel", "CyberGuard teacher dashboard could not start."));
}
