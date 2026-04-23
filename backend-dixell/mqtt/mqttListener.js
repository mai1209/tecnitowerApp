import mqtt from "mqtt";
import { ControllerModel } from "../models/Controller.js";
import { ControllerReading } from "../models/ControllerReading.js";
import { buildControllerRuntimeState } from "../services/controllerAlertService.js";
import { publishControllerRealtime } from "../services/controllerRealtimeService.js";

export let mqttClient = null;
const pendingCommands = new Map();
const pendingRawCommands = new Map();

export let isWritingModbus = false; 
// Función para bloquear/desbloquear el flujo de telemetría
export function setWritingStatus(status) {
  isWritingModbus = status;
  if (status) console.log("[MQTT] Tráfico pausado para escritura Modbus...");
  else console.log("[MQTT] Tráfico reanudado.");
}

function extractElfinId(topic = "") {
  const parts = topic.split("/").filter(Boolean);
  const elfinsIndex = parts.findIndex((part) => part.toLowerCase() === "elfins");
  if (elfinsIndex === -1) return null;
  return parts[elfinsIndex + 1] ? parts[elfinsIndex + 1].toUpperCase() : null;
}

function extractTopicKind(topic = "") {
  const parts = topic.split("/").filter(Boolean);
  const elfinsIndex = parts.findIndex((part) => part.toLowerCase() === "elfins");
  if (elfinsIndex === -1) return null;
  return parts[elfinsIndex + 2] ? parts[elfinsIndex + 2].toLowerCase() : null;
}

function getRegisterValue(payload, register) {
  const key = String(register);
  const registers = payload?.registers ?? payload?.values ?? payload?.data ?? {};

  return payload?.[key] ?? registers?.[key] ?? registers?.[register] ?? null;
}

function normalizeRawNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function scaledValue(raw, scale = 10) {
  const numeric = normalizeRawNumber(raw);
  return numeric === null ? null : parseFloat((numeric / scale).toFixed(1));
}

function buildTelemetry(payload, topic, controller = null) {
  const receivedAt = new Date();

  const probe1Register = Number(controller?.probe1 ?? 256);
  const probe2Register = Number(controller?.probe2 ?? 258);
  const raw1 = normalizeRawNumber(
    getRegisterValue(payload, probe1Register) ??
    payload.probe1 ??
    payload.raw1 ??
    null
  );
  const raw2 = normalizeRawNumber(
    getRegisterValue(payload, probe2Register) ??
    payload.probe2 ??
    payload.raw2 ??
    null
  );

  const probe1Value = scaledValue(raw1);
  const probe2Value = scaledValue(raw2);

  return {
    probe1Value,
    probe2Value,
    raw1,
    raw2,
    temperature: probe1Value,
    topic,
    receivedAt,
    payload,
  };
}

function resolvePendingCommand(payload) {
  const correlationId = payload?.correlationId;
  if (!correlationId) return false;

  const pending = pendingCommands.get(correlationId);
  if (!pending) return false;

  pendingCommands.delete(correlationId);
  clearTimeout(pending.timeout);

  if (payload.ok === false) {
    const error = new Error(payload.error || "Comando MQTT rechazado por el agente local");
    error.ack = payload;
    pending.reject(error);
    return true;
  }

  pending.resolve(payload);
  return true;
}

function resolvePendingRawCommand(elfinId, messageBuffer) {
  const key = String(elfinId ?? "").trim().toUpperCase();
  const queue = pendingRawCommands.get(key);
  const pending = queue?.shift();

  if (!pending) return false;

  if (queue.length === 0) {
    pendingRawCommands.delete(key);
  }

  clearTimeout(pending.timeout);
  pending.resolve(Buffer.from(messageBuffer));
  return true;
}

async function handleMessage(topic, messageBuffer) {
  const elfinId = extractElfinId(topic);
  if (!elfinId) return;

  const topicKind = extractTopicKind(topic);
  const rawResponseSuffix = String(process.env.MQTT_RAW_RESPONSE_TOPIC_SUFFIX ?? "rx").toLowerCase();
  if (topicKind === rawResponseSuffix) {
    resolvePendingRawCommand(elfinId, messageBuffer);
    return;
  }

  let payload;
  try {
    payload = JSON.parse(messageBuffer.toString());
  } catch (err) {
    return;
  }

  if (topicKind === "ack") {
    resolvePendingCommand(payload);
    return;
  }

  // SI ESTAMOS ESCRIBIENDO, ignoramos solo telemetría entrante para liberar
  // procesamiento del Elfin. Los ACK de comandos se atienden arriba.
  if (isWritingModbus) return;

  try {
    const controller = await ControllerModel.findOne({ elfinId });
    if (!controller) return;

    const telemetry = buildTelemetry(payload, topic, controller);
    const runtimeState = buildControllerRuntimeState(controller, { telemetry });
    controller.lastTelemetry = telemetry;
    controller.connectionState = runtimeState.connectionState;
    controller.alertState = runtimeState.alertState;
    await controller.save();

    await ControllerReading.create({
      controller: controller._id,
      elfinId,
      payload,
      topic,
      receivedAt: telemetry.receivedAt,
    });

    publishControllerRealtime(controller._id, { reason: "mqtt-telemetry" });
  } catch (err) {
    console.error("[MQTT] Error guardando lectura:", err.message);
  }
}

