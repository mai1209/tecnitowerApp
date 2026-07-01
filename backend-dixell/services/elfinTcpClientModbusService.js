import { sendTcpClientRawCommand } from "../tcp/elfinTcpGatewayServer.js";

const DEFAULT_SETPOINT_SCALE = 10;
const DEFAULT_TCP_CLIENT_MODBUS_MODE = normalizeTcpClientModbusMode(
  process.env.TCP_CLIENT_MODBUS_MODE ?? "rtu"
);
const pendingLocks = new Map();
let nextTransactionId = 1;

function withElfinTcpLock(elfinId, fn) {
  const key = String(elfinId ?? "").trim().toUpperCase();
  const previous = pendingLocks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  const cleanup = next.finally(() => {
    if (pendingLocks.get(key) === next) {
      pendingLocks.delete(key);
    }
  });
  cleanup.catch(() => {});
  pendingLocks.set(key, next);
  return next;
}

function normalizeTcpClientModbusMode(value) {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();
  if (
    normalized === "tcp" ||
    normalized === "modbus-tcp" ||
    normalized === "modbus_tcp" ||
    normalized === "mbap"
  ) {
    return "modbus-tcp";
  }
  return "rtu";
}

function getTcpClientModbusMode(value) {
  return normalizeTcpClientModbusMode(value ?? DEFAULT_TCP_CLIENT_MODBUS_MODE);
}

function allocateTransactionId() {
  const transactionId = nextTransactionId;
  nextTransactionId = nextTransactionId >= 0xffff ? 1 : nextTransactionId + 1;
  return transactionId;
}

function crc16Modbus(buffer) {
  let crc = 0xffff;

  for (const byte of buffer) {
    crc ^= byte;
    for (let i = 0; i < 8; i += 1) {
      crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
    }
  }

  return crc;
}

function appendCrc(buffer) {
  const crc = crc16Modbus(buffer);
  return Buffer.concat([buffer, Buffer.from([crc & 0xff, (crc >> 8) & 0xff])]);
}

function hasValidCrc(frame) {
  if (!frame || frame.length < 5) return false;
  const body = frame.subarray(0, -2);
  const expected = crc16Modbus(body);
  const actual = frame[frame.length - 2] | (frame[frame.length - 1] << 8);
  return expected === actual;
}

function buildModbusTcpFrame({ transactionId, unitId, pdu }) {
  const mbap = Buffer.alloc(7);
  mbap.writeUInt16BE(transactionId, 0);
  mbap.writeUInt16BE(0, 2);
  mbap.writeUInt16BE(pdu.length + 1, 4);
  mbap[6] = unitId;
  return Buffer.concat([mbap, pdu]);
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

  if (dataType === "boolean") return numericValue ? 1 : 0;
  if (dataType === "integer") return Math.round(numericValue);
  return Math.round(numericValue * scale);
}

function buildReadHoldingRegisterFrame({ unitId, register, mode = DEFAULT_TCP_CLIENT_MODBUS_MODE, transactionId }) {
  const normalizedMode = getTcpClientModbusMode(mode);
  if (normalizedMode === "modbus-tcp") {
    const pdu = Buffer.alloc(5);
    pdu[0] = 0x03;
    pdu.writeUInt16BE(register, 1);
    pdu.writeUInt16BE(1, 3);
    return buildModbusTcpFrame({ transactionId, unitId, pdu });
  }

  const body = Buffer.alloc(6);
  body[0] = unitId;
  body[1] = 0x03;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(1, 4);
  return appendCrc(body);
}

function buildWriteSingleRegisterFrame({
  unitId,
  register,
  rawValue,
  mode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
  transactionId,
}) {
  const normalizedMode = getTcpClientModbusMode(mode);
  if (normalizedMode === "modbus-tcp") {
    const pdu = Buffer.alloc(5);
    pdu[0] = 0x06;
    pdu.writeUInt16BE(register, 1);
    pdu.writeUInt16BE(toUnsigned16(rawValue), 3);
    return buildModbusTcpFrame({ transactionId, unitId, pdu });
  }

  const body = Buffer.alloc(6);
  body[0] = unitId;
  body[1] = 0x06;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(toUnsigned16(rawValue), 4);
  return appendCrc(body);
}

function buildWriteMultipleRegistersFrame({
  unitId,
  register,
  rawValue,
  mode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
  transactionId,
}) {
  const normalizedMode = getTcpClientModbusMode(mode);
  if (normalizedMode === "modbus-tcp") {
    const pdu = Buffer.alloc(8);
    pdu[0] = 0x10;
    pdu.writeUInt16BE(register, 1);
    pdu.writeUInt16BE(1, 3);
    pdu[5] = 2;
    pdu.writeUInt16BE(toUnsigned16(rawValue), 6);
    return buildModbusTcpFrame({ transactionId, unitId, pdu });
  }

  const body = Buffer.alloc(9);
  body[0] = unitId;
  body[1] = 0x10;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(1, 4);
  body[6] = 2;
  body.writeUInt16BE(toUnsigned16(rawValue), 7);
  return appendCrc(body);
}

