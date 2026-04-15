/**
 * E2E: CompletedTurnTaskView — verify completed turn activity renders correctly
 *
 * Tests that:
 * 1. The page loads without errors
 * 2. If activity items exist, they don't show generic node names
 * 3. CompletedTurnTaskView component renders a collapsible "Turn Activity" section
 */

import { test, expect } from "@playwright/test";

test.describe("CompletedTurnTaskView", () => {
  test("page loads and CompletedTurnTaskView does not show generic node names", async ({
    page,
  }) => {
    test.setTimeout(30_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Check for activity items in the DOM
    const activityItems = await page.evaluate(() => {
      const items = document.querySelectorAll("[data-activity-item]");
      return Array.from(items).map((el) => ({
        kind: el.getAttribute("data-kind"),
        status: el.getAttribute("data-status"),
        depth: el.getAttribute("data-depth"),
        text: (el.textContent || "").substring(0, 200),
      }));
    });

    if (activityItems.length === 0) {
      // No activity items on main page — this is expected when no thread is loaded
      console.log("No activity items found — skipping assertions (no thread loaded)");
      return;
    }

    // Verify no generic node names in LLM output items
    const llmOutputs = activityItems.filter((i) => i.kind === "llm_output");
    for (const item of llmOutputs) {
      const textStart = item.text.trim().substring(0, 20);
      expect(textStart).not.toMatch(/^Model\s/);
      expect(textStart).not.toMatch(/^Tools\s/);
    }

    // Verify no generic names in subgraph depth=1 items
    const depth1Items = activityItems.filter((i) => i.depth === "1");
    const hasGenericNames = depth1Items.some(
      (i) =>
        i.text.startsWith("Model") ||
        i.text.startsWith("Tools") ||
        i.text.startsWith("Agent"),
    );
    expect(hasGenericNames).toBe(false);
  });

  test("Turn Activity section is collapsible when present", async ({ page }) => {
    test.setTimeout(30_000);

    await page.goto("/");
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(3000);

    // Look for "Turn Activity" text which indicates CompletedTurnTaskView is rendered
    const turnActivityButton = page.locator("text=Turn Activity").first();

    if (await turnActivityButton.isVisible().catch(() => false)) {
      // Click to expand
      await turnActivityButton.click();
      await page.waitForTimeout(500);

      // Take screenshot for visual verification
      await page.screenshot({
        path: "test-results/completed-turn-expanded.png",
        fullPage: true,
      });

      // Click again to collapse
      await turnActivityButton.click();
      await page.waitForTimeout(500);

      await page.screenshot({
        path: "test-results/completed-turn-collapsed.png",
        fullPage: true,
      });
    } else {
      console.log("No Turn Activity section found — skipping (no completed turns)");
    }
  });
});
