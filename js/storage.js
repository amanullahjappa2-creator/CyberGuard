import { normalizeAdaptiveState } from "./adaptive.js";

const STORAGE_KEY = "cyberguard-progress-v1";
const MAX_IMPORT_SIZE = 1024 * 1024;
const MAX_LEVELS = 30;

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function loadProgress() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return null;
    const progress = JSON.parse(raw);
    if (
      !progress ||
      typeof progress !== "object" ||
      !progress.levels ||
      typeof progress.levels !== "object"
    ) {
      throw new Error("Saved progress has an unexpected format.");
    }
    return progress;
  } catch (error) {
    console.error("Could not load CyberGuard progress.", error);
    throw new Error("Saved progress could not be read. Clear this site's saved data to start again.", {
      cause: error,
    });
  }
}

export function saveProgress(progress) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error("Could not save CyberGuard progress.", error);
    throw new Error("Progress could not be saved in this browser.", { cause: error });
  }
}

export function clearProgress() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (error) {
    console.error("Could not clear CyberGuard progress.", error);
    throw new Error("Saved progress could not be cleared.", { cause: error });
  }
}

export function exportProgress(progress) {
  return JSON.stringify({ ...progress, schemaVersion: 2 }, null, 2);
}

export function parseProgressImport(raw) {
  if (typeof raw !== "string" || raw.length > MAX_IMPORT_SIZE) {
    throw new Error("Progress file is too large or unreadable.");
  }
  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (error) {
    throw new Error("Progress file is not valid JSON.", { cause: error });
  }
  if (
    !isPlainObject(parsed) ||
    (parsed.schemaVersion !== undefined && ![1, 2].includes(parsed.schemaVersion)) ||
    !Number.isInteger(parsed.unlocked) ||
    parsed.unlocked < 1 ||
    parsed.unlocked > MAX_LEVELS ||
    !isPlainObject(parsed.levels)
  ) {
    throw new Error("Progress file has an unsupported structure.");
  }
  const levels = {};
  for (const [id, record] of Object.entries(parsed.levels)) {
    if (
      !/^(?:[1-9]|[12]\d|30)$/.test(id) ||
      Number(id) > parsed.unlocked ||
      !isPlainObject(record) ||
      !Number.isFinite(record.score) ||
      record.score < 0 ||
      record.score > 10000000 ||
      !Number.isInteger(record.stars) ||
      record.stars < 0 ||
      record.stars > 3
    ) {
      throw new Error("Progress file contains an invalid level record.");
    }
    levels[id] = {
      score: record.score,
      stars: record.stars,
      hints: Number.isInteger(record.hints) && record.hints >= 0 ? record.hints : 0,
      xpGranted: record.xpGranted === true,
    };
  }
  const xp = parsed.xp === undefined ? 0 : parsed.xp;
  if (!Number.isFinite(xp) || xp < 0 || xp > 10000000) {
    throw new Error("Progress file contains invalid experience.");
  }
  return {
    schemaVersion: 2,
    unlocked: parsed.unlocked,
    levels,
    finished: parsed.finished === true && parsed.unlocked === MAX_LEVELS,
    current: null,
    name: typeof parsed.name === "string" ? parsed.name.slice(0, 48) : "",
    adaptive: normalizeAdaptiveState(parsed.adaptive),
    sessionHistory: normalizeAdaptiveState({ sessions: parsed.sessionHistory }).sessions,
    xp,
    achievements: Array.isArray(parsed.achievements)
      ? [
          ...new Set(parsed.achievements.filter((item) => typeof item === "string" && item.length <= 64)),
        ].slice(0, 100)
      : [],
    mastery: isPlainObject(parsed.mastery) ? parsed.mastery : {},
    unlockedTerms: Array.isArray(parsed.unlockedTerms)
      ? [
          ...new Set(parsed.unlockedTerms.filter((item) => typeof item === "string" && item.length <= 80)),
        ].slice(0, 200)
      : [],
    streak: isPlainObject(parsed.streak) ? parsed.streak : { count: 0, lastDate: null },
    certificateId: typeof parsed.certificateId === "string" ? parsed.certificateId.slice(0, 80) : null,
  };
}

