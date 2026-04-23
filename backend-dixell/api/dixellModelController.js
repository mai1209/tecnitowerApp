import { DeviceModel } from "../models/DixellModel.js";

function sanitizeRegisterTemplates(rawTemplates = []) {
  if (!Array.isArray(rawTemplates)) return [];

  return rawTemplates
    .map((template, index) => {
      const key = String(template?.key ?? "").trim().toUpperCase();
      const label = String(template?.label ?? key).trim();
      const register = Number(template?.register);

      if (!key || !label || !Number.isFinite(register)) {
        return null;
      }

      return {
        key,
        label,
        register,
        verifyRegister: template?.verifyRegister == null ? undefined : Number(template.verifyRegister),
        scale: Number(template?.scale ?? 10),
        min: template?.min == null ? undefined : Number(template.min),
        max: template?.max == null ? undefined : Number(template.max),
        step: Number(template?.step ?? 0.1),
        dataType: template?.dataType ?? "number",
        writable: template?.writable !== false,
        visible: template?.visible !== false,
        accessLevel: template?.accessLevel === "technician" ? "technician" : "user",
        functionCode: ["0x06", "0x10"].includes(template?.functionCode) ? template.functionCode : "auto",
        description: template?.description,
        sortOrder: Number.isFinite(Number(template?.sortOrder)) ? Number(template.sortOrder) : index,
      };
    })
    .filter(Boolean);
}

function ensureAdmin(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Solo un admin puede gestionar modelos" });
    return false;
  }
  return true;
}

function buildModelPayload(rawBody = {}) {
  return {
    brand: String(rawBody?.brand ?? "DIXELL").trim().toUpperCase(),
    name: String(rawBody?.name ?? "").trim().toUpperCase(),
    description: rawBody?.description,
    protocol: rawBody?.protocol ?? "modbus-tcp",
    connectionType: rawBody?.connectionType ?? "tcp",
    defaultUnitId: rawBody?.defaultUnitId,
    defaultModbusPort: rawBody?.defaultModbusPort,
    defaultBaudRate: rawBody?.defaultBaudRate,
    defaultDataBits: rawBody?.defaultDataBits,
    defaultParity: rawBody?.defaultParity,
    defaultStopBits: rawBody?.defaultStopBits,
    defaultProbe1: rawBody?.defaultProbe1,
    defaultProbe2: rawBody?.defaultProbe2,
    registerCount: rawBody?.registerCount,
    notes: rawBody?.notes,
    setpointRegister: rawBody?.setpointRegister,
    setpointReadRegister: rawBody?.setpointReadRegister,
    setpointVerifyRegister: rawBody?.setpointVerifyRegister,
    setpointMin: rawBody?.setpointMin,
    setpointMax: rawBody?.setpointMax,
    setpointScale: rawBody?.setpointScale,
    registerTemplates: sanitizeRegisterTemplates(rawBody?.registerTemplates),
  };
}

function handleDuplicateModelName(err, res) {
  if (err?.code === 11000) {
    return res.status(409).json({ error: "Ya existe un modelo con ese nombre" });
  }
  return null;
}

export async function listDeviceModels(_req, res, next) {
  try {
    const models = await DeviceModel.find().sort({ brand: 1, name: 1 }).lean();
    return res.json({ models });
  } catch (err) {
    return next(err);
  }
}

export async function createDeviceModel(req, res, next) {
  try {
    if (!ensureAdmin(req, res)) return;

    const payload = buildModelPayload(req.body);

    if (!payload.name) {
      return res.status(400).json({ error: "name es requerido" });
    }

    const modelDoc = await DeviceModel.create(payload);
    return res.status(201).json({ model: modelDoc });
  } catch (err) {
    if (handleDuplicateModelName(err, res)) return;
    return next(err);
  }
}

export async function updateDeviceModel(req, res, next) {
  try {
    if (!ensureAdmin(req, res)) return;

    const modelDoc = await DeviceModel.findById(req.params.id);
    if (!modelDoc) {
      return res.status(404).json({ error: "Modelo no encontrado" });
    }

    const payload = buildModelPayload(req.body);
    if (!payload.name) {
      return res.status(400).json({ error: "name es requerido" });
    }

    Object.assign(modelDoc, payload);
    await modelDoc.save();

    return res.json({ model: modelDoc });
  } catch (err) {
    if (handleDuplicateModelName(err, res)) return;
    return next(err);
  }
}

// Alias de compatibilidad para el código existente
export const listDixellModels = listDeviceModels;
export const createDixellModel = createDeviceModel;
