export const SKILL_TAGS = [
  "passwords",
  "phishing",
  "social-engineering",
  "network",
  "web",
  "cloud",
  "response",
];

export const INITIAL_MASTERY = 50;
export const MIN_MASTERY_ANSWERS = 4;
export const MAX_ADAPTIVE_EVENTS = 2000;

export function createAdaptiveState() {
  return {
    masteryScores: Object.fromEntries(SKILL_TAGS.map((skill) => [skill, INITIAL_MASTERY])),
    events: [],
    sessions: [],
  };
}

export function normalizeAdaptiveState(value) {
  const defaults = createAdaptiveState();
  const masteryScores = { ...defaults.masteryScores };
  for (const skillTag of SKILL_TAGS) {
    const score = value?.masteryScores?.[skillTag];
    if (Number.isFinite(score)) masteryScores[skillTag] = clamp(score, 0, 100);
  }
  const events = (Array.isArray(value?.events) ? value.events : [])
    .filter(
      (event) =>
        SKILL_TAGS.includes(event.skillTag) &&
        ["correct", "wrong", "hint"].includes(event.outcome) &&
        Number.isInteger(event.levelId) &&
        event.levelId >= 1 &&
        event.levelId <= 30 &&
        Number.isInteger(event.difficulty) &&
        event.difficulty >= 1 &&
        event.difficulty <= 5,
    )
    .slice(-MAX_ADAPTIVE_EVENTS)
    .map((event) => ({
      sessionId: typeof event.sessionId === "string" ? event.sessionId.slice(0, 100) : "",
      levelId: event.levelId,
      skillTag: event.skillTag,
      issueIndex: Number.isInteger(event.issueIndex) ? Math.max(0, Math.min(5, event.issueIndex)) : 0,
      difficulty: event.difficulty,
      outcome: event.outcome,
      hintUsed: event.hintUsed === true,
      seconds: Number.isFinite(event.seconds) ? clamp(event.seconds, 0, 3600) : 0,
      category: event.skillTag,
      timestamp: Number.isFinite(event.timestamp) ? event.timestamp : 0,
      masteryBefore: Number.isFinite(event.masteryBefore) ? clamp(event.masteryBefore, 0, 100) : 50,
      masteryAfter: Number.isFinite(event.masteryAfter) ? clamp(event.masteryAfter, 0, 100) : 50,
    }));
  const sessions = (Array.isArray(value?.sessions) ? value.sessions : [])
    .filter(
      (session) =>
        Number.isInteger(session.levelId) &&
        session.levelId >= 1 &&
        session.levelId <= 30 &&
        SKILL_TAGS.includes(session.skillTag) &&
        Number.isFinite(session.accuracy) &&
        session.accuracy >= 0 &&
        session.accuracy <= 100,
    )
    .slice(-200)
    .map((session) => ({
      sessionId: typeof session.sessionId === "string" ? session.sessionId.slice(0, 100) : "",
      levelId: session.levelId,
      skillTag: session.skillTag,
      accuracy: Math.round(session.accuracy),
      elapsedSeconds: Number.isFinite(session.elapsedSeconds) ? clamp(session.elapsedSeconds, 0, 86400) : 0,
      hints: Number.isInteger(session.hints) ? clamp(session.hints, 0, 100) : 0,
      mistakes: Number.isInteger(session.mistakes) ? clamp(session.mistakes, 0, 100) : 0,
      score: Number.isFinite(session.score) ? clamp(session.score, 0, 100000) : 0,
      completedAt: typeof session.completedAt === "string" ? session.completedAt.slice(0, 40) : "",
    }));
  return { masteryScores, events, sessions };
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, value));
}

function expectedSeconds(difficulty) {
  return 20 + (clamp(Number(difficulty) || 1, 1, 5) - 1) * 15;
}

