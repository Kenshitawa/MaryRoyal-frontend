import { createClient } from "redis";
import { z } from "zod";

const retentionCacheKey = "mary-royal:school-setting:draft-retention-days";
const retentionTtlSeconds = 30;
const retentionDaysSchema = z.number().int().min(0).max(365);
const redisUrlSchema = z.string().url().refine((value) => /^rediss?:\/\//i.test(value), "must be a Redis URL");
const cachedRetentionDaysSchema = z
  .string()
  .regex(/^\d{1,3}$/)
  .transform(Number)
  .pipe(retentionDaysSchema);

type RedisClient = ReturnType<typeof createClient>;
let redisClientPromise: Promise<RedisClient> | undefined;

async function getRedisClient(): Promise<RedisClient | null> {
  const url = process.env.REDIS_URL;
  if (!url) return null;
  const parsedUrl = redisUrlSchema.parse(url);

  if (!redisClientPromise) {
    const client = createClient({ url: parsedUrl });
    client.on("error", (error) => {
      console.error("Redis cache connection error", { errorName: error.name });
    });
    redisClientPromise = client.connect().then(
      () => client,
      (error: unknown) => {
        redisClientPromise = undefined;
        throw error;
      },
    );
  }

  return redisClientPromise;
}

export async function getDraftRetentionDays(readFromDatabase: () => Promise<number>): Promise<number> {
  const client = await getRedisClient();
  if (!client) return retentionDaysSchema.parse(await readFromDatabase());

  const cachedValue = await client.get(retentionCacheKey);
  if (cachedValue !== null) {
    const parsed = cachedRetentionDaysSchema.safeParse(cachedValue);
    if (!parsed.success) {
      await client.del(retentionCacheKey);
      throw new Error("Redis cache contains an invalid draft retention setting.");
    }
    return parsed.data;
  }

  const days = retentionDaysSchema.parse(await readFromDatabase());
  await client.set(retentionCacheKey, String(days), { EX: retentionTtlSeconds });
  return days;
}

export async function invalidateDraftRetentionDaysCache(): Promise<void> {
  const client = await getRedisClient();
  if (client) await client.del(retentionCacheKey);
}
