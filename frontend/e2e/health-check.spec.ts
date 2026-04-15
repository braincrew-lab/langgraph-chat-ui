/**
 * E2E: Health check endpoint verification
 *
 * Tests that:
 * 1. GET /api/health returns 200 with { status: "ok" }
 * 2. The endpoint is publicly accessible (no auth required)
 */

import { test, expect } from "@playwright/test";

test.describe("Health Check Endpoint", () => {
  test("GET /api/health returns status ok", async ({ request }) => {
    const response = await request.get("/api/health");

    expect(response.status()).toBe(200);

    const body = await response.json();
    expect(body).toEqual({ status: "ok" });
  });

  test("health endpoint is accessible without authentication", async ({
    request,
  }) => {
    // Make request without any auth headers/cookies
    const response = await request.get("/api/health", {
      headers: {},
    });

    expect(response.status()).toBe(200);
    const body = await response.json();
    expect(body.status).toBe("ok");
  });
});
