import { useEffect, useMemo, useState } from "react";
import {
  createDeviceModel,
  fetchAdminController,
  fetchAdminUsers,
  fetchDeviceModels,
  login,
  updateAdminControllerAlerts,
  updateAdminControllerConnection,
  updateAdminControllerRegisters,
  updateAdminUser,
  updateDeviceModel,
  type ModelPayload,
  type Session,
} from "./lib/api";
import { downloadCsv, parseRegisterDefinitionsCsv, serializeRegisterDefinitionsCsv } from "./lib/csv";
import { formatDate, formatNumber } from "./lib/format";
import type {
  AdminControllerDetail,
  DeviceModel,
  RegisterDefinition,
  UserWithControllers,
  UserRole,
} from "./types";

type View = "overview" | "users" | "models";

const STORAGE_KEY = "tecnitower-admin-web-session";

const defaultTemplateRows: RegisterDefinition[] = [
  {
    key: "SET",
    label: "Setpoint normal",
    register: 31,
    verifyRegister: 31,
    scale: 10,
    step: 0.1,
    min: -50,
    max: 105,
    writable: true,
    visible: true,
    accessLevel: "user",
    functionCode: "auto",
  },
  {
    key: "TMP1",
    label: "Temperatura S1",
    register: 101,
    scale: 10,
    step: 0.1,
    writable: false,
    visible: true,
    accessLevel: "user",
    functionCode: "auto",
  },
];

function emptyModelForm(): ModelPayload {
  return {
    brand: "DIXELL",
    name: "",
    protocol: "tcp-client",
    connectionType: "serial",
    defaultUnitId: 1,
    defaultModbusPort: 502,
    defaultBaudRate: 9600,
    defaultDataBits: 8,
    defaultParity: "none",
    defaultStopBits: 1,
    defaultProbe1: undefined,
    defaultProbe2: undefined,
    setpointRegister: undefined,
    setpointReadRegister: undefined,
    setpointVerifyRegister: undefined,
    setpointMin: undefined,
    setpointMax: undefined,
    setpointScale: 10,
    description: "",
    notes: "",
    registerTemplates: defaultTemplateRows,
  };
}

function telemetrySummary(controller: UserWithControllers["controllers"][number]) {
  const telemetry = controller.lastTelemetry;
  if (!telemetry) return "Sin telemetría reciente";
  const parts = [];
  if (telemetry.probe1Value != null) parts.push(`S1 ${formatNumber(telemetry.probe1Value)} °C`);
  if (telemetry.probe2Value != null) parts.push(`S2 ${formatNumber(telemetry.probe2Value)} °C`);
  if (telemetry.temperature != null) parts.push(`Temp ${formatNumber(telemetry.temperature)} °C`);
  if (telemetry.humidity != null) parts.push(`Hum ${formatNumber(telemetry.humidity)} %`);
  return parts.join(" | ") || "Sin valores interpretados";
}

