import ModbusRTU from "modbus-serial";

export const client = new ModbusRTU();

// IP del Elfin en red local actual
// IP por defecto del Elfin (red 192.168.30.x)
const DEFAULT_HOST = process.env.MODBUS_HOST ?? "192.168.100.57";
const DEFAULT_PORT = Number(process.env.MODBUS_DEVICE_PORT ?? 502);
const DEFAULT_UNIT_ID = Number(process.env.MODBUS_DEFAULT_UNIT_ID ?? 1);
const DEFAULT_TIMEOUT_MS = Number(process.env.MODBUS_TIMEOUT_MS ?? 3000);

const DEFAULT_SETPOINT_REGISTER = 768;
const LEGACY_SETPOINT_REGISTER = 1536;

const USER_PARAMS_START = 768;
const USER_PARAMS_MAX = 5;
const DEFAULT_SETPOINT_SCALE = 10;

let activeConnectionKey = null;
let modbusQueue = Promise.resolve();

function withModbusLock(fn) {
  const next = modbusQueue.then(fn, fn);
  modbusQueue = next.then(() => undefined, () => undefined);
  return next;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isBusyException(err) {
  const msg = String(err?.message ?? "").toLowerCase();
  return msg.includes("exception 6") || msg.includes("busy");
}

async function retryIfBusy(op, { attempts = 6, baseDelayMs = 600 } = {}) {
  let lastErr;
  for (let i = 0; i < attempts; i += 1) {
    try {
      return await op();
    } catch (err) {
      lastErr = err;
      if (!isBusyException(err)) throw err;
      await sleep(baseDelayMs + i * 300);
    }
  }
  throw lastErr;
}

function normalizeConnection(connection = {}) {
  const host = String(connection.host ?? connection.ipAddress ?? DEFAULT_HOST).trim();
  const port = Number(connection.port ?? connection.modbusPort ?? DEFAULT_PORT);
  const unitId = Number(connection.unitId ?? DEFAULT_UNIT_ID);

  if (!host) {
    throw new Error("Falta host/IP para la conexión Modbus");
  }

  if (!Number.isFinite(port) || port < 1 || port > 65535) {
    throw new Error("Puerto Modbus inválido");
  }

  if (!Number.isFinite(unitId) || unitId < 1 || unitId > 247) {
    throw new Error("Unit ID Modbus inválido");
  }

  return { host, port, unitId };
}

function getConnectionKey(connection) {
  return `${connection.host}:${connection.port}:${connection.unitId}`;
}

async function resetConnectionIfNeeded(connection) {
  const nextKey = getConnectionKey(connection);
  if (client.isOpen && activeConnectionKey && activeConnectionKey !== nextKey) {
    try {
      client.close();
    } catch (_) {}
    activeConnectionKey = null;
  }
}

export const connect = async (connection = {}) => {
  const normalized = normalizeConnection(connection);
  await resetConnectionIfNeeded(normalized);

  if (!client.isOpen) {
    await client.connectTcpRTUBuffered(normalized.host, { port: normalized.port });
  }

  client.setTimeout(Number.isFinite(DEFAULT_TIMEOUT_MS) && DEFAULT_TIMEOUT_MS > 0 ? DEFAULT_TIMEOUT_MS : 3000);
  client.setID(normalized.unitId);
  activeConnectionKey = getConnectionKey(normalized);

  return normalized;
};

async function readRawRegister(register) {
  const data = await retryIfBusy(() => client.readHoldingRegisters(register, 1));
  return data.data[0];
}

function toSigned16(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  return v & 0x8000 ? v - 0x10000 : v;
}

function toUnsigned16(value) {
  const v = Number(value);
  if (!Number.isFinite(v)) return null;
  return v < 0 ? 0x10000 + v : v;
}

function normalizeWriteValue(value, { scale = 1, dataType = "number" } = {}) {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue)) {
    throw new Error("Valor inválido");
  }

  if (dataType === "boolean") {
    return numericValue ? 1 : 0;
  }

  if (dataType === "integer") {
    return Math.round(numericValue);
  }

  return Math.round(numericValue * scale);
}

function describeModbusError(err) {
  return {
    message: err?.message || String(err),
    code: err?.modbusCode ?? err?.code ?? null,
    errno: err?.errno ?? null,
  };
}

function logWriteDebug(label, payload) {
  if (!label) return;
  console.log(`🧪 [${label}]`, payload);
}