export function masterySignal({ outcome, hintUsed = false, seconds = null, difficulty = 1 }) {
  const base = outcome === "correct" ? (hintUsed ? 70 : 100) : outcome === "hint" ? 55 : 0;
  if (outcome !== "correct" || !Number.isFinite(seconds)) return base;
  const expected = expectedSeconds(difficulty);
  const timeAdjustment = clamp(((expected - Math.max(0, seconds)) / expected) * 10, -10, 10);
  return clamp(Math.round(base + timeAdjustment), 0, 100);
}

export function updateMasteryScore(current, observation) {
  const score = clamp(Number.isFinite(current) ? current : INITIAL_MASTERY, 0, 100);
  const issueDifficulty = clamp(Number(observation.difficulty) || 1, 1, 5);
  const learningRate = 0.18 + issueDifficulty * 0.04;
  const signal = masterySignal(observation);
  return Math.round(clamp(score + learningRate * (signal - score), 0, 100));
}

export function applyAdaptiveObservation(adaptive, observation, timestamp = Date.now()) {
  if (!SKILL_TAGS.includes(observation.skillTag)) {
    throw new Error(`Unknown skill tag: ${observation.skillTag}`);
  }
  if (!["correct", "wrong", "hint"].includes(observation.outcome)) {
    throw new Error(`Unknown adaptive outcome: ${observation.outcome}`);
  }
  const state = {
    ...createAdaptiveState(),
    ...adaptive,
    masteryScores: {
      ...createAdaptiveState().masteryScores,
      ...(adaptive?.masteryScores ?? {}),
    },
    events: Array.isArray(adaptive?.events) ? [...adaptive.events] : [],
    sessions: Array.isArray(adaptive?.sessions) ? [...adaptive.sessions] : [],
  };
  const before = state.masteryScores[observation.skillTag];
  const after = updateMasteryScore(before, observation);
  state.masteryScores[observation.skillTag] = after;
  state.events.push({
    ...observation,
    timestamp,
    masteryBefore: before,
    masteryAfter: after,
  });
  if (state.events.length > MAX_ADAPTIVE_EVENTS) {
    state.events.splice(0, state.events.length - MAX_ADAPTIVE_EVENTS);
  }
  return state;
}

export function recentAccuracy(events, skillTag, limit = 10) {
  const relevant = events
    .filter((event) => event.skillTag === skillTag && ["correct", "wrong"].includes(event.outcome))
    .slice(-limit);
  if (!relevant.length) return null;
  return Math.round((relevant.filter((event) => event.outcome === "correct").length / relevant.length) * 100);
}

export function chooseRecommendation(catalog, progress) {
  const unlocked = Math.max(1, Math.min(catalog.length, progress.unlocked ?? 1));
  const completed = progress.levels ?? {};
  const candidates = catalog.filter((level) => level.id <= unlocked && !completed[level.id]);
  if (!candidates.length) return null;
  const mastery = progress.adaptive?.masteryScores ?? {};
  const rankedSkills = [...new Set(candidates.map((level) => level.skillTag))]
    .filter((skillTag) => SKILL_TAGS.includes(skillTag))
    .map((skillTag) => {
      const score = Math.round(mastery[skillTag] ?? INITIAL_MASTERY);
      const accuracy = recentAccuracy(progress.adaptive?.events ?? [], skillTag);
      return {
        skillTag,
        mastery: score,
        accuracy,
        needScore: accuracy === null ? score : (score + accuracy) / 2,
      };
    })
    .sort(
      (left, right) =>
        left.needScore - right.needScore ||
        left.mastery - right.mastery ||
        SKILL_TAGS.indexOf(left.skillTag) - SKILL_TAGS.indexOf(right.skillTag),
    );
  const weakest = rankedSkills[0];
  const skillTag = weakest?.skillTag ?? candidates[0].skillTag;
  const level = candidates.find((candidate) => candidate.skillTag === skillTag) ?? candidates[0];
  return {
    ...level,
    mastery: weakest?.mastery ?? Math.round(mastery[skillTag] ?? INITIAL_MASTERY),
    accuracy: weakest?.accuracy ?? null,
    skillTag,
  };
}

