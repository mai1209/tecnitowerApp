const STORAGE_KEY = "tecnitower-admin-session";

const state = {
  token: null,
  user: null,
  users: [],
  models: [],
  currentController: null,
  currentModelId: null,
};

const els = {
  loginView: document.getElementById("loginView"),
  adminView: document.getElementById("adminView"),
  loginForm: document.getElementById("loginForm"),
  loginEmail: document.getElementById("loginEmail"),
  loginPassword: document.getElementById("loginPassword"),
  loginError: document.getElementById("loginError"),
  sessionUser: document.getElementById("sessionUser"),
  sessionRole: document.getElementById("sessionRole"),
  logoutButton: document.getElementById("logoutButton"),
  reloadButton: document.getElementById("reloadButton"),
  errorBanner: document.getElementById("errorBanner"),
  successBanner: document.getElementById("successBanner"),
  metricUsers: document.getElementById("metricUsers"),
  metricControllers: document.getElementById("metricControllers"),
  metricOnline: document.getElementById("metricOnline"),
  metricAlerts: document.getElementById("metricAlerts"),
  usersList: document.getElementById("usersList"),
  modelsList: document.getElementById("modelsList"),
  modelForm: document.getElementById("modelForm"),
  modelId: document.getElementById("modelId"),
  modelRegisterRows: document.getElementById("modelRegisterRows"),
  modelCsvInput: document.getElementById("modelCsvInput"),
  importModelCsvButton: document.getElementById("importModelCsvButton"),
  exportModelCsvButton: document.getElementById("exportModelCsvButton"),
  addModelRegisterButton: document.getElementById("addModelRegisterButton"),
  cancelEditModelButton: document.getElementById("cancelEditModelButton"),
  saveModelButton: document.getElementById("saveModelButton"),
  drawer: document.getElementById("editorDrawer"),
  drawerTitle: document.getElementById("drawerTitle"),
  drawerSubtitle: document.getElementById("drawerSubtitle"),
  closeDrawerButton: document.getElementById("closeDrawerButton"),
  saveControllerButton: document.getElementById("saveControllerButton"),
  controllerName: document.getElementById("controllerName"),
  controllerElfinId: document.getElementById("controllerElfinId"),
  controllerGatewayMode: document.getElementById("controllerGatewayMode"),
  controllerIpAddress: document.getElementById("controllerIpAddress"),
  controllerModbusPort: document.getElementById("controllerModbusPort"),
  controllerUnitId: document.getElementById("controllerUnitId"),
  controllerBaudRate: document.getElementById("controllerBaudRate"),
  controllerProbe1: document.getElementById("controllerProbe1"),
  controllerProbe2: document.getElementById("controllerProbe2"),
  controllerLocation: document.getElementById("controllerLocation"),
  alertEnabled: document.getElementById("alertEnabled"),
  alertMin: document.getElementById("alertMin"),
  alertMax: document.getElementById("alertMax"),
  alertOffline: document.getElementById("alertOffline"),
  registerRows: document.getElementById("registerRows"),
  addRegisterButton: document.getElementById("addRegisterButton"),
  navLinks: Array.from(document.querySelectorAll(".nav-link")),
  sections: {
    overview: document.getElementById("overviewSection"),
    users: document.getElementById("usersSection"),
    models: document.getElementById("modelsSection"),
  },
  modelFields: {
    brand: document.getElementById("modelBrand"),
    name: document.getElementById("modelName"),
    protocol: document.getElementById("modelProtocol"),
    connectionType: document.getElementById("modelConnectionType"),
    defaultUnitId: document.getElementById("modelDefaultUnitId"),
    defaultModbusPort: document.getElementById("modelDefaultModbusPort"),
    defaultBaudRate: document.getElementById("modelDefaultBaudRate"),
    defaultDataBits: document.getElementById("modelDefaultDataBits"),
    defaultParity: document.getElementById("modelDefaultParity"),
    defaultStopBits: document.getElementById("modelDefaultStopBits"),
    defaultProbe1: document.getElementById("modelDefaultProbe1"),
    defaultProbe2: document.getElementById("modelDefaultProbe2"),
    setpointRegister: document.getElementById("modelSetpointRegister"),
    setpointReadRegister: document.getElementById("modelSetpointReadRegister"),
    setpointVerifyRegister: document.getElementById("modelSetpointVerifyRegister"),
    setpointMin: document.getElementById("modelSetpointMin"),
    setpointMax: document.getElementById("modelSetpointMax"),
    setpointScale: document.getElementById("modelSetpointScale"),
    description: document.getElementById("modelDescription"),
    notes: document.getElementById("modelNotes"),
  },
};

function loadSession() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.token && parsed?.user) {
      state.token = parsed.token;
      state.user = parsed.user;
    }
  } catch (_) {}
}

function saveSession() {
  if (!state.token || !state.user) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      token: state.token,
      user: state.user,
    })
  );
}

