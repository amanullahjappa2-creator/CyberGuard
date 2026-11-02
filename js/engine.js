import { loadProgress, saveProgress } from "./storage.js";
import {
  adaptiveControls,
  applyAdaptiveObservation,
  chooseRecommendation,
  createAdaptiveState,
  normalizeAdaptiveState,
  recentAccuracy,
  SKILL_TAGS,
} from "./adaptive.js";

export const MAX_LEVELS = 30;
export { SKILL_TAGS };

export const DIFFICULTIES = {
  learner: { trust: 5, hints: 3, scoreMultiplier: 0.8, timerMultiplier: 1.5 },
  defender: { trust: 3, hints: 2, scoreMultiplier: 1, timerMultiplier: 1 },
  expert: { trust: 2, hints: 1, scoreMultiplier: 1.25, timerMultiplier: 0.75 },
};

const RANKS = [
  { xp: 0, name: "Recruit" },
  { xp: 250, name: "Analyst" },
  { xp: 800, name: "Defender" },
  { xp: 1800, name: "Hunter" },
  { xp: 3500, name: "Architect" },
];

export function createNewProgress() {
  return {
    schemaVersion: 2,
    unlocked: 1,
    levels: {},
    current: null,
    name: "",
    xp: 0,
    playerLevel: 1,
    rank: "Recruit",
    achievements: [],
    mastery: Object.fromEntries(SKILL_TAGS.map((skill) => [skill, 0])),
    adaptive: createAdaptiveState(),
    sessionHistory: [],
    unlockedTerms: [],
    streak: { count: 0, lastDate: null },
    certificateId: null,
  };
}

export function rankForXp(xp) {
  return RANKS.filter((rank) => xp >= rank.xp).at(-1).name;
}

export function playerLevelForXp(xp) {
  return Math.floor(Math.max(0, xp) / 250) + 1;
}

export function dailyChallengeForDate(date = new Date(), unlocked = 1, totalLevels = MAX_LEVELS) {
  const dateKey = date instanceof Date ? date.toISOString().slice(0, 10) : String(date).slice(0, 10);
  let hash = 2166136261;
  for (const character of dateKey) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  const available = Math.max(1, Math.min(totalLevels, unlocked));
  const unsignedHash = hash >>> 0;
  return { date: dateKey, levelId: (unsignedHash % available) + 1, variant: unsignedHash % 3 };
}

function normalizeProgress(progress) {
  const defaults = createNewProgress();
  const normalized = { ...defaults, ...progress };
  normalized.unlocked = Math.max(
    1,
    Math.min(MAX_LEVELS, Number.isInteger(normalized.unlocked) ? normalized.unlocked : 1),
  );
  normalized.levels = normalized.levels && typeof normalized.levels === "object" ? normalized.levels : {};
  normalized.achievements = Array.isArray(normalized.achievements) ? normalized.achievements : [];
  normalized.mastery = { ...defaults.mastery, ...(normalized.mastery ?? {}) };
  normalized.adaptive = normalizeAdaptiveState(normalized.adaptive);
  normalized.sessionHistory = Array.isArray(normalized.sessionHistory) ? normalized.sessionHistory : [];
  normalized.unlockedTerms = Array.isArray(normalized.unlockedTerms) ? normalized.unlockedTerms : [];
  normalized.xp = Number.isFinite(normalized.xp) ? Math.max(0, normalized.xp) : 0;
  normalized.playerLevel = playerLevelForXp(normalized.xp);
  normalized.rank = rankForXp(normalized.xp);
  normalized.streak =
    normalized.streak && typeof normalized.streak === "object"
      ? normalized.streak
      : { count: 0, lastDate: null };
  normalized.name = typeof normalized.name === "string" ? normalized.name.slice(0, 48) : "";
  normalized.current =
    normalized.current && Number.isInteger(normalized.current.levelId) ? normalized.current : null;
  normalized.finished = normalized.finished === true && normalized.unlocked >= MAX_LEVELS;
  return normalized;
}

