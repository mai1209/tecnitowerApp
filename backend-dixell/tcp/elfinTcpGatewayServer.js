import net from "net";

const DEFAULT_HOST = process.env.TCP_GATEWAY_HOST ?? "0.0.0.0";
const DEFAULT_PORT = Number(process.env.TCP_GATEWAY_PORT ?? 4001);
const DEFAULT_TIMEOUT_MS = Number(process.env.TCP_GATEWAY_TIMEOUT_MS ?? 12000);
const DEBUG_TCP_GATEWAY = String(process.env.DEBUG_TCP_GATEWAY ?? "").trim() === "1";

// Delay en ms tras el registro del Elfin antes de aceptar comandos.
// Evita la carrera inicial donde la app dispara fetchDiagnostic
// antes de que el canal RS485 esté estable.
const READY_DELAY_MS = Number(process.env.TCP_GATEWAY_READY_DELAY_MS ?? 400);

// Intervalo de keep-alive TCP en ms. Mantiene viva la conexión NAT
// en routers domésticos/industriales que cierran sesiones idle.
const KEEP_ALIVE_INTERVAL_MS = Number(process.env.TCP_GATEWAY_KEEP_ALIVE_MS ?? 10000);
const DESTROY_AFTER_TIMEOUTS = Number(process.env.TCP_GATEWAY_DESTROY_AFTER_TIMEOUTS ?? 0);
const REGISTRATION_TIMEOUT_MS = Number(process.env.TCP_GATEWAY_REGISTRATION_TIMEOUT_MS ?? 5000);
const MAX_IDENTITY_BUFFER_BYTES = Number(process.env.TCP_GATEWAY_MAX_IDENTITY_BUFFER_BYTES ?? 256);
const ALLOW_BARE_ELFIN_ID = String(process.env.TCP_GATEWAY_ALLOW_BARE_ID ?? "").trim() === "1";

let tcpServer = null;
const connections = new Map();

// ─── utilidades ────────────────────────────────────────────────────────────────

function canonicalizeElfinId(value = "") {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^(ELFIN|ID|MAC)\s*[:=]\s*/i, "")
    .replace(/[^A-Z0-9]/g, "");
}

function looksLikeElfinId(value = "") {
  const raw = String(value ?? "").trim().toUpperCase();
  if (/^(GET|POST|HEAD|PUT|DELETE|OPTIONS|TRACE|CONNECT)\s|^GETHTTP/.test(raw)) {
    return false;
  }
  const normalized = canonicalizeElfinId(value);
  return normalized.length >= 8 && /\d/.test(normalized);
}

function hasExplicitElfinPrefix(value = "") {
  return /^\s*(ELFIN|ID|MAC)\s*[:=]\s*[A-Za-z0-9._-]{8,}/i.test(String(value ?? ""));
}

function canRegisterIdentity(value = "") {
  return hasExplicitElfinPrefix(value) || (ALLOW_BARE_ELFIN_ID && looksLikeElfinId(value));
}

function toHexPreview(buffer, maxBytes = 32) {
  const bytes = Buffer.from(buffer ?? []);
  const preview = bytes.subarray(0, maxBytes).toString("hex");
  return bytes.length > maxBytes ? `${preview}...` : preview;
}

function getNormalizedElfinId(value = "") {
  const normalized = canonicalizeElfinId(value);
  if (!normalized) {
    throw new Error("Falta elfinId para usar el gateway TCP");
  }
  return normalized;
}

function logPrefix(state) {
  return state?.elfinId ? `[TCP GATEWAY ${state.elfinId}]` : "[TCP GATEWAY]";
}

function formatDuration(ms) {
  if (!Number.isFinite(ms) || ms < 0) return "-";
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  if (minutes < 1) return `${seconds}s`;
  return `${minutes}m ${remainingSeconds}s`;
}

