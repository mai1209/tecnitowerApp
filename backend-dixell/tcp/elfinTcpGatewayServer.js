import net from "net";

const DEFAULT_HOST = process.env.TCP_GATEWAY_HOST ?? "0.0.0.0";
const DEFAULT_PORT = Number(process.env.TCP_GATEWAY_PORT ?? 4001);
const DEFAULT_TIMEOUT_MS = Number(process.env.TCP_GATEWAY_TIMEOUT_MS ?? 12000);

let tcpServer = null;
const connections = new Map();

function canonicalizeElfinId(value = "") {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^(ELFIN|ID|MAC)\s*[:=]\s*/i, "")
    .replace(/[^A-Z0-9]/g, "");
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
  connections.set(normalizedElfinId, state);
  console.log(`${logPrefix(state)} conexión registrada`);
}

function detachConnection(state) {
  if (!state?.elfinId) return;
  const current = connections.get(state.elfinId);
  if (current === state) {
    connections.delete(state.elfinId);
  }
}

function tryRegisterElfin(state, chunk) {
  state.identityBuffer += chunk.toString("utf8");
  const parts = state.identityBuffer.split(/\r?\n/);
  state.identityBuffer = parts.pop() ?? "";

  for (const rawPart of parts) {
    const normalized = canonicalizeElfinId(rawPart);
    if (!normalized) continue;
    attachConnection(normalized, state);
    return true;
  }

  const immediateCandidate = state.identityBuffer.trim();
  const printableAscii = /^[\x20-\x7E]+$/.test(immediateCandidate);
  const normalizedImmediate = canonicalizeElfinId(immediateCandidate);
  if (printableAscii && normalizedImmediate.length >= 6) {
    attachConnection(normalizedImmediate, state);
    state.identityBuffer = "";
    return true;
  }

  return false;
}

function resolvePending(state) {
  const pending = state.pending;
  if (!pending) return;

  const match = pending.matcher(state.buffer);
  if (!match?.frame) return;

  clearTimeout(pending.timeout);
  state.pending = null;
  state.buffer = state.buffer.subarray(match.consumedBytes ?? state.buffer.length);
  pending.resolve(Buffer.from(match.frame));
}

function handleSocketData(state, chunk) {
  state.lastSeenAt = new Date();

  if (!state.elfinId && tryRegisterElfin(state, chunk)) {
    return;
  }

  state.buffer = Buffer.concat([state.buffer, Buffer.from(chunk)]);
  resolvePending(state);
}

function handleSocketClose(state, reason = "closed") {
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
    elfinId: null,
    registeredAt: null,
    lastSeenAt: null,
    identityBuffer: "",
    buffer: Buffer.alloc(0),
    pending: null,
  };

  socket.on("data", (chunk) => handleSocketData(state, chunk));
  socket.on("close", () => handleSocketClose(state, "cerrada"));
  socket.on("end", () => handleSocketClose(state, "finalizada"));
  socket.on("error", (err) => {
    console.error(`${logPrefix(state)} socket error:`, err?.message || err);
    handleSocketClose(state, err?.message || "error");
  });

  return state;
}

export function startTcpGatewayServer() {
  if (tcpServer) return tcpServer;

  if (!Number.isFinite(DEFAULT_PORT) || DEFAULT_PORT < 1 || DEFAULT_PORT > 65535) {
    throw new Error("TCP_GATEWAY_PORT inválido");
  }

  tcpServer = net.createServer((socket) => {
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

export function getTcpGatewayConnectionInfo(elfinId) {
  const state = connections.get(getNormalizedElfinId(elfinId));
  if (!state) return null;

  return {
    elfinId: state.elfinId,
    registeredAt: state.registeredAt,
    lastSeenAt: state.lastSeenAt,
    remoteAddress: state.socket.remoteAddress,
    remotePort: state.socket.remotePort,
  };
}

export function sendTcpClientRawCommand(elfinId, frameBuffer, { matcher, timeoutMs } = {}) {
  const normalizedElfinId = getNormalizedElfinId(elfinId);
  const state = connections.get(normalizedElfinId);
  if (!state?.socket || state.socket.destroyed) {
    throw new Error(`Elfin TCP Client no conectado (${normalizedElfinId})`);
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

  state.buffer = Buffer.alloc(0);

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      if (state.pending?.timeout === timer) {
        state.pending = null;
      }
      reject(new Error(`Timeout esperando respuesta TCP del Elfin (${normalizedElfinId})`));
    }, Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : DEFAULT_TIMEOUT_MS);

    state.pending = { matcher, resolve, reject, timeout: timer };
    state.socket.write(buffer, (err) => {
      if (!err) return;
      clearTimeout(timer);
      state.pending = null;
      reject(err);
    });
  });
}