async function writeHoldingRegister(
  register,
  rawValue,
  { functionCode = "auto", debugLabel = null } = {}
) {
  const safeValue = toUnsigned16(rawValue);

  if (functionCode === "0x06") {
    logWriteDebug(debugLabel, { stage: "write-start", functionCode: "0x06", register, rawValue, safeValue });
    await retryIfBusy(() => client.writeRegister(register, safeValue));
    return { functionCode: "0x06" };
  }

  if (functionCode === "0x10") {
    logWriteDebug(debugLabel, { stage: "write-start", functionCode: "0x10", register, rawValue, safeValue });
    await retryIfBusy(() => client.writeRegisters(register, [safeValue]));
    return { functionCode: "0x10" };
  }

  try {
    logWriteDebug(debugLabel, { stage: "write-start", functionCode: "0x10", register, rawValue, safeValue });
    await retryIfBusy(() => client.writeRegisters(register, [safeValue]));
    return { functionCode: "0x10" };
  } catch (err) {
    const fc16Error = describeModbusError(err);
    logWriteDebug(debugLabel, { stage: "write-failed", functionCode: "0x10", register, rawValue, error: fc16Error });
    logWriteDebug(debugLabel, { stage: "write-start", functionCode: "0x06", register, rawValue, safeValue });
    await retryIfBusy(() => client.writeRegister(register, safeValue));
    return { functionCode: "0x06", fallbackError: fc16Error.message, fallbackMeta: fc16Error };
  }
}

export async function writeRegisterValue(
  value,
  {
    connection = {},
    register,
    verifyRegister = register,
    scale = DEFAULT_SETPOINT_SCALE,
    min = null,
    max = null,
    dataType = "number",
    functionCode = "auto",
    debugLabel = null,
  } = {}
) {
  return withModbusLock(async () => {
    await connect(connection);

    if (!Number.isFinite(Number(register))) {
      throw new Error("Registro inválido");
    }

    const numericValue = Number(value);
    if (Number.isFinite(min) && numericValue < Number(min)) {
      throw new Error(`Valor por debajo del mínimo permitido (${min})`);
    }

    if (Number.isFinite(max) && numericValue > Number(max)) {
      throw new Error(`Valor por encima del máximo permitido (${max})`);
    }

    const rawValue = normalizeWriteValue(numericValue, { scale, dataType });
    const rawBeforeVerify = Number.isFinite(Number(verifyRegister))
      ? toSigned16(await readRawRegister(verifyRegister))
      : null;
    logWriteDebug(debugLabel, {
      stage: "verify-before",
      register,
      verifyRegister,
      rawBeforeVerify,
      valueRequested: numericValue,
      scale,
      dataType,
      functionCode,
    });

    const meta = await writeHoldingRegister(register, rawValue, { functionCode, debugLabel });
    await sleep(900);

    const rawAfterVerify = Number.isFinite(Number(verifyRegister))
      ? toSigned16(await readRawRegister(verifyRegister))
      : null;

    const normalizedAfter =
      dataType === "number" ? rawAfterVerify / scale : rawAfterVerify;
    const ok = rawAfterVerify === rawValue || Number(verifyRegister) !== Number(register);
    logWriteDebug(debugLabel, {
      stage: "verify-after",
      register,
      verifyRegister,
      rawValue,
      rawAfterVerify,
      valueAfterVerify: Number.isFinite(normalizedAfter) ? normalizedAfter : null,
      ok,
      ...meta,
    });

    return {
      ok,
      register,
      verifyRegister,
      rawValue,
      rawBeforeVerify,
      rawAfterVerify,
      valueWritten: numericValue,
      valueAfterVerify: Number.isFinite(normalizedAfter) ? normalizedAfter : null,
      ...meta,
    };
  });
}

export const writeSetpoint = async (
  temperature,
  {
    connection = {},
    register = DEFAULT_SETPOINT_REGISTER,
    verifyRegister = register,
    scale = DEFAULT_SETPOINT_SCALE,
    min = null,
    max = null,
    functionCode = "auto",
    debugLabel = null,
  } = {}
) =>
  writeRegisterValue(temperature, {
    connection,
    register,
    verifyRegister,
    scale,
    min,
    max,
    dataType: "number",
    functionCode,
    debugLabel,
  });

export const readSetpoint = async ({
  connection = {},
  register = DEFAULT_SETPOINT_REGISTER,
  scale = DEFAULT_SETPOINT_SCALE,
} = {}) => {
  return withModbusLock(async () => {
    await connect(connection);
    const data = await retryIfBusy(() => client.readHoldingRegisters(register, 1));
    const raw = toSigned16(data.data[0]);
    return raw / scale;
  });
};

export async function readRegistersSnapshot(registers, connection = {}) {
  return withModbusLock(async () => {
    await connect(connection);
    const out = {};
    for (const register of registers ?? []) {
      try {
        const data = await retryIfBusy(() => client.readHoldingRegisters(register, 1));
        out[register] = toSigned16(data.data[0]);
      } catch (err) {
        out[register] = { error: err.message };
      }
      await sleep(250);
    }
    return out;
  });
}

export async function readRegisterDefinitionsValues({
  connection = {},
  definitions = [],
} = {}) {
  return withModbusLock(async () => {
    await connect(connection);
    const items = [];

    for (const definition of definitions) {
      const register = Number(definition?.register);
      if (!Number.isFinite(register)) continue;

      try {
        const data = await retryIfBusy(() => client.readHoldingRegisters(register, 1));
        const raw = toSigned16(data.data[0]);
        const scale = Number(definition?.scale ?? DEFAULT_SETPOINT_SCALE);
        const dataType = definition?.dataType ?? "number";
        const value = dataType === "number" ? raw / scale : raw;

        items.push({
          ...definition,
          raw,
          value,
        });
      } catch (err) {
        items.push({
          ...definition,
          error: err?.message || String(err),
          value: null,
        });
      }

      await sleep(200);
    }

    return items;
  });
}