function buildConnectionSnapshot(state) {
  const now = Date.now();
  const connectedMs = state?.connectedAtMs ? now - state.connectedAtMs : null;
  const registeredMs = state?.registeredAt ? now - state.registeredAt.getTime() : null;
  const lastSeenMs = state?.lastSeenAt ? now - state.lastSeenAt.getTime() : null;

  return {
    elfinId: state?.elfinId ?? null,
    remoteAddress: state?.socket?.remoteAddress,
    remotePort: state?.socket?.remotePort,
    connectedFor: formatDuration(connectedMs),
    registeredFor: formatDuration(registeredMs),
    lastSeenAgo: formatDuration(lastSeenMs),
    ready: Boolean(state?.ready),
    pending: Boolean(state?.pending),
    commandTimeouts: state?.commandTimeouts ?? 0,
    bufferedBytes: state?.buffer?.length ?? 0,
  };
}

// ─── gestión de conexiones ─────────────────────────────────────────────────────

function attachConnection(elfinId, state) {
  const normalizedElfinId = getNormalizedElfinId(elfinId);
  const previous = connections.get(normalizedElfinId);

  if (previous && previous !== state) {
    try {
      previous.socket.destroy();
    } catch (_) {}
  }

  state.elfinId = normalizedElfinId;
  state.registeredAt = new Date();
  state.ready = false; // canal RS485 aún no estable

  connections.set(normalizedElfinId, state);
  if (state.registrationTimeout) {
    clearTimeout(state.registrationTimeout);
    state.registrationTimeout = null;
  }
  console.log(`${logPrefix(state)} conexión registrada`, buildConnectionSnapshot(state));

  // Marcar como listo después del delay para evitar la carrera inicial
  setTimeout(() => {
    // Verificar que el socket siga siendo el mismo (no fue reemplazado)
    if (connections.get(normalizedElfinId) === state && !state.socket.destroyed) {
      state.ready = true;
      console.log(`${logPrefix(state)} canal RS485 listo`, buildConnectionSnapshot(state));
    }
  }, READY_DELAY_MS);
}

function detachConnection(state) {
  if (!state?.elfinId) return;
  const current = connections.get(state.elfinId);
  if (current === state) {
    connections.delete(state.elfinId);
  }
}

function destroyConnection(state, reason = "socket descartado") {
  if (!state?.socket || state.socket.destroyed) return;
  console.warn(
    `${logPrefix(state)} ${reason}; cerrando socket para forzar reconexión`,
    buildConnectionSnapshot(state)
  );
  detachConnection(state);
  try {
    state.socket.destroy();
  } catch (_) {}
}

// ─── identificación del Elfin ──────────────────────────────────────────────────

function tryRegisterElfin(state, chunk) {
  state.identityBuffer += chunk.toString("utf8");
  const parts = state.identityBuffer.split(/\r?\n/);
  state.identityBuffer = parts.pop() ?? "";

  for (const rawPart of parts) {
    if (!canRegisterIdentity(rawPart) || !looksLikeElfinId(rawPart)) continue;
    const normalized = canonicalizeElfinId(rawPart);
    attachConnection(normalized, state);
    return { registered: true, remainder: Buffer.alloc(0) };
  }

  const immediateCandidate = state.identityBuffer.trim();
  const printableAscii = /^[\x20-\x7E]+$/.test(immediateCandidate);
  if (printableAscii && canRegisterIdentity(immediateCandidate) && looksLikeElfinId(immediateCandidate)) {
    attachConnection(canonicalizeElfinId(immediateCandidate), state);
    state.identityBuffer = "";
    return { registered: true, remainder: Buffer.alloc(0) };
  }

  // Si el chunk mezcla texto de registro + bytes binarios, intentamos
  // extraer el ID ASCII del inicio y preservar el resto para el matcher.
  const asciiPrefixMatch = state.identityBuffer.match(/^\s*(ELFIN|ID|MAC)\s*[:=]\s*([A-Za-z0-9._-]{8,})/i);
  if (asciiPrefixMatch) {
    const normalized = canonicalizeElfinId(`${asciiPrefixMatch[1]}:${asciiPrefixMatch[2]}`);
    const consumedText = asciiPrefixMatch[0].length;
    const trailingText = state.identityBuffer.slice(consumedText);
    attachConnection(normalized, state);
    state.identityBuffer = "";
    return {
      registered: true,
      remainder: trailingText ? Buffer.from(trailingText, "utf8") : Buffer.alloc(0),
    };
  }

  if (
    Buffer.byteLength(state.identityBuffer, "utf8") > MAX_IDENTITY_BUFFER_BYTES ||
    /^(GET|POST|HEAD|PUT|DELETE|OPTIONS|TRACE|CONNECT)\s/i.test(state.identityBuffer)
  ) {
    destroyConnection(state, "registro TCP inválido");
  }

  return { registered: false, remainder: Buffer.alloc(0) };
}

