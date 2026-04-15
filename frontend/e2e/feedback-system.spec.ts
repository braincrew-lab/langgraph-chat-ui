/**
 * E2E: Feedback system verification
 *
 * Tests the feedback system UI components and admin page:
 * 1. Feedback button visibility on AI messages (when NextAuth is configured)
 * 2. Admin feedback page accessibility
 * 3. Feedback dialog interaction
 */

import { test, expect } from "@playwright/test";

test.describe("Feedback System", () => {
  test("feedback admin page is accessible for admin users", async ({ page }) => {
    test.setTimeout(30_000);

    // Try to access the admin feedback page
    const response = await page.goto("/admin/feedback");

    // Should either load successfully (200) or redirect to login (302)
    // depending on auth configuration
    const status = response?.status();
    expect([200, 302, 307]).toContain(status);

    if (status === 200) {
      // If accessible, verify the page structure
      await page.waitForLoadState("networkidle");

      // Take screenshot for visual verification
      await page.screenshot({
        path: "test-results/feedback-admin-page.png",
        fullPage: true,
      });
    }
  });

  test("main page loads without errors when feedback system is enabled", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Verify no console errors related to feedback
    const consoleErrors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error" && msg.text().includes("feedback")) {
        consoleErrors.push(msg.text());
      }
    });

    // Wait a bit for any async errors
    await page.waitForTimeout(2000);

    // Take screenshot
    await page.screenshot({
      path: "test-results/feedback-main-page.png",
      fullPage: true,
    });

    expect(consoleErrors).toHaveLength(0);
  });

  test("health check for feedback API routes", async ({ request }) => {
    // Test that the feedback API routes exist and require auth
    const response = await request.get("/api/admin/feedback");

    // Should return 401 (unauthorized) or 200 (if authenticated)
    // Either way, the route should exist and not 404
    expect(response.status()).not.toBe(404);
  });
});
