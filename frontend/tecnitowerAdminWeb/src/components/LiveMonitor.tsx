import { useEffect, useRef, useState } from "react";
import { fetchControllerDiagnostic } from "../lib/api";
import type { DiagnosticParam, DiagnosticResponse } from "../lib/api";
import type { AdminControllerDetail } from "../types";

const REFRESH_MS = 5000;

function isConnectionAlertType(type?: string) {
  return type === "offline" || type === "elfin_offline" || type === "modbus_offline";
}

function formatValue(raw: number | string | null | undefined, step?: number) {
  if (raw === null || raw === undefined || raw === "") return "--";
  const num = Number(raw);
  if (!Number.isFinite(num)) return String(raw);
  const decimals = (step ?? 0.1) < 1 ? 1 : 0;
  return num.toFixed(decimals);
}

export default function LiveMonitor({
  controller,
  token,
}: {
  controller: AdminControllerDetail;
  token: string;
}) {
  const [data, setData] = useState<DiagnosticResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    setData(null);
    setLoading(true);
    setError("");

    async function load() {
      try {
        const json = await fetchControllerDiagnostic(token, controller._id);
        if (!mountedRef.current) return;
        setData(json);
        setError("");
        setUpdatedAt(new Date());
      } catch (err) {
        if (mountedRef.current) {
          setError(err instanceof Error ? err.message : "No se pudo leer el diagnóstico");
        }
      } finally {
        if (mountedRef.current) setLoading(false);
      }
    }

    load();
    const interval = setInterval(load, REFRESH_MS);
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [controller._id, token]);

  const elfinOnline = Boolean(data?.connectionState?.elfinOnline ?? data?.online);
  const modbusOnline = Boolean(data?.connectionState?.modbusOnline ?? data?.online);
  const gatewayOnline = elfinOnline;
  const alert = data?.alertState;
  const showConnAlert = Boolean(alert?.active) && isConnectionAlertType(alert?.type);

  const statusMessage = !gatewayOnline
    ? "Lectura Modbus no verificable: el gateway/Elfin no está conectado al servidor. Revisá WiFi, internet, energía del Elfin o configuración TCP Client."
    : !modbusOnline
      ? "Gateway conectado, pero el controlador no entrega datos Modbus. Revisá cableado RS485, alimentación, Unit ID, baud rate y registros."
      : "Gateway conectado y lectura Modbus activa.";
  const fullStatusMessage =
    showConnAlert
      ? statusMessage
      : alert?.active && alert?.message
        ? `${statusMessage} ${alert.message}`
        : statusMessage;

  const baseDefinitions: DiagnosticParam[] = (controller.registerDefinitions ?? []).filter(
    (definition) => definition.visible !== false
  );
  const params: DiagnosticParam[] =
    data?.configuredRegisters && data.configuredRegisters.length > 0
      ? data.configuredRegisters
      : baseDefinitions;

  return (
    <section className="stack live-monitor">
      <div className="live-topbar">
        <span className={`live-pill ${gatewayOnline ? "on" : "off"}`}>
          <span className="live-dot" />
          {gatewayOnline ? "GATEWAY ONLINE" : "GATEWAY OFFLINE"}
        </span>
        <span className="muted small">
          {loading && !data
            ? "Cargando…"
            : updatedAt
              ? `Actualizado ${updatedAt.toLocaleTimeString()} · se refresca cada ${REFRESH_MS / 1000}s`
              : ""}
        </span>
      </div>

      {error ? <div className="banner error">{error}</div> : null}

      <section className="panel live-main">
        <p className="eyebrow">Temperatura de cámara</p>

        <div className={`live-status-box ${showConnAlert ? "is-alert" : ""}`}>
          <strong>{modbusOnline ? "LECTURA MODBUS ONLINE" : "LECTURA MODBUS OFFLINE"}</strong>
          <p className="muted small">{fullStatusMessage}</p>
        </div>

        <div className="live-temp">
          <span className="live-temp-value">{formatValue(data?.probe1Value)}</span>
          <span className="live-temp-unit">°C</span>
        </div>

        <div className="live-setpoint-row">
          <div className="live-setpoint-copy">
            <span className="muted small">Setpoint actual</span>
            <strong>{formatValue(data?.setpointValue)}°C</strong>
          </div>
          {data?.setpointRegister != null ? (
            <span className="live-reg">REG {data.setpointRegister}</span>
          ) : null}
        </div>
      </section>

      <section className="panel">
        <p className="eyebrow">Parámetros disponibles</p>
        {params.length === 0 ? (
          <p className="muted small">Este controlador no tiene parámetros configurados.</p>
        ) : (
          <div className="live-params">
            {params.map((param) => {
              const note =
                param.accessLevel === "technician"
                  ? "Solo técnico (no visible para el usuario)."
                  : param.writable === false
                    ? "Visible para el usuario, sin edición habilitada."
                    : "Visible y editable por el usuario.";
              return (
                <article key={param.key} className="live-param">
                  <div className="live-param-head">
                    <strong>{param.label ?? param.key}</strong>
                    <span className="live-reg">REG {param.register ?? "---"}</span>
                  </div>
                  <div className="live-param-value">{formatValue(param.value, param.step)}</div>
                  <span className="muted small">{note}</span>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </section>
  );
}