function tryExtractResponseFrame(buffer, { unitId, functionCode, mode = DEFAULT_TCP_CLIENT_MODBUS_MODE, transactionId }) {
  const response = Buffer.from(buffer ?? []);
  const normalizedMode = getTcpClientModbusMode(mode);

  if (normalizedMode === "modbus-tcp") {
    for (let index = 0; index <= response.length - 9; index += 1) {
      if (response.readUInt16BE(index + 2) !== 0) continue;
      if (transactionId != null && response.readUInt16BE(index) !== transactionId) continue;

      const length = response.readUInt16BE(index + 4);
      const totalLength = 6 + length;
      const frame = response.subarray(index, index + totalLength);
      if (frame.length !== totalLength) return null;
      if (frame[6] !== unitId) continue;

      const receivedFunctionCode = frame[7];
      if (receivedFunctionCode !== functionCode && receivedFunctionCode !== (functionCode | 0x80)) {
        continue;
      }

      return {
        frame: Buffer.from(frame),
        consumedBytes: index + totalLength,
      };
    }

    return null;
  }

  for (let index = 0; index <= response.length - 5; index += 1) {
    if (response[index] !== unitId) continue;

    const receivedFunctionCode = response[index + 1];
    if (receivedFunctionCode !== functionCode && receivedFunctionCode !== (functionCode | 0x80)) {
      continue;
    }

    let length = 0;
    if (receivedFunctionCode === 0x03) {
      if (index + 3 > response.length) return null;
      length = 5 + response[index + 2];
    } else if (receivedFunctionCode === 0x06 || receivedFunctionCode === 0x10) {
      length = 8;
    } else if (receivedFunctionCode & 0x80) {
      length = 5;
    }

    const frame = response.subarray(index, index + length);
    if (frame.length !== length) return null;
    if (!hasValidCrc(frame)) continue;

    return {
      frame: Buffer.from(frame),
      consumedBytes: index + length,
    };
  }

  return null;
}

function assertNoModbusException(frame, mode = DEFAULT_TCP_CLIENT_MODBUS_MODE) {
  const normalizedMode = getTcpClientModbusMode(mode);
  const functionCodeIndex = normalizedMode === "modbus-tcp" ? 7 : 1;
  const exceptionCodeIndex = normalizedMode === "modbus-tcp" ? 8 : 2;

  if (!(frame[functionCodeIndex] & 0x80)) return;
  throw new Error(`Modbus exception ${frame[exceptionCodeIndex]}`);
}

async function sendFrameAndAwait({
  elfinId,
  unitId,
  functionCode,
  frameBuffer,
  mode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
  transactionId,
}) {
  const normalizedMode = getTcpClientModbusMode(mode);
  return sendTcpClientRawCommand(elfinId, frameBuffer, {
    clearBuffer: normalizedMode !== "modbus-tcp",
    matcher: (buffer) =>
      tryExtractResponseFrame(buffer, {
        unitId,
        functionCode,
        mode: normalizedMode,
        transactionId,
      }),
  });
}

async function readRawRegisterViaTcpClient({
  elfinId,
  unitId,
  register,
  modbusMode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
}) {
  const mode = getTcpClientModbusMode(modbusMode);
  const transactionId = mode === "modbus-tcp" ? allocateTransactionId() : undefined;
  const request = buildReadHoldingRegisterFrame({ unitId, register, mode, transactionId });
  const response = await sendFrameAndAwait({
    elfinId,
    unitId,
    functionCode: 0x03,
    frameBuffer: request,
    mode,
    transactionId,
  });
  assertNoModbusException(response, mode);

  if (mode === "modbus-tcp") {
    if (response[8] !== 2) {
      throw new Error(`Respuesta Modbus TCP client inesperada para registro ${register}`);
    }

    return toSigned16(response.readUInt16BE(9));
  }

  if (response[2] !== 2) {
    throw new Error(`Respuesta Modbus TCP client inesperada para registro ${register}`);
  }

  return toSigned16(response.readUInt16BE(3));
}

async function writeHoldingRegisterViaTcpClient({
  elfinId,
  unitId,
  register,
  rawValue,
  functionCode = "auto",
  modbusMode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
}) {
  const mode = getTcpClientModbusMode(modbusMode);

  const sendWrite = async (resolvedFunctionCode) => {
    const numericFunctionCode = resolvedFunctionCode === "0x06" ? 0x06 : 0x10;
    const transactionId = mode === "modbus-tcp" ? allocateTransactionId() : undefined;
    const request =
      numericFunctionCode === 0x06
        ? buildWriteSingleRegisterFrame({ unitId, register, rawValue, mode, transactionId })
        : buildWriteMultipleRegistersFrame({ unitId, register, rawValue, mode, transactionId });
    const response = await sendFrameAndAwait({
      elfinId,
      unitId,
      functionCode: numericFunctionCode,
      frameBuffer: request,
      mode,
      transactionId,
    });
    assertNoModbusException(response, mode);
    return { functionCode: resolvedFunctionCode };
  };

  if (functionCode === "0x06") return sendWrite("0x06");
  if (functionCode === "0x10") return sendWrite("0x10");

  try {
    return await sendWrite("0x10");
  } catch (err) {
    const fallbackError = err?.message || String(err);
    // Solo hacemos fallback a 0x06 si el equipo RECHAZÓ 0x10 por función ilegal
    // (Modbus exception 1). Ante timeouts o errores de transporte NO reintentamos:
    // el write pudo haber llegado y escribiríamos el mismo registro dos veces.
    if (!/Modbus exception 1\b/.test(fallbackError)) {
      throw err;
    }
    const result = await sendWrite("0x06");
    return { ...result, fallbackError };
  }
}

