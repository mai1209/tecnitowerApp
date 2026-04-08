import ModbusRTU from "modbus-serial";

const DEVICE_PORT_CANDIDATES = Array.from(
  new Set(
    [Number(process.env.MODBUS_DEVICE_PORT ?? 502), 502, 8899].filter((p) => Number.isFinite(p))
  )
);
const TIMEOUT_MS = Number(process.env.MODBUS_TIMEOUT_MS ?? 3000);
const REGISTER_COUNT = Number(process.env.MODBUS_REGISTER_COUNT ?? 1);
const DEFAULT_UNIT_ID = Number(process.env.MODBUS_DEFAULT_UNIT_ID ?? 1);
const DEFAULT_PROBE1 = Number(process.env.MODBUS_DEFAULT_PROBE1 ?? 256);
const DEFAULT_PROBE2 = Number(process.env.MODBUS_DEFAULT_PROBE2 ?? 258);
const DEFAULT_SETPOINT_SCALE = Number(process.env.MODBUS_SETPOINT_SCALE ?? 10);

function parseRegisterValue(value, scale = 10) {
  if (!Number.isFinite(value) || !Number.isFinite(scale) || scale === 0) {
    return null;
  }
  const decimals = scale === 10 ? 1 : 2;
  return parseFloat((value / scale).toFixed(decimals));
}

export async function readModbusTemperatures(req, res, next) {
  const ip = req.query.ip;
  const unitId = Number(req.query.unitId ?? DEFAULT_UNIT_ID);
  const probe1 = Number(req.query.probe1 ?? DEFAULT_PROBE1);
  const probe2 = Number(req.query.probe2 ?? DEFAULT_PROBE2);
  const setpointRegister = Number(req.query.setpointRegister ?? NaN);
  const shouldReadSetpoint = Number.isFinite(setpointRegister);
  const setpointScale = Number(req.query.setpointScale ?? DEFAULT_SETPOINT_SCALE);

  if (!ip || typeof ip !== "string") {
    return res.status(400).json({
      error: "Falta parámetro ip",
      example: "/api/modbus?ip=192.168.0.85&unitId=1",
    });
  }

  if (!Number.isFinite(unitId) || unitId < 1 || unitId > 247) {
    return res.status(400).json({ error: "unitId inválido (1-247)" });
  }

  try {
    let client = null;
    let portUsed = null;
    let lastError = null;

    for (const port of DEVICE_PORT_CANDIDATES) {
      const c = new ModbusRTU();
      try {
        await c.connectTcpRTUBuffered(ip, { port, timeout: TIMEOUT_MS });
        c.setID(unitId);
        c.setTimeout(TIMEOUT_MS);
        client = c;
        portUsed = port;
        break;
      } catch (err) {
        lastError = err;
        try {
          c.close();
        } catch (_) {}
      }
    }

    if (!client) {
      const message = lastError?.message || "No se pudo conectar al gateway Elfin en ningún puerto conocido";
      return res.status(502).json({
        error: message,
        advice: "Revisa IP, puertos 502/8899 y configuración del Elfin.",
        ip,
        unitId,
      });
    }

    const probe1Result = await client.readHoldingRegisters(probe1, REGISTER_COUNT);
    const probe2Result = await client.readHoldingRegisters(probe2, REGISTER_COUNT);

    const raw1 = probe1Result.data[0];
    const raw2 = probe2Result.data[0];

    const temp1 = parseRegisterValue(raw1);
    const temp2 = parseRegisterValue(raw2);

    let setpointValue = null;
    let rawSetpoint = null;
    if (shouldReadSetpoint) {
      const setpointResult = await client.readHoldingRegisters(setpointRegister, 1);
      rawSetpoint = setpointResult.data[0];
      setpointValue = parseRegisterValue(rawSetpoint, setpointScale);
    }

    try {
      client.close();
    } catch (_) {}

    return res.json({
      ip,
      unitId,
      probe1,
      probe2,
      probe1Value: temp1,
      probe2Value: temp2,
      raw1,
      raw2,
      port: portUsed,
      setpointRegister: shouldReadSetpoint ? setpointRegister : undefined,
      setpointScale: shouldReadSetpoint ? setpointScale : undefined,
      setpointValue,
      rawSetpoint,
      ts: new Date().toISOString(),
    });
  } catch (err) {
    // El cliente ya se cerró dentro del bloque try o al fallar cada intento
    const advice = String(err?.message).includes("Timed out")
      ? "TIMEOUT: revisa red/cableado/Elfin."
      : "Error de lectura. Revisa IP, unitId, cableado A/B y función 0x03.";

    if (!err.statusCode) {
      err.statusCode = 500;
    }

    if (res.headersSent) {
      return next(err);
    }

    return res.status(err.statusCode).json({
      error: err?.message || "Error Modbus",
      advice,
      ip,
      unitId,
    });
  }
}
