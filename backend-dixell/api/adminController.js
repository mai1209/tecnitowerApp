import { ControllerModel } from "../models/Controller.js";
import { PasswordRecoveryRequestModel } from "../models/PasswordRecoveryRequest.js";
import { PushDeviceModel } from "../models/PushDevice.js";
import { UserModel } from "../models/User.js";
import { invalidateDiagnosticCache } from "../services/diagnosticCacheService.js";
import { publishControllerRealtime } from "../services/controllerRealtimeService.js";
import { sendPushToUser } from "../services/pushNotificationService.js";
import { buildPublicUser, normalizeUserRole } from "../utils/userAccess.js";
import { buildControllerPayloadForOwner } from "./controllerController.js";

function requireAdmin(req, res) {
  if (req.user?.role !== "admin") {
    res.status(403).json({ error: "Solo un admin puede usar este recurso" });
    return false;
  }
  return true;
}

function sanitizeRegisterDefinitions(rawDefinitions = []) {
  if (!Array.isArray(rawDefinitions)) return [];

  return rawDefinitions
    .map((definition, index) => {
      const key = String(definition?.key ?? "").trim().toUpperCase();
      const label = String(definition?.label ?? key).trim();
      const register = Number(definition?.register);
      const verifyRegister =
        definition?.verifyRegister == null || definition.verifyRegister === ""
          ? undefined
          : Number(definition.verifyRegister);
      const scale = Number(definition?.scale ?? 10);
      const min = definition?.min == null || definition.min === "" ? undefined : Number(definition.min);
      const max = definition?.max == null || definition.max === "" ? undefined : Number(definition.max);
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

function normalizeTransport(value) {
  const transport = String(value ?? "").trim().toLowerCase();
  if (transport === "mqtt" || transport === "cloud" || transport === "agent-mqtt") return "agent-mqtt";
  if (transport === "mqtt-raw" || transport === "elfin-mqtt") return "elfin-mqtt";
  if (transport === "tcp-client" || transport === "tcp_client") return "tcp-client";
  return "direct";
}

function requiresLocalIp(gatewayMode) {
  const transport = normalizeTransport(gatewayMode);
  return transport !== "elfin-mqtt" && transport !== "tcp-client";
}

async function deleteUserResources(userId) {
  const controllers = await ControllerModel.find({ owner: userId }).select({ _id: 1 });
  for (const controller of controllers) {
    invalidateDiagnosticCache(controller._id);
  }

  await ControllerModel.deleteMany({ owner: userId });
  await PushDeviceModel.deleteMany({ user: userId });
  await PasswordRecoveryRequestModel.deleteMany({ userId });
}

export async function listUsersWithControllers(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const users = await UserModel.find({})
      .select({ fullName: 1, email: 1, role: 1, canWrite: 1, isActive: 1, createdAt: 1 })
      .sort({ createdAt: -1 })
      .lean();

    const userIds = users.map((user) => user._id);
    const pushDevices = await PushDeviceModel.aggregate([
      {
        $match: {
          user: { $in: userIds },
          enabled: true,
        },
      },
      {
        $group: {
          _id: "$user",
          count: { $sum: 1 },
        },
      },
    ]);
    const controllers = await ControllerModel.find({ owner: { $in: userIds } })
      .select({
        owner: 1,
        name: 1,
        elfinId: 1,
        ipAddress: 1,
        modbusPort: 1,
        location: 1,
        gatewayMode: 1,
        deviceBrand: 1,
        deviceModel: 1,
        dixellModel: 1,
        unitId: 1,
        baudRate: 1,
        probe1: 1,
        probe2: 1,
        lastTelemetry: 1,
        connectionState: 1,
        alertState: 1,
        alertConfig: 1,
        registerDefinitions: 1,
        createdAt: 1,
        updatedAt: 1,
      })
      .sort({ createdAt: -1 })
      .lean();
    const pushDevicesByUser = new Map(
      pushDevices.map((item) => [String(item._id), Number(item.count ?? 0)])
    );

    const controllersByOwner = new Map();
    for (const controller of controllers) {
      const ownerId = String(controller.owner);
      const list = controllersByOwner.get(ownerId) ?? [];
      list.push({
        ...controller,
        _id: controller._id?.toString(),
        owner: ownerId,
        registerDefinitionsCount: controller.registerDefinitions?.length ?? 0,
      });
      controllersByOwner.set(ownerId, list);
    }

    return res.json({
      users: users.map((user) => {
        const ownedControllers = controllersByOwner.get(String(user._id)) ?? [];
        return {
          ...buildPublicUser(user),
          pushDevicesEnabledCount: pushDevicesByUser.get(String(user._id)) ?? 0,
          controllersCount: ownedControllers.length,
          controllers: ownedControllers,
        };
      }),
    });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminUser(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (req.body?.fullName != null) {
      const fullName = String(req.body.fullName).trim();
      if (fullName.length < 3) {
        return res.status(400).json({ error: "Nombre inválido" });
      }
      user.fullName = fullName;
    }

    if (req.body?.role != null) {
      const role = String(req.body.role).trim().toLowerCase();
      if (!["admin", "user"].includes(role)) {
        return res.status(400).json({ error: "Rol inválido" });
      }
      user.role = role;
    }

    if (req.body?.canWrite != null) {
      user.canWrite = Boolean(req.body.canWrite);
    }

    if (normalizeUserRole(user.role) === "admin") {
      user.canWrite = true;
    }

    if (req.body?.isActive != null) {
      user.isActive = Boolean(req.body.isActive);
    }

    await user.save();

    return res.json({
      user: buildPublicUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

export async function deleteAdminUser(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const user = await UserModel.findById(req.params.id);
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    if (String(user._id) === String(req.user?.id ?? "")) {
      return res.status(400).json({ error: "No podés eliminar tu propio usuario desde este panel" });
    }

    const deletedUser = {
      _id: user._id.toString(),
      fullName: user.fullName,
      email: user.email,
      role: normalizeUserRole(user.role),
    };

    await deleteUserResources(user._id);
    await user.deleteOne();

    return res.json({
      message: "Usuario eliminado correctamente",
      user: deletedUser,
    });
  } catch (err) {
    return next(err);
  }
}

export async function sendAdminUserTestPush(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const user = await UserModel.findById(req.params.id)
      .select({ _id: 1, fullName: 1, email: 1, role: 1, canWrite: 1, isActive: 1, createdAt: 1 })
      .lean();
    if (!user) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const result = await sendPushToUser({
      userId: user._id,
      title: "Prueba de notificación",
      body: "Esta es una prueba de Tecnitower para validar push en este usuario.",
      data: {
        kind: "admin-test-push",
        userId: user._id,
        userEmail: user.email,
        screen: "Home",
      },
    });

    return res.json({
      message:
        result.sent === true
          ? "Notificación de prueba enviada"
          : "No se pudo entregar la notificación de prueba",
      result,
      user: buildPublicUser(user),
    });
  } catch (err) {
    return next(err);
  }
}

export async function createAdminController(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const ownerId = String(req.body?.ownerId ?? "").trim();
    if (!ownerId) {
      return res.status(400).json({ error: "ownerId es obligatorio" });
    }

    const owner = await UserModel.findById(ownerId).select({ _id: 1 }).lean();
    if (!owner) {
      return res.status(404).json({ error: "Usuario destino no encontrado" });
    }

    const payload = await buildControllerPayloadForOwner(ownerId, req.body);
    const controller = await ControllerModel.create(payload);
    return res.status(201).json({ controller });
  } catch (err) {
    if (err?.message === "name y elfinId son obligatorios" || err?.message === "name, elfinId e ipAddress son obligatorios") {
      return res.status(400).json({ error: err.message });
    }
    if (err?.code === 11000 && err?.keyPattern?.elfinId) {
      return res.status(409).json({ error: "Ese Elfin ID ya está registrado en otro controlador." });
    }
    return next(err);
  }
}

export async function deleteAdminController(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const controller = await ControllerModel.findById(req.params.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    const deleted = {
      _id: controller._id.toString(),
      name: controller.name,
      elfinId: controller.elfinId,
      owner: controller.owner?.toString?.() ?? String(controller.owner ?? ""),
    };

    await controller.deleteOne();
    invalidateDiagnosticCache(controller._id);

    return res.json({
      message: "Controlador eliminado correctamente",
      controller: deleted,
    });
  } catch (err) {
    return next(err);
  }
}

export async function getAdminController(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const controller = await ControllerModel.findById(req.params.id).lean();
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    return res.json({ controller });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminControllerRegisterDefinitions(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const controller = await ControllerModel.findById(req.params.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    controller.registerDefinitions = sanitizeRegisterDefinitions(req.body?.registerDefinitions);
    await controller.save();
    invalidateDiagnosticCache(controller._id);
    publishControllerRealtime(controller._id, { reason: "admin-register-definitions-updated" });

    return res.json({ registerDefinitions: controller.registerDefinitions });
  } catch (err) {
    return next(err);
  }
}

export async function updateAdminControllerConnectionConfig(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const controller = await ControllerModel.findById(req.params.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    if (req.body?.name != null) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ error: "Nombre inválido" });
      }
      controller.name = name;
    }

    if (req.body?.elfinId != null) {
      const elfinId = String(req.body.elfinId).trim().toUpperCase();
      if (!elfinId) {
        return res.status(400).json({ error: "Elfin ID inválido" });
      }
      controller.elfinId = elfinId;
    }

    if (req.body?.gatewayMode != null) {
      controller.gatewayMode = normalizeTransport(req.body.gatewayMode);
    }

    if (req.body?.ipAddress != null) {
      const ipAddress = String(req.body.ipAddress).trim();
      if (!ipAddress && requiresLocalIp(req.body?.gatewayMode ?? controller.gatewayMode)) {
        return res.status(400).json({ error: "IP inválida" });
      }
      controller.ipAddress = ipAddress || undefined;
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

    if (req.body?.location != null) {
      controller.location = String(req.body.location).trim() || undefined;
    }

    await controller.save();
    invalidateDiagnosticCache(controller._id);
    publishControllerRealtime(controller._id, { reason: "admin-connection-config-updated" });

    return res.json({
      controller: {
        _id: controller._id.toString(),
        name: controller.name,
        elfinId: controller.elfinId,
        gatewayMode: controller.gatewayMode,
        ipAddress: controller.ipAddress,
        modbusPort: controller.modbusPort,
        unitId: controller.unitId,
        baudRate: controller.baudRate,
        probe1: controller.probe1,
        probe2: controller.probe2,
        location: controller.location,
      },
    });
  } catch (err) {
    if (err?.code === 11000 && err?.keyPattern?.elfinId) {
      return res.status(409).json({ error: "Ese Elfin ID ya está registrado en otro controlador." });
    }
    return next(err);
  }
}

export async function updateAdminControllerAlertConfig(req, res, next) {
  try {
    if (!requireAdmin(req, res)) return;

    const controller = await ControllerModel.findById(req.params.id);
    if (!controller) {
      return res.status(404).json({ error: "Controlador no encontrado" });
    }

    const nextConfig = {
      ...(controller.alertConfig?.toObject?.() ?? controller.alertConfig ?? {}),
    };

    if (req.body?.enabled != null) nextConfig.enabled = Boolean(req.body.enabled);
    if (req.body?.minTemperature !== undefined) {
      nextConfig.minTemperature =
        req.body.minTemperature === null || req.body.minTemperature === ""
          ? undefined
          : Number(req.body.minTemperature);
    }
    if (req.body?.maxTemperature !== undefined) {
      nextConfig.maxTemperature =
        req.body.maxTemperature === null || req.body.maxTemperature === ""
          ? undefined
          : Number(req.body.maxTemperature);
    }
    if (req.body?.offlineAfterMs !== undefined) {
      nextConfig.offlineAfterMs =
        req.body.offlineAfterMs === null || req.body.offlineAfterMs === ""
          ? undefined
          : Number(req.body.offlineAfterMs);
    }

    controller.alertConfig = nextConfig;
    await controller.save();
    invalidateDiagnosticCache(controller._id);
    publishControllerRealtime(controller._id, { reason: "admin-alert-config-updated" });

    return res.json({
      alertConfig: controller.alertConfig,
      alertState: controller.alertState ?? null,
      connectionState: controller.connectionState ?? null,
    });
  } catch (err) {
    return next(err);
  }
}