function toNumber(value: string) {
  if (value.trim() === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function readSession(): Session | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

function saveSession(session: Session | null) {
  if (!session) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession());
  const [view, setView] = useState<View>("overview");
  const [users, setUsers] = useState<UserWithControllers[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("admin@admin.com");
  const [loginPassword, setLoginPassword] = useState("admin");
  const [selectedController, setSelectedController] = useState<AdminControllerDetail | null>(null);
  const [modelForm, setModelForm] = useState<ModelPayload>(emptyModelForm());
  const [editingModelId, setEditingModelId] = useState<string | null>(null);

  const controllerMetrics = useMemo(() => {
    const controllers = users.flatMap((user) => user.controllers);
    return {
      users: users.length,
      controllers: controllers.length,
      online: controllers.filter((controller) => controller.connectionState?.online).length,
      alerts: controllers.filter((controller) => controller.alertState?.active).length,
    };
  }, [users]);

  async function loadData(token: string) {
    setLoading(true);
    try {
      const [usersPayload, modelsPayload] = await Promise.all([
        fetchAdminUsers(token),
        fetchDeviceModels(token),
      ]);
      setUsers(usersPayload.users);
      setModels(modelsPayload.models);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!session?.token) return;
    loadData(session.token).catch((err: Error) => {
      setError(err.message);
      setSession(null);
      saveSession(null);
    });
  }, [session?.token]);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoginLoading(true);
    try {
      const nextSession = await login(loginEmail.trim(), loginPassword);
      if (nextSession.user.role !== "admin") {
        throw new Error("Este usuario no tiene rol admin");
      }
      setSession(nextSession);
      saveSession(nextSession);
      setSuccess("Sesión iniciada.");
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoginLoading(false);
    }
  }

  async function handleRefresh() {
    if (!session?.token) return;
    setError("");
    setSuccess("");
    try {
      await loadData(session.token);
      setSuccess("Datos actualizados.");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleOpenController(controllerId: string) {
    if (!session?.token) return;
    try {
      const payload = await fetchAdminController(session.token, controllerId);
      setSelectedController(payload.controller);
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveUser(userId: string, fullName: string, role: UserRole, isActive: boolean) {
    if (!session?.token) return;
    try {
      await updateAdminUser(session.token, userId, { fullName, role, isActive });
      await loadData(session.token);
      setSuccess("Usuario actualizado.");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSaveController() {
    if (!session?.token || !selectedController?._id) return;
    try {
      await Promise.all([
        updateAdminControllerConnection(session.token, selectedController._id, {
          name: selectedController.name,
          elfinId: selectedController.elfinId,
          gatewayMode: selectedController.gatewayMode,
          ipAddress: selectedController.ipAddress,
          modbusPort: selectedController.modbusPort,
          unitId: selectedController.unitId,
          baudRate: selectedController.baudRate,
          probe1: selectedController.probe1,
          probe2: selectedController.probe2,
          location: selectedController.location,
        }),
        updateAdminControllerAlerts(session.token, selectedController._id, selectedController.alertConfig ?? {}),
        updateAdminControllerRegisters(
          session.token,
          selectedController._id,
          selectedController.registerDefinitions ?? []
        ),
      ]);
      await loadData(session.token);
      setSuccess("Controlador actualizado.");
      setError("");
      setSelectedController(null);
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleSubmitModel(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.token) return;
    try {
      if (!modelForm.name?.trim()) {
        throw new Error("El nombre del modelo es obligatorio");
      }
      if (editingModelId) {
        await updateDeviceModel(session.token, editingModelId, modelForm);
        setSuccess("Modelo actualizado.");
      } else {
        await createDeviceModel(session.token, modelForm);
        setSuccess("Modelo creado.");
      }
      setError("");
      setModelForm(emptyModelForm());
      setEditingModelId(null);
      await loadData(session.token);
      setView("models");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleEditModel(model: DeviceModel) {
    setEditingModelId(model._id);
    setModelForm({
      brand: model.brand,
      name: model.name,
      protocol: model.protocol,
      connectionType: model.connectionType,
      defaultUnitId: model.defaultUnitId,
      defaultModbusPort: model.defaultModbusPort,
      defaultBaudRate: model.defaultBaudRate,
      defaultDataBits: model.defaultDataBits,
      defaultParity: model.defaultParity,
      defaultStopBits: model.defaultStopBits,
      defaultProbe1: model.defaultProbe1,
      defaultProbe2: model.defaultProbe2,
      registerCount: model.registerCount,
      notes: model.notes,
      setpointRegister: model.setpointRegister,
      setpointReadRegister: model.setpointReadRegister,
      setpointVerifyRegister: model.setpointVerifyRegister,
      setpointMin: model.setpointMin,
      setpointMax: model.setpointMax,
      setpointScale: model.setpointScale,
      description: model.description,
      registerTemplates: model.registerTemplates?.length ? model.registerTemplates : defaultTemplateRows,
    });
    setView("models");
  }

  if (!session) {
    return (
      <div className="auth-shell">
        <div className="auth-card">
          <p className="eyebrow">Tecnitower</p>
          <h1>Admin web</h1>
          <p className="muted">Panel separado de la app mobile para operación técnica y administración.</p>
          <form className="auth-form" onSubmit={handleLogin}>
            <label>
              <span>Email</span>
              <input value={loginEmail} onChange={(event) => setLoginEmail(event.target.value)} />
            </label>
            <label>
              <span>Contraseña</span>
              <input
                type="password"
                value={loginPassword}
                onChange={(event) => setLoginPassword(event.target.value)}
              />
            </label>
            <button disabled={loginLoading} type="submit" className="primary-button">
              {loginLoading ? "Ingresando..." : "Ingresar"}
            </button>
          </form>
          {error ? <p className="error-text">{error}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Tecnitower</p>
          <h2>Admin web</h2>
          <p className="muted inverse">Separado de la app cliente, conectado al mismo backend.</p>
        </div>
        <nav className="nav">
          <button className={view === "overview" ? "nav-link active" : "nav-link"} onClick={() => setView("overview")}>Resumen</button>
          <button className={view === "users" ? "nav-link active" : "nav-link"} onClick={() => setView("users")}>Usuarios</button>
          <button className={view === "models" ? "nav-link active" : "nav-link"} onClick={() => setView("models")}>Modelos</button>
        </nav>
        <div className="session-box">
          <p className="session-user">{session.user.email}</p>
          <p className="session-role">{session.user.role}</p>
          <button
            className="ghost-button"
            onClick={() => {
              setSession(null);
              saveSession(null);
            }}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <h1>Panel administrador</h1>
            <p className="muted">Usuarios, controladores, plantillas de modelo y permisos técnicos.</p>
          </div>
          <button className="ghost-button" onClick={handleRefresh} disabled={loading}>
            {loading ? "Actualizando..." : "Actualizar"}
          </button>
        </header>

        {error ? <section className="banner error">{error}</section> : null}
        {success ? <section className="banner success">{success}</section> : null}

        {view === "overview" ? (
          <section className="metrics-grid">
            <article className="metric-card"><span>Usuarios</span><strong>{controllerMetrics.users}</strong></article>
            <article className="metric-card"><span>Controladores</span><strong>{controllerMetrics.controllers}</strong></article>
            <article className="metric-card"><span>Online</span><strong>{controllerMetrics.online}</strong></article>
            <article className="metric-card"><span>Alertas activas</span><strong>{controllerMetrics.alerts}</strong></article>
          </section>
        ) : null}

        {view === "users" ? (
          <section className="stack">
            {users.map((user) => (
              <UserCard key={user._id} user={user} onSave={handleSaveUser} onEditController={handleOpenController} />
            ))}
          </section>
        ) : null}

        {view === "models" ? (
          <section className="stack">
            <section className="panel">
              <div className="panel-header">
                <div>
                  <h3>{editingModelId ? "Editar modelo" : "Alta de modelo"}</h3>
                  <p className="muted">Plantillas reutilizables para múltiples controladores del mismo equipo.</p>
                </div>
              </div>
              <form className="stack" onSubmit={handleSubmitModel}>
                <div className="form-grid form-grid-3">
                  <Field label="Marca" value={modelForm.brand ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, brand: value }))} />
                  <Field label="Nombre" value={modelForm.name ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, name: value }))} />
                  <Field label="Protocolo" value={modelForm.protocol ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, protocol: value }))} />
                  <Field label="Connection type" value={modelForm.connectionType ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, connectionType: value }))} />
                  <NumberField label="Unit ID default" value={modelForm.defaultUnitId} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultUnitId: value }))} />
                  <NumberField label="Puerto Modbus" value={modelForm.defaultModbusPort} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultModbusPort: value }))} />
                  <NumberField label="Baudrate" value={modelForm.defaultBaudRate} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultBaudRate: value }))} />
                  <NumberField label="Data bits" value={modelForm.defaultDataBits} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultDataBits: value }))} />
                  <Field label="Parity" value={modelForm.defaultParity ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultParity: value }))} />
                  <NumberField label="Stop bits" value={modelForm.defaultStopBits} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultStopBits: value }))} />
                  <NumberField label="Probe 1 default" value={modelForm.defaultProbe1} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultProbe1: value }))} />
                  <NumberField label="Probe 2 default" value={modelForm.defaultProbe2} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultProbe2: value }))} />
                  <NumberField label="Setpoint register" value={modelForm.setpointRegister} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointRegister: value }))} />
                  <NumberField label="Setpoint read register" value={modelForm.setpointReadRegister} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointReadRegister: value }))} />
                  <NumberField label="Setpoint verify register" value={modelForm.setpointVerifyRegister} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointVerifyRegister: value }))} />
                  <NumberField label="Setpoint min" value={modelForm.setpointMin} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointMin: value }))} />
                  <NumberField label="Setpoint max" value={modelForm.setpointMax} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointMax: value }))} />
                  <NumberField label="Setpoint scale" value={modelForm.setpointScale} onChange={(value) => setModelForm((prev) => ({ ...prev, setpointScale: value }))} />
                </div>
                <Field label="Descripción" value={modelForm.description ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, description: value }))} />
                <Field label="Notas" value={modelForm.notes ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, notes: value }))} />

                <section className="panel panel-soft">
                  <div className="panel-header inline">
                    <div>
                      <h4>Plantilla de registros</h4>
                      <p className="muted small">Importá, exportá y editá la base de registros del modelo.</p>
                    </div>
                    <div className="actions-row compact">
                      <label className="ghost-button file-button">
                        Importar CSV
                        <input
                          type="file"
                          accept=".csv,text/csv"
                          hidden
                          onChange={async (event) => {
                            const file = event.target.files?.[0];
                            if (!file) return;
                            const text = await file.text();
                            try {
                              const parsed = parseRegisterDefinitionsCsv(text);
                              setModelForm((prev) => ({ ...prev, registerTemplates: parsed }));
                              setSuccess("CSV importado.");
                              setError("");
                            } catch (err) {
                              setError((err as Error).message);
                            }
                            event.currentTarget.value = "";
                          }}
                        />
                      </label>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() => downloadCsv(`${(modelForm.name || "modelo").toLowerCase()}-register-templates.csv`, serializeRegisterDefinitionsCsv(modelForm.registerTemplates))}
                      >
                        Exportar CSV
                      </button>
                      <button
                        type="button"
                        className="ghost-button"
                        onClick={() =>
                          setModelForm((prev) => ({
                            ...prev,
                            registerTemplates: [...prev.registerTemplates, defaultTemplateRows[0]],
                          }))
                        }
                      >
                        Agregar registro
                      </button>
                    </div>
                  </div>
                  <div className="stack">
                    {modelForm.registerTemplates.map((item, index) => (
                      <RegisterRow
                        key={`${item.key}-${index}`}
                        value={item}
                        onChange={(next) =>
                          setModelForm((prev) => ({
                            ...prev,
                            registerTemplates: prev.registerTemplates.map((current, currentIndex) =>
                              currentIndex === index ? next : current
                            ),
                          }))
                        }
                        onRemove={() =>
                          setModelForm((prev) => ({
                            ...prev,
                            registerTemplates: prev.registerTemplates.filter((_, currentIndex) => currentIndex !== index),
                          }))
                        }
                      />
                    ))}
                  </div>
                </section>

                <div className="actions-row">
                  {editingModelId ? (
                    <button
                      type="button"
                      className="ghost-button"
                      onClick={() => {
                        setEditingModelId(null);
                        setModelForm(emptyModelForm());
                      }}
                    >
                      Cancelar edición
                    </button>
                  ) : null}
                  <button className="primary-button" type="submit">
                    {editingModelId ? "Guardar cambios" : "Guardar modelo"}
                  </button>
                </div>
              </form>
            </section>

            <section className="models-grid">
              {models.map((model) => (
                <article key={model._id} className="model-card">
                  <p className="eyebrow">{model.brand}</p>
                  <h4>{model.name}</h4>
                  <p className="muted small">{model.description || "Sin descripción"}</p>
                  <div className="model-defaults">
                    uid: {model.defaultUnitId ?? "-"} | port: {model.defaultModbusPort ?? "-"}<br />
                    baud: {model.defaultBaudRate ?? "-"} | parity: {model.defaultParity ?? "-"} | stop: {model.defaultStopBits ?? "-"}<br />
                    templates: {model.registerTemplates?.length ?? 0}
                  </div>
                  <div className="controller-actions">
                    <button className="ghost-button" onClick={() => handleEditModel(model)}>Editar</button>
                    <button
                      className="ghost-button"
                      onClick={() =>
                        downloadCsv(
                          `${model.name.toLowerCase()}-register-templates.csv`,
                          serializeRegisterDefinitionsCsv(model.registerTemplates ?? [])
                        )
                      }
                    >
                      Exportar CSV
                    </button>
                  </div>
                </article>
              ))}
            </section>
          </section>
        ) : null}
      </main>

      {selectedController ? (
        <aside className="drawer">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Controlador</p>
              <h3>{selectedController.name}</h3>
              <p className="muted small">{selectedController.deviceBrand} / {selectedController.deviceModel || selectedController.dixellModel}</p>
            </div>
            <button className="icon-button" onClick={() => setSelectedController(null)}>×</button>
          </div>
          <div className="drawer-body">
            <section className="panel">
              <h4>Configuración base</h4>
              <div className="form-grid">
                <Field label="Nombre" value={selectedController.name ?? ""} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, name: value } : prev)} />
                <Field label="Elfin ID" value={selectedController.elfinId ?? ""} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, elfinId: value.toUpperCase() } : prev)} />
                <Field label="Gateway mode" value={selectedController.gatewayMode ?? ""} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, gatewayMode: value } : prev)} />
                <Field label="IP local" value={selectedController.ipAddress ?? ""} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, ipAddress: value } : prev)} />
                <NumberField label="Puerto Modbus" value={selectedController.modbusPort} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, modbusPort: value } : prev)} />
                <NumberField label="Unit ID" value={selectedController.unitId} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, unitId: value } : prev)} />
                <NumberField label="Baud rate" value={selectedController.baudRate} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, baudRate: value } : prev)} />
                <NumberField label="Probe 1" value={selectedController.probe1} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, probe1: value } : prev)} />
                <NumberField label="Probe 2" value={selectedController.probe2} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, probe2: value } : prev)} />
                <Field label="Ubicación" value={selectedController.location ?? ""} onChange={(value) => setSelectedController((prev) => prev ? { ...prev, location: value } : prev)} />
              </div>
            </section>

            <section className="panel">
              <h4>Alertas</h4>
              <div className="form-grid">
                <label className="toggle-row">
                  <span>Alertas activas</span>
                  <input
                    type="checkbox"
                    checked={selectedController.alertConfig?.enabled !== false}
                    onChange={(event) =>
                      setSelectedController((prev) =>
                        prev
                          ? {
                              ...prev,
                              alertConfig: {
                                ...prev.alertConfig,
                                enabled: event.target.checked,
                              },
                            }
                          : prev
                      )
                    }
                  />
                </label>
                <NumberField
                  label="Mínima"
                  value={selectedController.alertConfig?.minTemperature}
                  onChange={(value) =>
                    setSelectedController((prev) =>
                      prev ? { ...prev, alertConfig: { ...prev.alertConfig, minTemperature: value } } : prev
                    )
                  }
                />
                <NumberField
                  label="Máxima"
                  value={selectedController.alertConfig?.maxTemperature}
                  onChange={(value) =>
                    setSelectedController((prev) =>
                      prev ? { ...prev, alertConfig: { ...prev.alertConfig, maxTemperature: value } } : prev
                    )
                  }
                />
                <NumberField
                  label="Offline (ms)"
                  value={selectedController.alertConfig?.offlineAfterMs}
                  onChange={(value) =>
                    setSelectedController((prev) =>
                      prev ? { ...prev, alertConfig: { ...prev.alertConfig, offlineAfterMs: value } } : prev
                    )
                  }
                />
              </div>
            </section>

            <section className="panel">
              <div className="panel-header inline">
                <div>
                  <h4>Registros visibles/editables</h4>
                  <p className="muted small">Esto define qué ve o modifica el cliente en mobile.</p>
                </div>
                <button
                  type="button"
                  className="ghost-button"
                  onClick={() =>
                    setSelectedController((prev) =>
                      prev
                        ? {
                            ...prev,
                            registerDefinitions: [...(prev.registerDefinitions ?? []), defaultTemplateRows[0]],
                          }
                        : prev
                    )
                  }
                >
                  Agregar registro
                </button>
              </div>
              <div className="stack">
                {(selectedController.registerDefinitions ?? []).map((definition, index) => (
                  <RegisterRow
                    key={`${definition.key}-${index}`}
                    value={definition}
                    onChange={(next) =>
                      setSelectedController((prev) =>
                        prev
                          ? {
                              ...prev,
                              registerDefinitions: prev.registerDefinitions.map((current, currentIndex) =>
                                currentIndex === index ? next : current
                              ),
                            }
                          : prev
                      )
                    }
                    onRemove={() =>
                      setSelectedController((prev) =>
                        prev
                          ? {
                              ...prev,
                              registerDefinitions: prev.registerDefinitions.filter((_, currentIndex) => currentIndex !== index),
                            }
                          : prev
                      )
                    }
                  />
                ))}
              </div>
            </section>

            <section className="panel panel-soft">
              <h4>Estado actual</h4>
              <p className="muted small">
                Online: {selectedController.connectionState?.online ? "sí" : "no"} | Última actualización: {formatDate(selectedController.updatedAt)}
              </p>
              <p className="muted small">Lectura: {telemetrySummary(selectedController)}</p>
              {selectedController.connectionState?.lastPollError ? <p className="error-text">{selectedController.connectionState.lastPollError}</p> : null}
            </section>
          </div>
          <div className="drawer-footer">
            <button className="primary-button" onClick={handleSaveController}>Guardar cambios</button>
          </div>
        </aside>
      ) : null}
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value?: number;
  onChange: (value?: number) => void;
}) {
  return (
    <label>
      <span>{label}</span>
      <input value={value ?? ""} onChange={(event) => onChange(toNumber(event.target.value))} />
    </label>
  );
}