function clearSession() {
  state.token = null;
  state.user = null;
  state.users = [];
  state.models = [];
  state.currentController = null;
  state.currentModelId = null;
  saveSession();
  renderSession();
  closeDrawer();
  resetModelForm();
}

function setBanner(type, message) {
  const banner = type === "error" ? els.errorBanner : els.successBanner;
  const other = type === "error" ? els.successBanner : els.errorBanner;
  other.classList.add("hidden");
  other.textContent = "";

  if (!message) {
    banner.classList.add("hidden");
    banner.textContent = "";
    return;
  }

  banner.textContent = message;
  banner.classList.remove("hidden");
}

function clearBanners() {
  setBanner("error", "");
  setBanner("success", "");
}

function parseErrorMessage(err, fallback = "Ocurrió un error") {
  return err?.message || fallback;
}

async function api(path, { method = "GET", body, requiresAuth = true } = {}) {
  const headers = {};
  if (body != null) headers["Content-Type"] = "application/json";
  if (requiresAuth && state.token) headers.Authorization = `Bearer ${state.token}`;

  const response = await fetch(path, {
    method,
    headers,
    body: body != null ? JSON.stringify(body) : undefined,
  });

  let payload = null;
  try {
    payload = await response.json();
  } catch (_) {}

  if (!response.ok) {
    const message =
      payload?.error || payload?.message || `HTTP ${response.status} ${response.statusText}`;
    const error = new Error(message);
    error.status = response.status;
    error.payload = payload;
    throw error;
  }

  return payload;
}

function formatDate(value) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("es-AR", {
      dateStyle: "short",
      timeStyle: "short",
    }).format(new Date(value));
  } catch (_) {
    return String(value);
  }
}

function formatNumber(value) {
  if (value == null || Number.isNaN(Number(value))) return "-";
  return Number(value).toLocaleString("es-AR", {
    minimumFractionDigits: Number(value) % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 1,
  });
}

function getOnlineStatus(controller) {
  return Boolean(controller?.connectionState?.online);
}

function getAlertActive(controller) {
  return Boolean(controller?.alertState?.active);
}

function telemetrySummary(controller) {
  const parts = [];
  const telemetry = controller?.lastTelemetry;
  if (!telemetry) return "Sin telemetría reciente";
  if (telemetry.probe1Value != null) parts.push(`S1 ${formatNumber(telemetry.probe1Value)} °C`);
  if (telemetry.probe2Value != null) parts.push(`S2 ${formatNumber(telemetry.probe2Value)} °C`);
  if (telemetry.temperature != null) parts.push(`Temp ${formatNumber(telemetry.temperature)} °C`);
  if (telemetry.humidity != null) parts.push(`Hum ${formatNumber(telemetry.humidity)} %`);
  const summary = parts.length ? parts.join(" | ") : "Sin valores interpretados";
  const receivedAt = telemetry.receivedAt ? `Última ${formatDate(telemetry.receivedAt)}` : "";
  return receivedAt ? `${summary} | ${receivedAt}` : summary;
}

function navTo(sectionName) {
  for (const [name, section] of Object.entries(els.sections)) {
    section.classList.toggle("hidden", name !== sectionName);
  }
  for (const button of els.navLinks) {
    button.classList.toggle("active", button.dataset.section === sectionName);
  }
}

function renderSession() {
  const loggedIn = Boolean(state.token && state.user);
  els.loginView.classList.toggle("hidden", loggedIn);
  els.adminView.classList.toggle("hidden", !loggedIn);
  els.sessionUser.textContent = state.user?.email ?? "-";
  els.sessionRole.textContent = state.user?.role ?? "-";
}

function renderOverview() {
  const users = state.users;
  const controllers = users.flatMap((user) => user.controllers ?? []);
  const online = controllers.filter((controller) => getOnlineStatus(controller)).length;
  const alerts = controllers.filter((controller) => getAlertActive(controller)).length;

  els.metricUsers.textContent = String(users.length);
  els.metricControllers.textContent = String(controllers.length);
  els.metricOnline.textContent = String(online);
  els.metricAlerts.textContent = String(alerts);
}