export function publishMqttCommand(elfinId, command = {}, { timeoutMs } = {}) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error("MQTT no está conectado");
  }

  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();
  if (!normalizedElfinId) {
    throw new Error("Falta elfinId para publicar comando MQTT");
  }

  const timeout = Number(timeoutMs ?? process.env.MQTT_COMMAND_TIMEOUT_MS ?? 12000);
  const correlationId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const topic = `tecnitower/elfins/${normalizedElfinId}/cmd`;
  const payload = {
    ...command,
    correlationId,
    sentAt: new Date().toISOString(),
  };

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      pendingCommands.delete(correlationId);
      reject(new Error(`Timeout esperando ACK MQTT (${normalizedElfinId})`));
    }, Number.isFinite(timeout) && timeout > 0 ? timeout : 12000);

    pendingCommands.set(correlationId, { resolve, reject, timeout: timer });

    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (!err) return;
      clearTimeout(timer);
      pendingCommands.delete(correlationId);
      reject(err);
    });
  });
}

export function publishMqttRawCommand(elfinId, frameBuffer, { timeoutMs } = {}) {
  if (!mqttClient || !mqttClient.connected) {
    throw new Error("MQTT no está conectado");
  }

  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();
  if (!normalizedElfinId) {
    throw new Error("Falta elfinId para publicar trama MQTT");
  }

  const buffer = Buffer.from(frameBuffer ?? []);
  if (buffer.length === 0) {
    throw new Error("Trama MQTT vacía");
  }

  const timeout = Number(timeoutMs ?? process.env.MQTT_COMMAND_TIMEOUT_MS ?? 12000);
  const suffix = String(process.env.MQTT_RAW_COMMAND_TOPIC_SUFFIX ?? "tx").replace(/^\/+|\/+$/g, "");
  const topic = `tecnitower/elfins/${normalizedElfinId}/${suffix}`;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      const queue = pendingRawCommands.get(normalizedElfinId) ?? [];
      const index = queue.findIndex((item) => item.timeout === timer);
      if (index >= 0) queue.splice(index, 1);
      if (queue.length === 0) pendingRawCommands.delete(normalizedElfinId);
      reject(new Error(`Timeout esperando respuesta MQTT raw (${normalizedElfinId})`));
    }, Number.isFinite(timeout) && timeout > 0 ? timeout : 12000);

    const queue = pendingRawCommands.get(normalizedElfinId) ?? [];
    queue.push({ resolve, reject, timeout: timer });
    pendingRawCommands.set(normalizedElfinId, queue);

    mqttClient.publish(topic, buffer, { qos: 1 }, (err) => {
      if (!err) return;
      clearTimeout(timer);
      const pendingQueue = pendingRawCommands.get(normalizedElfinId) ?? [];
      const index = pendingQueue.findIndex((item) => item.timeout === timer);
      if (index >= 0) pendingQueue.splice(index, 1);
      if (pendingQueue.length === 0) pendingRawCommands.delete(normalizedElfinId);
      reject(err);
    });
  });
}

export function startMqttListener() {
  if (mqttClient) return mqttClient;

  if (!process.env.MQTT_URL) {
    console.warn("[MQTT] No se inició: falta MQTT_URL");
    return null;
  }

  const clientId =
    process.env.BACKEND_MQTT_CLIENT_ID ??
    process.env.MQTT_CLIENT_ID ??
    `tecnitower-api-${String(process.env.NODE_ENV ?? "local").toLowerCase()}`;

  const options = {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    clientId,
    reconnectPeriod: Number(process.env.MQTT_RECONNECT_MS ?? 3000),
  };

  mqttClient = mqtt.connect(process.env.MQTT_URL, options);

  mqttClient.on("connect", () => {
    console.log(`[MQTT] Conectado al broker como ${clientId}`);
    const topic = process.env.MQTT_TOPIC ?? "tecnitower/elfins/+/data";
    const ackTopic = process.env.MQTT_ACK_TOPIC ?? "tecnitower/elfins/+/ack";
    const rawResponseTopic = `tecnitower/elfins/+/${process.env.MQTT_RAW_RESPONSE_TOPIC_SUFFIX ?? "rx"}`;
    mqttClient.subscribe([topic, ackTopic, rawResponseTopic]);
  });

  mqttClient.on("message", handleMessage);
  return mqttClient;
}
