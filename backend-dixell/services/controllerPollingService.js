import { ControllerModel } from "../models/Controller.js";
import { ControllerReading } from "../models/ControllerReading.js";
import { readRegistersSnapshotViaElfinTcpClient } from "./elfinTcpClientModbusService.js";
import { invalidateDiagnosticCache } from "./diagnosticCacheService.js";
import { buildControllerRuntimeState } from "./controllerAlertService.js";
import { publishControllerRealtime } from "./controllerRealtimeService.js";
import { notifyControllerAlertTransition } from "./pushNotificationService.js";

const POLL_INTERVAL_MS = Number(process.env.CONTROLLER_POLL_INTERVAL_MS ?? 12000);
const ACTIVE_WINDOW_MS = Number(process.env.CONTROLLER_POLL_ACTIVE_WINDOW_MS ?? 180000);
const BACKGROUND_POLL_INTERVAL_MS = Number(
  process.env.CONTROLLER_BACKGROUND_POLL_INTERVAL_MS ?? 60000
);

const activeControllers = new Map();
let pollTimer = null;
let backgroundPollTimer = null;
let pollInFlight = false;

function now() {
  return Date.now();
}

function normalizeControllerId(controllerId) {
  return String(controllerId ?? "").trim();
}

function isFinitePositive(value) {
  return Number.isFinite(value) && value > 0;
}

function getPollIntervalMs() {
  return isFinitePositive(POLL_INTERVAL_MS) ? POLL_INTERVAL_MS : 12000;
}

function getActiveWindowMs() {
  return isFinitePositive(ACTIVE_WINDOW_MS) ? ACTIVE_WINDOW_MS : 180000;
}

function getTelemetryRegisterValue(payload, register) {
  const key = String(register);
  const registers = payload?.registers ?? payload?.values ?? payload?.data ?? {};
  return payload?.[key] ?? registers?.[key] ?? registers?.[register] ?? null;
}

function normalizeRawNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function scaledValue(raw, scale = 10) {
  const numeric = normalizeRawNumber(raw);
  return numeric === null ? null : parseFloat((numeric / scale).toFixed(1));
}

function buildTcpTelemetry(snapshot, controller) {
  const probe1Register = Number(controller?.probe1 ?? 256);
  const probe2Register = Number(controller?.probe2 ?? 258);
  const raw1 = normalizeRawNumber(getTelemetryRegisterValue({ registers: snapshot }, probe1Register));
  const raw2 = normalizeRawNumber(getTelemetryRegisterValue({ registers: snapshot }, probe2Register));
  const probe1Value = scaledValue(raw1);
  const probe2Value = scaledValue(raw2);

  return {
    probe1Value,
    probe2Value,
    raw1,
    raw2,
    temperature: probe1Value,
    topic: "tcp-client/poll",
    receivedAt: new Date(),
    payload: {
      source: "tcp-client-poll",
      registers: snapshot,
    },
  };
}

function collectRegisters(controller) {
  const registers = [
    controller?.probe1,
    controller?.probe2,
    controller?.setpointReadRegister,
    controller?.setpointRegister,
    ...(controller?.registerDefinitions ?? []).map((definition) => definition?.register),
  ];

  return [...new Set(registers.map(Number).filter(Number.isFinite))];
}

function hasSnapshotChanged(previousTelemetry, nextSnapshot) {
  const previousSnapshot = previousTelemetry?.payload?.registers ?? null;
  if (!previousSnapshot) return true;
  return JSON.stringify(previousSnapshot) !== JSON.stringify(nextSnapshot);
}

function hasRuntimeStateChanged(previousController, nextRuntimeState) {
  const previousConnectionState = previousController?.connectionState ?? {};
  const nextConnectionState = nextRuntimeState?.connectionState ?? {};
  const previousAlertState = previousController?.alertState ?? {};
  const nextAlertState = nextRuntimeState?.alertState ?? {};

  return (
    Boolean(previousConnectionState.online) !== Boolean(nextConnectionState.online) ||
    String(previousConnectionState.lastPollError ?? "") !== String(nextConnectionState.lastPollError ?? "") ||
    Boolean(previousAlertState.active) !== Boolean(nextAlertState.active) ||
    String(previousAlertState.type ?? "") !== String(nextAlertState.type ?? "") ||
    String(previousAlertState.severity ?? "") !== String(nextAlertState.severity ?? "") ||
    String(previousAlertState.message ?? "") !== String(nextAlertState.message ?? "")
  );
}