function renderUsers() {
  if (!state.users.length) {
    els.usersList.innerHTML = `<div class="empty-state">No hay usuarios cargados.</div>`;
    return;
  }

  els.usersList.innerHTML = state.users
    .map((user) => {
      const controllersHtml = (user.controllers ?? [])
        .map((controller) => {
          const online = getOnlineStatus(controller);
          const alert = getAlertActive(controller);
          const statusClass = online ? "success" : "warning";
          const statusText = online ? "Online" : "Offline";
          const alertText = alert
            ? ` | alerta: ${controller.alertState?.message ?? controller.alertState?.type}`
            : "";

          return `
            <article class="controller-card">
              <div class="controller-head">
                <div>
                  <h4>${escapeHtml(controller.name ?? "-")}</h4>
                  <div class="controller-meta">
                    ${escapeHtml(controller.deviceBrand ?? "-")} / ${escapeHtml(controller.deviceModel ?? controller.dixellModel ?? "-")}<br />
                    elfinId: ${escapeHtml(controller.elfinId ?? "-")} | gateway: ${escapeHtml(controller.gatewayMode ?? "-")}<br />
                    uid: ${escapeHtml(controller.unitId ?? "-")} | baud: ${escapeHtml(controller.baudRate ?? "-")} | probe1: ${escapeHtml(controller.probe1 ?? "-")} | probe2: ${escapeHtml(controller.probe2 ?? "-")}<br />
                    ip: ${escapeHtml(controller.ipAddress ?? "-")} | port: ${escapeHtml(controller.modbusPort ?? "-")} | loc: ${escapeHtml(controller.location ?? "-")}
                  </div>
                  <div class="controller-telemetry">
                    <strong>Lectura:</strong> ${escapeHtml(telemetrySummary(controller))}
                  </div>
                </div>
                <span class="status-pill ${statusClass}">${statusText}${alert ? " + alerta" : ""}</span>
              </div>
              <div class="controller-meta">
                ${controller.connectionState?.lastPollError ? `Error: ${escapeHtml(controller.connectionState.lastPollError)}<br />` : ""}
                ${controller.alertState?.message ? `${escapeHtml(controller.alertState.message)}<br />` : ""}
                Actualizado: ${escapeHtml(formatDate(controller.updatedAt))}${alertText ? `<br />${escapeHtml(alertText)}` : ""}
              </div>
              <div class="controller-actions">
                <button class="ghost-button" data-controller-id="${controller._id}" data-action="edit-controller">Editar alertas y registros</button>
              </div>
            </article>
          `;
        })
        .join("");

      return `
        <article class="user-card">
          <div class="user-top">
            <div>
              <h3>${escapeHtml(user.fullName ?? "-")}</h3>
              <p class="muted">${escapeHtml(user.email ?? "-")} | rol: ${escapeHtml(user.role ?? "-")}</p>
            </div>
            <span class="status-pill ${user.isActive ? "success" : "warning"}">
              ${user.controllersCount} controlador${user.controllersCount === 1 ? "" : "es"}
            </span>
          </div>
          <div class="form-grid">
            <label>
              <span>Nombre</span>
              <input data-user-field="fullName" type="text" value="${escapeAttr(user.fullName ?? "")}" />
            </label>
            <label>
              <span>Rol</span>
              <select data-user-field="role">
                <option value="admin" ${user.role === "admin" ? "selected" : ""}>admin</option>
                <option value="technician" ${user.role === "technician" ? "selected" : ""}>technician</option>
                <option value="viewer" ${user.role === "viewer" ? "selected" : ""}>viewer</option>
              </select>
            </label>
            <label class="toggle-row">
              <span>Usuario activo</span>
              <input data-user-field="isActive" type="checkbox" ${user.isActive ? "checked" : ""} />
            </label>
          </div>
          <div class="controller-actions">
            <button class="ghost-button" data-user-id="${user._id}" data-action="save-user">Guardar usuario</button>
          </div>
          <div class="controllers-grid">
            ${controllersHtml || `<div class="empty-state">Este usuario todavía no tiene controladores.</div>`}
          </div>
        </article>
      `;
    })
    .join("");
}

function renderModels() {
  if (!state.models.length) {
    els.modelsList.innerHTML = `<div class="empty-state">No hay modelos cargados todavía.</div>`;
    return;
  }

  els.modelsList.innerHTML = state.models
    .map((model) => {
      const templateCount = model.registerTemplates?.length ?? 0;
      return `
        <article class="model-card">
          <p class="eyebrow">${escapeHtml(model.brand ?? "-")}</p>
          <h4>${escapeHtml(model.name ?? "-")}</h4>
          <p class="muted small">${escapeHtml(model.description ?? "Sin descripción")}</p>
          <div class="model-defaults">
            uid: ${escapeHtml(model.defaultUnitId ?? "-")} | port: ${escapeHtml(model.defaultModbusPort ?? "-")}<br />
            baud: ${escapeHtml(model.defaultBaudRate ?? "-")} | parity: ${escapeHtml(model.defaultParity ?? "-")} | stop: ${escapeHtml(model.defaultStopBits ?? "-")}<br />
            probe1: ${escapeHtml(model.defaultProbe1 ?? "-")} | probe2: ${escapeHtml(model.defaultProbe2 ?? "-")}<br />
            templates: ${templateCount} | setpoint reg: ${escapeHtml(model.setpointRegister ?? "-")}
          </div>
          <div class="controller-actions">
            <button class="ghost-button" data-action="edit-model" data-model-id="${model._id}">Editar</button>
            <button class="ghost-button" data-action="export-model" data-model-id="${model._id}">Exportar CSV</button>
          </div>
        </article>
      `;
    })
    .join("");
}

