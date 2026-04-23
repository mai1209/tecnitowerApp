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
  const online = recent;
  const { minTemperature, maxTemperature } = getTemperatureThresholds(controller);
  const alertsEnabled = controller?.alertConfig?.enabled !== false;

  const connectionState = {
    online,
    lastSeenAt: receivedAt,
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
        type: "offline",
        severity: "critical",
        message: error
          ? `Sin comunicación reciente (${String(error?.message || error)})`
          : "Sin comunicación reciente con el controlador",
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
