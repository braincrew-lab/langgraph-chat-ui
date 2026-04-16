import { test, expect } from "@playwright/test";

/**
 * Admin upload file-serve auth guard — regression test for GitHub issue #65.
 *
 * Verifies that `GET /api/admin/upload/{filename}` rejects unauthenticated
 * requests with 401 Unauthorized. Before this fix the route returned uploaded
 * admin assets to any caller that knew the filename.
 *
 * Only the unauthenticated boundary is asserted here. The non-admin (403) and
 * admin (200) cases depend on seeded NextAuth session state that isn't
 * available in the standalone e2e environment used by this suite.
 *
 * Requires:
 * - Next.js dev/preview server on the baseURL defined in playwright.config
 *   (any AUTH_MODE — the check runs at route entry before mode branching)
 */

test.describe("Admin upload file-serve — auth guard", () => {
  test("unauthenticated GET returns 401 Unauthorized", async ({ request }) => {
    const response = await request.get(
      "/api/admin/upload/does-not-matter.png",
    );

    expect(response.status()).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});
