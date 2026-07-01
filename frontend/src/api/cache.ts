/*
 * Simple namespaced LRU cache backed by localStorage with in-memory fallback.
 *
 * - Per-namespace LRU order and maxEntries
 * - Per-item TTL with default per namespace
 * - Graceful handling of storage quota by evicting oldest and retrying
 * - Optional versioning per namespace to invalidate stale formats
 */

type JsonValue = unknown;

export interface CacheNamespaceOptions {
  maxEntries: number;
  defaultTtlMs: number;
  version?: number;
}

interface StoredItem {
  value: JsonValue;
  expiresAt: number; // epoch ms
  version?: number;
}

const LOCAL_STORAGE_AVAILABLE = (() => {
  try {
    const testKey = '__cache_test__';
    window.localStorage.setItem(testKey, '1');
    window.localStorage.removeItem(testKey);
    return true;
  } catch {
    return false;
  }
})();

class InMemoryStorage {
  private map = new Map<string, string>();
  getItem(key: string): string | null {
    return this.map.has(key) ? (this.map.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
  removeItem(key: string): void {
    this.map.delete(key);
  }
}

const storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'> =
  LOCAL_STORAGE_AVAILABLE ? window.localStorage : new InMemoryStorage();

function namespacedKey(namespace: string, key: string): string {
  return `cache:${namespace}:${key}`;
}

function orderKey(namespace: string): string {
  return `cache:${namespace}:__order__`;
}

function readOrder(namespace: string): string[] {
  const raw = storage.getItem(orderKey(namespace));
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function writeOrder(namespace: string, order: string[]): void {
  try {
    storage.setItem(orderKey(namespace), JSON.stringify(order));
  } catch {
    // Ignore; order persistence failure is non-fatal
  }
}

function safeParseItem(raw: string | null): StoredItem | null {
  if (!raw) return null;
  try {
    return JSON.parse(raw) as StoredItem;
  } catch {
    return null;
  }
}

export class NamespacedCache {
  private optionsByNamespace: Record<string, CacheNamespaceOptions>;

  constructor(optionsByNamespace: Record<string, CacheNamespaceOptions>) {
    this.optionsByNamespace = optionsByNamespace;
  }

  get<T = JsonValue>(namespace: string, key: string): T | null {
    const nsOptions = this.optionsByNamespace[namespace];
    const storageKey = namespacedKey(namespace, key);
    const item = safeParseItem(storage.getItem(storageKey));

    if (!item) {
      return null;
    }

    // Version mismatch invalidates item
    if (nsOptions?.version !== undefined && item.version !== nsOptions.version) {
      this.remove(namespace, key);
      return null;
    }

    // TTL check
    const now = Date.now();
    if (item.expiresAt < now) {
      this.remove(namespace, key);
      return null;
    }

    // Touch LRU order
    this.touch(namespace, key);
    return item.value as T;
  }

  set(namespace: string, key: string, value: JsonValue, ttlMs?: number): void {
    const nsOptions = this.optionsByNamespace[namespace];
    const effectiveTtl = Math.max(1, ttlMs ?? nsOptions?.defaultTtlMs ?? 0);
    const storageKey = namespacedKey(namespace, key);
    const payload: StoredItem = {
      value,
      expiresAt: Date.now() + effectiveTtl,
      version: nsOptions?.version,
    };

    const tryStore = () => storage.setItem(storageKey, JSON.stringify(payload));

    try {
      tryStore();
    } catch (err) {
      // Attempt to free space by evicting the oldest entries
      this.evictOldest(namespace, 10);
      try {
        tryStore();
      } catch {
        // Give up silently if still failing
        return;
      }
    }

    this.touch(namespace, key);
    this.enforceMaxEntries(namespace);
  }

  remove(namespace: string, key: string): void {
    storage.removeItem(namespacedKey(namespace, key));
    const order = readOrder(namespace).filter((k) => k !== key);
    writeOrder(namespace, order);
  }

  clear(namespace: string): void {
    const order = readOrder(namespace);
    for (const key of order) {
      storage.removeItem(namespacedKey(namespace, key));
    }
    writeOrder(namespace, []);
  }

  private touch(namespace: string, key: string): void {
    const order = readOrder(namespace);
    const filtered = order.filter((k) => k !== key);
    filtered.push(key);
    writeOrder(namespace, filtered);
  }

  private enforceMaxEntries(namespace: string): void {
    const nsOptions = this.optionsByNamespace[namespace];
    if (!nsOptions?.maxEntries || nsOptions.maxEntries <= 0) return;
    const order = readOrder(namespace);

    // Remove expired entries first to keep hot data
    for (const key of [...order]) {
      const item = safeParseItem(storage.getItem(namespacedKey(namespace, key)));
      if (!item) {
        this.remove(namespace, key);
      } else if (item.expiresAt < Date.now()) {
        this.remove(namespace, key);
      }
    }

    let currentOrder = readOrder(namespace);
    while (currentOrder.length > nsOptions.maxEntries) {
      const oldestKey = currentOrder[0];
      this.remove(namespace, oldestKey);
      currentOrder = readOrder(namespace);
    }
  }

  private evictOldest(namespace: string, count: number): void {
    const order = readOrder(namespace);
    const toRemove = order.slice(0, count);
    for (const key of toRemove) {
      this.remove(namespace, key);
    }
  }
}

// Default cache configuration per our usage
export const appCache = new NamespacedCache({
  telemetry: {
    // Drive telemetry is historical and stable; cache for 24h by default
    defaultTtlMs: 24 * 60 * 60 * 1000,
    // Keep up to 500 sol-parameter entries (~a few MB depending on data density)
    maxEntries: 500,
    version: 1,
  },
  evrs: {
    // EVR annotations change infrequently; cache 24h
    defaultTtlMs: 24 * 60 * 60 * 1000,
    maxEntries: 500,
    version: 1,
  },
  sols: {
    // Sol metadata may update; cache for 6h
    defaultTtlMs: 6 * 60 * 60 * 1000,
    maxEntries: 200,
    version: 1,
  },
});