export async function readRegistersSnapshotViaElfinTcpClient({
  elfinId,
  unitId,
  registers = [],
  modbusMode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
} = {}) {
  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();
  const numericUnitId = Number(unitId);
  const normalizedRegisters = [...new Set(registers.map(Number).filter(Number.isFinite))];
  const mode = getTcpClientModbusMode(modbusMode);

  if (!normalizedElfinId) throw new Error("Falta elfinId para TCP Client");
  if (!Number.isFinite(numericUnitId) || numericUnitId < 1 || numericUnitId > 247) {
    throw new Error("Unit ID Modbus inválido");
  }

  return withElfinTcpLock(normalizedElfinId, async () => {
    const snapshot = {};
    for (const register of normalizedRegisters) {
      snapshot[register] = await readRawRegisterViaTcpClient({
        elfinId: normalizedElfinId,
        unitId: numericUnitId,
        register,
        modbusMode: mode,
      });
    }
    return snapshot;
  });
}

export async function writeRegisterValueViaElfinTcpClient(
  value,
  {
    elfinId,
    unitId,
    register,
    verifyRegister = register,
    scale = DEFAULT_SETPOINT_SCALE,
    min = null,
    max = null,
    dataType = "number",
    functionCode = "auto",
    debugLabel = null,
    modbusMode = DEFAULT_TCP_CLIENT_MODBUS_MODE,
  } = {}
) {
  const numericValue = Number(value);
  const numericUnitId = Number(unitId);
  const numericRegister = Number(register);
  const numericVerifyRegister = Number(verifyRegister);
  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();
  const mode = getTcpClientModbusMode(modbusMode);

  if (!normalizedElfinId) throw new Error("Falta elfinId para TCP Client");
  if (!Number.isFinite(numericUnitId) || numericUnitId < 1 || numericUnitId > 247) {
    throw new Error("Unit ID Modbus inválido");
  }
  if (!Number.isFinite(numericRegister)) throw new Error("Registro inválido");
  if (Number.isFinite(min) && numericValue < Number(min)) {
    throw new Error(`Valor por debajo del mínimo permitido (${min})`);
  }
  if (Number.isFinite(max) && numericValue > Number(max)) {
    throw new Error(`Valor por encima del máximo permitido (${max})`);
  }

  return withElfinTcpLock(normalizedElfinId, async () => {
    const rawValue = normalizeWriteValue(numericValue, { scale, dataType });
    let rawBeforeVerify = null;
    let verifyBeforeError = null;

    if (Number.isFinite(numericVerifyRegister)) {
      try {
        rawBeforeVerify = await readRawRegisterViaTcpClient({
          elfinId: normalizedElfinId,
          unitId: numericUnitId,
          register: numericVerifyRegister,
          modbusMode: mode,
        });
      } catch (error) {
        verifyBeforeError = error?.message || String(error);
      }
    }

    if (debugLabel) {
      console.log(`🧪 [${debugLabel} TCP CLIENT]`, {
        stage: "verify-before",
        register: numericRegister,
        verifyRegister: numericVerifyRegister,
        rawBeforeVerify,
        rawValue,
        verifyBeforeError,
      });
    }

    const meta = await writeHoldingRegisterViaTcpClient({
      elfinId: normalizedElfinId,
      unitId: numericUnitId,
      register: numericRegister,
      rawValue,
      functionCode,
      modbusMode: mode,
    });

    let rawAfterVerify = null;
    let verifyAfterError = null;

    if (Number.isFinite(numericVerifyRegister)) {
      try {
        rawAfterVerify = await readRawRegisterViaTcpClient({
          elfinId: normalizedElfinId,
          unitId: numericUnitId,
          register: numericVerifyRegister,
          modbusMode: mode,
        });
      } catch (error) {
        verifyAfterError = error?.message || String(error);
      }
    }

    const normalizedAfter = Number.isFinite(rawAfterVerify)
      ? dataType === "number"
        ? rawAfterVerify / scale
        : rawAfterVerify
      : null;
    const ok =
      verifyAfterError != null
        ? true
        : rawAfterVerify === rawValue || numericVerifyRegister !== numericRegister;

    return {
      ok,
      register: numericRegister,
      verifyRegister: numericVerifyRegister,
      rawValue,
      rawBeforeVerify,
      rawAfterVerify,
      valueWritten: numericValue,
      valueAfterVerify: Number.isFinite(normalizedAfter) ? normalizedAfter : null,
      verifyBeforeError,
      verifyAfterError,
      transport: "tcp-client",
      modbusMode: mode,
      ...meta,
    };
  });
}
