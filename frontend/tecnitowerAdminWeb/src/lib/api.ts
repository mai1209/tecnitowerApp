import type {
  AdminControllerDetail,
  AlertConfig,
  DeviceModel,
  RegisterDefinition,
  SessionUser,
  UserWithControllers,
  UserRole,
} from "../types";

const DEFAULT_API_BASE = "http://localhost:3001";

export type Session = {
  token: string;
  user: SessionUser;
};

export type ModelPayload = {
  brand?: string;
  name?: string;
  protocol?: string;
  connectionType?: string;
  defaultUnitId?: number;
  defaultModbusPort?: number;
  defaultBaudRate?: number;
  defaultDataBits?: number;
  defaultParity?: string;
  defaultStopBits?: number;
  defaultProbe1?: number;
  defaultProbe2?: number;
  registerCount?: number;
  notes?: string;
  setpointRegister?: number;
  setpointReadRegister?: number;
  setpointVerifyRegister?: number;
  setpointMin?: number;
  setpointMax?: number;
  setpointScale?: number;
  description?: string;
  registerTemplates: RegisterDefinition[];
};

export type ControllerConnectionPayload = {
  name?: string;
  elfinId?: string;
  gatewayMode?: string;
  ipAddress?: string;
  modbusPort?: number;
  unitId?: number;
  baudRate?: number;
  probe1?: number;
  probe2?: number;
  location?: string;
};

type RequestOptions = {
  method?: string;
  token?: string | null;
  body?: unknown;
};

function getApiBase() {
  const envBase = (globalThis as { __APP_API_BASE__?: string }).__APP_API_BASE__;
  return envBase || DEFAULT_API_BASE;
}

async function request<T>(path: string, { method = "GET", token, body }: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body !== undefined) headers["Content-Type"] = "application/json";

  const response = await fetch(`${getApiBase()}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let payload: unknown = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const error = payload as { error?: string; message?: string } | null;
    throw new Error(error?.error || error?.message || `HTTP ${response.status}`);
  }

  return payload as T;
}

export async function login(email: string, password: string): Promise<Session> {
  return request<Session>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
}

export async function fetchAdminUsers(token: string) {
  return request<{ users: UserWithControllers[] }>("/api/admin/users", { token });
}

export async function updateAdminUser(
  token: string,
  userId: string,
  body: { fullName: string; role: UserRole; isActive: boolean }
) {
  return request<{ user: SessionUser & { isActive: boolean } }>(`/api/admin/users/${userId}`, {
    method: "PUT",
    token,
    body,
  });
}

export async function fetchAdminController(token: string, controllerId: string) {
  return request<{ controller: AdminControllerDetail }>(`/api/admin/controllers/${controllerId}`, { token });
}

export async function updateAdminControllerConnection(
  token: string,
  controllerId: string,
  body: ControllerConnectionPayload
) {
  return request<{ controller: AdminControllerDetail }>(
    `/api/admin/controllers/${controllerId}/connection-config`,
    {
      method: "PUT",
      token,
      body,
    }
  );
}

export async function updateAdminControllerAlerts(
  token: string,
  controllerId: string,
  body: AlertConfig
) {
  return request(`/api/admin/controllers/${controllerId}/alert-config`, {
    method: "PUT",
    token,
    body,
  });
}

export async function updateAdminControllerRegisters(
  token: string,
  controllerId: string,
  registerDefinitions: RegisterDefinition[]
) {
  return request(`/api/admin/controllers/${controllerId}/register-definitions`, {
    method: "PUT",
    token,
    body: { registerDefinitions },
  });
}

export async function fetchDeviceModels(token: string) {
  return request<{ models: DeviceModel[] }>("/api/device-models", { token });
}

export async function createDeviceModel(token: string, body: ModelPayload) {
  return request<{ model: DeviceModel }>("/api/device-models", {
    method: "POST",
    token,
    body,
  });
}

export async function updateDeviceModel(token: string, modelId: string, body: ModelPayload) {
  return request<{ model: DeviceModel }>(`/api/device-models/${modelId}`, {
    method: "PUT",
    token,
    body,
  });
}
