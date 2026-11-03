import { buildPerformanceReport } from "./adaptive.js";

async function requestJson(path, options = {}) {
  const response = await fetch(path, {
    credentials: "same-origin",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The scoreboard returned an unreadable response.", { cause: error });
  }
  if (!response.ok) throw new Error(result.error ?? `Scoreboard request failed (${response.status}).`);
  return result;
}

async function csrfHeaders() {
  const result = await requestJson("/api/csrf");
  return { "X-CSRF-Token": result.token };
}

export function createScorePayload(progress, nickname, classCode = "") {
  const report = buildPerformanceReport(progress);
  return {
    privacyConsent: true,
    nickname,
    classCode: classCode || null,
    score: report.totalScore,
    completedLevels: Object.keys(progress.levels ?? {}).map(Number),
    skillStats: Object.fromEntries(
      Object.entries(report.skillStats).map(([skillTag, stats]) => [skillTag, stats.accuracy]),
    ),
    levelStats: report.levels.map(({ levelId, accuracy }) => ({ levelId, accuracy })),
  };
}

export async function submitScore(progress, nickname, classCode = "") {
  return requestJson("/api/score", {
    method: "POST",
    headers: await csrfHeaders(),
    body: JSON.stringify(createScorePayload(progress, nickname, classCode)),
  });
}

export async function fetchLeaderboard(scope = "global", classCode = "") {
  const params = new URLSearchParams({ scope });
  if (scope === "class") params.set("classCode", classCode);
  return requestJson(`/api/leaderboard?${params}`);
}

export async function createClass() {
  return requestJson("/api/classes", {
    method: "POST",
    headers: await csrfHeaders(),
    body: JSON.stringify({}),
  });
}

export async function createTeacherClass() {
  return requestJson("/api/teacher/classes", {
    method: "POST",
    headers: await csrfHeaders(),
    body: JSON.stringify({}),
  });
}

export async function fetchTeacherClasses() {
  return requestJson("/api/teacher/classes");
}

export async function fetchStudentClasses() {
  return requestJson("/api/student/classes");
}

export async function joinStudentClass(classCode) {
  return requestJson("/api/student/classes", {
    method: "POST",
    headers: await csrfHeaders(),
    body: JSON.stringify({ classCode }),
  });
}

export async function fetchClassMembers(classCode) {
  return requestJson(`/api/teacher/classes/${encodeURIComponent(classCode)}/members`);
}

export async function updateClassMemberStatus(classCode, userId, status) {
  return requestJson(
    `/api/teacher/classes/${encodeURIComponent(classCode)}/members/${encodeURIComponent(userId)}/status`,
    {
      method: "POST",
      headers: await csrfHeaders(),
      body: JSON.stringify({ status }),
    },
  );
}

export async function removeClassMember(classCode, userId) {
  return requestJson(
    `/api/teacher/classes/${encodeURIComponent(classCode)}/members/${encodeURIComponent(userId)}`,
    {
      method: "DELETE",
      headers: await csrfHeaders(),
    },
  );
}

export async function fetchClassReport(classCode, teacherToken = "") {
  return requestJson(`/api/classes/${encodeURIComponent(classCode)}/report`, {
    headers: teacherToken ? { Authorization: `Bearer ${teacherToken}` } : {},
  });
}

export async function fetchClassCsv(classCode, teacherToken = "") {
  const response = await fetch(`/api/classes/${encodeURIComponent(classCode)}/export.csv`, {
    credentials: "same-origin",
    headers: teacherToken ? { Authorization: `Bearer ${teacherToken}` } : {},
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error ?? `Class export failed (${response.status}).`);
  }
  return response.blob();
}
