const DEFAULT_DIAGNOSTIC_CACHE_MS = Number(process.env.DIAGNOSTIC_CACHE_MS ?? 3000);

const diagnosticCache = new Map();

function now() {
  return Date.now();
}

function isFresh(entry) {
  return entry && entry.expiresAt > now();
}

function getCacheTtlMs() {
  return Number.isFinite(DEFAULT_DIAGNOSTIC_CACHE_MS) && DEFAULT_DIAGNOSTIC_CACHE_MS > 0
    ? DEFAULT_DIAGNOSTIC_CACHE_MS
    : 0;
}

function buildKey(controllerId, revisionKey) {
  return `${String(controllerId)}::${String(revisionKey ?? "no-revision")}`;
}

function cleanupExpiredEntries() {
  const current = now();
  for (const [key, entry] of diagnosticCache.entries()) {
    if (!entry || entry.expiresAt <= current) {
      diagnosticCache.delete(key);
    }
  }
}

export function invalidateDiagnosticCache(controllerId) {
  const prefix = `${String(controllerId)}::`;
  for (const key of diagnosticCache.keys()) {
    if (key.startsWith(prefix)) {
      diagnosticCache.delete(key);
    }
  }
}

export async function getCachedDiagnostic({
  controllerId,
  revisionKey,
  bypass = false,
  loader,
}) {
  if (typeof loader !== "function") {
    throw new Error("loader inválido para diagnostic cache");
  }

  const ttlMs = getCacheTtlMs();
  if (ttlMs <= 0 || bypass) {
    return loader();
  }

  cleanupExpiredEntries();

  const key = buildKey(controllerId, revisionKey);
  const existing = diagnosticCache.get(key);

  if (existing?.promise) {
    return existing.promise;
  }

  if (isFresh(existing) && existing.value !== undefined) {
    return existing.value;
  }

  const pendingPromise = Promise.resolve()
    .then(loader)
    .then((value) => {
      diagnosticCache.set(key, {
        value,
        expiresAt: now() + ttlMs,
      });
      return value;
    })
    .catch((error) => {
      diagnosticCache.delete(key);
      throw error;
    });

  diagnosticCache.set(key, {
    promise: pendingPromise,
    expiresAt: now() + ttlMs,
  });

  return pendingPromise;
}