export async function readDiagnosticSnapshot({
  connection = {},
  probeRegister = 256,
  setpointRegister = DEFAULT_SETPOINT_REGISTER,
  extraSetpointRegisters = [],
} = {}) {
  return withModbusLock(async () => {
    await connect(connection);

    let probeRaw = null;
    try {
      const probeData = await retryIfBusy(() => client.readHoldingRegisters(probeRegister, 1));
      probeRaw = toSigned16(probeData.data[0]);
    } catch (err) {
      probeRaw = { error: err?.message || String(err) };
    }

    const allRegisters = [
      setpointRegister,
      ...(Array.isArray(extraSetpointRegisters) ? extraSetpointRegisters : []),
    ].filter((value, index, array) => Number.isFinite(Number(value)) && array.indexOf(value) === index);

    const setpointsRaw = {};
    for (const register of allRegisters) {
      try {
        const data = await retryIfBusy(() => client.readHoldingRegisters(register, 1));
        setpointsRaw[register] = toSigned16(data.data[0]);
      } catch (err) {
        setpointsRaw[register] = { error: err?.message || String(err) };
      }
      await sleep(200);
    }

    return {
      probeRaw,
      setpointsRaw,
    };
  });
}

export async function readUserParams768Block({
  connection = {},
  scale = DEFAULT_SETPOINT_SCALE,
} = {}) {
  return withModbusLock(async () => {
    await connect(connection);

    try {
      const res = await retryIfBusy(() =>
        client.readHoldingRegisters(USER_PARAMS_START, USER_PARAMS_MAX)
      );

      const data = Array.isArray(res?.data) ? res.data.slice(0, USER_PARAMS_MAX) : [];
      const items = data.map((raw, idx) => {
        const signed = toSigned16(raw);
        return {
          register: USER_PARAMS_START + idx,
          raw: signed,
          value: signed / scale,
        };
      });

      return {
        raw: data.map(toSigned16),
        items,
        scale,
      };
    } catch (err) {
      console.error("[MODBUS] Error leyendo bloque 768:", err.message);
      return null;
    }
  });
}

export async function scanSetpointRegisters({
  connection = {},
  temperature,
  scale = DEFAULT_SETPOINT_SCALE,
  start,
  end,
  step = 1,
  candidateRegisters = [],
  verifyRegister = DEFAULT_SETPOINT_REGISTER,
  maxAttempts = 40,
} = {}) {
  return withModbusLock(async () => {
    await connect(connection);

    const explicitCandidates = Array.isArray(candidateRegisters)
      ? candidateRegisters.map(Number).filter((value) => Number.isFinite(value))
      : [];
    const numericStart = Number(start);
    const numericEnd = Number(end);
    const numericStep = Number(step);

    if (
      explicitCandidates.length === 0 &&
      (!Number.isFinite(numericStart) ||
        !Number.isFinite(numericEnd) ||
        !Number.isFinite(numericStep) ||
        numericStep <= 0)
    ) {
      throw new Error("Rango inválido para escaneo");
    }

    const originalVerifyRaw = toSigned16(await readRawRegister(verifyRegister));
    const results = [];
    const affectingRegisters = [];
    const registersToTest =
      explicitCandidates.length > 0
        ? explicitCandidates.slice(0, maxAttempts)
        : Array.from(
            { length: Math.floor((numericEnd - numericStart) / numericStep) + 1 },
            (_, index) => numericStart + index * numericStep
          ).slice(0, maxAttempts);

    for (const register of registersToTest) {
      try {
        const originalCandidateRaw = toSigned16(await readRawRegister(register));
        const targetRaw = Math.round(Number(temperature) * scale);
        const write = await writeHoldingRegister(register, targetRaw);
        await sleep(900);
        const verifyRaw = toSigned16(await readRawRegister(verifyRegister));
        const affectsSetpoint = verifyRaw === targetRaw;

        results.push({
          register,
          writeOk: true,
          affectsSetpoint,
          functionCode: write.functionCode,
          originalCandidateRaw,
          verifyRaw,
        });

        if (affectsSetpoint) affectingRegisters.push(register);

        // Si el candidato no es el registro correcto del setpoint, restauramos
        // su valor original para no dejar parámetros desconocidos alterados.
        if (!affectsSetpoint && Number.isFinite(originalCandidateRaw)) {
          try {
            await writeHoldingRegister(register, originalCandidateRaw);
            await sleep(500);
          } catch (_) {}
        }
      } catch (err) {
        results.push({
          register,
          writeOk: false,
          affectsSetpoint: false,
          error: err?.message || String(err),
        });
      }

      await sleep(250);
    }

    if (Number.isFinite(originalVerifyRaw)) {
      try {
        await writeHoldingRegister(verifyRegister, originalVerifyRaw);
      } catch (_) {}
    }

    return {
      scale,
      registersTested: results.length,
      affectingRegisters,
      results,
    };
  });
}

export { LEGACY_SETPOINT_REGISTER, DEFAULT_SETPOINT_REGISTER };
