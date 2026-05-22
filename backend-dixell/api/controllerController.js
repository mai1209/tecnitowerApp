import {
  DEFAULT_SETPOINT_REGISTER,
  LEGACY_SETPOINT_REGISTER,
  readDiagnosticSnapshot,
  readRegisterDefinitionsValues,
  readRegistersSnapshot,
  readSetpoint,
  readUserParams768Block,
  scanSetpointRegisters,
  writeRegisterValue,
} from "../services/modbusService.js";
import { ControllerModel } from "../models/Controller.js";
import { DeviceModel } from "../models/DixellModel.js";
import { mqttClient, publishMqttCommand, setWritingStatus } from "../mqtt/mqttListener.js";
import { writeRegisterValueViaElfinMqtt } from "../services/elfinMqttModbusService.js";
import {
  readRegistersSnapshotViaElfinTcpClient,
  writeRegisterValueViaElfinTcpClient,
} from "../services/elfinTcpClientModbusService.js";
import { getTcpGatewayConnectionInfo } from "../tcp/elfinTcpGatewayServer.js";
import {
  getCachedDiagnostic,
  invalidateDiagnosticCache,
} from "../services/diagnosticCacheService.js";
import { touchControllerPolling } from "../services/controllerPollingService.js";
import { buildControllerRuntimeState } from "../services/controllerAlertService.js";
import { publishControllerRealtime } from "../services/controllerRealtimeService.js";

const XR35_SETPOINT_REGISTER = 768;
const STATUS_REGISTER = 1280;
const DEFAULT_XR35_UNIT_ID = 1;
const DIAGNOSTIC_TELEMETRY_FRESH_MS = Number(process.env.DIAGNOSTIC_TELEMETRY_FRESH_MS ?? 20000);

function resolveControllerConnection(controller) {
  const model = String(controller?.dixellModel ?? "").toUpperCase();
  const rawUnitId = Number(controller?.unitId);
  const unitId =
    Number.isFinite(rawUnitId) && rawUnitId >= 1 && rawUnitId <= 247
      ? rawUnitId
      : model === "XR35CX"
        ? DEFAULT_XR35_UNIT_ID
        : undefined;

  return {
    host: controller?.ipAddress,
    port: controller?.modbusPort,
    unitId,
  };
}

function resolveDefaultProbe(modelName, probeNumber) {
  const normalizedModelName = String(modelName ?? "").toUpperCase();
  if (normalizedModelName === "TC900E LOG") {
    return probeNumber === 2 ? 102 : 101;
  }
  return probeNumber === 2 ? 258 : 256;
}