// ─── resolución de respuestas pendientes ───────────────────────────────────────

function resolvePending(state) {
  const pending = state.pending;
  if (!pending) return;

  const match = pending.matcher(state.buffer);
  if (!match?.frame) return;

  clearTimeout(pending.timeout);
  state.pending = null;
  state.commandTimeouts = 0;
  state.buffer = state.buffer.subarray(match.consumedBytes ?? state.buffer.length);
  pending.resolve(Buffer.from(match.frame));
}

// ─── handlers de socket ────────────────────────────────────────────────────────

function handleSocketData(state, chunk) {
  state.lastSeenAt = new Date();

  if (DEBUG_TCP_GATEWAY) {
    console.log(`${logPrefix(state)} rx ${Buffer.byteLength(chunk)} bytes`, {
      hex: toHexPreview(chunk),
      pending: Boolean(state.pending),
    });
  }

  if (!state.elfinId) {
    const registration = tryRegisterElfin(state, chunk);
    if (registration.registered) {
      if (registration.remainder?.length) {
        state.buffer = Buffer.concat([state.buffer, registration.remainder]);
        resolvePending(state);
      }
      return;
    }
  }

  state.buffer = Buffer.concat([state.buffer, Buffer.from(chunk)]);
  resolvePending(state);
}

function handleSocketClose(state, reason = "closed", details = {}) {
  console.warn(`${logPrefix(state)} socket ${reason}`, {
    ...buildConnectionSnapshot(state),
    ...details,
  });

  if (state.registrationTimeout) {
    clearTimeout(state.registrationTimeout);
    state.registrationTimeout = null;
  }
  detachConnection(state);
  if (state.pending) {
    clearTimeout(state.pending.timeout);
    state.pending.reject(new Error(`Conexión TCP del Elfin ${reason}`));
    state.pending = null;
  }
}

function createConnectionState(socket) {
  const state = {
    socket,
    connectedAtMs: Date.now(),
    elfinId: null,
    registeredAt: null,
    lastSeenAt: null,
    ready: false,
    commandTimeouts: 0,
    identityBuffer: "",
    buffer: Buffer.alloc(0),
    pending: null,
    registrationTimeout: null,
  };

  state.registrationTimeout = setTimeout(() => {
    if (!state.elfinId) {
      destroyConnection(state, "sin registro Elfin válido");
    }
  }, REGISTRATION_TIMEOUT_MS);

  socket.on("data", (chunk) => handleSocketData(state, chunk));
  socket.on("close", (hadError) => handleSocketClose(state, "cerrado", { hadError }));
  socket.on("end", () => handleSocketClose(state, "finalizado por remoto"));
  socket.on("error", (err) => {
    console.error(`${logPrefix(state)} socket error:`, {
      message: err?.message || String(err),
      code: err?.code,
      ...buildConnectionSnapshot(state),
    });
    handleSocketClose(state, "error", {
      error: err?.message || String(err),
      code: err?.code,
    });
  });

  return state;
}

// ─── servidor TCP ──────────────────────────────────────────────────────────────

