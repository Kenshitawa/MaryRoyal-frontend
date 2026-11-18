import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { client, createClientMock } = vi.hoisted(() => {
  const mockedClient = {
    connect: vi.fn(),
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
    on: vi.fn(),
  };
  return { client: mockedClient, createClientMock: vi.fn(() => mockedClient) };
});

vi.mock("redis", () => ({ createClient: createClientMock }));

const originalRedisUrl = process.env.REDIS_URL;

beforeEach(() => {
  vi.resetModules();
  vi.clearAllMocks();
  process.env.REDIS_URL = "redis://cache.test";
  client.connect.mockResolvedValue(client);
  client.get.mockResolvedValue(null);
  client.set.mockResolvedValue("OK");
  client.del.mockResolvedValue(1);
  createClientMock.mockReturnValue(client);
});

afterEach(() => {
  if (originalRedisUrl === undefined) delete process.env.REDIS_URL;
  else process.env.REDIS_URL = originalRedisUrl;
});

describe("Redis school-setting cache", () => {
  it("uses the database directly when Redis is not configured", async () => {
    delete process.env.REDIS_URL;
    const { getDraftRetentionDays } = await import("../src/lib/redis-cache");
    const readFromDatabase = vi.fn().mockResolvedValue(30);

    await expect(getDraftRetentionDays(readFromDatabase)).resolves.toBe(30);
    expect(readFromDatabase).toHaveBeenCalledOnce();
    expect(createClientMock).not.toHaveBeenCalled();
  });

  it("serves a valid cached value without querying the database", async () => {
    client.get.mockResolvedValue("14");
    const { getDraftRetentionDays } = await import("../src/lib/redis-cache");
    const readFromDatabase = vi.fn().mockResolvedValue(30);

    await expect(getDraftRetentionDays(readFromDatabase)).resolves.toBe(14);
    expect(readFromDatabase).not.toHaveBeenCalled();
  });

  it("caches a validated database value and invalidates after updates", async () => {
    const { getDraftRetentionDays, invalidateDraftRetentionDaysCache } = await import("../src/lib/redis-cache");
    const readFromDatabase = vi.fn().mockResolvedValue(30);

    await expect(getDraftRetentionDays(readFromDatabase)).resolves.toBe(30);
    expect(client.set).toHaveBeenCalledWith(
      "mary-royal:school-setting:draft-retention-days",
      "30",
      { EX: 30 },
    );

    await invalidateDraftRetentionDaysCache();
    expect(client.del).toHaveBeenCalledWith("mary-royal:school-setting:draft-retention-days");
  });

  it("rejects malformed or out-of-range values from Redis", async () => {
    client.get.mockResolvedValue("999");
    const { getDraftRetentionDays } = await import("../src/lib/redis-cache");

    await expect(getDraftRetentionDays(async () => 30)).rejects.toThrow("invalid draft retention setting");
    expect(client.del).toHaveBeenCalledWith("mary-royal:school-setting:draft-retention-days");
  });

  it("rejects non-Redis connection URLs before connecting", async () => {
    process.env.REDIS_URL = "https://cache.test";
    const { getDraftRetentionDays } = await import("../src/lib/redis-cache");

    await expect(getDraftRetentionDays(async () => 30)).rejects.toThrow("must be a Redis URL");
    expect(createClientMock).not.toHaveBeenCalled();
  });
});