function createRegisterRow(definition = {}, { removable = true } = {}) {
  const row = document.createElement("article");
  row.className = "register-row";
  row.innerHTML = `
    <div class="register-grid">
      <label>
        <span>Key</span>
        <input data-field="key" type="text" value="${escapeAttr(definition.key ?? "")}" placeholder="TMP1" />
      </label>
      <label>
        <span>Label</span>
        <input data-field="label" type="text" value="${escapeAttr(definition.label ?? "")}" placeholder="Temperatura S1" />
      </label>
      <label>
        <span>Registro</span>
        <input data-field="register" type="number" min="0" step="1" value="${escapeAttr(definition.register ?? "")}" />
      </label>
      <label>
        <span>Verify register</span>
        <input data-field="verifyRegister" type="number" min="0" step="1" value="${escapeAttr(definition.verifyRegister ?? "")}" />
      </label>
      <label>
        <span>Scale</span>
        <input data-field="scale" type="number" min="1" step="1" value="${escapeAttr(definition.scale ?? 10)}" />
      </label>
      <label>
        <span>Step</span>
        <input data-field="step" type="number" min="0.1" step="0.1" value="${escapeAttr(definition.step ?? 0.1)}" />
      </label>
      <label>
        <span>Mínimo</span>
        <input data-field="min" type="number" step="0.1" value="${escapeAttr(definition.min ?? "")}" />
      </label>
      <label>
        <span>Máximo</span>
        <input data-field="max" type="number" step="0.1" value="${escapeAttr(definition.max ?? "")}" />
      </label>
      <label>
        <span>Access level</span>
        <select data-field="accessLevel">
          <option value="user" ${definition.accessLevel !== "technician" ? "selected" : ""}>user</option>
          <option value="technician" ${definition.accessLevel === "technician" ? "selected" : ""}>technician</option>
        </select>
      </label>
      <label>
        <span>Function code</span>
        <select data-field="functionCode">
          <option value="auto" ${!definition.functionCode || definition.functionCode === "auto" ? "selected" : ""}>auto</option>
          <option value="0x06" ${definition.functionCode === "0x06" ? "selected" : ""}>0x06</option>
          <option value="0x10" ${definition.functionCode === "0x10" ? "selected" : ""}>0x10</option>
        </select>
      </label>
      <label>
        <span>Descripción</span>
        <input data-field="description" type="text" value="${escapeAttr(definition.description ?? "")}" placeholder="Texto opcional" />
      </label>
    </div>
    <div class="register-options">
      <label><input data-field="writable" type="checkbox" ${definition.writable !== false ? "checked" : ""} /> editable</label>
      <label><input data-field="visible" type="checkbox" ${definition.visible !== false ? "checked" : ""} /> visible</label>
    </div>
    <div class="register-row-actions">
      ${removable ? `<button type="button" class="danger-button" data-action="remove-row">Eliminar</button>` : ""}
    </div>
  `;

  if (removable) {
    row.querySelector('[data-action="remove-row"]')?.addEventListener("click", () => row.remove());
  }

  return row;
}

function readRegisterRows(container) {
  return Array.from(container.querySelectorAll(".register-row"))
    .map((row) => {
      const key = row.querySelector('[data-field="key"]').value.trim().toUpperCase();
      const label = row.querySelector('[data-field="label"]').value.trim();
      const register = row.querySelector('[data-field="register"]').value.trim();
      if (!key || !label || !register) return null;

      return {
        key,
        label,
        register: Number(register),
        verifyRegister: toOptionalNumber(row.querySelector('[data-field="verifyRegister"]').value),
        scale: toNumberOrDefault(row.querySelector('[data-field="scale"]').value, 10),
        step: toNumberOrDefault(row.querySelector('[data-field="step"]').value, 0.1),
        min: toOptionalNumber(row.querySelector('[data-field="min"]').value),
        max: toOptionalNumber(row.querySelector('[data-field="max"]').value),
        accessLevel: row.querySelector('[data-field="accessLevel"]').value,
        functionCode: row.querySelector('[data-field="functionCode"]').value,
        description: row.querySelector('[data-field="description"]').value.trim() || undefined,
        writable: row.querySelector('[data-field="writable"]').checked,
        visible: row.querySelector('[data-field="visible"]').checked,
      };
    })
    .filter(Boolean);
}