function sanitizeRegisterDefinitions(rawDefinitions = []) {
  if (!Array.isArray(rawDefinitions)) return [];

  return rawDefinitions
    .map((definition, index) => {
      const key = String(definition?.key ?? "").trim().toUpperCase();
      const label = String(definition?.label ?? key).trim();
      const register = Number(definition?.register);
      const verifyRegister = definition?.verifyRegister == null ? undefined : Number(definition.verifyRegister);
      const scale = Number(definition?.scale ?? 10);
      const min = definition?.min == null ? undefined : Number(definition.min);
      const max = definition?.max == null ? undefined : Number(definition.max);
      const step = Number(definition?.step ?? (scale === 10 ? 0.1 : 1));
      const dataType = definition?.dataType ?? "number";

      if (!key || !label || !Number.isFinite(register)) {
        return null;
      }

      return {
        key,
        label,
        register,
        verifyRegister: Number.isFinite(verifyRegister) ? verifyRegister : undefined,
        scale: Number.isFinite(scale) && scale > 0 ? scale : 10,
        min: Number.isFinite(min) ? min : undefined,
        max: Number.isFinite(max) ? max : undefined,
        step: Number.isFinite(step) && step > 0 ? step : 0.1,
        dataType: ["number", "integer", "boolean"].includes(dataType) ? dataType : "number",
        writable: definition?.writable !== false,
        visible: definition?.visible !== false,
        accessLevel: "user",
        functionCode: ["0x06", "0x10"].includes(definition?.functionCode) ? definition.functionCode : "auto",
        description: definition?.description ? String(definition.description).trim() : undefined,
        sortOrder: Number.isFinite(Number(definition?.sortOrder)) ? Number(definition.sortOrder) : index,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

async function findModelFromPayload(body = {}) {
  const modelId = body?.deviceModelId ?? body?.dixellModelId;
  const modelName = body?.deviceModel ?? body?.dixellModel;

  if (modelId) {
    const byId = await DeviceModel.findById(modelId).lean();
    if (byId) return byId;
  }

  if (modelName) {
    const byName = await DeviceModel.findOne({
      name: String(modelName).trim().toUpperCase(),
    }).lean();
    if (byName) return byName;
  }

  return null;
}

export async function buildControllerPayloadForOwner(owner, body = {}) {
  const name = String(body?.name ?? "").trim();
  const elfinId = String(body?.elfinId ?? "").trim().toUpperCase();
  const ipAddress = String(body?.ipAddress ?? "").trim();
  const gatewayMode = normalizeTransport(body?.gatewayMode ?? process.env.CONTROL_TRANSPORT ?? "direct");

  if (!owner) {
    throw new Error("OWNER_REQUIRED");
  }

  if (!name || !elfinId || (requiresLocalIp(gatewayMode) && !ipAddress)) {
    throw new Error(
      !requiresLocalIp(gatewayMode)
        ? "name y elfinId son obligatorios"
        : "name, elfinId e ipAddress son obligatorios"
    );
  }

  const model = await findModelFromPayload(body);
  const requestedModelName = body?.deviceModel ?? body?.dixellModel;
  const normalizedModelName =
    model?.name ?? (requestedModelName ? String(requestedModelName).trim().toUpperCase() : undefined);
  const normalizedBrand =
    model?.brand ?? (body?.deviceBrand ? String(body.deviceBrand).trim().toUpperCase() : undefined);
  const fallbackUnitId = normalizedModelName === "XR35CX" ? DEFAULT_XR35_UNIT_ID : 1;
  const registerDefinitions = sanitizeRegisterDefinitions(
    body?.registerDefinitions ?? model?.registerTemplates ?? []
  );

  return {
    owner,
    name,
    gatewayMode,
    elfinId,
    ipAddress: ipAddress || undefined,
    modbusPort: body?.modbusPort ?? undefined,
    baudRate: body?.baudRate ?? model?.defaultBaudRate ?? undefined,
    dataBits: body?.dataBits ?? model?.defaultDataBits ?? undefined,
    parity: body?.parity ?? model?.defaultParity ?? undefined,
    stopBits: body?.stopBits ?? model?.defaultStopBits ?? undefined,
    unitId: body?.unitId ?? model?.defaultUnitId ?? fallbackUnitId,
    probe1: body?.probe1 ?? model?.defaultProbe1 ?? resolveDefaultProbe(normalizedModelName, 1),
    probe2: body?.probe2 ?? model?.defaultProbe2 ?? resolveDefaultProbe(normalizedModelName, 2),
    deviceModelId: model?._id ?? undefined,
    deviceModel: normalizedModelName,
    deviceBrand: normalizedBrand,
    protocol: body?.protocol ?? model?.protocol ?? undefined,
    connectionType: body?.connectionType ?? model?.connectionType ?? undefined,
    dixellModelId: model?._id ?? undefined,
    dixellModel: normalizedModelName,
    location: body?.location,
    notes: body?.notes,
    setpointRegister: body?.setpointRegister ?? model?.setpointRegister,
    setpointReadRegister: body?.setpointReadRegister ?? model?.setpointReadRegister,
    setpointVerifyRegister: body?.setpointVerifyRegister ?? model?.setpointVerifyRegister,
    setpointMin: body?.setpointMin ?? model?.setpointMin,
    setpointMax: body?.setpointMax ?? model?.setpointMax,
    setpointScale: body?.setpointScale ?? model?.setpointScale ?? 10,
    alertConfig: {
      enabled: body?.alertConfig?.enabled ?? true,
      minTemperature:
        body?.alertConfig?.minTemperature == null
          ? undefined
          : Number(body.alertConfig.minTemperature),
      maxTemperature:
        body?.alertConfig?.maxTemperature == null
          ? undefined
          : Number(body.alertConfig.maxTemperature),
      offlineAfterMs:
        body?.alertConfig?.offlineAfterMs == null
          ? undefined
          : Number(body.alertConfig.offlineAfterMs),
    },
    registerDefinitions,
  };
}

function buildRegisterDefinitionFromControllerRegister(controller, overrides = {}) {
  return sanitizeRegisterDefinitions([
    {
      key: overrides.key,
      label: overrides.label,
      register: overrides.register,
      verifyRegister: overrides.verifyRegister,
      scale: overrides.scale,
      min: overrides.min,
      max: overrides.max,
      step: overrides.step,
      dataType: overrides.dataType ?? "number",
      writable: true,
      visible: true,
      accessLevel: "user",
      functionCode: overrides.functionCode ?? "auto",
    },
  ])[0];
}

function canMutateOwnedController(role, canWrite) {
  return role === "admin" || canWrite === true;
}

function canAccessDefinition(definition) {
  if (definition?.visible === false) return false;
  return true;
}

function ensureControllerMutationRole(req, res) {
  if (canMutateOwnedController(req.user?.role, req.user?.canWrite)) return true;
  res.status(403).json({ error: "Tu perfil es solo lectura" });
  return false;
}

function getControllerVisibleDefinitions(controller) {
  return (controller?.registerDefinitions ?? []).filter((definition) =>
    canAccessDefinition(definition)
  );
}

function getSetpointDefinition(controller) {
  const model = String(controller?.dixellModel ?? "").toUpperCase();
  const writeRegister =
    Number.isFinite(Number(controller?.setpointRegister))
      ? Number(controller.setpointRegister)
      : model === "XR35CX"
        ? XR35_SETPOINT_REGISTER
        : DEFAULT_SETPOINT_REGISTER;
  const readRegister =
    Number.isFinite(Number(controller?.setpointReadRegister))
      ? Number(controller.setpointReadRegister)
      : model === "XR35CX"
        ? LEGACY_SETPOINT_REGISTER
        : writeRegister;
  const verifyRegister =
    Number.isFinite(Number(controller?.setpointVerifyRegister))
      ? Number(controller.setpointVerifyRegister)
      : readRegister;

  return buildRegisterDefinitionFromControllerRegister(controller, {
    key: "SETPOINT",
    label: "Setpoint",
    register: writeRegister,
    verifyRegister,
    scale: controller?.setpointScale ?? 10,
    min: controller?.setpointMin,
    max: controller?.setpointMax,
    step: (controller?.setpointScale ?? 10) === 10 ? 0.1 : 1,
    description:
      model === "XR35CX"
        ? `XR35CX documentado: SEt en 768; lectura/verificacion operativa en ${readRegister}`
        : `Lectura/verificacion en ${readRegister}`,
  });
}

function findOwnedController(id, userId) {
  return ControllerModel.findOne({ _id: id, owner: userId });
}

function publishReadCommands(controller, registers = []) {
  if (!mqttClient || !mqttClient.connected || !controller?.elfinId) return;

  const cmdTopic = `tecnitower/elfins/${controller.elfinId}/cmd`;
  const uniqueRegisters = [...new Set(registers.filter((value) => Number.isFinite(Number(value))))];

  for (const register of uniqueRegisters) {
    mqttClient.publish(cmdTopic, JSON.stringify({ action: "read", reg: Number(register) }));
  }
}

function normalizeTransport(value) {
  const transport = String(value ?? "").trim().toLowerCase();
  if (transport === "mqtt" || transport === "cloud" || transport === "agent-mqtt") return "agent-mqtt";
  if (transport === "mqtt-raw" || transport === "elfin-mqtt") return "elfin-mqtt";
  if (
    transport === "tcp-client" ||
    transport === "tcp_client" ||
    transport === "elfin-tcp-client" ||
    transport === "elfin-tcp"
  ) {
    return "tcp-client";
  }
  return "direct";
}

function getControlTransport(controller = null) {
  return normalizeTransport(controller?.gatewayMode ?? process.env.CONTROL_TRANSPORT ?? "direct");
}

function shouldUseAgentMqttControl(controller = null) {
  return getControlTransport(controller) === "agent-mqtt";
}

function shouldUseElfinMqttControl(controller = null) {
  return getControlTransport(controller) === "elfin-mqtt";
}

function shouldUseTcpClientControl(controller = null) {
  return getControlTransport(controller) === "tcp-client";
}

function shouldUseMqttControl(controller = null) {
  return shouldUseAgentMqttControl(controller) || shouldUseElfinMqttControl(controller);
}

function requiresLocalIp(gatewayMode) {
  const transport = normalizeTransport(gatewayMode);
  return transport !== "elfin-mqtt" && transport !== "tcp-client";
}

function isRecentTelemetry(telemetry, maxAgeMs = DIAGNOSTIC_TELEMETRY_FRESH_MS) {
  const receivedAt = telemetry?.receivedAt ? new Date(telemetry.receivedAt).getTime() : NaN;
  const validMaxAge = Number.isFinite(maxAgeMs) && maxAgeMs > 0 ? maxAgeMs : 20000;
  return Number.isFinite(receivedAt) && Date.now() - receivedAt <= validMaxAge;
}

function buildMqttWriteCommand({ connection, definition, value, debugLabel }) {
  return {
    action: "writeRegister",
    register: Number(definition.register),
    verifyRegister: Number(definition.verifyRegister ?? definition.register),
    value: Number(value),
    scale: Number(definition.scale ?? 10),
    min: definition.min,
    max: definition.max,
    dataType: definition.dataType ?? "number",
    functionCode: definition.functionCode ?? "auto",
    connection: {
      unitId: connection.unitId,
    },
    debugLabel,
  };
}

function emitControllerRefresh(controllerId, reason) {
  publishControllerRealtime(controllerId, { reason });
}

function getTelemetryRegisterValue(telemetry, register) {
  const payload = telemetry?.payload ?? {};
  const registers = payload?.registers ?? payload?.values ?? payload?.data ?? {};
  const key = String(register);

  return payload?.[key] ?? registers?.[key] ?? registers?.[register] ?? null;
}

function getSnapshotRegisterValue(snapshot, register) {
  if (!snapshot) return null;
  const key = String(register);
  const value = snapshot?.[key] ?? snapshot?.[register] ?? null;
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function buildDefinitionValuesFromRegisterSnapshot(definitions = [], snapshot = null, source = "mqtt-agent") {
  return definitions.map((definition) => {
    const numericRaw = getSnapshotRegisterValue(snapshot, definition?.register);
    const scale = Number(definition?.scale ?? 10);
    const dataType = definition?.dataType ?? "number";

    if (!Number.isFinite(numericRaw)) {
      return {
        ...definition,
        value: null,
        error: "Sin lectura MQTT",
      };
    }

    return {
      ...definition,
      raw: numericRaw,
      value: dataType === "number" ? numericRaw / scale : numericRaw,
      source,
    };
  });
}

function buildDefinitionValuesFromTelemetry(definitions = [], telemetry = null) {
  return definitions.map((definition) => {
    const raw = getTelemetryRegisterValue(telemetry, definition?.register);
    const numericRaw = raw === null || raw === undefined || raw === "" ? null : Number(raw);
    const scale = Number(definition?.scale ?? 10);
    const dataType = definition?.dataType ?? "number";

    if (numericRaw === null || !Number.isFinite(numericRaw)) {
      return {
        ...definition,
        value: null,
        error: "Sin lectura MQTT",
      };
    }

    return {
      ...definition,
      raw: numericRaw,
      value: dataType === "number" ? numericRaw / scale : numericRaw,
      source: "mqtt-telemetry",
    };
  });
}

async function writeDefinitionValue({ controller, definition, value }) {
  if (!definition?.writable) {
    throw new Error("El parámetro no es editable");
  }

  const connection = resolveControllerConnection(controller);
  const debugLabel = `REGISTER ${definition.key ?? definition.register}`;
  console.log(`🧪 [${debugLabel} CONFIG]`, {
    controllerId: String(controller._id),
    model: controller.dixellModel,
    connection,
    register: definition.register,
    verifyRegister: definition.verifyRegister ?? definition.register,
    scale: definition.scale ?? 10,
    min: definition.min,
    max: definition.max,
    functionCode: definition.functionCode ?? "auto",
    valueRequested: value,
    transport: getControlTransport(controller),
  });

  if (shouldUseElfinMqttControl(controller)) {
    return writeRegisterValueViaElfinMqtt(value, {
      elfinId: controller.elfinId,
      unitId: connection.unitId,
      register: definition.register,
      verifyRegister: definition.verifyRegister ?? definition.register,
      scale: definition.scale ?? 10,
      min: definition.min,
      max: definition.max,
      dataType: definition.dataType ?? "number",
      functionCode: definition.functionCode ?? "auto",
      debugLabel,
    });
  }

  if (shouldUseTcpClientControl(controller)) {
    return writeRegisterValueViaElfinTcpClient(value, {
      elfinId: controller.elfinId,
      unitId: connection.unitId,
      register: definition.register,
      verifyRegister: definition.verifyRegister ?? definition.register,
      scale: definition.scale ?? 10,
      min: definition.min,
      max: definition.max,
      dataType: definition.dataType ?? "number",
      functionCode: definition.functionCode ?? "auto",
      debugLabel,
    });
  }

  if (shouldUseAgentMqttControl(controller)) {
    const ack = await publishMqttCommand(
      controller.elfinId,
      buildMqttWriteCommand({ connection, definition, value, debugLabel })
    );
    return ack?.modbus ?? ack;
  }

  return writeRegisterValue(value, {
    connection,
    register: definition.register,
    verifyRegister: definition.verifyRegister ?? definition.register,
    scale: definition.scale ?? 10,
    min: definition.min,
    max: definition.max,
    dataType: definition.dataType ?? "number",
    functionCode: definition.functionCode ?? "auto",
    debugLabel,
  });
}

export const getSetpoint = async (req, res) => {
  try {
    const setpoint = await readSetpoint({
      register: XR35_SETPOINT_REGISTER,
      scale: 10,
    });
    res.json({ setpoint });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error leyendo setpoint" });
  }
};

export const createController = async (req, res, next) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const owner = req.user?.id;
    if (!owner) {
      return res.status(401).json({ error: "No autenticado" });
    }
    const payload = await buildControllerPayloadForOwner(owner, req.body);

    const controller = await ControllerModel.create(payload);
    return res.status(201).json({ controller });
  } catch (err) {
    if (err?.message === "name y elfinId son obligatorios" || err?.message === "name, elfinId e ipAddress son obligatorios") {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === 11000 && err?.keyPattern?.elfinId) {
      return res.status(409).json({
        error: "Ese Elfin ID ya está registrado en otro controlador.",
      });
    }
    return next(err);
  }
};

export const listControllers = async (req, res) => {
  try {
    const owner = req.user?.id;
    if (!owner) {
      return res.status(401).json({ error: "No autenticado" });
    }

    const controllers = await ControllerModel.find({ owner }).sort({ createdAt: -1 }).lean();
    const normalizedControllers = await Promise.all(
      controllers.map(async (controller) => {
        if (!shouldUseTcpClientControl(controller)) return controller;

        touchControllerPolling(controller._id);

        const connectionInfo = getTcpGatewayConnectionInfo(controller.elfinId);
        const hadGatewayOnline = Boolean(controller?.connectionState?.elfinOnline);
        const hadModbusOnline = Boolean(controller?.connectionState?.modbusOnline);
        const runtimeState = connectionInfo
          ? buildControllerRuntimeState(controller, {
              telemetry: hadModbusOnline ? controller?.lastTelemetry ?? null : null,
              error: hadModbusOnline
                ? null
                : new Error(`Timeout esperando respuesta Modbus del controlador (${controller.elfinId})`),
            })
          : buildControllerRuntimeState(controller, {
              telemetry: controller?.lastTelemetry ?? null,
              error: new Error(`Elfin TCP Client no conectado (${controller.elfinId})`),
            });

        const gatewayChanged = hadGatewayOnline !== Boolean(runtimeState.connectionState?.elfinOnline);
        const modbusChanged = hadModbusOnline !== Boolean(runtimeState.connectionState?.modbusOnline);
        const alertTypeChanged =
          String(controller?.alertState?.type ?? "") !== String(runtimeState?.alertState?.type ?? "");

        if (gatewayChanged || modbusChanged || alertTypeChanged) {
          await ControllerModel.updateOne(
            { _id: controller._id },
            {
              $set: {
                connectionState: runtimeState.connectionState,
                alertState: runtimeState.alertState,
              },
            }
          );
          invalidateDiagnosticCache(controller._id);
          publishControllerRealtime(controller._id, { reason: "controller-list-state-refresh" });
        }

        return {
          ...controller,
          connectionState: runtimeState.connectionState,
          alertState: runtimeState.alertState,
        };
      })
    );

    res.json({ controllers: normalizedControllers });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Error leyendo controladores" });
  }
};

export const deleteController = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    const deleted = {
      _id: controller._id.toString(),
      name: controller.name,
      elfinId: controller.elfinId,
    };

    await controller.deleteOne();
    invalidateDiagnosticCache(controller._id);

    return res.json({
      message: "Controlador eliminado correctamente",
      controller: deleted,
    });
  } catch (error) {
    console.error("❌ [DELETE CONTROLLER ERROR]:", error?.message || error);
    return res.status(500).json({ error: "Error eliminando controlador" });
  }
};

export const getController = async (req, res) => {
  try {
    const controller = await findOwnedController(req.params.id, req.user?.id).lean();
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    return res.json({ controller });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error leyendo el controlador" });
  }
};

export const updateControllerRegisterDefinitions = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    const registerDefinitions = sanitizeRegisterDefinitions(req.body?.registerDefinitions);
    controller.registerDefinitions = registerDefinitions;
    await controller.save();
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "register-definitions-updated");

    return res.json({ registerDefinitions: controller.registerDefinitions });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: "Error guardando parámetros dinámicos" });
  }
};

