import { sendTcpClientRawCommand } from "../tcp/elfinTcpGatewayServer.js";

const DEFAULT_SETPOINT_SCALE = 10;
const pendingLocks = new Map();

function withElfinTcpLock(elfinId, fn) {
  const key = String(elfinId ?? "").trim().toUpperCase();
  const previous = pendingLocks.get(key) ?? Promise.resolve();
  const next = previous.then(fn, fn);
  pendingLocks.set(
    key,
    next.finally(() => {
      if (pendingLocks.get(key) === next) {
        pendingLocks.delete(key);
      }
    })
  );
  return next;
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

function buildReadHoldingRegisterFrame({ unitId, register }) {
  const body = Buffer.alloc(6);
  body[0] = unitId;
  body[1] = 0x03;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(1, 4);
  return appendCrc(body);
}

function buildWriteSingleRegisterFrame({ unitId, register, rawValue }) {
  const body = Buffer.alloc(6);
  body[0] = unitId;
  body[1] = 0x06;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(toUnsigned16(rawValue), 4);
  return appendCrc(body);
}

function buildWriteMultipleRegistersFrame({ unitId, register, rawValue }) {
  const body = Buffer.alloc(9);
  body[0] = unitId;
  body[1] = 0x10;
  body.writeUInt16BE(register, 2);
  body.writeUInt16BE(1, 4);
  body[6] = 2;
  body.writeUInt16BE(toUnsigned16(rawValue), 7);
  return appendCrc(body);
}

function tryExtractResponseFrame(buffer, { unitId, functionCode }) {
  const response = Buffer.from(buffer ?? []);

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

function assertNoModbusException(frame) {
  if (!(frame[1] & 0x80)) return;
  throw new Error(`Modbus exception ${frame[2]}`);
}

async function sendFrameAndAwait({ elfinId, unitId, functionCode, frameBuffer }) {
  return sendTcpClientRawCommand(elfinId, frameBuffer, {
    matcher: (buffer) => tryExtractResponseFrame(buffer, { unitId, functionCode }),
  });
}

async function readRawRegisterViaTcpClient({ elfinId, unitId, register }) {
  const request = buildReadHoldingRegisterFrame({ unitId, register });
  const response = await sendFrameAndAwait({
    elfinId,
    unitId,
    functionCode: 0x03,
    frameBuffer: request,
  });
  assertNoModbusException(response);

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
}) {
  const sendWrite = async (resolvedFunctionCode) => {
    const numericFunctionCode = resolvedFunctionCode === "0x06" ? 0x06 : 0x10;
    const request =
      numericFunctionCode === 0x06
        ? buildWriteSingleRegisterFrame({ unitId, register, rawValue })
        : buildWriteMultipleRegistersFrame({ unitId, register, rawValue });
    const response = await sendFrameAndAwait({
      elfinId,
      unitId,
      functionCode: numericFunctionCode,
      frameBuffer: request,
    });
    assertNoModbusException(response);
    return { functionCode: resolvedFunctionCode };
  };

  if (functionCode === "0x06") return sendWrite("0x06");
  if (functionCode === "0x10") return sendWrite("0x10");

  try {
    return await sendWrite("0x10");
  } catch (err) {
    const fallbackError = err?.message || String(err);
    const result = await sendWrite("0x06");
    return { ...result, fallbackError };
  }
}

export async function readRegistersSnapshotViaElfinTcpClient({ elfinId, unitId, registers = [] } = {}) {
  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();
  const numericUnitId = Number(unitId);
  const normalizedRegisters = [...new Set(registers.map(Number).filter(Number.isFinite))];

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
  } = {}
) {
  const numericValue = Number(value);
  const numericUnitId = Number(unitId);
  const numericRegister = Number(register);
  const numericVerifyRegister = Number(verifyRegister);
  const normalizedElfinId = String(elfinId ?? "").trim().toUpperCase();

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
    const rawBeforeVerify = Number.isFinite(numericVerifyRegister)
      ? await readRawRegisterViaTcpClient({
          elfinId: normalizedElfinId,
          unitId: numericUnitId,
          register: numericVerifyRegister,
        })
      : null;

    if (debugLabel) {
      console.log(`🧪 [${debugLabel} TCP CLIENT]`, {
        stage: "verify-before",
        register: numericRegister,
        verifyRegister: numericVerifyRegister,
        rawBeforeVerify,
        rawValue,
      });
    }

    const meta = await writeHoldingRegisterViaTcpClient({
      elfinId: normalizedElfinId,
      unitId: numericUnitId,
      register: numericRegister,
      rawValue,
      functionCode,
    });

    const rawAfterVerify = Number.isFinite(numericVerifyRegister)
      ? await readRawRegisterViaTcpClient({
          elfinId: normalizedElfinId,
          unitId: numericUnitId,
          register: numericVerifyRegister,
        })
      : null;
    const normalizedAfter = dataType === "number" ? rawAfterVerify / scale : rawAfterVerify;
    const ok = rawAfterVerify === rawValue || numericVerifyRegister !== numericRegister;

    return {
      ok,
      register: numericRegister,
      verifyRegister: numericVerifyRegister,
      rawValue,
      rawBeforeVerify,
      rawAfterVerify,
      valueWritten: numericValue,
      valueAfterVerify: Number.isFinite(normalizedAfter) ? normalizedAfter : null,
      transport: "tcp-client",
      ...meta,
    };
  });
}