function renderControllerDrawer(controller) {
  state.currentController = controller;
  els.drawerTitle.textContent = controller.name ?? "-";
  els.drawerSubtitle.textContent = `${controller.deviceBrand ?? "-"} / ${controller.deviceModel ?? controller.dixellModel ?? "-"} | ${controller.elfinId ?? "-"}`;
  els.controllerName.value = controller.name ?? "";
  els.controllerElfinId.value = controller.elfinId ?? "";
  els.controllerGatewayMode.value = controller.gatewayMode ?? "tcp-client";
  els.controllerIpAddress.value = controller.ipAddress ?? "";
  els.controllerModbusPort.value = controller.modbusPort ?? "";
  els.controllerUnitId.value = controller.unitId ?? "";
  els.controllerBaudRate.value = controller.baudRate ?? "";
  els.controllerProbe1.value = controller.probe1 ?? "";
  els.controllerProbe2.value = controller.probe2 ?? "";
  els.controllerLocation.value = controller.location ?? "";
  els.alertEnabled.checked = controller.alertConfig?.enabled !== false;
  els.alertMin.value = controller.alertConfig?.minTemperature ?? "";
  els.alertMax.value = controller.alertConfig?.maxTemperature ?? "";
  els.alertOffline.value = controller.alertConfig?.offlineAfterMs
    ? Math.round(controller.alertConfig.offlineAfterMs / 1000)
    : "";

  els.registerRows.innerHTML = "";
  const definitions = Array.isArray(controller.registerDefinitions) ? controller.registerDefinitions : [];
  if (!definitions.length) {
    els.registerRows.innerHTML = `<div class="empty-state">No hay registros configurados todavía. Cargalos acá para que aparezcan luego en la app del cliente.</div>`;
  } else {
    for (const definition of definitions) {
      els.registerRows.appendChild(createRegisterRow(definition));
    }
  }

  els.drawer.classList.remove("hidden");
}

function closeDrawer() {
  els.drawer.classList.add("hidden");
  els.registerRows.innerHTML = "";
  state.currentController = null;
}

function setModelFormMode(mode) {
  const editing = mode === "edit";
  els.cancelEditModelButton.classList.toggle("hidden", !editing);
  els.saveModelButton.textContent = editing ? "Guardar cambios" : "Guardar modelo";
}

function seedModelRows(definitions = null) {
  els.modelRegisterRows.innerHTML = "";

  const nextDefinitions =
    definitions && definitions.length
      ? definitions
      : [
          {
            key: "SET",
            label: "Setpoint normal",
            register: 31,
            verifyRegister: 31,
            scale: 10,
            min: -50,
            max: 105,
            writable: true,
            visible: true,
          },
          {
            key: "TMP1",
            label: "Temperatura S1",
            register: 101,
            scale: 10,
            writable: false,
            visible: true,
          },
        ];

  for (const definition of nextDefinitions) {
    els.modelRegisterRows.appendChild(createRegisterRow(definition));
  }
}

function resetModelForm() {
  state.currentModelId = null;
  els.modelId.value = "";
  els.modelForm.reset();
  els.modelFields.brand.value = "DIXELL";
  els.modelFields.protocol.value = "tcp-client";
  els.modelFields.connectionType.value = "serial";
  els.modelFields.defaultUnitId.value = "1";
  els.modelFields.defaultModbusPort.value = "502";
  els.modelFields.defaultBaudRate.value = "9600";
  els.modelFields.defaultDataBits.value = "8";
  els.modelFields.defaultParity.value = "none";
  els.modelFields.defaultStopBits.value = "1";
  els.modelFields.setpointScale.value = "10";
  seedModelRows();
  setModelFormMode("create");
}

function populateModelForm(model) {
  state.currentModelId = model._id;
  els.modelId.value = model._id;
  els.modelFields.brand.value = model.brand ?? "";
  els.modelFields.name.value = model.name ?? "";
  els.modelFields.protocol.value = model.protocol ?? "tcp-client";
  els.modelFields.connectionType.value = model.connectionType ?? "serial";
  els.modelFields.defaultUnitId.value = model.defaultUnitId ?? "";
  els.modelFields.defaultModbusPort.value = model.defaultModbusPort ?? "";
  els.modelFields.defaultBaudRate.value = model.defaultBaudRate ?? "";
  els.modelFields.defaultDataBits.value = model.defaultDataBits ?? "";
  els.modelFields.defaultParity.value = model.defaultParity ?? "none";
  els.modelFields.defaultStopBits.value = model.defaultStopBits ?? "";
  els.modelFields.defaultProbe1.value = model.defaultProbe1 ?? "";
  els.modelFields.defaultProbe2.value = model.defaultProbe2 ?? "";
  els.modelFields.setpointRegister.value = model.setpointRegister ?? "";
  els.modelFields.setpointReadRegister.value = model.setpointReadRegister ?? "";
  els.modelFields.setpointVerifyRegister.value = model.setpointVerifyRegister ?? "";
  els.modelFields.setpointMin.value = model.setpointMin ?? "";
  els.modelFields.setpointMax.value = model.setpointMax ?? "";
  els.modelFields.setpointScale.value = model.setpointScale ?? "";
  els.modelFields.description.value = model.description ?? "";
  els.modelFields.notes.value = model.notes ?? "";
  seedModelRows(model.registerTemplates ?? []);
  setModelFormMode("edit");
}