export const setControllerSetpoint = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) return res.status(404).json({ error: "Controlador no encontrado" });
    touchControllerPolling(controller._id);

    const temperature = parseFloat(req.body?.temperature);
    if (Number.isNaN(temperature)) {
      return res.status(400).json({ error: "Temperatura inválida" });
    }

    const definition = getSetpointDefinition(controller);
    console.log("🧪 [SETPOINT CONFIG]", {
      controllerId: String(controller._id),
      model: controller.dixellModel,
      connection: resolveControllerConnection(controller),
      register: definition.register,
      verifyRegister: definition.verifyRegister,
      scale: definition.scale,
      min: definition.min,
      max: definition.max,
      note: definition.description,
    });

    setWritingStatus(true);
    await new Promise((resolve) => setTimeout(resolve, 400));
    const writeResult = await writeDefinitionValue({
      controller,
      definition,
      value: temperature,
    });

    publishReadCommands(controller, [definition.register, LEGACY_SETPOINT_REGISTER]);
    setWritingStatus(false);
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "setpoint-written");

    return res.json({ success: true, newSetpoint: temperature, modbus: writeResult });
  } catch (error) {
    setWritingStatus(false);
    console.error("❌ [SETPOINT ERROR]:", error.message);
    return res.status(500).json({
      error: error?.message || "Error al escribir en el equipo.",
      details: error?.message,
    });
  }
};

