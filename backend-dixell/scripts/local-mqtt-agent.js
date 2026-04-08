import "dotenv/config";
import mqtt from "mqtt";
import {
  readRegistersSnapshot,
  writeRegisterValue,
} from "../services/modbusService.js";

const MQTT_URL = process.env.MQTT_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;
const ELFIN_ID = String(process.env.LOCAL_AGENT_ELFIN_ID ?? process.env.ELFIN_ID ?? "")
  .trim()
  .toUpperCase();
const MODBUS_HOST = process.env.LOCAL_AGENT_MODBUS_HOST ?? process.env.MODBUS_HOST;
const MODBUS_PORT = Number(process.env.LOCAL_AGENT_MODBUS_PORT ?? process.env.MODBUS_DEVICE_PORT ?? 502);
const DEFAULT_UNIT_ID = Number(process.env.LOCAL_AGENT_UNIT_ID ?? process.env.MODBUS_DEFAULT_UNIT_ID ?? 1);
const MQTT_CLIENT_ID =
  process.env.LOCAL_AGENT_MQTT_CLIENT_ID ??
  process.env.MQTT_CLIENT_ID ??
  `tecnitower-agent-${ELFIN_ID}`;

if (!MQTT_URL) {
  throw new Error("Falta MQTT_URL para iniciar el agente local");
}

if (!ELFIN_ID) {
  throw new Error("Falta LOCAL_AGENT_ELFIN_ID para iniciar el agente local");
}

if (!MODBUS_HOST) {
  throw new Error("Falta LOCAL_AGENT_MODBUS_HOST para conectar con el Elfin local");
}

const commandTopic = `tecnitower/elfins/${ELFIN_ID}/cmd`;
const ackTopic = `tecnitower/elfins/${ELFIN_ID}/ack`;
const dataTopic = `tecnitower/elfins/${ELFIN_ID}/data`;

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

function getConnection(command = {}) {
  const unitId = Number(command?.connection?.unitId ?? command?.unitId ?? DEFAULT_UNIT_ID);

  return {
    host: MODBUS_HOST,
    port: MODBUS_PORT,
    unitId,
  };
}

function publishJson(client, topic, payload) {
  return new Promise((resolve, reject) => {
    client.publish(topic, JSON.stringify(payload), { qos: 1 }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function publishAck(client, command, payload) {
  await publishJson(client, ackTopic, {
    correlationId: command?.correlationId,
    action: command?.action,
    ...payload,
    receivedAt: new Date().toISOString(),
  });
}

async function publishData(client, registers, extra = {}) {
  await publishJson(client, dataTopic, {
    registers,
    ...extra,
    receivedAt: new Date().toISOString(),
  });
}

function uniqueFiniteNumbers(values = []) {
  return [...new Set(values.map(Number).filter(Number.isFinite))];
}

async function handleRead(client, command) {
  const register = Number(command.register ?? command.reg);
  if (!Number.isFinite(register)) {
    throw new Error("Registro inválido para lectura MQTT");
  }

  const connection = getConnection(command);
  console.log(`[LOCAL AGENT] Leyendo registro ${register} en ${connection.host}:${connection.port} uid=${connection.unitId}`);
  const snapshot = await readRegistersSnapshot([register], connection);
  console.log("[LOCAL AGENT] Lectura:", summarizeRegisters(snapshot));
  await publishData(client, snapshot, { source: "local-agent", action: "read" });
  await publishAck(client, command, { ok: true, registers: snapshot });
}

async function handleReadRegisters(client, command) {
  const registers = uniqueFiniteNumbers(command.registers ?? []);
  if (registers.length === 0) {
    throw new Error("Faltan registros para lectura MQTT");
  }

  const connection = getConnection(command);
  console.log(`[LOCAL AGENT] Leyendo registros ${registers.join(",")} en ${connection.host}:${connection.port} uid=${connection.unitId}`);
  const snapshot = await readRegistersSnapshot(registers, connection);
  console.log("[LOCAL AGENT] Lectura:", summarizeRegisters(snapshot));
  await publishData(client, snapshot, { source: "local-agent", action: "readRegisters" });
  await publishAck(client, command, { ok: true, registers: snapshot });
}

async function handleWriteRegister(client, command) {
  const register = Number(command.register);
  if (!Number.isFinite(register)) {
    throw new Error("Registro inválido para escritura MQTT");
  }

  const connection = getConnection(command);
  console.log(`[LOCAL AGENT] Escribiendo registro ${register}=${command.value} en ${connection.host}:${connection.port} uid=${connection.unitId}`);

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
  await publishData(client, registers, { source: "local-agent", action: "writeRegister" });
  await publishAck(client, command, { ok: true, modbus });
}

async function handleCommand(client, command) {
  if (command?.action === "read") {
    await handleRead(client, command);
    return;
  }

  if (command?.action === "readRegisters") {
    await handleReadRegisters(client, command);
    return;
  }

  if (command?.action === "writeRegister") {
    await handleWriteRegister(client, command);
    return;
  }

  throw new Error(`Acción MQTT no soportada: ${command?.action ?? "sin acción"}`);
}

const client = mqtt.connect(MQTT_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,
  clientId: MQTT_CLIENT_ID,
  reconnectPeriod: Number(process.env.MQTT_RECONNECT_MS ?? 3000),
});

client.on("connect", () => {
  console.log(`[LOCAL AGENT] MQTT conectado como ${MQTT_CLIENT_ID}. Escuchando ${commandTopic}`);
  console.log(`[LOCAL AGENT] Modbus local: ${MODBUS_HOST}:${MODBUS_PORT} uid=${DEFAULT_UNIT_ID}`);
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

function shutdown() {
  client.end(true, () => process.exit(0));
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