function mergeUniqueRecords(records, keyForRecord, limit, compare) {
  const merged = new Map();
  for (const record of records) {
    for (const item of record) {
      const key = keyForRecord(item);
      const existing = merged.get(key);
      if (!existing || compare(item, existing) > 0) merged.set(key, item);
    }
  }
  return [...merged.values()].sort(compare).slice(-limit);
}

export function mergeProgressSnapshots(local, remote) {
  if (!local && !remote) throw new Error("At least one progress snapshot is required.");
  const localProgress = parseProgressImport(JSON.stringify(local ?? remote));
  const remoteProgress = parseProgressImport(JSON.stringify(remote ?? local));
  const levelIds = new Set([...Object.keys(localProgress.levels), ...Object.keys(remoteProgress.levels)]);
  const levels = Object.fromEntries(
    [...levelIds].map((id) => {
      const localLevel = localProgress.levels[id];
      const remoteLevel = remoteProgress.levels[id];
      if (!localLevel) return [id, remoteLevel];
      if (!remoteLevel) return [id, localLevel];
      return [
        id,
        {
          score: Math.max(localLevel.score, remoteLevel.score),
          stars: Math.max(localLevel.stars, remoteLevel.stars),
          hints: Math.min(localLevel.hints, remoteLevel.hints),
          xpGranted: localLevel.xpGranted || remoteLevel.xpGranted,
        },
      ];
    }),
  );
  const events = mergeUniqueRecords(
    [localProgress.adaptive.events, remoteProgress.adaptive.events],
    (event) => JSON.stringify(event),
    2000,
    (left, right) => left.timestamp - right.timestamp,
  );
  const mergeSessions = (left, right) =>
    mergeUniqueRecords(
      [left, right],
      (session) => session.sessionId || JSON.stringify(session),
      200,
      (first, second) =>
        first.completedAt.localeCompare(second.completedAt) ||
        first.score - second.score ||
        first.accuracy - second.accuracy,
    );
  const masteryScores = {};
  for (const skill of Object.keys(localProgress.adaptive.masteryScores)) {
    const latestObservation = events.filter((event) => event.skillTag === skill).at(-1);
    masteryScores[skill] =
      latestObservation?.masteryAfter ??
      Math.max(localProgress.adaptive.masteryScores[skill], remoteProgress.adaptive.masteryScores[skill]);
  }
  const localStreak = localProgress.streak;
  const remoteStreak = remoteProgress.streak;
  const streak =
    (remoteStreak.lastDate ?? "") > (localStreak.lastDate ?? "") ||
    (remoteStreak.lastDate === localStreak.lastDate && remoteStreak.count > localStreak.count)
      ? remoteStreak
      : localStreak;
  const merged = parseProgressImport(
    JSON.stringify({
      schemaVersion: 2,
      unlocked: Math.max(localProgress.unlocked, remoteProgress.unlocked),
      levels,
      finished: localProgress.finished || remoteProgress.finished,
      xp: Math.max(localProgress.xp, remoteProgress.xp),
      achievements: [...localProgress.achievements, ...remoteProgress.achievements],
      mastery: Object.fromEntries(
        Object.keys(localProgress.mastery).map((skill) => [
          skill,
          Math.max(localProgress.mastery[skill], remoteProgress.mastery[skill]),
        ]),
      ),
      adaptive: {
        masteryScores,
        events,
        sessions: mergeSessions(localProgress.adaptive.sessions, remoteProgress.adaptive.sessions),
      },
      sessionHistory: mergeSessions(localProgress.sessionHistory, remoteProgress.sessionHistory),
      unlockedTerms: [...localProgress.unlockedTerms, ...remoteProgress.unlockedTerms],
      streak,
      certificateId: localProgress.certificateId ?? remoteProgress.certificateId,
    }),
  );
  merged.name = local?.name ?? remote?.name ?? "";
  merged.current = local?.current ?? null;
  return merged;
}

export function importProgress(raw) {
  const progress = parseProgressImport(raw);
  saveProgress(progress);
  return progress;
}