export const writeControllerRegister = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }
    touchControllerPolling(controller._id);

    const numericRegister = req.body?.register == null ? NaN : Number(req.body.register);
    const key = req.body?.key ? String(req.body.key).trim().toUpperCase() : null;
    const value = req.body?.value;

    let definition =
      controller.registerDefinitions.find((item) => item.key === key) ??
      controller.registerDefinitions.find((item) => Number(item.register) === numericRegister);

    if (!definition) {
      return res.status(404).json({ error: "Parámetro no configurado en este controlador" });
    }

    if (definition?.writable === false) {
      return res.status(403).json({ error: "Este parámetro es solo lectura" });
    }

    setWritingStatus(true);
    const writeResult = await writeDefinitionValue({ controller, definition, value });
    publishReadCommands(controller, [definition.register, definition.verifyRegister]);
    setWritingStatus(false);
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "register-written");

    return res.json({
      success: true,
      key: definition.key,
      register: definition.register,
      value,
      modbus: writeResult,
    });
  } catch (error) {
    setWritingStatus(false);
    console.error("❌ [REGISTER WRITE ERROR]:", error.message);
    return res.status(500).json({
      error: error?.message || "Error escribiendo el parámetro",
      details: error?.message,
    });
  }
};

export const diagnosticController = async (req, res) => {
  try {
    const controller = await findOwnedController(req.params.id, req.user?.id).lean();
    if (!controller) return res.status(404).json({ error: "No encontrado" });
    touchControllerPolling(controller._id);
    const bypassCache = String(req.query?.refresh ?? "").trim() === "1";
    const revisionKey = controller?.updatedAt
      ? new Date(controller.updatedAt).toISOString()
      : "no-updated-at";
    const response = await getCachedDiagnostic({
      controllerId: controller._id,
      revisionKey,
      bypass: bypassCache,
      loader: async () => {
        const connection = resolveControllerConnection(controller);
        const setpointDefinition = getSetpointDefinition(controller);
        const displayRegister =
          Number.isFinite(Number(controller?.setpointReadRegister))
            ? Number(controller.setpointReadRegister)
            : LEGACY_SETPOINT_REGISTER;
        const telemetry = controller?.lastTelemetry ?? null;
        const recentTelemetry = !bypassCache && isRecentTelemetry(telemetry);

        let probeRaw = null;
        let setpointsRaw = {};
        let modbusOnline = false;
        let mqttRegistersRaw = null;
        let tcpClientRegistersRaw = null;
        let diagnosticError = null;
        const visibleDefinitions = getControllerVisibleDefinitions(controller);

        if (shouldUseAgentMqttControl(controller)) {
          try {
            const registers = [
              controller?.probe1,
              displayRegister,
              setpointDefinition.register,
              ...visibleDefinitions.map((definition) => definition.register),
            ];
            const uniqueRegisters = [
              ...new Set(registers.filter((value) => Number.isFinite(Number(value))).map(Number)),
            ];
            const ack = await publishMqttCommand(controller.elfinId, {
              action: "readRegisters",
              registers: uniqueRegisters,
              connection: { unitId: connection.unitId },
            });
            mqttRegistersRaw = ack?.registers ?? null;
            probeRaw = getSnapshotRegisterValue(mqttRegistersRaw, controller?.probe1);
            setpointsRaw = {
              [displayRegister]: getSnapshotRegisterValue(mqttRegistersRaw, displayRegister),
              [setpointDefinition.register]: getSnapshotRegisterValue(
                mqttRegistersRaw,
                setpointDefinition.register
              ),
            };
            modbusOnline = Object.values(mqttRegistersRaw ?? {}).some((value) => {
              if (value === null || value === undefined || value === "") return false;
              return Number.isFinite(Number(value));
            });
          } catch (err) {
            console.error("❌ [DIAGNOSTIC MQTT AGENT ERROR]:", err?.message || err);
            diagnosticError = err;
          }
        } else if (shouldUseTcpClientControl(controller) && !recentTelemetry) {
          try {
            const registers = [
              controller?.probe1,
              displayRegister,
              setpointDefinition.register,
              ...visibleDefinitions.map((definition) => definition.register),
            ];
            const uniqueRegisters = [
              ...new Set(registers.filter((value) => Number.isFinite(Number(value))).map(Number)),
            ];
            tcpClientRegistersRaw = await readRegistersSnapshotViaElfinTcpClient({
              elfinId: controller.elfinId,
              unitId: connection.unitId,
              registers: uniqueRegisters,
            });
            probeRaw = getSnapshotRegisterValue(tcpClientRegistersRaw, controller?.probe1);
            setpointsRaw = {
              [displayRegister]: getSnapshotRegisterValue(tcpClientRegistersRaw, displayRegister),
              [setpointDefinition.register]: getSnapshotRegisterValue(
                tcpClientRegistersRaw,
                setpointDefinition.register
              ),
            };
            modbusOnline = Object.values(tcpClientRegistersRaw ?? {}).some((value) => {
              if (value === null || value === undefined || value === "") return false;
              return Number.isFinite(Number(value));
            });
          } catch (err) {
            console.error("❌ [DIAGNOSTIC TCP CLIENT ERROR]:", err?.message || err);
            diagnosticError = err;
          }
        } else if (shouldUseTcpClientControl(controller) && recentTelemetry) {
          modbusOnline = true;
        } else if (shouldUseMqttControl(controller)) {
          publishReadCommands(controller, [
            controller?.probe1,
            displayRegister,
            setpointDefinition.register,
          ]);
        } else {
          try {
            const snapshot = await readDiagnosticSnapshot({
              connection,
              probeRegister: Number(controller?.probe1 ?? 256),
              setpointRegister: displayRegister,
              extraSetpointRegisters: [setpointDefinition.register],
            });
            probeRaw = snapshot?.probeRaw ?? null;
            setpointsRaw = snapshot?.setpointsRaw ?? {};
            modbusOnline = true;
          } catch (err) {
            console.error("❌ [DIAGNOSTIC MODBUS ERROR]:", err?.message || err);
            diagnosticError = err;
          }
        }

        let configuredRegisters = [];
        try {
          if (shouldUseMqttControl(controller) || shouldUseTcpClientControl(controller)) {
            throw new Error("CONTROL_TRANSPORT=mqtt");
          }

          configuredRegisters = await readRegisterDefinitionsValues({
            connection,
            definitions: visibleDefinitions,
          });
        } catch (err) {
          if (tcpClientRegistersRaw) {
            configuredRegisters = buildDefinitionValuesFromRegisterSnapshot(
              visibleDefinitions,
              tcpClientRegistersRaw,
              "tcp-client"
            );
          } else if (shouldUseTcpClientControl(controller) && recentTelemetry) {
            configuredRegisters = buildDefinitionValuesFromTelemetry(visibleDefinitions, telemetry).map(
              (definition) => ({
                ...definition,
                source: "tcp-client-cache",
              })
            );
          } else if (mqttRegistersRaw) {
            configuredRegisters = buildDefinitionValuesFromRegisterSnapshot(
              visibleDefinitions,
              mqttRegistersRaw
            );
          } else if (shouldUseAgentMqttControl(controller)) {
            configuredRegisters = buildDefinitionValuesFromRegisterSnapshot(visibleDefinitions, null);
          } else if (shouldUseTcpClientControl(controller)) {
            configuredRegisters = buildDefinitionValuesFromRegisterSnapshot(
              visibleDefinitions,
              null,
              "tcp-client"
            );
          } else {
            configuredRegisters = buildDefinitionValuesFromTelemetry(visibleDefinitions, telemetry);
          }

          if (!shouldUseAgentMqttControl(controller) && !shouldUseTcpClientControl(controller)) {
            publishReadCommands(controller, visibleDefinitions.map((definition) => definition.register));
          }
        }

        const probeScale = 10;
        const scale = setpointDefinition.scale ?? 10;
        const useTelemetryFallback =
          (!shouldUseAgentMqttControl(controller) && !shouldUseTcpClientControl(controller)) ||
          (shouldUseTcpClientControl(controller) && recentTelemetry && !tcpClientRegistersRaw);
        const telemetryProbeRaw = useTelemetryFallback
          ? getTelemetryRegisterValue(telemetry, controller?.probe1)
          : null;
        const rawDisplay =
          getSnapshotRegisterValue(setpointsRaw, displayRegister) ??
          (useTelemetryFallback ? getTelemetryRegisterValue(telemetry, displayRegister) : null);
        const rawParam =
          getSnapshotRegisterValue(setpointsRaw, setpointDefinition.register) ??
          (useTelemetryFallback ? getTelemetryRegisterValue(telemetry, setpointDefinition.register) : null);
        const telemetryProbeValue =
          telemetryProbeRaw === null || telemetryProbeRaw === undefined || telemetryProbeRaw === ""
            ? null
            : Number.isFinite(Number(telemetryProbeRaw))
              ? Number(telemetryProbeRaw) / probeScale
              : null;
        const probe1Value = Number.isFinite(probeRaw)
          ? probeRaw / probeScale
          : telemetryProbeValue ?? (useTelemetryFallback ? telemetry?.probe1Value : null) ?? null;

        let userParams768 = null;
        if (
          !shouldUseMqttControl(controller) &&
          !shouldUseTcpClientControl(controller) &&
          String(controller?.dixellModel ?? "").toUpperCase() === "XR35CX"
        ) {
          userParams768 = await readUserParams768Block({ connection, scale });
        }

        let status1280 = null;
        if (!shouldUseMqttControl(controller) && !shouldUseTcpClientControl(controller)) {
          try {
            const snap = await readRegistersSnapshot([STATUS_REGISTER], connection);
            const raw = snap?.[STATUS_REGISTER];
            if (Number.isFinite(raw)) {
              const msb = (raw >> 8) & 0xff;
              const lsb = raw & 0xff;
              status1280 = {
                raw,
                msb,
                lsb,
                deviceOn: Boolean(msb & 1),
                defrostActive: Boolean(msb & (1 << 1)),
                fastFreezing: Boolean(msb & (1 << 2)),
                keyboardLock: Boolean(msb & (1 << 3)),
                energySaving: Boolean(msb & (1 << 6)),
              };
            }
          } catch (_) {
            status1280 = null;
          }
        }

        const online =
          shouldUseAgentMqttControl(controller) || shouldUseTcpClientControl(controller)
            ? modbusOnline || (shouldUseTcpClientControl(controller) && recentTelemetry)
            : modbusOnline || Boolean(telemetry);
        const responseTelemetry =
          Number.isFinite(probe1Value) || telemetry
            ? {
                probe1Value,
                temperature: probe1Value,
                receivedAt: tcpClientRegistersRaw || mqttRegistersRaw ? new Date() : telemetry?.receivedAt,
              }
            : null;
        const runtimeState = buildControllerRuntimeState(controller, {
          telemetry: responseTelemetry ?? telemetry,
          error: diagnosticError,
        });

        return {
          online,
          userCanWrite: canMutateOwnedController(req.user?.role, req.user?.canWrite),
          probe1Value,
          setpointValue: Number.isFinite(rawDisplay) ? rawDisplay / scale : null,
          setpointRegister: displayRegister,
          setpointLegacyValue: Number.isFinite(rawDisplay) ? rawDisplay / scale : null,
          setpointLegacyRegister: displayRegister,
          setpointParamValue: Number.isFinite(rawParam) ? rawParam / scale : null,
          setpointParamRegister: setpointDefinition.register,
          setpointVerifyRegister: setpointDefinition.verifyRegister,
          scale,
          probeScale,
          userParams768,
          status1280,
          connectionState: runtimeState.connectionState,
          alertState: runtimeState.alertState,
          configuredRegisters,
          registerDefinitions: visibleDefinitions,
        };
      },
    });

    return res.json(response);
  } catch (err) {
    console.error("❌ [DIAGNOSTIC ERROR]:", err?.message || err);
    return res.json({
      online: false,
      userCanWrite: canMutateOwnedController(req.user?.role, req.user?.canWrite),
      probe1Value: null,
      setpointValue: null,
      configuredRegisters: [],
    });
  }
};