function UserCard({
  user,
  onSave,
  onEditController,
}: {
  user: UserWithControllers;
  onSave: (userId: string, fullName: string, role: UserRole, isActive: boolean) => void;
  onEditController: (controllerId: string) => void;
}) {
  const [fullName, setFullName] = useState(user.fullName);
  const [role, setRole] = useState<UserRole>(user.role);
  const [isActive, setIsActive] = useState(user.isActive);

  useEffect(() => {
    setFullName(user.fullName);
    setRole(user.role);
    setIsActive(user.isActive);
  }, [user.fullName, user.role, user.isActive]);

  return (
    <article className="user-card">
      <div className="user-top">
        <div>
          <h3>{user.fullName}</h3>
          <p className="muted">{user.email} | alta: {formatDate(user.createdAt)}</p>
        </div>
        <span className={`status-pill ${user.isActive ? "success" : "warning"}`}>
          {user.controllersCount} controlador{user.controllersCount === 1 ? "" : "es"}
        </span>
      </div>

      <div className="form-grid">
        <Field label="Nombre" value={fullName} onChange={setFullName} />
        <label>
          <span>Rol</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="admin">admin</option>
            <option value="technician">technician</option>
            <option value="viewer">viewer</option>
          </select>
        </label>
        <label className="toggle-row">
          <span>Usuario activo</span>
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        </label>
      </div>

      <div className="actions-row">
        <button className="ghost-button" onClick={() => onSave(user._id, fullName, role, isActive)}>
          Guardar usuario
        </button>
      </div>

      <div className="controllers-grid">
        {user.controllers.length ? (
          user.controllers.map((controller) => (
            <article key={controller._id} className="controller-card">
              <div className="controller-head">
                <div>
                  <h4>{controller.name}</h4>
                  <div className="controller-meta">
                    {controller.deviceBrand} / {controller.deviceModel || controller.dixellModel}<br />
                    elfinId: {controller.elfinId} | gateway: {controller.gatewayMode}<br />
                    uid: {controller.unitId ?? "-"} | baud: {controller.baudRate ?? "-"} | probe1: {controller.probe1 ?? "-"} | probe2: {controller.probe2 ?? "-"}<br />
                    ip: {controller.ipAddress || "-"} | port: {controller.modbusPort ?? "-"} | loc: {controller.location || "-"}
                  </div>
                  <div className="controller-telemetry">
                    <strong>Lectura:</strong> {telemetrySummary(controller)}
                  </div>
                </div>
                <span className={`status-pill ${controller.connectionState?.online ? "success" : "warning"}`}>
                  {controller.connectionState?.online ? "Online" : "Offline"}
                </span>
              </div>
              <div className="controller-meta">
                {controller.alertState?.message || controller.connectionState?.lastPollError || "Sin alertas"}
              </div>
              <div className="controller-actions">
                <button className="ghost-button" onClick={() => onEditController(controller._id)}>
                  Editar
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">Este usuario todavía no tiene controladores.</div>
        )}
      </div>
    </article>
  );
}

function RegisterRow({
  value,
  onChange,
  onRemove,
}: {
  value: RegisterDefinition;
  onChange: (next: RegisterDefinition) => void;
  onRemove: () => void;
}) {
  return (
    <article className="register-row">
      <div className="register-grid">
        <Field label="Key" value={value.key} onChange={(next) => onChange({ ...value, key: next.toUpperCase() })} />
        <Field label="Label" value={value.label} onChange={(next) => onChange({ ...value, label: next })} />
        <NumberField label="Registro" value={value.register} onChange={(next) => onChange({ ...value, register: next ?? 0 })} />
        <NumberField label="Verify register" value={value.verifyRegister} onChange={(next) => onChange({ ...value, verifyRegister: next })} />
        <NumberField label="Scale" value={value.scale} onChange={(next) => onChange({ ...value, scale: next })} />
        <NumberField label="Step" value={value.step} onChange={(next) => onChange({ ...value, step: next })} />
        <NumberField label="Mínimo" value={value.min} onChange={(next) => onChange({ ...value, min: next })} />
        <NumberField label="Máximo" value={value.max} onChange={(next) => onChange({ ...value, max: next })} />
        <label>
          <span>Access level</span>
          <select value={value.accessLevel ?? "user"} onChange={(event) => onChange({ ...value, accessLevel: event.target.value as "user" | "technician" })}>
            <option value="user">user</option>
            <option value="technician">technician</option>
          </select>
        </label>
        <label>
          <span>Function code</span>
          <select value={value.functionCode ?? "auto"} onChange={(event) => onChange({ ...value, functionCode: event.target.value as "auto" | "0x06" | "0x10" })}>
            <option value="auto">auto</option>
            <option value="0x06">0x06</option>
            <option value="0x10">0x10</option>
          </select>
        </label>
        <Field label="Descripción" value={value.description ?? ""} onChange={(next) => onChange({ ...value, description: next })} />
      </div>
      <div className="register-options">
        <label>
          <input type="checkbox" checked={value.writable !== false} onChange={(event) => onChange({ ...value, writable: event.target.checked })} />
          editable
        </label>
        <label>
          <input type="checkbox" checked={value.visible !== false} onChange={(event) => onChange({ ...value, visible: event.target.checked })} />
          visible
        </label>
      </div>
      <div className="register-row-actions">
        <button type="button" className="danger-button" onClick={onRemove}>
          Eliminar
        </button>
      </div>
    </article>
  );
}
