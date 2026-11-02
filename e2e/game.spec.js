import { expect, test } from "@playwright/test";

test("completes a level, switches language and theme, and keeps progress after reload", async ({ page }) => {
  const apiRequests = [];
  let uploadedScore;
  page.on("request", (request) => {
    if (new URL(request.url()).pathname.startsWith("/api/")) apiRequests.push(request.url());
    if (new URL(request.url()).pathname === "/api/score") uploadedScore = request.postDataJSON();
  });
  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Build practical cyber safety skills" })).toBeVisible();
  const appOutlineStyle = await page.locator("#app").evaluate((app) => getComputedStyle(app).outlineStyle);
  expect(appOutlineStyle).toBe("none");
  await expect(page.locator(".skill-radar")).toBeVisible();
  const radarFill = await page.locator(".radar-data").evaluate((polygon) => getComputedStyle(polygon).fill);
  const radarLabelFills = await page
    .locator(".radar-label")
    .evaluateAll((labels) => labels.map((label) => getComputedStyle(label).fill));
  expect(radarFill).not.toBe("rgb(0, 0, 0)");
  expect(radarLabelFills.every((fill) => fill !== "rgb(0, 0, 0)")).toBe(true);
  await page.getByRole("button", { name: "Start learning" }).click();

  const answers = [
    ["Email account", "Replace it with a long, hard-to-guess passphrase"],
    ["School portal", "Use a different password for every account"],
    ["Shopping account", "Create and store a unique password in a password manager"],
    ["Family photo account", "Turn on two-step verification"],
  ];
  for (const [item, answer] of answers) {
    await page.getByRole("button", { name: new RegExp(item) }).click();
    await page.getByRole("button", { name: answer }).click();
  }

  await expect(page.getByRole("heading", { name: "Weak Passwords" })).toBeVisible();
  await expect(page.getByText("LEVEL COMPLETE")).toBeVisible();
  await page.getByRole("button", { name: "Dashboard" }).last().click();
  await page.getByRole("button", { name: "Switch language" }).click();
  await page.getByRole("button", { name: "لائٹ تھیم" }).click();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("body")).toHaveAttribute("data-theme", "light");
  await expect(page.getByText("2 / 30").first()).toBeVisible();
  await page.evaluate(() => navigator.serviceWorker.ready);
  await page.context().setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "سائبر حفاظت کی عملی مہارتیں سیکھیں" })).toBeVisible();
  await expect(page.getByText("2 / 30").first()).toBeVisible();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .getByRole("button", { name: "لیولز" })
    .click();
  const levels = page.locator(".level-card:not(:disabled)");
  await expect(page.locator(".level-card")).toHaveCount(30);
  await expect(page.locator(".city-map")).toHaveCount(0);
  await expect(levels).toHaveCount(2);
  await levels.first().focus();
  await page.keyboard.press("Tab");
  await expect(levels.nth(1)).toBeFocused();
  await levels.nth(1).click();
  await expect(page.getByRole("heading", { name: "جعلی ای میل" })).toBeVisible();
  await page
    .getByRole("navigation", { name: "Primary navigation" })
    .locator('[data-screen="report"]')
    .click();
  await expect(page.getByText(/رازداری:/)).toBeVisible();
  const joinButton = page.getByRole("button", { name: "درجہ بندی میں شامل ہوں" });
  await expect(joinButton).toBeVisible();
  await joinButton.click();
  expect(apiRequests).toHaveLength(0);
  await page.context().setOffline(false);
  await page.locator('input[name="nickname"]').fill("Learner_E2E");
  await page.locator('input[type="checkbox"]').check();
  await page.getByRole("button", { name: "میرا اسکور ہم وقت کریں" }).click();
  await expect(page.getByText(/Learner_E2E/)).toBeVisible();
  expect(uploadedScore).toMatchObject({ privacyConsent: true, nickname: "Learner_E2E", score: 400 });
  expect(uploadedScore).not.toHaveProperty("events");
  await page.getByRole("link", { name: "استاد کا ڈیش بورڈ" }).click();
  await page.getByRole("button", { name: "کلاس بنائیں" }).click();
  await expect(page.locator('input[name="classCode"]')).toHaveValue(/[A-Z2-9]{6}/);
  await page.setViewportSize({ width: 390, height: 844 });
  const fitsPhone = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
  expect(fitsPhone).toBe(true);
});