export const scanControllerSetpoint = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) return res.status(404).json({ error: "Controlador no encontrado" });

    const definition = getSetpointDefinition(controller);

    const result = await scanSetpointRegisters({
      connection: resolveControllerConnection(controller),
      temperature: Number(req.body?.temperature),
      scale: definition.scale,
      start: Number(req.body?.range?.start),
      end: Number(req.body?.range?.end),
      step: req.body?.range?.step == null ? 1 : Number(req.body.range.step),
      candidateRegisters: req.body?.candidateRegisters,
      verifyRegister: definition.verifyRegister,
      maxAttempts: 40,
    });

    if (req.body?.persist === true && result.affectingRegisters.length === 1) {
      controller.setpointRegister = result.affectingRegisters[0];
      if (!Number.isFinite(Number(controller.setpointReadRegister))) {
        controller.setpointReadRegister = LEGACY_SETPOINT_REGISTER;
      }
      if (!Number.isFinite(Number(controller.setpointVerifyRegister))) {
        controller.setpointVerifyRegister = controller.setpointReadRegister;
      }
      await controller.save();
      invalidateDiagnosticCache(controller._id);
    }

    return res.json(result);
  } catch (error) {
    console.error("❌ [SETPOINT SCAN ERROR]:", error?.message || error);
    return res.status(500).json({ error: "Error escaneando setpoint", details: error?.message });
  }
};

