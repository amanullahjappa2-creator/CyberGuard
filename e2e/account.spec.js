import { expect, test } from "@playwright/test";

test("student can register, sign in, and sign out through the bilingual account screen", async ({ page }) => {
  const username = `learner${Date.now()}`;
  const email = `${username}@example.test`;
  const password = "safe-example-password-2026";
  page.on("dialog", (dialog) => dialog.accept());
  await page.addInitScript(() => {
    if (localStorage.getItem("cyberguard-progress-v1") === null) {
      localStorage.setItem(
        "cyberguard-progress-v1",
        JSON.stringify({
          schemaVersion: 2,
          unlocked: 2,
          levels: { 1: { score: 100, stars: 1, hints: 1, xpGranted: true } },
          xp: 120,
          achievements: ["first-local-badge"],
        }),
      );
    }
  });

  await page.goto("/");
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Account" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Sign in" })).toBeVisible();

  await page.getByLabel("Full name").fill("Student Example");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email", { exact: true }).fill(email);
  const passwords = page.getByLabel("Password (at least 12 characters)");
  await passwords.nth(1).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
  await expect(page.locator(".account-panel")).toContainText(username);
  await expect(page.locator(".account-panel")).toContainText("student");
  await page.getByRole("button", { name: "Merge browser progress into account" }).click();
  await expect(page.locator(".account-message")).toContainText("merged successfully");

  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("cyberguard-progress-v1"));
    progress.unlocked = 3;
    progress.levels["2"] = { score: 150, stars: 2, hints: 0, xpGranted: true };
    progress.xp = 250;
    progress.achievements.push("second-local-badge");
    localStorage.setItem("cyberguard-progress-v1", JSON.stringify(progress));
  });
  await page.reload();
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
  await page.getByRole("button", { name: "Merge browser progress into account" }).click();
  await expect(page.locator(".account-message")).toContainText("merged successfully");
  const uploaded = await page.evaluate(() =>
    fetch("/api/student/progress").then((response) => response.json()),
  );
  expect(Object.keys(uploaded.progress.levels).sort()).toEqual(["1", "2"]);
  expect(uploaded.progress.xp).toBe(250);
  await page.locator("#home-link").click();
  await expect(page.getByText("Analyst", { exact: true })).toBeVisible();

  await page.evaluate(() => {
    const progress = JSON.parse(localStorage.getItem("cyberguard-progress-v1"));
    progress.unlocked = 4;
    progress.levels["3"] = { score: 175, stars: 1, hints: 2, xpGranted: true };
    progress.xp = 300;
    localStorage.setItem("cyberguard-progress-v1", JSON.stringify(progress));
  });
  await page.reload();
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
  await Promise.all([
    page.waitForNavigation({ waitUntil: "domcontentloaded" }),
    page.getByRole("button", { name: "Merge account progress into browser" }).click(),
  ]);
  const locallyMerged = await page.evaluate(() => JSON.parse(localStorage.getItem("cyberguard-progress-v1")));
  expect(Object.keys(locallyMerged.levels).sort()).toEqual(["1", "2", "3"]);
  expect(locallyMerged.xp).toBe(300);
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();
  await page.getByRole("button", { name: "Delete cloud backup" }).click();
  await expect(page.locator(".account-message")).toContainText("backup was deleted");
  await expect
    .poll(() => page.evaluate(() => fetch("/api/student/progress").then((response) => response.json())))
    .toMatchObject({ progress: null, updatedAt: null });
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account", exact: true }).click();
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page.getByText("You have been signed out.")).toBeVisible();

  await page.getByLabel("Username or email").fill(email);
  await page.getByLabel("Password (at least 12 characters)").first().fill(password);
  await page.getByRole("button", { name: "Sign in" }).first().click();
  await expect(page.getByRole("heading", { name: "Signed in" })).toBeVisible();

  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Switch language" }).click();
  await page.locator("#user-menu-trigger").click();
  await expect(page.getByRole("button", { name: "اکاؤنٹ", exact: true })).toBeVisible();
});

test("teacher invite owns classes and approves a student join request", async ({ page, browser }) => {
  const username = `teacher${Date.now()}`;
  const password = "safe-example-password-2026";

  await page.goto("/");
  await page.locator("#user-menu-trigger").click();
  await page.getByRole("button", { name: "Account" }).click();
  await page.getByLabel("Full name").fill("Teacher Example");
  await page.getByLabel("Username", { exact: true }).fill(username);
  await page.getByLabel("Email", { exact: true }).fill(`${username}@example.test`);
  await page.getByLabel("Teacher invitation code (optional)").fill("playwright-teacher-invite");
  const passwords = page.getByLabel("Password (at least 12 characters)");
  await passwords.nth(1).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();

  await expect(page.locator(".account-panel")).toContainText("teacher");
  await page.getByRole("link", { name: "Teacher dashboard" }).click();
  await expect(page.getByRole("heading", { name: "Class dashboard" })).toBeVisible();
  await expect(page.locator(".teacher-owned-class")).toHaveCount(0);
  await page.getByRole("button", { name: "Create class" }).click();
  const ownedClass = page.locator(".teacher-owned-class");
  await expect(ownedClass).toHaveCount(1);
  const classCode = (await ownedClass.locator("h3").textContent()).match(/[A-Z2-9]{6}/)?.[0];
  expect(classCode).toMatch(/^[A-Z2-9]{6}$/);
  await expect(ownedClass.getByRole("button", { name: "Open dashboard" })).toBeVisible();
  await ownedClass.getByRole("button", { name: "Open dashboard" }).click();
  await expect(page.locator("#teacher-report .report-card").first()).toContainText("0");

  const studentContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const studentPage = await studentContext.newPage();
  const studentUsername = `student${Date.now()}`;
  await studentPage.goto("/");
  await studentPage.locator("#user-menu-trigger").click();
  await studentPage.getByRole("button", { name: "Account" }).click();
  await studentPage.getByLabel("Full name").fill("Student Example");
  await studentPage.getByLabel("Username", { exact: true }).fill(studentUsername);
  await studentPage.getByLabel("Email", { exact: true }).fill(`${studentUsername}@example.test`);
  const studentPasswords = studentPage.getByLabel("Password (at least 12 characters)");
  await studentPasswords.nth(1).fill(password);
  await studentPage.getByLabel("Confirm password").fill(password);
  await studentPage.getByRole("button", { name: "Create account" }).click();
  await studentPage.getByLabel("Class code").fill(classCode);
  await studentPage.getByRole("button", { name: "Request to join" }).click();
  await expect(studentPage.locator(".student-class-list")).toContainText("Pending approval");

  await page.reload();
  await expect(page.locator(".teacher-owned-class")).toHaveCount(1);
  const member = ownedClass.locator(".teacher-member");
  await expect(member).toContainText(studentUsername);
  await member.getByRole("button", { name: "Approve" }).click();
  await expect(member).toContainText("Joined");
  await studentPage.reload();
  await studentPage.locator("#user-menu-trigger").click();
  await studentPage.getByRole("button", { name: "Account" }).click();
  await expect(studentPage.locator(".student-class-list")).toContainText("Joined");

  await member.getByRole("button", { name: "Remove student" }).click();
  await expect(ownedClass).toContainText("No students have requested or joined yet.");
  await studentPage.reload();
  await studentPage.locator("#user-menu-trigger").click();
  await studentPage.getByRole("button", { name: "Account" }).click();
  await expect(studentPage.locator(".student-class-list")).toContainText("No class memberships yet.");
  await studentContext.close();
});
