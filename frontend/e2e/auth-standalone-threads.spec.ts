import { test, expect } from "@playwright/test";

/**
 * Standalone Mode E2E Tests — Thread List Verification
 *
 * Tests that the standalone mode can connect to a real LangGraph server
 * and display the thread list in the sidebar.
 *
 * Requires:
 * - AUTH_MODE=standalone (default)
 * - A running LangGraph server at NEXT_PUBLIC_API_URL or LANGGRAPH_API_URL
 */

const isStandaloneMode =
  !process.env.AUTH_MODE || process.env.AUTH_MODE === "standalone";

test.describe("Standalone mode — thread list with real server", () => {
  test.skip(!isStandaloneMode, "Requires AUTH_MODE=standalone");

  test("homepage renders chat UI (not login)", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Should NOT redirect to login
    expect(page.url()).not.toContain("/login");

    // Should show the chat input
    const chatInput = page.locator(
      'textarea, [contenteditable="true"], input[type="text"]',
    );
    await expect(chatInput.first()).toBeVisible({ timeout: 15_000 });
  });

  test("sidebar is visible with thread management", async ({ page }) => {
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // The sidebar uses bg-sidebar class and contains thread history
    // Look for sidebar toggle button or the sidebar container itself
    const sidebarToggle = page.locator(
      'button[aria-label*="sidebar"], button[aria-label*="Sidebar"]',
    );
    const sidebarContainer = page.locator(".bg-sidebar");

    const toggleVisible = await sidebarToggle
      .first()
      .isVisible()
      .catch(() => false);
    const containerVisible = await sidebarContainer
      .first()
      .isVisible()
      .catch(() => false);

    expect(toggleVisible || containerVisible).toBe(true);
  });

  test("can access assistants from LangGraph server", async ({ request }) => {
    // Direct API call to verify server connectivity through proxy
    const response = await request.post("/api/assistants/search", {
      data: { limit: 5 },
      headers: { "Content-Type": "application/json" },
    });

    expect(response.ok()).toBe(true);
    const data = await response.json();
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("can create and list threads via API", async ({ request }) => {
    // Create a thread
    const createResponse = await request.post("/api/threads", {
      data: { metadata: {} },
      headers: { "Content-Type": "application/json" },
    });
    expect(createResponse.ok()).toBe(true);

    const thread = await createResponse.json();
    expect(thread.thread_id).toBeTruthy();

    // Search for threads
    const searchResponse = await request.post("/api/threads/search", {
      data: { limit: 10 },
      headers: { "Content-Type": "application/json" },
    });
    expect(searchResponse.ok()).toBe(true);

    const threads = await searchResponse.json();
    expect(Array.isArray(threads)).toBe(true);
    // Our newly created thread should be in the list
    const found = threads.some(
      (t: { thread_id: string }) => t.thread_id === thread.thread_id,
    );
    expect(found).toBe(true);
  });
});