async function pollController(controller) {
  const registers = collectRegisters(controller);
  if (!registers.length) return;

  const unitId = Number(controller?.unitId);
  if (!Number.isFinite(unitId) || unitId < 1 || unitId > 247) {
    return;
  }

  const snapshot = await readRegistersSnapshotViaElfinTcpClient({
    elfinId: controller.elfinId,
    unitId,
    registers,
  });

  const telemetry = buildTcpTelemetry(snapshot, controller);
  const changed = hasSnapshotChanged(controller?.lastTelemetry, snapshot);
  const runtimeState = buildControllerRuntimeState(controller, { telemetry });
  const stateChanged = hasRuntimeStateChanged(controller, runtimeState);

  await ControllerModel.updateOne(
    { _id: controller._id },
    {
      $set: {
        lastTelemetry: telemetry,
        connectionState: runtimeState.connectionState,
        alertState: runtimeState.alertState,
      },
    }
  );

  if (changed) {
    await ControllerReading.create({
      controller: controller._id,
      elfinId: controller.elfinId,
      payload: telemetry.payload,
      topic: telemetry.topic,
      receivedAt: telemetry.receivedAt,
    });
  }

  invalidateDiagnosticCache(controller._id);
  if (
    Boolean(controller?.alertState?.active) !== Boolean(runtimeState?.alertState?.active) ||
    String(controller?.alertState?.type ?? "") !== String(runtimeState?.alertState?.type ?? "")
  ) {
    await notifyControllerAlertTransition({
      controller,
      previousAlertState: controller?.alertState ?? null,
      nextAlertState: runtimeState?.alertState ?? null,
    });
  }
  if (changed || stateChanged) {
    publishControllerRealtime(controller._id, {
      reason: changed ? "telemetry-changed" : "controller-state-changed",
    });
  }
}

async function updateControllerPollingErrorState(controller, error) {
  const runtimeState = buildControllerRuntimeState(controller, {
    telemetry: controller?.lastTelemetry ?? null,
    error,
  });

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
  if (
    Boolean(controller?.alertState?.active) !== Boolean(runtimeState?.alertState?.active) ||
    String(controller?.alertState?.type ?? "") !== String(runtimeState?.alertState?.type ?? "")
  ) {
    await notifyControllerAlertTransition({
      controller,
      previousAlertState: controller?.alertState ?? null,
      nextAlertState: runtimeState?.alertState ?? null,
    });
  }
  publishControllerRealtime(controller._id, { reason: "poll-error" });
}

async function runPollingCycle() {
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const current = now();
    const activeIds = [];

    for (const [controllerId, lastSeenAt] of activeControllers.entries()) {
      if (current - lastSeenAt > getActiveWindowMs()) {
        activeControllers.delete(controllerId);
        continue;
      }
      activeIds.push(controllerId);
    }

    if (!activeIds.length) return;

    const controllers = await ControllerModel.find({
      _id: { $in: activeIds },
      gatewayMode: "tcp-client",
    }).lean();

    for (const controller of controllers) {
      try {
        await pollController(controller);
      } catch (error) {
        await updateControllerPollingErrorState(controller, error);
        console.warn(
          `[POLL] ${controller?.elfinId || controller?._id} error:`,
          error?.message || error
        );
      }
    }
  } finally {
    pollInFlight = false;
  }
}

async function runBackgroundPollingCycle() {
  if (!isFinitePositive(BACKGROUND_POLL_INTERVAL_MS)) return;
  if (pollInFlight) return;
  pollInFlight = true;

  try {
    const controllers = await ControllerModel.find({
      gatewayMode: "tcp-client",
    }).lean();

    for (const controller of controllers) {
      try {
        await pollController(controller);
      } catch (error) {
        await updateControllerPollingErrorState(controller, error);
        console.warn(
          `[POLL BACKGROUND] ${controller?.elfinId || controller?._id} error:`,
          error?.message || error
        );
      }
    }
  } finally {
    pollInFlight = false;
  }
}

export function touchControllerPolling(controllerId) {
  const normalized = normalizeControllerId(controllerId);
  if (!normalized) return;
  activeControllers.set(normalized, now());
}

export function startControllerPollingService() {
  if (pollTimer) return pollTimer;

  pollTimer = setInterval(() => {
    runPollingCycle().catch((error) => {
      console.error("[POLL] cycle error:", error?.message || error);
    });
  }, getPollIntervalMs());

  if (typeof pollTimer?.unref === "function") {
    pollTimer.unref();
  }

  console.log(`[POLL] activo cada ${getPollIntervalMs()} ms`);

  if (isFinitePositive(BACKGROUND_POLL_INTERVAL_MS)) {
    backgroundPollTimer = setInterval(() => {
      runBackgroundPollingCycle().catch((error) => {
        console.error("[POLL BACKGROUND] cycle error:", error?.message || error);
      });
    }, BACKGROUND_POLL_INTERVAL_MS);

    if (typeof backgroundPollTimer?.unref === "function") {
      backgroundPollTimer.unref();
    }

    console.log(`[POLL BACKGROUND] activo cada ${BACKGROUND_POLL_INTERVAL_MS} ms`);
  }

  return pollTimer;
}

export async function stopControllerPollingService() {
  if (pollTimer) clearInterval(pollTimer);
  if (backgroundPollTimer) clearInterval(backgroundPollTimer);
  pollTimer = null;
  backgroundPollTimer = null;
}
