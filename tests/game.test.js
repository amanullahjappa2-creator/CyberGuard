import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  dailyChallengeForDate,
  GameEngine,
  playerLevelForXp,
  rankForXp,
  validateLevel,
} from "../js/engine.js";
import { exportProgress, importProgress, parseProgressImport } from "../js/storage.js";

const file = (path) => readFile(new URL(path, import.meta.url), "utf8").then(JSON.parse);
const locales = {
  en: await file("../lang/en.json"),
  ur: await file("../lang/ur.json"),
};
const levels = await Promise.all(
  Array.from({ length: 30 }, (_, index) => file(`../levels/level${String(index + 1).padStart(2, "0")}.json`)),
);

function installMemoryStorage() {
  const data = new Map();
  globalThis.localStorage = {
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => data.set(key, String(value)),
    removeItem: (key) => data.delete(key),
  };
}

test("all thirty levels have complete fixes, explanations and translations", () => {
  assert.equal(levels.length, 30);
  levels.forEach((level, index) => {
    assert.equal(level.id, index + 1);
    assert.equal(level.chapter, Math.ceil(level.id / 5));
    level.issues.forEach((issue) => assert.ok(issue.difficulty >= 1 && issue.difficulty <= 5));
    assert.deepEqual(validateLevel(level, locales), []);
  });
});

test("migrated levels define chapter metadata, two hints and alternatives", () => {
  levels.forEach((level) => {
    assert.ok(level.chapter >= 1 && level.chapter <= 6);
    assert.equal(level.hints.length, 2);
    level.issues.forEach((issue) => assert.equal(issue.wrongFixes.length, 2));
  });
});

test("level data rejects a missing fix explanation and translated issue", () => {
  const level = structuredClone(levels[0]);
  const translated = structuredClone(locales);
  delete level.issues[0].fix;
  delete level.issues[0].difficulty;
  delete translated.ur.levels[0].issues[0].why;
  assert.ok(validateLevel(level, translated).some((error) => error.includes("missing or invalid fix")));
  assert.ok(validateLevel(level, translated).some((error) => error.includes("difficulty must be")));
  assert.ok(validateLevel(level, translated).some((error) => error.includes("missing a translation")));
});

test("wrong fixes reduce trust and a correct fix adds score", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  assert.equal(game.beginLevel(1), true);
  assert.equal(game.beginLevel(2), false);
  game.selectIssue(0);
  const wrongChoice = levels[0].choices.find((choice) => choice !== levels[0].issues[0].fix);
  assert.equal(game.answer(wrongChoice).type, "wrong");
  assert.equal(game.state.trust, 2);
  game.selectIssue(0);
  assert.equal(game.answer(levels[0].issues[0].fix).type, "correct");
  assert.equal(game.state.score, 100);
});

test("hints are limited and lower the score", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.beginLevel(1);
  game.state.score = 80;
  assert.equal(game.useHint().type, "hint");
  assert.equal(game.state.score, 55);
  assert.equal(game.useHint().type, "hint");
  assert.equal(game.state.hints, 2);
  assert.equal(game.useHint().type, "unavailable");
});

test("completing a level unlocks the next level and stores progress", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.beginLevel(1);
  for (let index = 0; index < levels[0].issues.length; index += 1) {
    game.selectIssue(index);
    const result = game.answer(levels[0].issues[index].fix);
    if (index < levels[0].issues.length - 1) assert.equal(result.type, "correct");
    else assert.equal(result.type, "levelComplete");
  }
  assert.equal(game.progress.unlocked, 2);
  assert.equal(game.progress.levels[1].stars, 3);
  assert.equal(game.getTotalScore(), 400);
});

test("incident response steps must be completed in order", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.progress.unlocked = 10;
  game.beginLevel(10);
  assert.equal(game.selectIssue(1).type, "order");
  assert.equal(game.state.trust, 2);
  assert.equal(game.selectIssue(0).type, "selected");
  assert.equal(game.answer("identify").type, "correct");
  assert.equal(game.selectIssue(1).type, "selected");
});

test("a failed attempt is not resumed and can be retried from a fresh state", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.beginLevel(1);
  const wrongChoice = levels[0].choices.find((choice) => choice !== levels[0].issues[0].fix);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    game.selectIssue(0);
    const result = game.answer(wrongChoice);
    assert.equal(result.type, attempt === 2 ? "failed" : "wrong");
  }
  assert.equal(game.progress.current, null);
  assert.equal(game.state.trust, 0);
  game.abandonCurrent();
  game.beginLevel(1);
  assert.equal(game.state.trust, 3);
  assert.equal(game.state.issues[0].resolved, false);
});

