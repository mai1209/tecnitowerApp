const DEFAULT_OFFLINE_AFTER_MS = Number(process.env.ALERT_OFFLINE_AFTER_MS ?? 60000);

function getOfflineAfterMs(controller) {
  const configured = Number(controller?.alertConfig?.offlineAfterMs);
  if (Number.isFinite(configured) && configured >= 1000) return configured;
  if (Number.isFinite(DEFAULT_OFFLINE_AFTER_MS) && DEFAULT_OFFLINE_AFTER_MS >= 1000) {
    return DEFAULT_OFFLINE_AFTER_MS;
  }
  return 60000;
}

function getTemperatureThresholds(controller) {
  const minTemperature = Number(controller?.alertConfig?.minTemperature);
  const maxTemperature = Number(controller?.alertConfig?.maxTemperature);
  return {
    minTemperature: Number.isFinite(minTemperature) ? minTemperature : null,
    maxTemperature: Number.isFinite(maxTemperature) ? maxTemperature : null,
  };
}

function getTemperatureValue(telemetry) {
  const value = Number(telemetry?.probe1Value ?? telemetry?.temperature);
  return Number.isFinite(value) ? value : null;
}

function getReceivedAt(telemetry, fallback = null) {
  const receivedAt = telemetry?.receivedAt ? new Date(telemetry.receivedAt) : fallback;
  return receivedAt instanceof Date && !Number.isNaN(receivedAt.getTime()) ? receivedAt : null;
}

function isRecent(receivedAt, maxAgeMs) {
  if (!(receivedAt instanceof Date) || Number.isNaN(receivedAt.getTime())) return false;
  return Date.now() - receivedAt.getTime() <= maxAgeMs;
}

function classifyCommunicationError(error) {
  const message = String(error?.message || error || "").toLowerCase();

  if (!message) {
    return {
      status: "unknown",
      alertType: "offline",
      message: "Sin comunicación reciente con el controlador.",
    };
  }

  if (
    message.includes("elfin tcp client no conectado") ||
    message.includes("elfin tcp client no listo") ||
    message.includes("conexión tcp del elfin")
  ) {
    return {
      status: "elfin_offline",
      alertType: "elfin_offline",
      message:
        "Elfin sin conexión al servidor. Revisá WiFi, router, energía del módulo o configuración TCP Client.",
    };
  }

  if (
    message.includes("timeout esperando respuesta tcp del elfin") ||
    message.includes("timeout esperando respuesta modbus del controlador") ||
    message.includes("modbus exception") ||
    message.includes("respuesta modbus") ||
    message.includes("unit id modbus")
  ) {
    return {
      status: "modbus_offline",
      alertType: "modbus_offline",
      message:
        "Elfin conectado, pero sin respuesta Modbus del controlador. Revisá cableado RS485, alimentación del controlador, Unit ID, baud rate y registros.",
    };
  }

  return {
    status: "modbus_offline",
    alertType: "modbus_offline",
    message:
      "Elfin conectado, pero la lectura Modbus falló. Revisá cableado físico, controlador y configuración Modbus.",
  };
}

function buildInactiveAlert(previousAlert, online, temperature) {
  return {
    active: false,
    type: "none",
    severity: "info",
    message: null,
    since: previousAlert?.active ? null : previousAlert?.since ?? null,
    lastEvaluatedAt: new Date(),
    temperature,
    threshold: null,
    online,
  };
}

function buildActiveAlert(previousAlert, nextAlert) {
  const sameType = previousAlert?.active && previousAlert?.type === nextAlert.type;
  return {
    ...nextAlert,
    active: true,
    since: sameType ? previousAlert?.since ?? new Date() : new Date(),
    lastEvaluatedAt: new Date(),
  };
}

export function buildControllerRuntimeState(controller, { telemetry = null, error = null } = {}) {
  const previousAlert = controller?.alertState ?? null;
  const previousConnection = controller?.connectionState ?? null;
  const fallbackSeenAt = getReceivedAt(
    controller?.lastTelemetry,
    previousConnection?.lastSeenAt ? new Date(previousConnection.lastSeenAt) : null
  );
  const receivedAt = getReceivedAt(telemetry, fallbackSeenAt);
  const offlineAfterMs = getOfflineAfterMs(controller);
  const temperature = getTemperatureValue(telemetry);
  const recent = isRecent(receivedAt, offlineAfterMs);
  const errorClassification = classifyCommunicationError(error);
  const hasError = Boolean(error);
  const modbusOnline = hasError ? false : recent;
  const elfinOnline = hasError
    ? errorClassification.status !== "elfin_offline"
    : recent || Boolean(controller?.connectionState?.elfinOnline);
  const online = elfinOnline && modbusOnline;
  const connectionStatus = online
    ? "online"
    : hasError
      ? errorClassification.status
      : "unknown";
  const connectionMessage = online
    ? "Elfin conectado y lectura Modbus activa."
    : hasError
      ? errorClassification.message
      : "Sin diagnóstico reciente del controlador.";
  const { minTemperature, maxTemperature } = getTemperatureThresholds(controller);
  const alertsEnabled = controller?.alertConfig?.enabled !== false;

  const connectionState = {
    online,
    elfinOnline,
    modbusOnline,
    status: connectionStatus,
    message: connectionMessage,
    lastSeenAt: receivedAt,
    lastElfinSeenAt: elfinOnline
      ? new Date()
      : controller?.connectionState?.lastElfinSeenAt ?? null,
    lastModbusOkAt: modbusOnline
      ? receivedAt
      : controller?.connectionState?.lastModbusOkAt ?? null,
    lastPollAt: new Date(),
    lastPollError: error ? String(error?.message || error) : null,
  };

  if (!alertsEnabled) {
    return {
      connectionState,
      alertState: buildInactiveAlert(previousAlert, online, temperature),
    };
  }

  if (!online) {
    return {
      connectionState,
      alertState: buildActiveAlert(previousAlert, {
        type: hasError ? errorClassification.alertType : "offline",
        severity: "critical",
        message: connectionMessage,
        temperature,
        threshold: null,
        online,
      }),
    };
  }

  if (temperature !== null && maxTemperature !== null && temperature > maxTemperature) {
    return {
      connectionState,
      alertState: buildActiveAlert(previousAlert, {
        type: "temperature_high",
        severity: "warning",
        message: `Temperatura alta: ${temperature.toFixed(1)}°C > ${maxTemperature.toFixed(1)}°C`,
        temperature,
        threshold: maxTemperature,
        online,
      }),
    };
  }

  if (temperature !== null && minTemperature !== null && temperature < minTemperature) {
    return {
      connectionState,
      alertState: buildActiveAlert(previousAlert, {
        type: "temperature_low",
        severity: "warning",
        message: `Temperatura baja: ${temperature.toFixed(1)}°C < ${minTemperature.toFixed(1)}°C`,
        temperature,
        threshold: minTemperature,
        online,
      }),
    };
  }

  return {
    connectionState,
    alertState: buildInactiveAlert(previousAlert, online, temperature),
  };
}
