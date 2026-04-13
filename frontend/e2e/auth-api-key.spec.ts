import { test, expect } from "@playwright/test";

/**
 * API Key Auth Mode E2E Tests
 *
 * Tests the api-key auth flow:
 * 1. Login page shows API key input form
 * 2. Enter API key → validate → connect
 * 3. After connection, thread list is visible in sidebar
 *
 * Requires:
 * - AUTH_MODE=api-key
 * - A running LangGraph server (LANGGRAPH_API_URL)
 */

const isApiKeyMode = process.env.AUTH_MODE === "api-key";

test.describe("API Key auth mode", () => {
  test.skip(!isApiKeyMode, "Requires AUTH_MODE=api-key");

  test("login page shows API key input form", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Should show API key input (password type for masking)
    const apiKeyInput = page.locator('input[name="apiKey"]');
    await expect(apiKeyInput).toBeVisible({ timeout: 10_000 });

    // Should have placeholder text
    await expect(apiKeyInput).toHaveAttribute("placeholder", /lsv2_pt_/);

    // Should show connect button
    const connectButton = page.getByRole("button", { name: /connect/i });
    await expect(connectButton).toBeVisible();
  });

  test("empty API key shows validation feedback", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Click connect without entering key
    const connectButton = page.getByRole("button", { name: /connect/i });
    await connectButton.click();

    // Should show error or stay on login page (HTML5 validation or custom error)
    await page.waitForTimeout(1000);
    expect(page.url()).toContain("/login");

    // The form should still be visible (not navigated away)
    const apiKeyInput = page.locator('input[name="apiKey"]');
    await expect(apiKeyInput).toBeVisible();
  });

  test("invalid API key shows error", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Enter invalid key
    const apiKeyInput = page.locator('input[name="apiKey"]');
    await apiKeyInput.fill("invalid-key-12345");

    // Click connect
    const connectButton = page.getByRole("button", { name: /connect/i });
    await connectButton.click();

    // Should show error (validation fails against server)
    const error = page.locator('[role="alert"]');
    await expect(error).toBeVisible({ timeout: 15_000 });
  });

  test("protected route redirects to login", async ({ page }) => {
    await page.goto("/");
    // Without API key, should redirect to login
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("admin route redirects away", async ({ page }) => {
    await page.goto("/admin");
    await page.waitForURL((url) => !url.pathname.startsWith("/admin"), {
      timeout: 10_000,
    });
    expect(page.url()).not.toContain("/admin");
  });
});

test.describe("API Key auth mode — env var auto-login", () => {
  const hasEnvKey = !!(
    process.env.LANGCHAIN_API_KEY ||
    process.env.NEXT_PUBLIC_LANGCHAIN_API_KEY
  );

  test.skip(
    !isApiKeyMode || !hasEnvKey,
    "Requires AUTH_MODE=api-key and LANGCHAIN_API_KEY env var",
  );

  test("auto-redirects to home when env key is set", async ({ page }) => {
    await page.goto("/login");
    // Should redirect to / because env key is pre-configured
    await page.waitForURL(
      (url) => !url.pathname.includes("/login"),
      { timeout: 10_000 },
    );
    expect(page.url()).not.toContain("/login");
  });

  test("sidebar shows thread list after auto-login", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should NOT be on login page
    expect(page.url()).not.toContain("/login");

    // Should show chat UI with sidebar
    // The sidebar contains thread list or "new thread" button
    const sidebar = page.locator('[data-testid="sidebar"], aside, nav');
    await expect(sidebar.first()).toBeVisible({ timeout: 15_000 });
  });
});
