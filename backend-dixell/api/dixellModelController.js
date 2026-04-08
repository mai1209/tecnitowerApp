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
    const role = req.user?.role;
    if (role !== "admin") {
      return res.status(403).json({ error: "Solo un admin puede crear modelos" });
    }

    const payload = {
      brand: String(req.body?.brand ?? "DIXELL").trim().toUpperCase(),
      name: String(req.body?.name ?? "").trim().toUpperCase(),
      description: req.body?.description,
      protocol: req.body?.protocol ?? "modbus-tcp",
      connectionType: req.body?.connectionType ?? "tcp",
      defaultUnitId: req.body?.defaultUnitId,
      defaultModbusPort: req.body?.defaultModbusPort,
      defaultBaudRate: req.body?.defaultBaudRate,
      defaultDataBits: req.body?.defaultDataBits,
      defaultParity: req.body?.defaultParity,
      defaultStopBits: req.body?.defaultStopBits,
      defaultProbe1: req.body?.defaultProbe1,
      defaultProbe2: req.body?.defaultProbe2,
      registerCount: req.body?.registerCount,
      notes: req.body?.notes,
      setpointRegister: req.body?.setpointRegister,
      setpointReadRegister: req.body?.setpointReadRegister,
      setpointVerifyRegister: req.body?.setpointVerifyRegister,
      setpointMin: req.body?.setpointMin,
      setpointMax: req.body?.setpointMax,
      setpointScale: req.body?.setpointScale,
      registerTemplates: sanitizeRegisterTemplates(req.body?.registerTemplates),
    };

    if (!payload.name) {
      return res.status(400).json({ error: "name es requerido" });
    }

    const modelDoc = await DeviceModel.create(payload);
    return res.status(201).json({ model: modelDoc });
  } catch (err) {
    return next(err);
  }
}

// Alias de compatibilidad para el código existente
export const listDixellModels = listDeviceModels;
export const createDixellModel = createDeviceModel;
