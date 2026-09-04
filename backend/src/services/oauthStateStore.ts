import Redis from 'ioredis';

const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6380'),
});

const TTL_SECONDS = 600; // 10 minutes
const MEMORY_STORE = new Map<string, any>();

function memoryGet(key: string) {
  return MEMORY_STORE.get(key);
}

function memorySet(key: string, value: any) {
  MEMORY_STORE.set(key, value);
}

function memoryDelete(key: string) {
  MEMORY_STORE.delete(key);
}

async function redisGet(key: string) {
  const data = await redis.get(`oauth:state:${key}`);
  return data ? JSON.parse(data) : undefined;
}

async function redisSet(key: string, value: any) {
  await redis.setex(`oauth:state:${key}`, TTL_SECONDS, JSON.stringify(value));
}

async function redisDelete(key: string) {
  await redis.del(`oauth:state:${key}`);
}

export const oauthStateStore = {
  get(key: string) {
    const mem = memoryGet(key);
    if (mem) return mem;
    return undefined;
  },

  set(key: string, value: any) {
    memorySet(key, value);
    redisSet(key, value).catch((error) => {
      console.error('[oauthStateStore] Failed to persist to Redis:', error);
    });
  },

  "delete"(key: string) {
    memoryDelete(key);
    redisDelete(key).catch((error) => {
      console.error('[oauthStateStore] Failed to delete from Redis:', error);
    });
  },

  entries() {
    return MEMORY_STORE.entries();
  },

  keys() {
    return MEMORY_STORE.keys();
  },

  get size() {
    return MEMORY_STORE.size;
  },

  clear() {
    MEMORY_STORE.clear();
  },
};

export async function loadOAuthStateFromRedis(key: string) {
  try {
    return await redisGet(key);
  } catch (error) {
    console.error('[oauthStateStore] Failed to load from Redis:', error);
    return undefined;
  }
}

export async function cleanupExpiredStates() {
  if (MEMORY_STORE.size > 1000) {
    const firstKey = MEMORY_STORE.keys().next().value;
    if (firstKey) MEMORY_STORE.delete(firstKey);
  }
}
