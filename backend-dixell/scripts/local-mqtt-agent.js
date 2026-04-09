import "dotenv/config";
import mqtt from "mqtt";
import { connectMongo, disconnectMongo } from "../database/connectMongo.js";
import { ControllerModel } from "../models/Controller.js";
import { readRegistersSnapshot, writeRegisterValue } from "../services/modbusService.js";

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const ELFIN_ID = String(process.env.LOCAL_AGENT_ELFIN_ID ?? process.env.ELFIN_ID ?? "")
  .trim()
  .toUpperCase();
const FALLBACK_MODBUS_HOST = process.env.LOCAL_AGENT_MODBUS_HOST ?? process.env.MODBUS_HOST;
const FALLBACK_MODBUS_PORT = Number(
  process.env.LOCAL_AGENT_MODBUS_PORT ?? process.env.MODBUS_DEVICE_PORT ?? 502
);
const DEFAULT_UNIT_ID = Number(process.env.LOCAL_AGENT_UNIT_ID ?? process.env.MODBUS_DEFAULT_UNIT_ID ?? 1);
const MQTT_CLIENT_ID =
  process.env.LOCAL_AGENT_MQTT_CLIENT_ID ??
  process.env.MQTT_CLIENT_ID ??
  `tecnitower-agent-${ELFIN_ID}`;
const CONTROLLER_CACHE_TTL_MS = Number(process.env.LOCAL_AGENT_CONTROLLER_CACHE_TTL_MS ?? 15000);

const commandTopic = `tecnitower/elfins/${ELFIN_ID}/cmd`;
const ackTopic = `tecnitower/elfins/${ELFIN_ID}/ack`;
const dataTopic = `tecnitower/elfins/${ELFIN_ID}/data`;
const controllerCache = new Map();

let client = null;

if (!MQTT_URL) {
  throw new Error("Falta MQTT_URL para iniciar el agente local");
}

if (!ELFIN_ID) {
  throw new Error("Falta LOCAL_AGENT_ELFIN_ID para iniciar el agente local");
}

function summarizeRegisters(registers = {}) {
  return Object.fromEntries(
    Object.entries(registers).map(([register, value]) => {
      if (value && typeof value === "object" && value.error) {
        return [register, `ERROR: ${value.error}`];
      }
      return [register, value];
    })
  );
}

function uniqueFiniteNumbers(values = []) {
  return [...new Set(values.map(Number).filter(Number.isFinite))];
}

async function findControllerByElfinId(elfinId) {
  const normalizedElfinId = String(elfinId ?? "")
    .trim()
    .toUpperCase();
  if (!normalizedElfinId) return null;

  const cached = controllerCache.get(normalizedElfinId);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.controller;
  }

  const controller = await ControllerModel.findOne({ elfinId: normalizedElfinId })
    .select({
      _id: 1,
      name: 1,
      elfinId: 1,
      gatewayMode: 1,
      ipAddress: 1,
      modbusPort: 1,
      unitId: 1,
    })
    .lean();

  controllerCache.set(normalizedElfinId, {
    controller,
    expiresAt: Date.now() + CONTROLLER_CACHE_TTL_MS,
  });

  return controller;
}

async function getConnection(command = {}) {
  const normalizedElfinId = String(command?.elfinId ?? ELFIN_ID)
    .trim()
    .toUpperCase();
  const controller = await findControllerByElfinId(normalizedElfinId);
  const host = String(controller?.ipAddress ?? FALLBACK_MODBUS_HOST ?? "").trim();
  const port = Number(controller?.modbusPort ?? FALLBACK_MODBUS_PORT ?? 502);
  const unitId = Number(
    command?.connection?.unitId ?? command?.unitId ?? controller?.unitId ?? DEFAULT_UNIT_ID
  );

  if (!host) {
    throw new Error(
      `Falta ipAddress para el controlador ${normalizedElfinId}. Configurala en Mongo o LOCAL_AGENT_MODBUS_HOST en el .env local`
    );
  }

  return {
    host,
    port,
    unitId,
    controller,
  };
}

