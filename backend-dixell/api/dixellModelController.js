import { ControllerModel } from "../models/Controller.js";
import { DeviceModel } from "../models/DixellModel.js";
import { invalidateDiagnosticCache } from "../services/diagnosticCacheService.js";
import { publishControllerRealtime } from "../services/controllerRealtimeService.js";

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
        accessLevel: "user",
        functionCode: ["0x06", "0x10"].includes(template?.functionCode) ? template.functionCode : "auto",
        description: template?.description,
        sortOrder: Number.isFinite(Number(template?.sortOrder)) ? Number(template.sortOrder) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

function mergeControllerRegisterDefinitions(existingDefinitions = [], templateDefinitions = []) {
  const existing = sanitizeRegisterTemplates(existingDefinitions);
  const templates = sanitizeRegisterTemplates(templateDefinitions);
  const existingByKey = new Map(existing.map((definition) => [definition.key, definition]));
  const merged = [];
  const usedKeys = new Set();

  for (const template of templates) {
    const current = existingByKey.get(template.key);
    usedKeys.add(template.key);

    if (current) {
      merged.push({
        ...template,
        ...current,
        key: current.key,
      });
      continue;
    }

    merged.push(template);
  }

  for (const definition of existing) {
    if (usedKeys.has(definition.key)) continue;
    merged.push(definition);
  }

  return merged.map((definition, index) => ({
    ...definition,
    sortOrder: index,
  }));
}

async function syncModelTemplatesToControllers(modelDoc) {
  const modelId = modelDoc?._id;
  const modelName = String(modelDoc?.name ?? "").trim().toUpperCase();
  const templateDefinitions = sanitizeRegisterTemplates(modelDoc?.registerTemplates);

  if (!modelId && !modelName) {
    return 0;
  }

  const matchers = [];
  if (modelId) {
    matchers.push({ deviceModelId: modelId }, { dixellModelId: modelId });
  }
  if (modelName) {
    matchers.push({ deviceModel: modelName }, { dixellModel: modelName });
  }

  if (!matchers.length) {
    return 0;
  }

  const controllers = await ControllerModel.find({ $or: matchers })
    .select({ _id: 1, registerDefinitions: 1, deviceModelId: 1, dixellModelId: 1 })
    .lean();

  const operations = [];
  const updatedControllerIds = [];

  for (const controller of controllers) {
    const currentDefinitions = sanitizeRegisterTemplates(controller?.registerDefinitions);
    const mergedDefinitions = mergeControllerRegisterDefinitions(
      controller?.registerDefinitions,
      templateDefinitions
    );
    const requiresModelLink = modelId && (!controller?.deviceModelId || !controller?.dixellModelId);
    const definitionsChanged =
      JSON.stringify(currentDefinitions) !== JSON.stringify(mergedDefinitions);

    if (!definitionsChanged && !requiresModelLink) {
      continue;
    }

    operations.push({
      updateOne: {
        filter: { _id: controller._id },
        update: {
          $set: {
            registerDefinitions: mergedDefinitions,
            ...(modelId
              ? {
                  deviceModelId: controller?.deviceModelId ?? modelId,
                  dixellModelId: controller?.dixellModelId ?? modelId,
                }
              : {}),
          },
        },
      },
    });
    updatedControllerIds.push(String(controller._id));
  }

  if (!operations.length) {
    return 0;
  }

  await ControllerModel.bulkWrite(operations);

  for (const controllerId of updatedControllerIds) {
    invalidateDiagnosticCache(controllerId);
    publishControllerRealtime(controllerId, { reason: "device-model-register-templates-synced" });
  }

  return updatedControllerIds.length;
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
    const syncedControllers = await syncModelTemplatesToControllers(modelDoc);
    return res.status(201).json({ model: modelDoc, syncedControllers });
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
    const syncedControllers = await syncModelTemplatesToControllers(modelDoc);

    return res.json({ model: modelDoc, syncedControllers });
  } catch (err) {
    if (handleDuplicateModelName(err, res)) return;
    return next(err);
  }
}

// Alias de compatibilidad para el código existente
export const listDixellModels = listDeviceModels;
export const createDixellModel = createDeviceModel;