export const setControllerHy = async (req, res) => {
  req.body = { ...req.body, key: "HY", register: 769 };
  return writeControllerRegister(req, res);
};

export const setControllerUs = async (req, res) => {
  req.body = { ...req.body, key: "US", register: 771 };
  return writeControllerRegister(req, res);
};

export const setControllerLs = async (req, res) => {
  req.body = { ...req.body, key: "LS", register: 770 };
  return writeControllerRegister(req, res);
};

export const setControllerSetpoint768 = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) return res.status(404).json({ error: "Controlador no encontrado" });
    touchControllerPolling(controller._id);

    const model = String(controller?.dixellModel ?? "").toUpperCase();
    if (model !== "XR35CX") {
      return res.status(400).json({
        error: "El registro 768 no aplica para este modelo de controlador.",
      });
    }

    const numericValue = parseFloat(req.body?.value);
    if (Number.isNaN(numericValue)) {
      return res.status(400).json({ error: "Valor inválido" });
    }

    const definition = buildRegisterDefinitionFromControllerRegister(controller, {
      key: "SETPOINT768",
      label: "Setpoint 768",
      register: 768,
      verifyRegister:
        Number.isFinite(Number(controller?.setpointVerifyRegister))
          ? Number(controller.setpointVerifyRegister)
          : LEGACY_SETPOINT_REGISTER,
      scale: controller?.setpointScale ?? 10,
      min: controller?.setpointMin ?? -50,
      max: controller?.setpointMax ?? 110,
      step: (controller?.setpointScale ?? 10) === 10 ? 0.1 : 1,
    });

    setWritingStatus(true);
    const writeResult = await writeDefinitionValue({
      controller,
      definition,
      value: numericValue,
    });
    publishReadCommands(controller, [768]);
    setWritingStatus(false);
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "setpoint-768-written");

    return res.json({ success: true, newValue: numericValue, modbus: writeResult });
  } catch (error) {
    setWritingStatus(false);
    console.error("❌ [SETPOINT 768 ERROR]:", error.message);
    return res.status(500).json({
      error: "Error modificando setpoint (REG 768).",
      details: error?.message,
      attempts: error?.attempts,
    });
  }
};