export function adaptiveControls(mastery, accuracy, issueDifficulty = 1) {
  const difficulty = clamp(Number(issueDifficulty) || 1, 1, 5);
  const needsSupport = mastery < 45 || (accuracy !== null && accuracy < 45);
  const mastered = mastery >= 85 && accuracy !== null && accuracy >= 80;
  const difficultMission = difficulty >= 4;
  return {
    extraTrust: needsSupport ? 1 : 0,
    extraHints: needsSupport || difficultMission ? 1 : 0,
    distractors: needsSupport || difficultMission ? 1 : 2,
    timerMultiplier: needsSupport ? 1.25 : difficultMission ? 1.1 : mastered ? 0.85 : 1,
    issueDifficulty: difficulty,
  };
}

export function buildPerformanceReport(progress) {
  const adaptive = progress.adaptive ?? createAdaptiveState();
  const skillStats = Object.fromEntries(
    SKILL_TAGS.map((skillTag) => {
      const events = adaptive.events.filter((event) => event.skillTag === skillTag);
      const scored = events.filter((event) => ["correct", "wrong"].includes(event.outcome));
      const incorrect = scored.filter((event) => event.outcome === "wrong").length;
      const hasMasteryBaseline = scored.length >= MIN_MASTERY_ANSWERS;
      return [
        skillTag,
        {
          mastery: hasMasteryBaseline
            ? Math.round(adaptive.masteryScores?.[skillTag] ?? INITIAL_MASTERY)
            : null,
          masteryStatus:
            scored.length === 0
              ? events.length
                ? "needs-answers"
                : "not-attempted"
              : hasMasteryBaseline
                ? "measured"
                : "building",
          answersToBaseline: Math.max(0, MIN_MASTERY_ANSWERS - scored.length),
          accuracy: scored.length ? Math.round(((scored.length - incorrect) / scored.length) * 100) : null,
          attempts: scored.length,
          mistakes: incorrect,
          hints: events.filter((event) => event.outcome === "hint").length,
          averageSeconds: scored.length
            ? Math.round(scored.reduce((sum, event) => sum + (event.seconds ?? 0), 0) / scored.length)
            : null,
        },
      ];
    }),
  );
  const byLevel = {};
  for (const session of adaptive.sessions) {
    const record = (byLevel[session.levelId] ??= {
      levelId: session.levelId,
      sessions: 0,
      totalSeconds: 0,
      totalAccuracy: 0,
      hints: 0,
      mistakes: 0,
    });
    record.sessions += 1;
    record.totalSeconds += session.elapsedSeconds;
    record.totalAccuracy += session.accuracy;
    record.hints += session.hints;
    record.mistakes += session.mistakes;
  }
  const sessions = adaptive.sessions.slice(-7);
  const firstHalf = sessions.slice(0, Math.ceil(sessions.length / 2));
  const secondHalf = sessions.slice(Math.ceil(sessions.length / 2));
  const averageAccuracy = (items) =>
    items.length
      ? Math.round(items.reduce((sum, session) => sum + session.accuracy, 0) / items.length)
      : null;
  return {
    generatedAt: new Date().toISOString(),
    totalScore: Object.values(progress.levels ?? {}).reduce((sum, level) => sum + (level.score ?? 0), 0),
    sessions,
    improvement: {
      firstAccuracy: averageAccuracy(firstHalf),
      recentAccuracy: averageAccuracy(secondHalf),
      change:
        averageAccuracy(firstHalf) === null || averageAccuracy(secondHalf) === null
          ? null
          : averageAccuracy(secondHalf) - averageAccuracy(firstHalf),
    },
    skillStats,
    levels: Object.values(byLevel).map((level) => ({
      ...level,
      averageSeconds: Math.round(level.totalSeconds / level.sessions),
      accuracy: Math.round(level.totalAccuracy / level.sessions),
    })),
    totalHints: adaptive.events.filter((event) => event.outcome === "hint").length,
    mistakesByCategory: Object.fromEntries(
      SKILL_TAGS.map((skillTag) => [skillTag, skillStats[skillTag].mistakes]),
    ),
  };
}