export function validateLevel(level, localeFiles) {
  const errors = [];
  if (!Number.isInteger(level.id) || level.id < 1 || level.id > MAX_LEVELS) errors.push("invalid level id");
  if (
    !Array.isArray(level.items) ||
    !Array.isArray(level.issues) ||
    level.issues.length < 3 ||
    level.issues.length > 6
  ) {
    errors.push("invalid items or issue count");
  }
  if (!Array.isArray(level.choices) || level.choices.length < 3) errors.push("missing answer choices");
  if (errors.length) return errors;
  if (!Number.isInteger(level.chapter) || level.chapter !== Math.ceil(level.id / 5))
    errors.push("invalid chapter");
  if (!level.title?.en || !level.title?.ur) errors.push("missing bilingual level title");
  if (!["learner", "defender", "expert"].includes(level.difficulty)) errors.push("invalid difficulty");
  if (!SKILL_TAGS.includes(level.skillTag)) errors.push("invalid skill tag");
  if (!level.type) errors.push("missing scenario type");
  if (
    !Array.isArray(level.hints) ||
    level.hints.length !== 2 ||
    level.hints.some(
      (hint) => !Number.isInteger(hint.issue) || hint.issue < 0 || hint.issue >= level.issues.length,
    )
  ) {
    errors.push("each level must define two valid hints");
  }
  if (!Array.isArray(level.glossaryTerms) || level.glossaryTerms.length === 0)
    errors.push("missing glossary term references");
  for (const language of ["en", "ur"]) {
    const copy = localeFiles[language]?.levels?.[level.id - 1];
    if (!copy?.title || !copy?.scenario || !Array.isArray(copy.items) || !Array.isArray(copy.issues)) {
      errors.push(`${language}: missing level translation`);
      continue;
    }
    if (copy.title !== level.title?.[language])
      errors.push(`${language}: level title does not match its translation`);
    if (copy.items.length !== level.items.length || copy.issues.length !== level.issues.length) {
      errors.push(`${language}: item or issue translation count mismatch`);
    }
    level.items.forEach((item, index) => {
      if (!Number.isInteger(item) || item < 0 || item >= copy.items.length) {
        errors.push(`${language}: level item ${index + 1} has no translation`);
      }
    });
    copy.items.forEach((item, index) => {
      if (!item?.title || !item?.detail)
        errors.push(`${language}: item ${index + 1} is missing translated text`);
    });
    level.issues.forEach((issue, index) => {
      if (!Number.isInteger(issue.item) || !level.items.includes(issue.item)) {
        errors.push(`issue ${index + 1}: invalid item`);
      }
      if (!issue.fix || !level.choices.includes(issue.fix))
        errors.push(`issue ${index + 1}: missing or invalid fix`);
      if (!Number.isInteger(issue.difficulty) || issue.difficulty < 1 || issue.difficulty > 5)
        errors.push(`issue ${index + 1}: difficulty must be an integer from 1 to 5`);
      if (
        !Array.isArray(issue.wrongFixes) ||
        issue.wrongFixes.length !== 2 ||
        new Set(issue.wrongFixes).size !== 2 ||
        issue.wrongFixes.some((choice) => !level.choices.includes(choice) || choice === issue.fix)
      ) {
        errors.push(`issue ${index + 1}: requires two valid plausible wrong fixes`);
      }
      if (!Array.isArray(issue.terms) || issue.terms.length === 0)
        errors.push(`issue ${index + 1}: missing glossary references`);
      const translatedIssue = copy.issues[index];
      if (
        !translatedIssue?.title ||
        !translatedIssue?.detail ||
        !translatedIssue?.why ||
        !translatedIssue?.mistake ||
        !translatedIssue?.tip ||
        !translatedIssue?.hint
      ) {
        errors.push(
          `${language}: issue ${index + 1} is missing a translation, fix explanation, mistake, tip or hint`,
        );
      }
      if (
        !Array.isArray(translatedIssue?.wrongExplanations) ||
        translatedIssue.wrongExplanations.length !== 2 ||
        translatedIssue.wrongExplanations.some((explanation) => !explanation)
      ) {
        errors.push(`${language}: issue ${index + 1} is missing explanations for wrong fixes`);
      }
      for (const term of issue.terms ?? []) {
        if (!localeFiles[language]?.glossary?.[term])
          errors.push(`${language}: issue ${index + 1} references unknown glossary term ${term}`);
      }
    });
    for (const term of level.glossaryTerms) {
      if (!localeFiles[language]?.glossary?.[term])
        errors.push(`${language}: level references unknown glossary term ${term}`);
    }
    if (!copy.choices || level.choices.some((choice) => !copy.choices[choice])) {
      errors.push(`${language}: missing choice translation`);
    }
    if (!Array.isArray(copy.hints) || copy.hints.length !== 2 || copy.hints.some((hint) => !hint)) {
      errors.push(`${language}: missing two translated hints`);
    }
    if (
      level.learningCard &&
      (!copy.learning?.whatHappened ||
        !copy.learning?.attacker ||
        !copy.learning?.defend ||
        !copy.learning?.pakistan)
    )
      errors.push(`${language}: missing learning card translation`);
  }
  return errors;
}