export const updateControllerSetpointConfig = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }
    touchControllerPolling(controller._id);

    if (req.body?.setpointRegister != null) {
      controller.setpointRegister = Number(req.body.setpointRegister);
    }
    if (req.body?.setpointReadRegister != null) {
      controller.setpointReadRegister = Number(req.body.setpointReadRegister);
    }
    if (req.body?.setpointVerifyRegister != null) {
      controller.setpointVerifyRegister = Number(req.body.setpointVerifyRegister);
    }
    if (req.body?.setpointScale != null) {
      controller.setpointScale = Number(req.body.setpointScale);
    }

    await controller.save();
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "setpoint-config-updated");

    return res.json({
      setpointRegister: controller.setpointRegister,
      setpointReadRegister: controller.setpointReadRegister,
      setpointVerifyRegister: controller.setpointVerifyRegister,
      setpointScale: controller.setpointScale,
    });
  } catch (error) {
    console.error("❌ [SETPOINT CONFIG ERROR]:", error?.message || error);
    return res.status(500).json({ error: "Error guardando configuracion de setpoint" });
  }
};

export const updateControllerConnectionConfig = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }
    touchControllerPolling(controller._id);

    if (req.body?.ipAddress != null) {
      const ipAddress = String(req.body.ipAddress).trim();
      if (!ipAddress && requiresLocalIp(controller.gatewayMode)) {
        return res.status(400).json({ error: "IP inválida" });
      }
      controller.ipAddress = ipAddress || undefined;
    }

    if (req.body?.gatewayMode != null) {
      controller.gatewayMode = normalizeTransport(req.body.gatewayMode);
    }

    if (req.body?.modbusPort != null) {
      const modbusPort = Number(req.body.modbusPort);
      if (!Number.isFinite(modbusPort) || modbusPort < 1 || modbusPort > 65535) {
        return res.status(400).json({ error: "Puerto Modbus inválido" });
      }
      controller.modbusPort = modbusPort;
    }

    if (req.body?.unitId != null) {
      const unitId = Number(req.body.unitId);
      if (!Number.isFinite(unitId) || unitId < 1 || unitId > 247) {
        return res.status(400).json({ error: "Unit ID inválido" });
      }
      controller.unitId = unitId;
    }

    if (req.body?.baudRate != null) {
      const baudRate = Number(req.body.baudRate);
      if (!Number.isFinite(baudRate) || baudRate < 1200) {
        return res.status(400).json({ error: "Baud rate inválido" });
      }
      controller.baudRate = baudRate;
    }

    if (req.body?.probe1 != null) {
      const probe1 = Number(req.body.probe1);
      if (!Number.isFinite(probe1) || probe1 < 0) {
        return res.status(400).json({ error: "Probe 1 inválida" });
      }
      controller.probe1 = probe1;
    }

    if (req.body?.probe2 != null) {
      const probe2 = Number(req.body.probe2);
      if (!Number.isFinite(probe2) || probe2 < 0) {
        return res.status(400).json({ error: "Probe 2 inválida" });
      }
      controller.probe2 = probe2;
    }

    await controller.save();
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "connection-config-updated");

    return res.json({
      gatewayMode: controller.gatewayMode,
      ipAddress: controller.ipAddress,
      modbusPort: controller.modbusPort,
      unitId: controller.unitId,
      baudRate: controller.baudRate,
      probe1: controller.probe1,
      probe2: controller.probe2,
    });
  } catch (error) {
    console.error("❌ [CONNECTION CONFIG ERROR]:", error?.message || error);
    return res.status(500).json({ error: "Error guardando configuracion de conexion" });
  }
};