export function startTcpGatewayServer() {
  if (tcpServer) return tcpServer;

  if (!Number.isFinite(DEFAULT_PORT) || DEFAULT_PORT < 1 || DEFAULT_PORT > 65535) {
    throw new Error("TCP_GATEWAY_PORT inválido");
  }

  tcpServer = net.createServer((socket) => {
    // Keep-alive TCP: mantiene viva la sesión NAT del router del cliente.
    // Sin esto, routers domésticos/industriales cierran la conexión idle
    // en 30-300s y el backend no se entera hasta el próximo tx.
    socket.setKeepAlive(true, KEEP_ALIVE_INTERVAL_MS);
    socket.setTimeout(0); // sin timeout de inactividad por parte de Node

    const state = createConnectionState(socket);
    console.log("[TCP GATEWAY] conexión entrante", {
      remoteAddress: socket.remoteAddress,
      remotePort: socket.remotePort,
    });
  });

  tcpServer.on("error", (err) => {
    console.error("[TCP GATEWAY] server error:", err?.message || err);
  });

  tcpServer.listen(DEFAULT_PORT, DEFAULT_HOST, () => {
    console.log(`[TCP GATEWAY] escuchando en ${DEFAULT_HOST}:${DEFAULT_PORT}`);
  });

  return tcpServer;
}

export async function stopTcpGatewayServer() {
  if (!tcpServer) return;

  for (const state of connections.values()) {
    try {
      state.socket.destroy();
    } catch (_) {}
  }
  connections.clear();

  await new Promise((resolve) => tcpServer.close(resolve));
  tcpServer = null;
}

// ─── info de conexión ──────────────────────────────────────────────────────────

export function getTcpGatewayConnectionInfo(elfinId) {
  const state = connections.get(getNormalizedElfinId(elfinId));
  if (!state) return null;

  return {
    elfinId: state.elfinId,
    registeredAt: state.registeredAt,
    lastSeenAt: state.lastSeenAt,
    ready: state.ready,
    remoteAddress: state.socket.remoteAddress,
    remotePort: state.socket.remotePort,
  };
}

// ─── comando raw ───────────────────────────────────────────────────────────────

export function sendTcpClientRawCommand(
  elfinId,
  frameBuffer,
  { matcher, timeoutMs, clearBuffer = true } = {}
) {
  const normalizedElfinId = getNormalizedElfinId(elfinId);
  const state = connections.get(normalizedElfinId);

  if (!state?.socket || state.socket.destroyed) {
    throw new Error(`Elfin TCP Client no conectado (${normalizedElfinId})`);
  }

  // Canal RS485 aún estabilizándose tras el handshake inicial
  if (!state.ready) {
    throw new Error(`Elfin TCP Client no listo aún (${normalizedElfinId})`);
  }

  if (typeof matcher !== "function") {
    throw new Error("Falta matcher para comando TCP del Elfin");
  }

  if (state.pending) {
    throw new Error(`Elfin TCP Client ocupado (${normalizedElfinId})`);
  }

  const buffer = Buffer.from(frameBuffer ?? []);
  if (buffer.length === 0) {
    throw new Error("Trama TCP vacía");
  }

  if (clearBuffer) {
    state.buffer = Buffer.alloc(0);
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (state.pending?.timeout === timer) {
        state.pending = null;
      }
      state.commandTimeouts = (state.commandTimeouts ?? 0) + 1;
      if (
        Number.isFinite(DESTROY_AFTER_TIMEOUTS) &&
        DESTROY_AFTER_TIMEOUTS > 0 &&
        state.commandTimeouts >= DESTROY_AFTER_TIMEOUTS
      ) {
        destroyConnection(
          state,
          `sin respuesta Modbus tras ${state.commandTimeouts} timeout(s)`
        );
      }
      reject(
        new Error(`Timeout esperando respuesta Modbus del controlador (${normalizedElfinId})`)
      );
    }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS);

    state.pending = { matcher, resolve, reject, timeout: timer };

    if (DEBUG_TCP_GATEWAY) {
      console.log(`${logPrefix(state)} tx ${buffer.length} bytes`, {
        hex: toHexPreview(buffer),
      });
    }

    state.socket.write(buffer, (err) => {
      if (!err) return;
      clearTimeout(timer);
      state.pending = null;
      // Limpiar el Map: el socket está muerto, no sirve para futuros comandos
      detachConnection(state);
      reject(
        new Error(`Socket muerto al escribir (${normalizedElfinId}): ${err.message}`)
      );
    });
  });
}