export class GameEngine {
  constructor(levels, locales) {
    this.levels = levels;
    this.locales = locales;
    this.progress = normalizeProgress(loadProgress() ?? createNewProgress());
    this.state = null;
  }

  recommendLevel(catalog = this.levels) {
    return chooseRecommendation(catalog, this.progress);
  }

  applyObservation(observation) {
    this.progress.adaptive = applyAdaptiveObservation(
      this.progress.adaptive,
      observation,
      observation.timestamp ?? Date.now(),
    );
    this.persist();
  }

  persist() {
    saveProgress(this.progress);
  }

  beginLevel(id, options = {}) {
    const level = this.levels.find((entry) => entry.id === id);
    const mode = options.mode ?? "campaign";
    if (!level || (mode === "campaign" && id > this.progress.unlocked)) return false;
    const saved =
      this.progress.current?.levelId === id && (this.progress.current.mode ?? "campaign") === mode
        ? this.progress.current
        : null;
    const difficulty = Object.hasOwn(DIFFICULTIES, options.difficulty) ? options.difficulty : "defender";
    const observations = this.progress.adaptive.events.filter(
      (event) => event.skillTag === level.skillTag && ["correct", "wrong"].includes(event.outcome),
    );
    const hasEnoughEvidence = observations.length >= 4;
    const mastery = hasEnoughEvidence ? (this.progress.adaptive.masteryScores[level.skillTag] ?? 50) : 50;
    const accuracy = hasEnoughEvidence ? recentAccuracy(this.progress.adaptive.events, level.skillTag) : null;
    const issueDifficulty =
      level.issues.reduce((total, issue) => total + issue.difficulty, 0) / level.issues.length;
    const adaptive = adaptiveControls(mastery, accuracy, issueDifficulty);
    this.state = saved
      ? {
          ...saved,
          difficulty: saved.difficulty ?? difficulty,
          trustMax: saved.trustMax ?? DIFFICULTIES[difficulty].trust,
          hintLimit: saved.hintLimit ?? DIFFICULTIES[difficulty].hints,
          timerSeconds: saved.timerSeconds ?? null,
          variant: saved.variant ?? 0,
          startedAt: saved.startedAt ?? Date.now(),
          sessionId: saved.sessionId ?? `${Date.now()}-${id}`,
        }
      : {
          levelId: id,
          issues: level.issues.map(() => ({ flagged: false, resolved: false })),
          trust: DIFFICULTIES[difficulty].trust + adaptive.extraTrust,
          trustMax: DIFFICULTIES[difficulty].trust + adaptive.extraTrust,
          hints: 0,
          mistakes: 0,
          score: 0,
          selectedIssue: null,
          difficulty,
          hintLimit: DIFFICULTIES[difficulty].hints + adaptive.extraHints,
          mode,
          variant: Number.isInteger(options.variant) ? options.variant : 0,
          startedAt: Date.now(),
          elapsedSeconds: 0,
          sessionId:
            globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`,
          issueSelectedAt: null,
          timerSeconds:
            mode === "timed" || level.timedByDefault
              ? Math.round(
                  (level.timerSeconds ?? 180) *
                    DIFFICULTIES[difficulty].timerMultiplier *
                    adaptiveControls(
                      this.progress.adaptive.masteryScores[level.skillTag] ?? 50,
                      recentAccuracy(this.progress.adaptive.events, level.skillTag),
                      issueDifficulty,
                    ).timerMultiplier,
                )
              : null,
        };
    if (saved && !saved.adaptive) {
      this.state.trustMax += adaptive.extraTrust;
      this.state.trust = Math.min(this.state.trust, this.state.trustMax);
      this.state.hintLimit += adaptive.extraHints;
    }
    this.state.adaptive = adaptive;
    this.progress.current = this.state;
    this.persist();
    return true;
  }

  selectIssue(index) {
    if (!this.state) return { type: "error" };
    if (!Number.isInteger(index) || index < 0 || index >= this.state.issues.length) return { type: "decoy" };
    const issueState = this.state.issues[index];
    if (issueState.resolved) return { type: "resolved" };
    const level = this.levels.find((entry) => entry.id === this.state.levelId);
    if (level.mode === "ordered") {
      const next = this.state.issues.findIndex((issue) => !issue.resolved);
      if (index !== next) {
        this.applyObservation({
          sessionId: this.state.sessionId,
          levelId: this.state.levelId,
          skillTag: level.skillTag,
          issueIndex: index,
          difficulty: level.issues[index].difficulty,
          outcome: "wrong",
          seconds: 0,
          category: level.skillTag,
        });
        this.penalize();
        return { type: this.state.trust === 0 ? "failed" : "order", expected: next };
      }
    }
    issueState.flagged = true;
    this.state.selectedIssue = index;
    this.state.issueSelectedAt = Date.now();
    this.persist();
    return { type: "selected" };
  }

  answer(choiceId) {
    if (!this.state || this.state.selectedIssue === null) return { type: "error" };
    const index = this.state.selectedIssue;
    const level = this.levels.find((entry) => entry.id === this.state.levelId);
    const issue = level.issues[index];
    const seconds = this.state.issueSelectedAt
      ? Math.max(0, (Date.now() - this.state.issueSelectedAt) / 1000)
      : 0;
    const hinted = (this.state.issues[index].hintsUsed ?? 0) > 0;
    if (choiceId === issue.fix) {
      this.applyObservation({
        sessionId: this.state.sessionId,
        levelId: this.state.levelId,
        skillTag: level.skillTag,
        issueIndex: index,
        difficulty: issue.difficulty,
        outcome: "correct",
        hintUsed: hinted,
        seconds,
        category: level.skillTag,
      });
      this.state.issues[index].resolved = true;
      this.state.selectedIssue = null;
      this.state.score += Math.round(100 * DIFFICULTIES[this.state.difficulty].scoreMultiplier);
      for (const term of issue.terms ?? level.glossaryTerms ?? []) {
        if (!this.progress.unlockedTerms.includes(term)) this.progress.unlockedTerms.push(term);
      }
      this.persist();
      if (this.state.issues.every((item) => item.resolved)) return this.completeLevel();
      return { type: "correct", issueIndex: index };
    }
    this.applyObservation({
      sessionId: this.state.sessionId,
      levelId: this.state.levelId,
      skillTag: level.skillTag,
      issueIndex: index,
      difficulty: issue.difficulty,
      outcome: "wrong",
      seconds,
      category: level.skillTag,
    });
    this.penalize();
    if (this.state.trust === 0) return { type: "failed" };
    this.persist();
    return { type: "wrong", issueIndex: index, choiceId };
  }

  useHint() {
    if (!this.state || this.state.hints >= this.state.hintLimit) return { type: "unavailable" };
    const selected = this.state.selectedIssue;
    const level = this.levels.find((entry) => entry.id === this.state.levelId);
    const hintReference = level.hints?.[this.state.hints];
    const index = selected ?? hintReference?.issue ?? this.state.issues.findIndex((issue) => !issue.resolved);
    if (index < 0 || index >= this.state.issues.length) return { type: "unavailable" };
    this.state.hints += 1;
    this.state.issues[index].hintsUsed = (this.state.issues[index].hintsUsed ?? 0) + 1;
    const levelForHint = this.levels.find((entry) => entry.id === this.state.levelId);
    this.applyObservation({
      sessionId: this.state.sessionId,
      levelId: this.state.levelId,
      skillTag: levelForHint.skillTag,
      issueIndex: index,
      difficulty: levelForHint.issues[index].difficulty,
      outcome: "hint",
      seconds: 0,
      category: levelForHint.skillTag,
    });
    this.state.score = Math.max(0, this.state.score - 25);
    this.state.issues[index].flagged = true;
    this.state.selectedIssue = index;
    this.persist();
    return { type: "hint", issueIndex: index, hintNumber: this.state.hints - 1 };
  }

  penalize() {
    if (!this.state) return;
    this.state.trust = Math.max(0, this.state.trust - 1);
    this.state.mistakes += 1;
    this.state.selectedIssue = null;
    this.state.issueSelectedAt = null;
    if (this.state.trust === 0) this.progress.current = null;
    this.persist();
  }

  completeLevel() {
    const stars =
      this.state.mistakes === 0 && this.state.hints === 0
        ? 3
        : this.state.mistakes <= 1 && this.state.hints <= 1
          ? 2
          : 1;
    const id = this.state.levelId;
    const level = this.levels.find((entry) => entry.id === id);
    const sessionEvents = this.progress.adaptive.events.filter(
      (event) => event.sessionId === this.state.sessionId,
    );
    const scoredEvents = sessionEvents.filter((event) => ["correct", "wrong"].includes(event.outcome));
    const sessionReport = {
      sessionId: this.state.sessionId,
      levelId: id,
      skillTag: level.skillTag,
      accuracy: scoredEvents.length
        ? Math.round(
            (scoredEvents.filter((event) => event.outcome === "correct").length / scoredEvents.length) * 100,
          )
        : 0,
      elapsedSeconds: Math.max(0, Math.round((Date.now() - this.state.startedAt) / 1000)),
      hints: this.state.hints,
      mistakes: this.state.mistakes,
      score: this.state.score,
      completedAt: new Date().toISOString(),
    };
    this.progress.adaptive.sessions.push(sessionReport);
    this.progress.adaptive.sessions = this.progress.adaptive.sessions.slice(-200);
    this.progress.sessionHistory.push(sessionReport);
    this.progress.sessionHistory = this.progress.sessionHistory.slice(-200);
    const previous = this.progress.levels[id] ?? { score: 0, stars: 0, hints: 0, xpGranted: false };
    const isFirstClear = !previous.xpGranted;
    const improved = this.state.score > previous.score || stars > previous.stars;
    this.progress.levels[id] = {
      ...previous,
      score: Math.max(previous.score, this.state.score),
      stars: Math.max(previous.stars, stars),
      hints: isFirstClear ? this.state.hints : Math.min(previous.hints ?? this.state.hints, this.state.hints),
    };
    this.progress.unlocked = Math.max(this.progress.unlocked, Math.min(this.levels.length, id + 1));
    if (isFirstClear) {
      this.progress.xp += 60 + stars * 20 + (this.state.difficulty === "expert" ? 20 : 0);
      this.progress.levels[id].xpGranted = true;
    } else if (improved) {
      this.progress.xp += 10;
    }
    this.progress.playerLevel = playerLevelForXp(this.progress.xp);
    this.progress.rank = rankForXp(this.progress.xp);
    if (isFirstClear && SKILL_TAGS.includes(level.skillTag)) {
      this.progress.mastery[level.skillTag] = (this.progress.mastery[level.skillTag] ?? 0) + 1;
    }
    this.updateAchievements(level, stars, isFirstClear);
    if (id === this.levels.length) this.progress.finished = true;
    this.progress.current = null;
    this.persist();
    return {
      type: id === this.levels.length ? "academyComplete" : "levelComplete",
      levelId: id,
      stars,
      score: this.state.score,
      xp: this.progress.xp,
    };
  }

  updateAchievements(level, stars, isFirstClear) {
    const award = (id) => {
      if (!this.progress.achievements.includes(id)) this.progress.achievements.push(id);
    };
    if (stars === 3) award("perfect-level");
    if (level.id % 5 === 0) award("boss-slayer");
    if (level.id === 9 || [21, 22, 23, 24].includes(level.id)) award("code-reviewer");
    if (level.id === 2) award("phishing-expert");
    if (level.id === 30) award("full-campaign");
    const chapter = level.chapter ?? Math.ceil(level.id / 5);
    const chapterStart = (chapter - 1) * 5 + 1;
    const chapterLevelIds = Array.from({ length: 5 }, (_, index) => chapterStart + index);
    if (
      chapterLevelIds.every((id) => this.progress.levels[id]) &&
      chapterLevelIds.every((id) => (this.progress.levels[id].hints ?? 0) === 0)
    ) {
      award("no-hints-chapter");
    }
    if (isFirstClear) this.updateStreak();
  }

  updateStreak(date = new Date()) {
    const today = date.toISOString().slice(0, 10);
    const lastDate = this.progress.streak.lastDate;
    if (lastDate === today) return;
    const yesterday = new Date(date.getTime() - 86400000).toISOString().slice(0, 10);
    this.progress.streak.count = lastDate === yesterday ? this.progress.streak.count + 1 : 1;
    this.progress.streak.lastDate = today;
    if (this.progress.streak.count >= 7 && !this.progress.achievements.includes("seven-day-streak")) {
      this.progress.achievements.push("seven-day-streak");
    }
  }

  getDailyChallenge(date = new Date()) {
    return dailyChallengeForDate(date, this.progress.unlocked, this.levels.length);
  }

  abandonCurrent() {
    this.progress.current = null;
    this.state = null;
    this.persist();
  }

  getTotalScore() {
    return Object.values(this.progress.levels).reduce((sum, level) => sum + level.score, 0);
  }

  setName(name) {
    this.progress.name = name.slice(0, 48);
    this.persist();
  }
}
