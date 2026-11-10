import { afterEach, describe, expect, it } from "vitest";
import {
  checkRateLimit,
  clearRateLimits,
  clientIpFromRequest,
  resetRateLimit,
} from "../src/lib/rate-limit";

afterEach(() => clearRateLimits());

describe("rate limiting", () => {
  it("allows requests up to the limit then blocks inside the window", () => {
    expect(checkRateLimit("test:login", 2, 60_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });
    expect(checkRateLimit("test:login", 2, 60_000)).toEqual({ allowed: true, retryAfterSeconds: 0 });

    const blocked = checkRateLimit("test:login", 2, 60_000);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("resets a bucket after a successful sign-in", () => {
    checkRateLimit("test:reset", 1, 60_000);
    expect(checkRateLimit("test:reset", 1, 60_000).allowed).toBe(false);
    resetRateLimit("test:reset");
    expect(checkRateLimit("test:reset", 1, 60_000).allowed).toBe(true);
  });

  it("reads the first forwarded client address", () => {
    const request = new Request("http://example.test", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.2" },
    });
    expect(clientIpFromRequest(request)).toBe("203.0.113.9");
    expect(clientIpFromRequest(new Request("http://example.test"))).toBe("local");
  });
});