function getModelFormPayload() {
  const registerTemplates = readRegisterRows(els.modelRegisterRows);
  return {
    brand: valueOrUndefined(els.modelFields.brand.value) ?? "DIXELL",
    name: valueOrUndefined(els.modelFields.name.value),
    protocol: valueOrUndefined(els.modelFields.protocol.value),
    connectionType: valueOrUndefined(els.modelFields.connectionType.value),
    defaultUnitId: toOptionalNumber(els.modelFields.defaultUnitId.value),
    defaultModbusPort: toOptionalNumber(els.modelFields.defaultModbusPort.value),
    defaultBaudRate: toOptionalNumber(els.modelFields.defaultBaudRate.value),
    defaultDataBits: toOptionalNumber(els.modelFields.defaultDataBits.value),
    defaultParity: valueOrUndefined(els.modelFields.defaultParity.value),
    defaultStopBits: toOptionalNumber(els.modelFields.defaultStopBits.value),
    defaultProbe1: toOptionalNumber(els.modelFields.defaultProbe1.value),
    defaultProbe2: toOptionalNumber(els.modelFields.defaultProbe2.value),
    registerCount: registerTemplates.length || undefined,
    setpointRegister: toOptionalNumber(els.modelFields.setpointRegister.value),
    setpointReadRegister: toOptionalNumber(els.modelFields.setpointReadRegister.value),
    setpointVerifyRegister: toOptionalNumber(els.modelFields.setpointVerifyRegister.value),
    setpointMin: toOptionalNumber(els.modelFields.setpointMin.value),
    setpointMax: toOptionalNumber(els.modelFields.setpointMax.value),
    setpointScale: toOptionalNumber(els.modelFields.setpointScale.value),
    description: valueOrUndefined(els.modelFields.description.value),
    notes: valueOrUndefined(els.modelFields.notes.value),
    registerTemplates,
  };
}

async function fetchAllData() {
  const [usersPayload, modelsPayload] = await Promise.all([
    api("/api/admin/users"),
    api("/api/device-models"),
  ]);

  state.users = usersPayload?.users ?? [];
  state.models = modelsPayload?.models ?? [];

  renderOverview();
  renderUsers();
  renderModels();
}

async function handleLogin(event) {
  event.preventDefault();
  clearBanners();
  els.loginError.classList.add("hidden");
  els.loginError.textContent = "";

  try {
    const payload = await api("/api/auth/login", {
      method: "POST",
      body: {
        email: els.loginEmail.value.trim(),
        password: els.loginPassword.value,
      },
      requiresAuth: false,
    });

    if (payload?.user?.role !== "admin") {
      throw new Error("Este usuario no tiene rol admin");
    }

    state.token = payload.token;
    state.user = payload.user;
    saveSession();
    renderSession();
    await fetchAllData();
    navTo("overview");
    setBanner("success", "Sesión iniciada.");
  } catch (err) {
    els.loginError.textContent = parseErrorMessage(err, "No se pudo iniciar sesión");
    els.loginError.classList.remove("hidden");
  }
}

async function handleReload() {
  clearBanners();
  try {
    await fetchAllData();
    setBanner("success", "Datos actualizados.");
  } catch (err) {
    if (err.status === 401) {
      clearSession();
      setBanner("error", "La sesión expiró. Volvé a iniciar sesión.");
      return;
    }
    setBanner("error", parseErrorMessage(err, "No se pudieron actualizar los datos"));
  }
}

async function openControllerEditor(controllerId) {
  clearBanners();
  try {
    const payload = await api(`/api/admin/controllers/${controllerId}`);
    renderControllerDrawer(payload.controller);
  } catch (err) {
    setBanner("error", parseErrorMessage(err, "No se pudo abrir el controlador"));
  }
}

async function handleSaveController() {
  if (!state.currentController?._id) return;
  clearBanners();

  try {
    const connectionPayload = {
      name: valueOrUndefined(els.controllerName.value),
      elfinId: valueOrUndefined(els.controllerElfinId.value),
      gatewayMode: valueOrUndefined(els.controllerGatewayMode.value),
      ipAddress: els.controllerIpAddress.value.trim(),
      modbusPort: toOptionalNumber(els.controllerModbusPort.value),
      unitId: toOptionalNumber(els.controllerUnitId.value),
      baudRate: toOptionalNumber(els.controllerBaudRate.value),
      probe1: toOptionalNumber(els.controllerProbe1.value),
      probe2: toOptionalNumber(els.controllerProbe2.value),
      location: els.controllerLocation.value.trim(),
    };
    const alertPayload = {
      enabled: els.alertEnabled.checked,
      minTemperature: toOptionalNumber(els.alertMin.value),
      maxTemperature: toOptionalNumber(els.alertMax.value),
      offlineAfterMs: toOptionalNumber(els.alertOffline.value, { multiplier: 1000 }),
    };

    const registerDefinitions = readRegisterRows(els.registerRows);

    await Promise.all([
      api(`/api/admin/controllers/${state.currentController._id}/connection-config`, {
        method: "PUT",
        body: connectionPayload,
      }),
      api(`/api/admin/controllers/${state.currentController._id}/alert-config`, {
        method: "PUT",
        body: alertPayload,
      }),
      api(`/api/admin/controllers/${state.currentController._id}/register-definitions`, {
        method: "PUT",
        body: { registerDefinitions },
      }),
    ]);

    await fetchAllData();
    closeDrawer();
    setBanner("success", "Controlador actualizado.");
    navTo("users");
  } catch (err) {
    setBanner("error", parseErrorMessage(err, "No se pudo guardar el controlador"));
  }
}

