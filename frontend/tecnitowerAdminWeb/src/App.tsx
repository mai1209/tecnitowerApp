import { useEffect, useMemo, useState } from "react";
import {
  createAdminController,
  deleteAdminController,
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
  type AdminControllerCreatePayload,
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
type ControllerSection = "hub" | "base" | "alerts" | "parameter-new" | "definitions";

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

function buildUserPreview(user: UserWithControllers) {
  const controllers = Array.isArray(user.controllers) ? user.controllers : [];
  const firstController = controllers[0];
  const onlineCount = controllers.filter((controller) => controller?.connectionState?.online).length;
  const alertCount = controllers.filter((controller) => controller?.alertState?.active).length;

  return {
    firstController,
    onlineCount,
    alertCount,
  };
}

function getUserRoleLabel(role: UserRole) {
  if (role === "admin") return "Administrador";
  if (role === "viewer") return "Solo lectura";
  return "Técnico";
}

function getUserRoleHelp(role: UserRole) {
  if (role === "admin") {
    return "Puede entrar al panel administrador y gestionar usuarios, controladores y modelos.";
  }
  if (role === "viewer") {
    return "Puede ver información, pero no debería realizar cambios técnicos ni administrativos.";
  }
  return "Puede operar la app y usar funciones técnicas habilitadas, sin administrar todo el sistema.";
}

function getAccessLevelLabel(value: RegisterDefinition["accessLevel"]) {
  return value === "technician" ? "Técnico" : "Usuario final";
}

function getAccessLevelHelp(value: RegisterDefinition["accessLevel"]) {
  return value === "technician"
    ? "Queda orientado a soporte técnico o configuración avanzada."
    : "Puede quedar disponible para el cliente final según visible y editable.";
}

function getFunctionCodeLabel(value: RegisterDefinition["functionCode"]) {
  if (value === "0x06") return "0x06 · Escritura simple";
  if (value === "0x10") return "0x10 · Escritura múltiple";
  return "Automático";
}

function getFunctionCodeHelp(value: RegisterDefinition["functionCode"]) {
  if (value === "0x06") {
    return "Fuerza Modbus 0x06: escribe un solo registro.";
  }
  if (value === "0x10") {
    return "Fuerza Modbus 0x10: escritura múltiple.";
  }
  return "Prueba 0x10 y, si falla, hace fallback a 0x06.";
}

function getControllerStatusSummary(controller: AdminControllerDetail) {
  if (controller.alertState?.active) {
    return {
      label: controller.alertState.type === "offline" ? "Offline" : "Alerta",
      className: "warning",
    };
  }
  if (controller.connectionState?.online) {
    return {
      label: "Online",
      className: "success",
    };
  }
  return {
    label: "Sin estado",
    className: "warning",
  };
}

function toNumber(value: string) {
  if (value.trim() === "") return undefined;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : undefined;
}

function emptyControllerForm(): AdminControllerCreatePayload {
  return {
    ownerId: "",
    name: "",
    gatewayMode: "tcp-client",
    deviceBrand: "",
    deviceModel: "",
    deviceModelId: "",
    dixellModel: "",
    dixellModelId: "",
    elfinId: "",
    ipAddress: "",
    unitId: 1,
    baudRate: 9600,
    probe1: undefined,
    probe2: undefined,
    alertConfig: {
      enabled: true,
      minTemperature: undefined,
      maxTemperature: undefined,
      offlineAfterMs: 60000,
    },
  };
}

function getRecommendedConnectionDefaults(model: DeviceModel | undefined, fallback: AdminControllerCreatePayload) {
  const normalizedName = String(model?.name ?? "").trim().toUpperCase();
  if (normalizedName === "TC900E LOG") {
    return {
      unitId: 1,
      baudRate: 9600,
      probe1: 101,
      probe2: 102,
    };
  }

  return {
    unitId: model?.defaultUnitId ?? fallback.unitId ?? 1,
    baudRate: model?.defaultBaudRate ?? fallback.baudRate ?? 9600,
    probe1: model?.defaultProbe1 ?? fallback.probe1,
    probe2: model?.defaultProbe2 ?? fallback.probe2,
  };
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
  const [view, setView] = useState<View>("users");
  const [users, setUsers] = useState<UserWithControllers[]>([]);
  const [models, setModels] = useState<DeviceModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [loginLoading, setLoginLoading] = useState(false);
  const [error, setError] = useState<string>("");
  const [success, setSuccess] = useState<string>("");
  const [loginEmail, setLoginEmail] = useState("admin@admin.com");
  const [loginPassword, setLoginPassword] = useState("admin");
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedController, setSelectedController] = useState<AdminControllerDetail | null>(null);
  const [selectedControllerSection, setSelectedControllerSection] = useState<ControllerSection>("hub");
  const [controllerCreatorOpen, setControllerCreatorOpen] = useState(false);
  const [controllerForm, setControllerForm] = useState<AdminControllerCreatePayload>(emptyControllerForm());
  const [modelForm, setModelForm] = useState<ModelPayload>(emptyModelForm());
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [modelEditorOpen, setModelEditorOpen] = useState(false);

  const controllerMetrics = useMemo(() => {
    const controllers = users.flatMap((user) => user.controllers);
    return {
      users: users.length,
      controllers: controllers.length,
      online: controllers.filter((controller) => controller.connectionState?.online).length,
      alerts: controllers.filter((controller) => controller.alertState?.active).length,
    };
  }, [users]);

  const selectedUser = useMemo(
    () => users.find((user) => user._id === selectedUserId) ?? null,
    [users, selectedUserId]
  );

  const topbarCopy = useMemo(() => {
    if (view === "users" && selectedUser) {
      return {
        title: `Usuario: ${selectedUser.fullName}`,
        subtitle: "Controladores del usuario, datos generales y acceso al panel técnico.",
      };
    }
    if (view === "models") {
      return {
        title: "Carga de modelos y registros",
        subtitle: "Plantillas globales reutilizables para distintos controladores.",
      };
    }
    if (view === "users") {
      return {
        title: "Lista de usuarios registrados",
        subtitle: "Elegí un usuario para ver sus controladores y entrar al panel técnico.",
      };
    }
    return {
      title: "Resumen general",
      subtitle: "Vista rápida del estado de usuarios, controladores y alertas.",
    };
  }, [selectedUser, view]);

  async function loadData(token: string) {
    setLoading(true);
    try {
      const [usersPayload, modelsPayload] = await Promise.all([
        fetchAdminUsers(token),
        fetchDeviceModels(token),
      ]);
      setUsers(usersPayload.users);
      setModels(modelsPayload.models);
      if (selectedUserId && !usersPayload.users.some((user) => user._id === selectedUserId)) {
        setSelectedUserId(null);
      }
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
      setSelectedControllerSection("hub");
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

  async function handleCreateController(event: React.FormEvent) {
    event.preventDefault();
    if (!session?.token || !selectedUser) return;

    const name = String(controllerForm.name ?? "").trim();
    const elfinId = String(controllerForm.elfinId ?? "").trim().toUpperCase();

    if (!name || !elfinId) {
      setError("Nombre y Elfin ID son obligatorios.");
      return;
    }

    try {
      await createAdminController(session.token, {
        ...controllerForm,
        ownerId: selectedUser._id,
        name,
        elfinId,
        deviceBrand: controllerForm.deviceBrand?.trim().toUpperCase() || undefined,
        deviceModel: controllerForm.deviceModel?.trim().toUpperCase() || undefined,
        dixellModel: controllerForm.dixellModel?.trim().toUpperCase() || undefined,
        ipAddress: controllerForm.ipAddress?.trim() || undefined,
      });
      await loadData(session.token);
      setControllerCreatorOpen(false);
      setControllerForm(emptyControllerForm());
      setSuccess("Controlador asignado correctamente.");
      setError("");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  async function handleDeleteController(controllerId: string) {
    if (!session?.token) return;
    const confirmed = window.confirm("Se va a eliminar este controlador. Esta acción no se puede deshacer.");
    if (!confirmed) return;

    try {
      const payload = await deleteAdminController(session.token, controllerId);
      await loadData(session.token);
      if (selectedController?._id === controllerId) {
        setSelectedController(null);
      }
      setSuccess(payload.message || "Controlador eliminado correctamente.");
      setError("");
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
      setModelEditorOpen(false);
      await loadData(session.token);
      setView("models");
    } catch (err) {
      setError((err as Error).message);
    }
  }

  function handleEditModel(model: DeviceModel) {
    setEditingModelId(model._id);
    setModelEditorOpen(true);
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
          <button
            className={view === "users" ? "nav-link active" : "nav-link"}
            onClick={() => {
              setView("users");
              setSelectedUserId(null);
            }}
          >
            Lista de usuarios
          </button>
          <button className={view === "models" ? "nav-link active" : "nav-link"} onClick={() => setView("models")}>Carga de modelos y registros</button>
        </nav>
        <div className="session-box">
          <p className="session-user">{session.user.email}</p>
          <p className="session-role">{getUserRoleLabel(session.user.role)}</p>
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
            <h1>{topbarCopy.title}</h1>
            <p className="muted">{topbarCopy.subtitle}</p>
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
            {selectedUser ? (
              <UserDetailView
                user={selectedUser}
                models={models}
                onBack={() => setSelectedUserId(null)}
                onSaveUser={handleSaveUser}
                onEditController={handleOpenController}
                onDeleteController={handleDeleteController}
                controllerCreatorOpen={controllerCreatorOpen}
                setControllerCreatorOpen={setControllerCreatorOpen}
                controllerForm={controllerForm}
                setControllerForm={setControllerForm}
                onCreateController={handleCreateController}
              />
            ) : (
              users.map((user) => (
                <UserSummaryCard
                  key={user._id}
                  user={user}
                  onOpen={() => setSelectedUserId(user._id)}
                />
              ))
            )}
          </section>
        ) : null}

        {view === "models" ? (
          <section className="stack">
            {!modelEditorOpen ? (
              <section className="stack">
                <section className="panel hero-panel">
                  <div className="panel-header">
                    <div>
                      <p className="eyebrow">Carga de modelos y registros</p>
                      <h3>Modelos cargados</h3>
                      <p className="muted">Elegí un modelo para editarlo o crear uno nuevo.</p>
                    </div>
                    <button
                      className="primary-button"
                      type="button"
                      onClick={() => {
                        setEditingModelId(null);
                        setModelForm(emptyModelForm());
                        setModelEditorOpen(true);
                      }}
                    >
                      Cargar nuevo modelo
                    </button>
                  </div>
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
                          onClick={() => {
                            handleEditModel(model);
                            setModelEditorOpen(true);
                          }}
                        >
                          Cargar nuevo registro
                        </button>
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
            ) : (
              <section className="panel">
                <div className="panel-header">
                  <div>
                    <p className="eyebrow">Carga de modelos y registros</p>
                    <h3>{editingModelId ? "Editar modelo" : "Alta de modelo"}</h3>
                    <p className="muted">Completá los datos del modelo y después cargá sus registros.</p>
                  </div>
                </div>
                <form className="stack" onSubmit={handleSubmitModel}>
                <div className="form-grid form-grid-3">
                  <Field label="Marca" value={modelForm.brand ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, brand: value }))} />
                  <Field label="Nombre" value={modelForm.name ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, name: value }))} />
                  <Field label="Protocolo" value={modelForm.protocol ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, protocol: value }))} />
                  <Field label="Tipo de conexión" value={modelForm.connectionType ?? ""} onChange={(value) => setModelForm((prev) => ({ ...prev, connectionType: value }))} />
                  <NumberField label="Unit ID por defecto" value={modelForm.defaultUnitId} onChange={(value) => setModelForm((prev) => ({ ...prev, defaultUnitId: value }))} />
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
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => {
                      setEditingModelId(null);
                      setModelForm(emptyModelForm());
                      setModelEditorOpen(false);
                    }}
                  >
                    Volver a modelos cargados
                  </button>
                  <button className="primary-button" type="submit">
                    {editingModelId ? "Guardar cambios" : "Guardar modelo"}
                  </button>
                </div>
              </form>
            </section>
            )}
          </section>
        ) : null}
      </main>

      {selectedController ? (
        <aside className="drawer">
          <div className="drawer-header">
            <div>
              <p className="eyebrow">Panel del controlador</p>
              <h3>{selectedController.name}</h3>
              <p className="muted small">
                {selectedUser?.fullName || selectedUser?.email || "-"} · {selectedController.elfinId} · {selectedController.deviceBrand} / {selectedController.deviceModel || selectedController.dixellModel}
              </p>
            </div>
            <button className="icon-button" onClick={() => setSelectedController(null)}>×</button>
          </div>
          <div className="drawer-body">
            {selectedControllerSection !== "hub" ? (
              <div className="actions-row">
                <button className="ghost-button" onClick={() => setSelectedControllerSection("hub")}>
                  Volver a secciones
                </button>
              </div>
            ) : null}

            {selectedControllerSection === "hub" ? (
              <>
                <section className="panel hero-panel">
                  <p className="eyebrow">Panel del controlador</p>
                  <h4>{selectedController.name}</h4>
                  <p className="muted small">
                    Elegí qué parte querés modificar. Cada sección guarda cambios sobre este controlador puntual del usuario.
                  </p>
                </section>

                <section className="summary-grid">
                  <article className="summary-card">
                    <span>Estado</span>
                    <strong className={`status-inline ${getControllerStatusSummary(selectedController).className}`}>
                      {getControllerStatusSummary(selectedController).label}
                    </strong>
                  </article>
                  <article className="summary-card">
                    <span>Modelo</span>
                    <strong>{selectedController.deviceModel || selectedController.dixellModel || "Sin modelo"}</strong>
                    <small>{selectedController.deviceBrand || "Sin marca"}</small>
                  </article>
                  <article className="summary-card">
                    <span>Conexión</span>
                    <strong>{selectedController.gatewayMode || "-"}</strong>
                    <small>UID {selectedController.unitId ?? "-"} · Baud {selectedController.baudRate ?? "-"}</small>
                  </article>
                  <article className="summary-card">
                    <span>Lectura</span>
                    <strong>{telemetrySummary(selectedController)}</strong>
                    <small>{selectedController.connectionState?.lastPollError || "Sin error registrado"}</small>
                  </article>
                  <article className="summary-card">
                    <span>Alertas</span>
                    <strong>
                      {selectedController.alertConfig?.enabled !== false ? "Activas" : "Desactivadas"}
                    </strong>
                    <small>
                      Min {selectedController.alertConfig?.minTemperature ?? "-"} · Max {selectedController.alertConfig?.maxTemperature ?? "-"}
                    </small>
                  </article>
                  <article className="summary-card">
                    <span>Registros</span>
                    <strong>{selectedController.registerDefinitions?.length ?? 0}</strong>
                    <small>{selectedController.location || "Sin ubicación"}</small>
                  </article>
                </section>

                <button className="section-card-button" onClick={() => setSelectedControllerSection("base")}>
                  <span className="section-card-title">Configuración base del controlador</span>
                  <span className="section-card-text">Nombre, Elfin ID, transporte, IP, Unit ID, baudrate, probes y ubicación.</span>
                </button>
                <button className="section-card-button" onClick={() => setSelectedControllerSection("alerts")}>
                  <span className="section-card-title">Alertas</span>
                  <span className="section-card-text">Rangos de temperatura y tiempo máximo sin comunicación.</span>
                </button>
                <button className="section-card-button" onClick={() => setSelectedControllerSection("parameter-new")}>
                  <span className="section-card-title">Alta de parámetro</span>
                  <span className="section-card-text">Agregar un nuevo parámetro para este controlador.</span>
                </button>
                <button className="section-card-button" onClick={() => setSelectedControllerSection("definitions")}>
                  <span className="section-card-title">Registros cargados</span>
                  <span className="section-card-text">Definir qué ve o modifica el cliente en la app.</span>
                </button>
              </>
            ) : null}

            {selectedControllerSection === "base" ? (
              <section className="panel">
                <h4>Configuración base del controlador</h4>
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
            ) : null}

            {selectedControllerSection === "alerts" ? (
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
                    label="Temperatura mínima"
                    value={selectedController.alertConfig?.minTemperature}
                    onChange={(value) =>
                      setSelectedController((prev) =>
                        prev ? { ...prev, alertConfig: { ...prev.alertConfig, minTemperature: value } } : prev
                      )
                    }
                  />
                  <NumberField
                    label="Temperatura máxima"
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
            ) : null}

            {selectedControllerSection === "parameter-new" || selectedControllerSection === "definitions" ? (
              <section className="panel">
                <div className="panel-header inline">
                  <div>
                    <h4>{selectedControllerSection === "parameter-new" ? "Alta de parámetro" : "Registros cargados"}</h4>
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
            ) : null}

            {selectedControllerSection === "hub" ? (
              <section className="panel panel-soft">
                <h4>Estado actual</h4>
                <p className="muted small">
                  Online: {selectedController.connectionState?.online ? "sí" : "no"} | Última actualización: {formatDate(selectedController.updatedAt)}
                </p>
                <p className="muted small">Lectura: {telemetrySummary(selectedController)}</p>
                {selectedController.connectionState?.lastPollError ? <p className="error-text">{selectedController.connectionState.lastPollError}</p> : null}
              </section>
            ) : null}
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

function UserSummaryCard({
  user,
  onOpen,
}: {
  user: UserWithControllers;
  onOpen: () => void;
}) {
  const preview = buildUserPreview(user);

  return (
    <article className="user-summary-card">
      <div className="user-top">
        <div>
          <p className="eyebrow">Usuario registrado</p>
          <h3>{user.fullName}</h3>
          <p className="muted">{user.email}</p>
          <p className="muted small">
            Rol {getUserRoleLabel(user.role)} · {user.controllersCount} controladores · Online {preview.onlineCount}
          </p>
        </div>
        <span className={`status-pill ${user.isActive ? "success" : "warning"}`}>
          {user.isActive ? "Activo" : "Inactivo"}
        </span>
      </div>

      <div className="preview-box">
        <strong>Vista previa</strong>
        <p>{preview.firstController ? `Modelo principal: ${preview.firstController.deviceModel || preview.firstController.dixellModel || "Sin modelo"}` : "Todavía no tiene controladores asignados."}</p>
        <p>{preview.firstController ? `Equipo ejemplo: ${preview.firstController.name} · ${preview.firstController.elfinId}` : "Sin equipos para mostrar."}</p>
        <p>Alertas activas: {preview.alertCount}</p>
      </div>

      <div className="actions-row">
        <button className="primary-button" onClick={onOpen}>
          Entrar al panel del usuario
        </button>
      </div>
    </article>
  );
}

function UserDetailView({
  user,
  models,
  onBack,
  onSaveUser,
  onEditController,
  onDeleteController,
  controllerCreatorOpen,
  setControllerCreatorOpen,
  controllerForm,
  setControllerForm,
  onCreateController,
}: {
  user: UserWithControllers;
  models: DeviceModel[];
  onBack: () => void;
  onSaveUser: (userId: string, fullName: string, role: UserRole, isActive: boolean) => void;
  onEditController: (controllerId: string) => void;
  onDeleteController: (controllerId: string) => Promise<void>;
  controllerCreatorOpen: boolean;
  setControllerCreatorOpen: (open: boolean) => void;
  controllerForm: AdminControllerCreatePayload;
  setControllerForm: React.Dispatch<React.SetStateAction<AdminControllerCreatePayload>>;
  onCreateController: (event: React.FormEvent) => Promise<void>;
}) {
  const preview = buildUserPreview(user);
  const [controllerFormSection, setControllerFormSection] = useState<
    "base" | "model" | "alerts"
  >("base");

  return (
    <section className="stack">
      <section className="panel hero-panel">
        <div className="panel-header">
          <div>
            <p className="eyebrow">Panel del usuario</p>
            <h3>{user.fullName}</h3>
            <p className="muted">
              {user.email} · Rol {getUserRoleLabel(user.role)} · {user.controllersCount} controladores
            </p>
          </div>
          <button className="ghost-button" onClick={onBack}>
            Volver a lista de usuarios
          </button>
        </div>
        <div className="preview-box">
          <strong>Vista previa</strong>
          <p>{preview.firstController ? `Modelo principal: ${preview.firstController.deviceModel || preview.firstController.dixellModel || "Sin modelo"}` : "Todavía no tiene controladores asignados."}</p>
          <p>Online: {preview.onlineCount} · Alertas activas: {preview.alertCount}</p>
        </div>
        <div className="actions-row">
          <button
            className="primary-button"
            onClick={() => {
              setControllerCreatorOpen(!controllerCreatorOpen);
              setControllerForm((current) => ({ ...emptyControllerForm(), ...current, ownerId: user._id }));
            }}
          >
            {controllerCreatorOpen ? "Ocultar alta de controlador" : "Cargar otro controlador para este usuario"}
          </button>
        </div>
      </section>

      {controllerCreatorOpen ? (
        <section className="panel">
          <div className="panel-header">
            <div>
              <h3>Alta de controlador</h3>
              <p className="muted">Este controlador se va a guardar para {user.fullName}.</p>
            </div>
          </div>
          <form className="stack" onSubmit={onCreateController}>
            <article className="register-row">
              <button
                type="button"
                className="register-header-button"
                onClick={() => setControllerFormSection((current) => (current === "base" ? "model" : "base"))}
              >
                <span className="register-header-copy">
                  <strong className="register-header-title">Datos base</strong>
                  <span className="register-header-meta">
                    Nombre del equipo, modelo e ID Elfin.
                  </span>
                </span>
                <span className="register-header-action">
                  {controllerFormSection === "base" ? "Abierto" : "Ir"}
                </span>
              </button>
              {controllerFormSection === "base" ? (
                <div className="form-grid form-grid-3">
                  <Field
                    label="Identificación"
                    value={controllerForm.name ?? ""}
                    onChange={(value) => setControllerForm((prev) => ({ ...prev, name: value }))}
                  />
                  <label>
                    <span>Modelo de hardware</span>
                    <select
                      value={controllerForm.deviceModelId ?? ""}
                      onChange={(event) => {
                        const model = models.find((item) => item._id === event.target.value);
                        const recommended = getRecommendedConnectionDefaults(model, controllerForm);
                        setControllerForm((prev) => ({
                          ...prev,
                          deviceModelId: model?._id ?? "",
                          dixellModelId: model?._id ?? "",
                          deviceModel: model?.name ?? "",
                          dixellModel: model?.name ?? "",
                          deviceBrand: model?.brand ?? "",
                          unitId: recommended.unitId,
                          baudRate: recommended.baudRate,
                          probe1: recommended.probe1,
                          probe2: recommended.probe2,
                        }));
                      }}
                    >
                      <option value="">Seleccioná un modelo...</option>
                      {models.map((model) => (
                        <option key={model._id} value={model._id}>
                          {model.brand} · {model.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <Field
                    label="ID Elfin"
                    value={controllerForm.elfinId ?? ""}
                    onChange={(value) =>
                      setControllerForm((prev) => ({ ...prev, elfinId: value.toUpperCase() }))
                    }
                  />
                </div>
              ) : null}
            </article>

            <article className="register-row">
              <button
                type="button"
                className="register-header-button"
                onClick={() => setControllerFormSection((current) => (current === "model" ? "alerts" : "model"))}
              >
                <span className="register-header-copy">
                  <strong className="register-header-title">Parámetros del modelo</strong>
                  <span className="register-header-meta">
                    Unit ID, baud rate y probes recomendados para el controlador.
                  </span>
                </span>
                <span className="register-header-action">
                  {controllerFormSection === "model" ? "Abierto" : "Ir"}
                </span>
              </button>
              {controllerFormSection === "model" ? (
                <>
                  <div className="preview-box">
                    <strong>Modelo seleccionado</strong>
                    <p>
                      {controllerForm.deviceBrand && controllerForm.deviceModel
                        ? `${controllerForm.deviceBrand} · ${controllerForm.deviceModel}`
                        : "Todavía no seleccionaste un modelo."}
                    </p>
                  </div>
                  <div className="form-grid form-grid-3">
                    <NumberField
                      label="Unit ID"
                      value={controllerForm.unitId}
                      onChange={(value) => setControllerForm((prev) => ({ ...prev, unitId: value }))}
                    />
                    <NumberField
                      label="Baud rate"
                      value={controllerForm.baudRate}
                      onChange={(value) => setControllerForm((prev) => ({ ...prev, baudRate: value }))}
                    />
                    <NumberField
                      label="Probe 1"
                      value={controllerForm.probe1}
                      onChange={(value) => setControllerForm((prev) => ({ ...prev, probe1: value }))}
                    />
                    <NumberField
                      label="Probe 2"
                      value={controllerForm.probe2}
                      onChange={(value) => setControllerForm((prev) => ({ ...prev, probe2: value }))}
                    />
                  </div>
                </>
              ) : null}
            </article>

            <article className="register-row">
              <button
                type="button"
                className="register-header-button"
                onClick={() => setControllerFormSection("alerts")}
              >
                <span className="register-header-copy">
                  <strong className="register-header-title">Alertas</strong>
                  <span className="register-header-meta">
                    Rango de temperatura y tiempo sin comunicación.
                  </span>
                </span>
                <span className="register-header-action">
                  {controllerFormSection === "alerts" ? "Abierto" : "Ir"}
                </span>
              </button>
              {controllerFormSection === "alerts" ? (
                <>
                  <label className="toggle-row">
                    <span>Alertas activas</span>
                    <input
                      type="checkbox"
                      checked={controllerForm.alertConfig?.enabled !== false}
                      onChange={(event) =>
                        setControllerForm((prev) => ({
                          ...prev,
                          alertConfig: { ...prev.alertConfig, enabled: event.target.checked },
                        }))
                      }
                    />
                  </label>
                  <div className="form-grid form-grid-3">
                    <NumberField
                      label="Temperatura mínima alerta"
                      value={controllerForm.alertConfig?.minTemperature}
                      onChange={(value) =>
                        setControllerForm((prev) => ({
                          ...prev,
                          alertConfig: { ...prev.alertConfig, minTemperature: value },
                        }))
                      }
                    />
                    <NumberField
                      label="Temperatura máxima alerta"
                      value={controllerForm.alertConfig?.maxTemperature}
                      onChange={(value) =>
                        setControllerForm((prev) => ({
                          ...prev,
                          alertConfig: { ...prev.alertConfig, maxTemperature: value },
                        }))
                      }
                    />
                    <NumberField
                      label="Segundos sin comunicación"
                      value={
                        controllerForm.alertConfig?.offlineAfterMs == null
                          ? undefined
                          : Number(controllerForm.alertConfig.offlineAfterMs) / 1000
                      }
                      onChange={(value) =>
                        setControllerForm((prev) => ({
                          ...prev,
                          alertConfig: {
                            ...prev.alertConfig,
                            offlineAfterMs: value == null ? undefined : value * 1000,
                          },
                        }))
                      }
                    />
                  </div>
                </>
              ) : null}
            </article>
            <div className="actions-row">
              <button
                type="button"
                className="ghost-button"
                onClick={() => {
                  setControllerCreatorOpen(false);
                  setControllerForm(emptyControllerForm());
                }}
              >
                Cancelar
              </button>
              <button type="submit" className="primary-button">
                Guardar controlador
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <UserEditor user={user} onSave={onSaveUser} />

      <section className="stack">
        {user.controllers.length ? (
          user.controllers.map((controller) => (
            <article key={controller._id} className="controller-card controller-card-large">
              <div className="controller-head">
                <div>
                  <p className="eyebrow">Panel del controlador</p>
                  <h4>{controller.name}</h4>
                  <div className="controller-meta">
                    {controller.elfinId} · {controller.deviceModel || controller.dixellModel || "Sin modelo"}<br />
                    UID {controller.unitId ?? "-"} · Baud {controller.baudRate ?? "-"} · Registros {controller.registerDefinitionsCount ?? 0}
                  </div>
                </div>
                <span className={`status-pill ${controller.connectionState?.online ? "success" : "warning"}`}>
                  {controller.connectionState?.online ? "Online" : "Offline"}
                </span>
              </div>

              <div className="preview-box">
                <strong>Vista técnica</strong>
                <p>{telemetrySummary(controller)}</p>
                <p>Último error: {controller.connectionState?.lastPollError || "Sin error registrado"}</p>
                <p>Ubicación: {controller.location || "Sin ubicación"}</p>
              </div>

              <div className="actions-row">
                <button className="ghost-button" onClick={() => onEditController(controller._id)}>
                  Entrar al panel del controlador
                </button>
                <button className="danger-button" onClick={() => void onDeleteController(controller._id)}>
                  Borrar controlador
                </button>
              </div>
            </article>
          ))
        ) : (
          <div className="empty-state">Este usuario todavía no tiene controladores.</div>
        )}
      </section>
    </section>
  );
}

function UserEditor({
  user,
  onSave,
}: {
  user: UserWithControllers;
  onSave: (userId: string, fullName: string, role: UserRole, isActive: boolean) => void;
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
    <article className="panel">
      <div className="panel-header">
        <div>
          <h3>Datos del usuario</h3>
          <p className="muted">Desde acá editás los datos generales del usuario. No modifica controladores ni registros.</p>
        </div>
      </div>

      <div className="form-grid">
        <Field label="Nombre" value={fullName} onChange={setFullName} />
        <label>
          <span>Rol</span>
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)}>
            <option value="admin">Administrador</option>
            <option value="technician">Técnico</option>
            <option value="viewer">Solo lectura</option>
          </select>
          <small>{getUserRoleHelp(role)}</small>
        </label>
        <label className="toggle-row">
          <span>Usuario activo</span>
          <input type="checkbox" checked={isActive} onChange={(event) => setIsActive(event.target.checked)} />
        </label>
      </div>

      <div className="actions-row">
        <button className="ghost-button" onClick={() => onSave(user._id, fullName, role, isActive)}>
          Guardar cambios del usuario
        </button>
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
  const [expanded, setExpanded] = useState(false);

  return (
    <article className="register-row">
      <button type="button" className="register-header-button" onClick={() => setExpanded((current) => !current)}>
        <span className="register-header-copy">
          <strong className="register-header-title">{value.label?.trim() || "Registro sin label"}</strong>
          <span className="register-header-meta">
            {value.key || "Sin key"} · Reg {value.register ?? "-"}
          </span>
        </span>
        <span className="register-header-action">{expanded ? "Ocultar" : "Ver"}</span>
      </button>

      {expanded ? (
        <>
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
              <span>Nivel de acceso</span>
              <select value={value.accessLevel ?? "user"} onChange={(event) => onChange({ ...value, accessLevel: event.target.value as "user" | "technician" })}>
                <option value="user">{getAccessLevelLabel("user")}</option>
                <option value="technician">{getAccessLevelLabel("technician")}</option>
              </select>
              <small>{getAccessLevelHelp(value.accessLevel)}</small>
            </label>
            <label>
              <span>Código de función</span>
              <select value={value.functionCode ?? "auto"} onChange={(event) => onChange({ ...value, functionCode: event.target.value as "auto" | "0x06" | "0x10" })}>
                <option value="auto">{getFunctionCodeLabel("auto")}</option>
                <option value="0x06">{getFunctionCodeLabel("0x06")}</option>
                <option value="0x10">{getFunctionCodeLabel("0x10")}</option>
              </select>
              <small>{getFunctionCodeHelp(value.functionCode)}</small>
            </label>
            <Field label="Descripción" value={value.description ?? ""} onChange={(next) => onChange({ ...value, description: next })} />
          </div>
          <div className="register-options">
            <label>
              <input type="checkbox" checked={value.writable !== false} onChange={(event) => onChange({ ...value, writable: event.target.checked })} />
              Editable en app cliente
            </label>
            <label>
              <input type="checkbox" checked={value.visible !== false} onChange={(event) => onChange({ ...value, visible: event.target.checked })} />
              Visible en app cliente
            </label>
          </div>
          <div className="register-row-actions">
            <button type="button" className="danger-button" onClick={onRemove}>
              Eliminar
            </button>
          </div>
        </>
      ) : null}
    </article>
  );
}
