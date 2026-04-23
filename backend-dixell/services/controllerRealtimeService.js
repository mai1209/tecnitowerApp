import { WebSocket, WebSocketServer } from "ws";
import { ControllerModel } from "../models/Controller.js";
import { verifyAccessToken } from "../token/jwtManager.js";

const WS_PATH = "/ws/controllers";

let wsServer = null;
const controllerSubscribers = new Map();

function normalizeControllerId(controllerId) {
  return String(controllerId ?? "").trim();
}

function subscribeSocket(controllerId, socket) {
  const normalizedControllerId = normalizeControllerId(controllerId);
  if (!normalizedControllerId) return;

  const subscribers = controllerSubscribers.get(normalizedControllerId) ?? new Set();
  subscribers.add(socket);
  controllerSubscribers.set(normalizedControllerId, subscribers);
  socket.controllerId = normalizedControllerId;
}

function unsubscribeSocket(socket) {
  const normalizedControllerId = normalizeControllerId(socket?.controllerId);
  if (!normalizedControllerId) return;

  const subscribers = controllerSubscribers.get(normalizedControllerId);
  if (!subscribers) return;

  subscribers.delete(socket);
  if (subscribers.size === 0) {
    controllerSubscribers.delete(normalizedControllerId);
  }
}

function sendJson(socket, payload) {
  if (!socket || socket.readyState !== WebSocket.OPEN) return;
  socket.send(JSON.stringify(payload));
}

async function authorizeRequest(request) {
  const origin = `http://${request.headers.host || "localhost"}`;
  const url = new URL(request.url || "/", origin);

  if (url.pathname !== WS_PATH) {
    return { ok: false, code: 404, message: "Not Found" };
  }

  const token = String(url.searchParams.get("token") ?? "").trim();
  const controllerId = normalizeControllerId(url.searchParams.get("controllerId"));
  const payload = verifyAccessToken(token);

  if (!payload?.sub) {
    return { ok: false, code: 401, message: "Unauthorized" };
  }

  if (!controllerId) {
    return { ok: false, code: 400, message: "Missing controllerId" };
  }

  const allowed = await ControllerModel.exists({
    _id: controllerId,
    owner: String(payload.sub),
  });

  if (!allowed) {
    return { ok: false, code: 403, message: "Forbidden" };
  }

  return {
    ok: true,
    controllerId,
    userId: String(payload.sub),
  };
}

function handleSocketConnection(socket, request, auth) {
  socket.userId = auth.userId;
  subscribeSocket(auth.controllerId, socket);

  sendJson(socket, {
    type: "connected",
    controllerId: auth.controllerId,
    at: new Date().toISOString(),
  });

  socket.on("close", () => {
    unsubscribeSocket(socket);
  });

  socket.on("error", () => {
    unsubscribeSocket(socket);
  });

  socket.on("message", (rawMessage) => {
    let payload = null;
    try {
      payload = JSON.parse(String(rawMessage ?? ""));
    } catch {
      payload = null;
    }

    if (payload?.type === "ping") {
      sendJson(socket, {
        type: "pong",
        controllerId: auth.controllerId,
        at: new Date().toISOString(),
      });
    }
  });
}

export function initControllerRealtimeServer(server) {
  if (wsServer) return wsServer;

  wsServer = new WebSocketServer({ noServer: true });

  server.on("upgrade", async (request, socket, head) => {
    try {
      const auth = await authorizeRequest(request);
      if (!auth.ok) {
        socket.write(`HTTP/1.1 ${auth.code} ${auth.message}\r\n\r\n`);
        socket.destroy();
        return;
      }

      wsServer.handleUpgrade(request, socket, head, (ws) => {
        handleSocketConnection(ws, request, auth);
      });
    } catch (error) {
      socket.write("HTTP/1.1 500 Internal Server Error\r\n\r\n");
      socket.destroy();
      console.error("[WS] upgrade error:", error?.message || error);
    }
  });

  console.log(`[WS] realtime activo en ${WS_PATH}`);
  return wsServer;
}

export function publishControllerRealtime(controllerId, payload = {}) {
  const normalizedControllerId = normalizeControllerId(controllerId);
  if (!normalizedControllerId) return;

  const subscribers = controllerSubscribers.get(normalizedControllerId);
  if (!subscribers?.size) return;

  const message = {
    type: "controller-refresh",
    controllerId: normalizedControllerId,
    at: new Date().toISOString(),
    ...payload,
  };

  for (const socket of subscribers) {
    sendJson(socket, message);
  }
}

export async function stopControllerRealtimeServer() {
  for (const subscribers of controllerSubscribers.values()) {
    for (const socket of subscribers) {
      try {
        socket.close();
      } catch (_) {}
    }
  }
  controllerSubscribers.clear();

  if (!wsServer) return;

  await new Promise((resolve) => wsServer.close(resolve));
  wsServer = null;
}