function publishJson(mqttClient, topic, payload) {
  return new Promise((resolve, reject) => {
    mqttClient.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function publishAck(mqttClient, command, payload) {
  await publishJson(mqttClient, ackTopic, {
    correlationId: command?.correlationId,
    action: command?.action,
    ...payload,
    receivedAt: new Date().toISOString(),
  });
}

async function publishData(mqttClient, registers, extra = {}) {
  await publishJson(mqttClient, dataTopic, {
    registers,
    ...extra,
    receivedAt: new Date().toISOString(),
  });
}

async function handleRead(mqttClient, command) {
  const register = Number(command.register ?? command.reg);
  if (!Number.isFinite(register)) {
    throw new Error("Registro inválido para lectura MQTT");
  }

  const connection = await getConnection(command);
  console.log(
    `[LOCAL AGENT] Leyendo registro ${register} en ${connection.host}:${connection.port} uid=${connection.unitId}`
  );
  const snapshot = await readRegistersSnapshot([register], connection);
  console.log("[LOCAL AGENT] Lectura:", summarizeRegisters(snapshot));
  await publishData(mqttClient, snapshot, { source: "local-agent", action: "read" });
  await publishAck(mqttClient, command, { ok: true, registers: snapshot });
}

async function handleReadRegisters(mqttClient, command) {
  const registers = uniqueFiniteNumbers(command.registers ?? []);
  if (registers.length === 0) {
    throw new Error("Faltan registros para lectura MQTT");
  }

  const connection = await getConnection(command);
  console.log(
    `[LOCAL AGENT] Leyendo registros ${registers.join(",")} en ${connection.host}:${connection.port} uid=${connection.unitId}`
  );
  const snapshot = await readRegistersSnapshot(registers, connection);
  console.log("[LOCAL AGENT] Lectura:", summarizeRegisters(snapshot));
  await publishData(mqttClient, snapshot, { source: "local-agent", action: "readRegisters" });
  await publishAck(mqttClient, command, { ok: true, registers: snapshot });
}

async function handleWriteRegister(mqttClient, command) {
  const register = Number(command.register);
  if (!Number.isFinite(register)) {
    throw new Error("Registro inválido para escritura MQTT");
  }

  const connection = await getConnection(command);
  console.log(
    `[LOCAL AGENT] Escribiendo registro ${register}=${command.value} en ${connection.host}:${connection.port} uid=${connection.unitId}`
  );

  const modbus = await writeRegisterValue(command.value, {
    connection,
    register,
    verifyRegister: Number(command.verifyRegister ?? register),
    scale: Number(command.scale ?? 10),
    min: command.min == null ? null : Number(command.min),
    max: command.max == null ? null : Number(command.max),
    dataType: command.dataType ?? "number",
    functionCode: command.functionCode ?? "auto",
    debugLabel: command.debugLabel ?? `MQTT REGISTER ${register}`,
  });

  const verifyRegister = Number(command.verifyRegister ?? register);
  const registers = {
    [verifyRegister]: modbus.rawAfterVerify,
  };

  console.log("[LOCAL AGENT] Escritura OK:", modbus);
  await publishData(mqttClient, registers, { source: "local-agent", action: "writeRegister" });
  await publishAck(mqttClient, command, { ok: true, modbus });
}

async function handleCommand(mqttClient, command) {
  if (command?.action === "read") {
    await handleRead(mqttClient, command);
    return;
  }

  if (command?.action === "readRegisters") {
    await handleReadRegisters(mqttClient, command);
    return;
  }

  if (command?.action === "writeRegister") {
    await handleWriteRegister(mqttClient, command);
    return;
  }

  throw new Error(`Acción MQTT no soportada: ${command?.action ?? "sin acción"}`);
}

async function start() {
  await connectMongo();

  const controller = await findControllerByElfinId(ELFIN_ID);
  if (!controller && !FALLBACK_MODBUS_HOST) {
    throw new Error(
      `No existe controlador con elfinId=${ELFIN_ID} y tampoco LOCAL_AGENT_MODBUS_HOST en el .env local`
    );
  }

  client = mqtt.connect(MQTT_URL, {
    username: MQTT_USERNAME,
    password: MQTT_PASSWORD,
    clientId: MQTT_CLIENT_ID,
    reconnectPeriod: Number(process.env.MQTT_RECONNECT_MS ?? 3000),
  });

  client.on("connect", async () => {
    const currentController = await findControllerByElfinId(ELFIN_ID);
    console.log(`[LOCAL AGENT] MQTT conectado como ${MQTT_CLIENT_ID}. Escuchando ${commandTopic}`);
    console.log("[LOCAL AGENT] Controlador resuelto:", {
      elfinId: ELFIN_ID,
      name: currentController?.name ?? null,
      gatewayMode: currentController?.gatewayMode ?? null,
      host: currentController?.ipAddress ?? FALLBACK_MODBUS_HOST ?? null,
      port: currentController?.modbusPort ?? FALLBACK_MODBUS_PORT,
      unitId: currentController?.unitId ?? DEFAULT_UNIT_ID,
    });
    client.subscribe(commandTopic, { qos: 1 });
  });

  client.on("message", async (_topic, messageBuffer) => {
    let command;
    try {
      command = JSON.parse(messageBuffer.toString());
      console.log("[LOCAL AGENT] Comando recibido:", {
        action: command?.action,
        register: command?.register ?? command?.reg,
        registers: command?.registers,
        value: command?.value,
        correlationId: command?.correlationId,
      });
      await handleCommand(client, command);
    } catch (err) {
      console.error("[LOCAL AGENT] Error procesando comando:", err?.message || err);
      if (command?.correlationId) {
        await publishAck(client, command, {
          ok: false,
          error: err?.message || String(err),
        });
      }
    }
  });

  client.on("error", (err) => {
    console.error("[LOCAL AGENT] MQTT error:", err?.message || err);
  });
}

async function shutdown() {
  try {
    if (client) {
      await new Promise((resolve) => client.end(true, resolve));
    }
  } finally {
    await disconnectMongo().catch(() => {});
    process.exit(0);
  }
}

process.on("SIGINT", () => void shutdown());
process.on("SIGTERM", () => void shutdown());

start().catch(async (err) => {
  console.error("[LOCAL AGENT] Startup error:", err?.message || err);
  await disconnectMongo().catch(() => {});
  process.exit(1);
});