async function handleSaveUser(userId, card) {
  clearBanners();

  try {
    await api(`/api/admin/users/${userId}`, {
      method: "PUT",
      body: {
        fullName: card.querySelector('[data-user-field="fullName"]').value.trim(),
        role: card.querySelector('[data-user-field="role"]').value,
        isActive: card.querySelector('[data-user-field="isActive"]').checked,
      },
    });

    await fetchAllData();
    setBanner("success", "Usuario actualizado.");
  } catch (err) {
    setBanner("error", parseErrorMessage(err, "No se pudo guardar el usuario"));
  }
}

async function handleSubmitModel(event) {
  event.preventDefault();
  clearBanners();

  try {
    const body = getModelFormPayload();
    if (!body.name) {
      throw new Error("El nombre del modelo es obligatorio");
    }

    if (state.currentModelId) {
      await api(`/api/device-models/${state.currentModelId}`, {
        method: "PUT",
        body,
      });
      setBanner("success", "Modelo actualizado.");
    } else {
      await api("/api/device-models", {
        method: "POST",
        body,
      });
      setBanner("success", "Modelo creado.");
    }

    resetModelForm();
    await fetchAllData();
    navTo("models");
  } catch (err) {
    setBanner("error", parseErrorMessage(err, "No se pudo guardar el modelo"));
  }
}

function serializeTemplatesToCsv(registerTemplates) {
  const headers = [
    "key",
    "label",
    "register",
    "verifyRegister",
    "scale",
    "step",
    "min",
    "max",
    "accessLevel",
    "functionCode",
    "writable",
    "visible",
    "description",
  ];

  const rows = [headers];
  for (const item of registerTemplates) {
    rows.push([
      item.key ?? "",
      item.label ?? "",
      item.register ?? "",
      item.verifyRegister ?? "",
      item.scale ?? "",
      item.step ?? "",
      item.min ?? "",
      item.max ?? "",
      item.accessLevel ?? "user",
      item.functionCode ?? "auto",
      item.writable !== false ? "true" : "false",
      item.visible !== false ? "true" : "false",
      item.description ?? "",
    ]);
  }

  return rows
    .map((row) =>
      row
        .map((value) => {
          const normalized = String(value ?? "");
          if (normalized.includes(",") || normalized.includes('"') || normalized.includes("\n")) {
            return `"${normalized.replaceAll('"', '""')}"`;
          }
          return normalized;
        })
        .join(",")
    )
    .join("\n");
}

function downloadTextFile(filename, text, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}

function exportCurrentModelCsv() {
  const name = valueOrUndefined(els.modelFields.name.value) ?? "modelo";
  const csv = serializeTemplatesToCsv(readRegisterRows(els.modelRegisterRows));
  downloadTextFile(`${name.toLowerCase()}-register-templates.csv`, csv, "text/csv;charset=utf-8");
}

function exportModelById(modelId) {
  const model = state.models.find((item) => String(item._id) === String(modelId));
  if (!model) {
    setBanner("error", "No se encontró el modelo para exportar");
    return;
  }

  const csv = serializeTemplatesToCsv(model.registerTemplates ?? []);
  downloadTextFile(`${String(model.name ?? "modelo").toLowerCase()}-register-templates.csv`, csv, "text/csv;charset=utf-8");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let value = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        value += '"';
        index += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (char === "," && !inQuotes) {
      row.push(value);
      value = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(value);
      if (row.some((cell) => cell !== "")) rows.push(row);
      row = [];
      value = "";
      continue;
    }

    value += char;
  }

  if (value !== "" || row.length) {
    row.push(value);
    if (row.some((cell) => cell !== "")) rows.push(row);
  }

  return rows;
}