export const updateControllerAlertConfig = async (req, res) => {
  try {
    if (!ensureControllerMutationRole(req, res)) return;

    const controller = await findOwnedController(req.params.id, req.user?.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    const nextConfig = {
      ...(controller.alertConfig?.toObject?.() ?? controller.alertConfig ?? {}),
    };

    if (req.body?.enabled != null) {
      nextConfig.enabled = Boolean(req.body.enabled);
    }

    if (req.body?.minTemperature !== undefined) {
      nextConfig.minTemperature =
        req.body.minTemperature === null || req.body.minTemperature === ""
          ? undefined
          : Number(req.body.minTemperature);
      if (nextConfig.minTemperature !== undefined && !Number.isFinite(nextConfig.minTemperature)) {
        return res.status(400).json({ error: "Temperatura mínima inválida" });
      }
    }

    if (req.body?.maxTemperature !== undefined) {
      nextConfig.maxTemperature =
        req.body.maxTemperature === null || req.body.maxTemperature === ""
          ? undefined
          : Number(req.body.maxTemperature);
      if (nextConfig.maxTemperature !== undefined && !Number.isFinite(nextConfig.maxTemperature)) {
        return res.status(400).json({ error: "Temperatura máxima inválida" });
      }
    }

    if (req.body?.offlineAfterMs !== undefined) {
      nextConfig.offlineAfterMs =
        req.body.offlineAfterMs === null || req.body.offlineAfterMs === ""
          ? undefined
          : Number(req.body.offlineAfterMs);
      if (
        nextConfig.offlineAfterMs !== undefined &&
        (!Number.isFinite(nextConfig.offlineAfterMs) || nextConfig.offlineAfterMs < 1000)
      ) {
        return res.status(400).json({ error: "offlineAfterMs inválido" });
      }
    }

    controller.alertConfig = nextConfig;
    await controller.save();
    invalidateDiagnosticCache(controller._id);
    emitControllerRefresh(controller._id, "alert-config-updated");

    return res.json({
      alertConfig: controller.alertConfig,
      alertState: controller.alertState ?? null,
      connectionState: controller.connectionState ?? null,
    });
  } catch (error) {
    console.error("❌ [ALERT CONFIG ERROR]:", error?.message || error);
    return res.status(500).json({ error: "Error guardando configuración de alertas" });
  }
};
