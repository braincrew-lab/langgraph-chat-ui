import { test, expect } from "@playwright/test";

/**
 * Custom JWT Auth Mode E2E Tests
 *
 * Tests the custom-jwt auth flow:
 * 1. Login page shows IdP redirect button
 * 2. Unauthenticated access redirects to login
 * 3. Admin routes are blocked
 *
 * Note: Full OIDC flow testing requires a mock IdP server.
 * These tests verify the UI components and routing behavior.
 *
 * Requires:
 * - AUTH_MODE=custom-jwt
 * - JWT_ISSUER and JWT_CLIENT_ID configured
 */

const isCustomJwtMode = process.env.AUTH_MODE === "custom-jwt";

test.describe("Custom JWT auth mode", () => {
  test.skip(!isCustomJwtMode, "Requires AUTH_MODE=custom-jwt");

  test("login page shows IdP login button", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Should show "Sign in with" button for IdP
    const signInButton = page.getByRole("button", { name: /sign in with/i });
    await expect(signInButton).toBeVisible({ timeout: 10_000 });
  });

  test("protected route redirects to login without token", async ({ page }) => {
    await page.goto("/");
    // Without IdP token, should redirect to login
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

  test("callback route exists and requires code parameter", async ({
    page,
  }) => {
    // Hitting callback without code should redirect to login
    await page.goto("/auth/callback");
    await page.waitForURL("**/login**", { timeout: 10_000 });
    expect(page.url()).toContain("/login");
  });

  test("IdP login button triggers authorization request", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");

    // Intercept the fetch to /auth/callback?action=authorize at the network level
    let callbackRequested = false;
    page.on("request", (req) => {
      if (req.url().includes("/auth/callback")) {
        callbackRequested = true;
      }
    });

    await page.getByRole("button", { name: /sign in with/i }).click();

    // Wait briefly for the fetch to fire
    await page.waitForTimeout(2000);

    // The button should have triggered a request to the callback endpoint
    expect(callbackRequested).toBe(true);
  });
});