test("the correct response path completes all thirty levels and unlocks the certificate", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  for (const level of levels) {
    assert.equal(game.beginLevel(level.id), true);
    for (let index = 0; index < level.issues.length; index += 1) {
      assert.equal(game.selectIssue(index).type, "selected");
      const result = game.answer(level.issues[index].fix);
      if (index < level.issues.length - 1) assert.equal(result.type, "correct");
      else assert.equal(result.type, level.id === 30 ? "gameComplete" : "levelComplete");
    }
  }
  assert.equal(game.progress.finished, true);
  assert.equal(game.progress.unlocked, 30);
  assert.equal(
    game.getTotalScore(),
    levels.reduce((score, level) => score + level.issues.length * 100, 0),
  );
});

test("difficulty adjusts trust, hints and awarded score", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.beginLevel(1, { difficulty: "expert" });
  assert.equal(game.state.trust, 2);
  assert.equal(game.state.hintLimit, 1);
  for (let index = 0; index < levels[0].issues.length; index += 1) {
    game.selectIssue(index);
    game.answer(levels[0].issues[index].fix);
  }
  assert.equal(game.progress.levels[1].score, 500);
  assert.equal(game.progress.xp, 140);
  assert.equal(game.progress.mastery.passwords, 1);
  assert.ok(game.progress.achievements.includes("perfect-level"));
});

test("the final boss timer starts in campaign mode", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.progress.unlocked = 30;
  assert.equal(game.beginLevel(30, { difficulty: "learner" }), true);
  assert.equal(game.state.timerSeconds, 360);
  game.abandonCurrent();
  assert.equal(game.beginLevel(30, { difficulty: "expert" }), true);
  assert.equal(game.state.timerSeconds, 180);
});

test("the final boss is a six-step triage and response queue", () => {
  const boss = levels.at(-1);
  assert.equal(boss.type, "alerts");
  assert.equal(boss.issues.length, 6);
  assert.equal(boss.timerSeconds, 240);
  assert.deepEqual(
    boss.issues.map((issue) => issue.fix),
    ["c0", "c1", "c2", "c3", "c4", "c5"],
  );
});

test("daily challenge is deterministic for the date and stays within unlocked levels", () => {
  const first = dailyChallengeForDate("2026-11-02", 7);
  assert.deepEqual(first, dailyChallengeForDate("2026-11-02", 7));
  assert.notDeepEqual(first, dailyChallengeForDate("2026-11-03", 7));
  assert.ok(first.levelId >= 1 && first.levelId <= 7);
  assert.ok(first.variant >= 0 && first.variant < 3);
});

test("starting a different game mode does not resume a stale campaign attempt", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.beginLevel(1);
  game.state.score = 90;
  assert.equal(game.beginLevel(1, { mode: "daily", variant: 2 }), true);
  assert.equal(game.state.score, 0);
  assert.equal(game.state.mode, "daily");
  assert.equal(game.state.variant, 2);
});

test("XP thresholds map to player levels and ranks", () => {
  assert.equal(playerLevelForXp(0), 1);
  assert.equal(playerLevelForXp(250), 2);
  assert.equal(rankForXp(0), "Recruit");
  assert.equal(rankForXp(800), "Defender");
  assert.equal(rankForXp(3500), "Architect");
});

test("progress export/import round-trips valid data and rejects tampering", () => {
  installMemoryStorage();
  const game = new GameEngine(levels, locales);
  game.progress.unlocked = 3;
  game.progress.levels[1] = { score: 400, stars: 3, hints: 0, xpGranted: true };
  game.progress.xp = 120;
  const exported = exportProgress(game.progress);
  const imported = parseProgressImport(exported);
  assert.equal(imported.unlocked, 3);
  assert.equal(imported.levels[1].score, 400);
  assert.equal(imported.current, null);
  assert.equal(imported.finished, false);
  importProgress(exported);
  assert.equal(JSON.parse(localStorage.getItem("cyberguard-progress-v1")).xp, 120);
  assert.throws(() => parseProgressImport('{"unlocked":31,"levels":{}}'));
  assert.throws(() => parseProgressImport('{"unlocked":2,"levels":{"1":{"score":1,"stars":9}}}'));
});

test("finished campaign status survives a validated progress export and import", () => {
  const progress = {
    schemaVersion: 2,
    unlocked: 30,
    levels: {},
    finished: true,
  };
  assert.equal(parseProgressImport(exportProgress(progress)).finished, true);
});
