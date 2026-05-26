interface Entry<T> {
  data: T;
  expiresAt: number;
  token: string;
}

const store = new Map<string, Entry<unknown>>();

export function getCached<T>(key: string, token: string): T | null {
  const entry = store.get(key) as Entry<T> | undefined;
  if (!entry || entry.token !== token || Date.now() > entry.expiresAt) return null;
  return entry.data;
}

export function setCached<T>(key: string, token: string, data: T, ttlMs = 30_000): void {
  store.set(key, { data, expiresAt: Date.now() + ttlMs, token });
}

export function invalidateCache(key: string): void {
  store.delete(key);
}

export function invalidateCachePrefix(prefix: string): void {
  for (const k of store.keys()) {
    if (k.startsWith(prefix)) store.delete(k);
  }
}
