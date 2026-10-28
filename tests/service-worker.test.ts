import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");

function worker() {
  const listeners: Record<string, (event: { request?: unknown; respondWith?: (response: Promise<Response>) => void; waitUntil?: (work: Promise<unknown>) => void }) => void> = {};
  const cache = { addAll: vi.fn(), put: vi.fn() };
  const caches = { open: vi.fn().mockResolvedValue(cache), match: vi.fn().mockResolvedValue(undefined), keys: vi.fn().mockResolvedValue(["mary-royal-v1", "mary-royal-v2", "other-app"]), delete: vi.fn() };
  const fetch = vi.fn().mockResolvedValue(new Response("network"));
  runInNewContext(source, {
    self: { location: { origin: "https://school.test" }, addEventListener: (type: string, handler: typeof listeners[string]) => { listeners[type] = handler; }, skipWaiting: vi.fn(), clients: { claim: vi.fn() } },
    caches, fetch, URL, Response,
  });
  return { listeners, caches, fetch, cache };
}

describe("private offline navigation", () => {
  it("never caches an authenticated document", async () => {
    const w = worker();
    const respondWith = vi.fn();
    w.listeners.fetch({ request: { url: "https://school.test/learners/synthetic", method: "GET", mode: "navigate" }, respondWith });
    const response = await respondWith.mock.calls[0][0];
    expect(await response.text()).toBe("network");
    expect(w.caches.open).not.toHaveBeenCalled();
    expect(w.cache.put).not.toHaveBeenCalled();
  });

  it("serves only the generic offline page when disconnected", async () => {
    const w = worker();
    w.fetch.mockRejectedValue(new Error("offline"));
    w.caches.match.mockResolvedValue(new Response("generic offline"));
    const respondWith = vi.fn();
    w.listeners.fetch({ request: { url: "https://school.test/learners/synthetic", method: "GET", mode: "navigate" }, respondWith });
    const response = await respondWith.mock.calls[0][0];
    expect(await response.text()).toBe("generic offline");
    expect(w.caches.match).toHaveBeenCalledExactlyOnceWith("/offline.html");
    expect(w.cache.put).not.toHaveBeenCalled();
  });

  it("does not intercept private uploads or API responses", () => {
    const w = worker();
    for (const pathname of ["/api/profile/avatar/synthetic/photo.png", "/api/learners", "/private-uploads/photo.jpg"]) {
      const respondWith = vi.fn();
      w.listeners.fetch({ request: { url: `https://school.test${pathname}`, method: "GET", mode: "cors" }, respondWith });
      expect(respondWith).not.toHaveBeenCalled();
    }
  });

  it("caches only approved public assets and Next static chunks", async () => {
    const w = worker();
    for (const pathname of ["/mary-royal-logo.png", "/_next/static/chunks/synthetic.js"]) {
      const respondWith = vi.fn();
      const request = { url: `https://school.test${pathname}`, method: "GET", mode: "cors" };
      w.listeners.fetch({ request, respondWith });
      await respondWith.mock.calls[0][0];
      expect(w.cache.put).toHaveBeenCalledWith(request, expect.any(Response));
    }
  });

  it("purges old school caches without touching unrelated caches", async () => {
    const w = worker();
    const waitUntil = vi.fn();
    w.listeners.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(w.caches.delete).toHaveBeenCalledExactlyOnceWith("mary-royal-v1");
  });
});
