import test from "node:test";
import assert from "node:assert/strict";
import { createScorePayload } from "../js/scoreboard.js";

test("scoreboard payload contains only opted-in nickname and aggregate learning data", () => {
  const progress = {
    levels: { 1: { score: 400 }, 2: { score: 300 } },
    adaptive: {
      masteryScores: { passwords: 70 },
      events: [{ sessionId: "private-session", outcome: "wrong", skillTag: "passwords" }],
      sessions: [{ levelId: 1, accuracy: 80, elapsedSeconds: 30, hints: 1, mistakes: 1 }],
    },
  };
  const payload = createScorePayload(progress, "Learner_01", "ABC234");
  assert.equal(payload.privacyConsent, true);
  assert.equal(payload.nickname, "Learner_01");
  assert.equal(payload.classCode, "ABC234");
  assert.equal(payload.score, 700);
  assert.deepEqual(payload.completedLevels, [1, 2]);
  assert.equal(payload.skillStats.passwords, 0);
  assert.equal(payload.levelStats[0].levelId, 1);
  assert.equal("events" in payload, false);
  assert.equal(JSON.stringify(payload).includes("private-session"), false);
});
