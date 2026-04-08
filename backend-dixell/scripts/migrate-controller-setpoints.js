import "dotenv/config";
import process from "node:process";

import { connectMongo, disconnectMongo } from "../database/connectMongo.js";
import { ControllerModel } from "../models/Controller.js";
import { DixellModel } from "../models/DixellModel.js";

const DEFAULT_MIN = -50;
const DEFAULT_MAX = 110;
const DEFAULT_SCALE = 10;
const INVALID_REGISTERS = new Set([null, undefined, 0, 1024]);

async function loadModels() {
  const models = await DixellModel.find({}).lean();
  const byId = new Map();
  const byName = new Map();

  for (const doc of models) {
    if (doc._id) {
      byId.set(String(doc._id), doc);
    }
    if (doc.name) {
      byName.set(String(doc.name).toUpperCase(), doc);
    }
  }

  return { byId, byName };
}

function pickModel(controller, { byId, byName }) {
  if (controller.dixellModelId && byId.has(String(controller.dixellModelId))) {
    return byId.get(String(controller.dixellModelId));
  }
  if (controller.dixellModel && byName.has(String(controller.dixellModel).toUpperCase())) {
    return byName.get(String(controller.dixellModel).toUpperCase());
  }
  return null;
}

function normalizeLimit(value, fallback, scale = DEFAULT_SCALE) {
  if (!Number.isFinite(value)) return fallback;

  let normalized = value;
  if (Math.abs(value) >= 300) {
    normalized = value / scale;
  }

  if (normalized < -120 || normalized > 150) return fallback;
  if (fallback < 0 && normalized >= 0) return fallback;
  if (fallback > 0 && normalized <= 0) return fallback;

  return normalized;
}

function buildRepairPayload(controller, model) {
  const payload = {};
  // XR35CX: setpoint SEt en 768 (ver seed-dixell-models.js). Evitar default histórico 1536.
  const targetRegister = model?.setpointRegister ?? controller.setpointRegister ?? 768;
  const targetMin = model?.setpointMin ?? DEFAULT_MIN;
  const targetMax = model?.setpointMax ?? DEFAULT_MAX;
  const targetScale = model?.setpointScale ?? DEFAULT_SCALE;

  if (INVALID_REGISTERS.has(controller.setpointRegister) || Number.isNaN(controller.setpointRegister)) {
    payload.setpointRegister = targetRegister;
  }

  const normalizedMin = normalizeLimit(controller.setpointMin, targetMin, targetScale);
  if (normalizedMin !== controller.setpointMin && targetMin != null) {
    payload.setpointMin = normalizedMin;
  }

  const normalizedMax = normalizeLimit(controller.setpointMax, targetMax, targetScale);
  if (normalizedMax !== controller.setpointMax && targetMax != null) {
    payload.setpointMax = normalizedMax;
  }

  if (!Number.isFinite(controller.setpointScale) || controller.setpointScale <= 0) {
    payload.setpointScale = targetScale;
  }

  return payload;
}

async function migrate() {
  await connectMongo();
  const models = await loadModels();

  const controllers = await ControllerModel.find({}).lean();

  let updated = 0;
  for (const controller of controllers) {
    const model = pickModel(controller, models);
    if (!model) continue;

    const payload = buildRepairPayload(controller, model);
    if (Object.keys(payload).length === 0) continue;

    await ControllerModel.updateOne({ _id: controller._id }, { $set: payload });
    updated += 1;
    console.log(
      `→ Controlador ${controller.name} reparado (registro=${payload.setpointRegister ?? controller.setpointRegister})`
    );
  }

  console.log(`✅ Reparación completada. Controladores actualizados: ${updated}`);
}

migrate()
  .catch((err) => {
    console.error("Error migrando controladores", err);
    process.exitCode = 1;
  })
  .finally(() => disconnectMongo().catch(() => {}));