function importTemplatesFromCsv(text) {
  const rows = parseCsv(text);
  if (rows.length < 2) {
    throw new Error("El CSV no tiene filas de datos");
  }

  const header = rows[0].map((item) => String(item ?? "").trim().toLowerCase());
  const getIndex = (name) => header.indexOf(name);

  if (getIndex("key") === -1 || getIndex("label") === -1 || getIndex("register") === -1) {
    throw new Error("El CSV debe incluir columnas key, label y register");
  }

  const definitions = rows.slice(1).map((cells) => {
    const get = (name) => {
      const columnIndex = getIndex(name);
      return columnIndex === -1 ? "" : String(cells[columnIndex] ?? "").trim();
    };

    return {
      key: get("key").toUpperCase(),
      label: get("label"),
      register: toOptionalNumber(get("register")),
      verifyRegister: toOptionalNumber(get("verifyRegister")),
      scale: toOptionalNumber(get("scale")) ?? 10,
      step: toOptionalNumber(get("step")) ?? 0.1,
      min: toOptionalNumber(get("min")),
      max: toOptionalNumber(get("max")),
      accessLevel: get("accessLevel") === "technician" ? "technician" : "user",
      functionCode: ["0x06", "0x10"].includes(get("functionCode")) ? get("functionCode") : "auto",
      writable: get("writable").toLowerCase() !== "false",
      visible: get("visible").toLowerCase() !== "false",
      description: get("description") || undefined,
    };
  });

  if (!definitions.length) {
    throw new Error("No se pudieron importar registros desde el CSV");
  }

  seedModelRows(definitions);
}

function handleImportedCsv(file) {
  if (!file) return;

  const reader = new FileReader();
  reader.onload = () => {
    try {
      importTemplatesFromCsv(String(reader.result ?? ""));
      setBanner("success", "CSV importado en la plantilla actual.");
    } catch (err) {
      setBanner("error", parseErrorMessage(err, "No se pudo importar el CSV"));
    }
  };
  reader.onerror = () => {
    setBanner("error", "No se pudo leer el archivo CSV");
  };
  reader.readAsText(file, "utf-8");
}

function bindEvents() {
  els.loginForm.addEventListener("submit", handleLogin);
  els.logoutButton.addEventListener("click", () => {
    clearSession();
    navTo("overview");
  });
  els.reloadButton.addEventListener("click", handleReload);
  els.closeDrawerButton.addEventListener("click", closeDrawer);
  els.saveControllerButton.addEventListener("click", handleSaveController);
  els.addRegisterButton.addEventListener("click", () => {
    const emptyState = els.registerRows.querySelector(".empty-state");
    if (emptyState) els.registerRows.innerHTML = "";
    els.registerRows.appendChild(createRegisterRow({}));
  });
  els.addModelRegisterButton.addEventListener("click", () => {
    const emptyState = els.modelRegisterRows.querySelector(".empty-state");
    if (emptyState) els.modelRegisterRows.innerHTML = "";
    els.modelRegisterRows.appendChild(createRegisterRow({}));
  });
  els.modelForm.addEventListener("submit", handleSubmitModel);
  els.cancelEditModelButton.addEventListener("click", () => {
    resetModelForm();
    setBanner("success", "Edición cancelada.");
  });
  els.importModelCsvButton.addEventListener("click", () => els.modelCsvInput.click());
  els.exportModelCsvButton.addEventListener("click", exportCurrentModelCsv);
  els.modelCsvInput.addEventListener("change", (event) => {
    handleImportedCsv(event.target.files?.[0]);
    event.target.value = "";
  });

  for (const button of els.navLinks) {
    button.addEventListener("click", () => navTo(button.dataset.section));
  }

  els.usersList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    if (target.dataset.action === "edit-controller") {
      openControllerEditor(target.dataset.controllerId);
      return;
    }

    if (target.dataset.action === "save-user") {
      const card = target.closest(".user-card");
      if (!card) return;
      handleSaveUser(target.dataset.userId, card);
    }
  });

  els.modelsList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-action]");
    if (!target) return;

    const modelId = target.dataset.modelId;
    if (target.dataset.action === "edit-model") {
      const model = state.models.find((item) => String(item._id) === String(modelId));
      if (!model) {
        setBanner("error", "No se encontró el modelo");
        return;
      }
      populateModelForm(model);
      navTo("models");
      setBanner("success", `Editando ${model.name}.`);
      return;
    }

    if (target.dataset.action === "export-model") {
      exportModelById(modelId);
    }
  });
}

async function bootstrap() {
  bindEvents();
  resetModelForm();
  loadSession();
  renderSession();
  navTo("overview");

  if (!state.token) return;

  try {
    await fetchAllData();
  } catch (err) {
    clearSession();
    setBanner("error", "La sesión guardada ya no es válida. Volvé a iniciar sesión.");
  }
}

function toOptionalNumber(value, { multiplier = 1 } = {}) {
  if (value == null || value === "") return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number * multiplier : undefined;
}

function toNumberOrDefault(value, fallback) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function valueOrUndefined(value) {
  const normalized = String(value ?? "").trim();
  return normalized ? normalized : undefined;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}

bootstrap();
