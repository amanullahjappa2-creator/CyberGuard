import test from "node:test";
import assert from "node:assert/strict";
import {
  adaptiveControls,
  applyAdaptiveObservation,
  buildPerformanceReport,
  chooseRecommendation,
  createAdaptiveState,
  masterySignal,
  recentAccuracy,
  updateMasteryScore,
} from "../js/adaptive.js";

test("mastery updates use issue difficulty, result, hint use and response time deterministically", () => {
  assert.equal(masterySignal({ outcome: "correct", seconds: 5, difficulty: 1 }), 100);
  assert.equal(masterySignal({ outcome: "correct", seconds: 40, difficulty: 1 }), 90);
  assert.equal(masterySignal({ outcome: "correct", hintUsed: true, seconds: 25, difficulty: 1 }), 68);
  assert.equal(masterySignal({ outcome: "wrong", difficulty: 5 }), 0);
  assert.equal(masterySignal({ outcome: "hint", difficulty: 3 }), 55);
  assert.ok(updateMasteryScore(50, { outcome: "correct", difficulty: 5 }) > 50);
  assert.ok(updateMasteryScore(50, { outcome: "wrong", difficulty: 5 }) < 50);
});

test("adaptive observations retain explanations and cap event history", () => {
  let state = createAdaptiveState();
  state = applyAdaptiveObservation(
    state,
    {
      sessionId: "session-a",
      levelId: 1,
      skillTag: "passwords",
      issueIndex: 0,
      difficulty: 3,
      outcome: "wrong",
      seconds: 4,
      category: "passwords",
    },
    123,
  );
  assert.equal(state.events[0].timestamp, 123);
  assert.equal(state.events[0].masteryBefore, 50);
  assert.ok(state.events[0].masteryAfter < 50);
  assert.throws(() => applyAdaptiveObservation(state, { skillTag: "invalid", outcome: "correct" }));
});

test("recommendation deterministically chooses the weakest available skill", () => {
  const catalog = [
    { id: 1, skillTag: "passwords", title: { en: "Passwords" } },
    { id: 2, skillTag: "phishing", title: { en: "Phishing" } },
    { id: 3, skillTag: "phishing", title: { en: "Email" } },
  ];
  const recommendation = chooseRecommendation(catalog, {
    unlocked: 3,
    levels: { 1: { score: 400 } },
    adaptive: {
      masteryScores: { passwords: 80, phishing: 25 },
      events: [
        { skillTag: "phishing", outcome: "wrong" },
        { skillTag: "phishing", outcome: "correct" },
      ],
    },
  });
  assert.equal(recommendation.id, 2);
  assert.equal(recommendation.mastery, 25);
  assert.equal(recommendation.accuracy, 50);
});

test("recommendation combines mastery with recent accuracy", () => {
  const recommendation = chooseRecommendation(
    [
      { id: 1, skillTag: "passwords" },
      { id: 2, skillTag: "phishing" },
    ],
    {
      unlocked: 2,
      levels: {},
      adaptive: {
        masteryScores: { passwords: 80, phishing: 40 },
        events: [
          { skillTag: "passwords", outcome: "wrong" },
          { skillTag: "passwords", outcome: "wrong" },
          { skillTag: "phishing", outcome: "correct" },
        ],
      },
    },
  );
  assert.equal(recommendation.id, 1);
  assert.equal(recommendation.accuracy, 0);
});

test("adaptive controls add support for weak mastery and challenge mastered skills", () => {
  assert.deepEqual(adaptiveControls(30, 40), {
    extraTrust: 1,
    extraHints: 1,
    distractors: 1,
    timerMultiplier: 1.25,
    issueDifficulty: 1,
  });
  assert.equal(adaptiveControls(60, 60, 4).extraHints, 1);
  assert.equal(adaptiveControls(60, 60, 4).timerMultiplier, 1.1);
  assert.equal(adaptiveControls(90, 90).distractors, 2);
  assert.equal(adaptiveControls(90, 90).timerMultiplier, 0.85);
});

test("performance report summarizes accuracy, mistakes, hints and recent sessions", () => {
  const adaptive = createAdaptiveState();
  adaptive.events = [
    { skillTag: "web", outcome: "correct", seconds: 20 },
    { skillTag: "web", outcome: "wrong", seconds: 10 },
    { skillTag: "web", outcome: "hint", seconds: 0 },
  ];
  adaptive.sessions = [
    { sessionId: "s1", levelId: 21, accuracy: 80, elapsedSeconds: 60, hints: 1, mistakes: 1 },
    { sessionId: "s2", levelId: 22, accuracy: 100, elapsedSeconds: 40, hints: 0, mistakes: 0 },
  ];
  const report = buildPerformanceReport({ levels: { 21: { score: 300 } }, adaptive });
  assert.equal(report.skillStats.web.accuracy, 50);
  assert.equal(report.skillStats.web.mistakes, 1);
  assert.equal(report.totalHints, 1);
  assert.equal(report.improvement.change, 20);
  assert.equal(report.levels[0].averageSeconds, 60);
  assert.equal(report.levels[0].accuracy, 80);
  assert.equal(recentAccuracy(adaptive.events, "web"), 50);
});
