import AsyncStorage from "@react-native-async-storage/async-storage";
import { STORAGE_KEYS } from "../constants/storageKeys";

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: unknown;
  signal?: AbortSignal;
  authToken?: string;
  timeoutMs?: number;
};

// Tipos de payload (definidos igual que antes)
export type RegisterPayload = {
  fullName: string;
  email: string;
  password: string;
};

export type LoginPayload = {
  email: string;
  password: string;
};

export type PasswordRecoveryPayload = {
  email: string;
};

export type PasswordRecoveryVerifyPayload = {
  email: string;
  code: string;
};

export type PasswordRecoveryResetPayload = PasswordRecoveryVerifyPayload & {
  newPassword: string;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type PushTokenPayload = {
  token: string;
  platform: "ios" | "android";
  deviceId?: string;
  appVersion?: string;
};

export type ControllerPayload = {
  name: string;
  gatewayMode?: "direct" | "agent-mqtt" | "elfin-mqtt" | "tcp-client";
  deviceBrand?: string;
  deviceModel?: string;
  deviceModelId?: string;
  dixellModel?: string;
  dixellModelId?: string;
  elfinId: string;
  ipAddress?: string;
  modbusPort?: number;
  baudRate?: number;
  dataBits?: number;
  parity?: "none" | "even" | "odd";
  stopBits?: number;
  protocol?: string;
  connectionType?: string;
  unitId?: number;
  probe1?: number;
  probe2?: number;
  alertConfig?: {
    enabled?: boolean;
    minTemperature?: number;
    maxTemperature?: number;
    offlineAfterMs?: number;
  };
  registerDefinitions?: RegisterDefinitionPayload[];
};

export type RegisterDefinitionPayload = {
  key: string;
  label: string;
  register: number;
  verifyRegister?: number;
  scale?: number;
  min?: number;
  max?: number;
  step?: number;
  dataType?: "number" | "integer" | "boolean";
  writable?: boolean;
  visible?: boolean;
  functionCode?: "auto" | "0x06" | "0x10";
  description?: string;
  sortOrder?: number;
};

export type SetpointScanRange = {
  start: number;
  end: number;
  step?: number;
};

export type SetpointScanResult = {
  register: number;
  writeOk: boolean;
  affectsSetpoint: boolean;
  error?: string;
};

export type SetpointScanResponse = {
  registersTested: number;
  affectingRegisters: number[];
  results: SetpointScanResult[];
};



const CLOUD_API_URL = "http://147.15.48.169:3001";

export const DEFAULT_API_BASE_URL = CLOUD_API_URL;

export async function getApiBaseUrl() {
  const storedUrl = await AsyncStorage.getItem(STORAGE_KEYS.apiBaseUrl);
  const normalizedStoredUrl = normalizeApiBaseUrl(storedUrl);
  if (normalizedStoredUrl) return normalizedStoredUrl;

  return DEFAULT_API_BASE_URL;
}


function normalizeApiBaseUrl(rawUrl?: string | null) {
  const trimmed = String(rawUrl ?? "").trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withProtocol.replace(/\/+$/, "");
}






export async function setApiBaseUrl(value?: string | null) {
  const normalized = normalizeApiBaseUrl(value);
  if (!normalized) {
    await AsyncStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
    return DEFAULT_API_BASE_URL;
  }

  await AsyncStorage.setItem(STORAGE_KEYS.apiBaseUrl, normalized);
  return normalized;
}

export async function resetApiBaseUrl() {
  await AsyncStorage.removeItem(STORAGE_KEYS.apiBaseUrl);
  return DEFAULT_API_BASE_URL;
}

export async function getControllerWebSocketUrl(controllerId: string, authToken: string) {
  const baseUrl = await getApiBaseUrl();
  const wsBaseUrl = baseUrl.replace(/^http:/i, "ws:").replace(/^https:/i, "wss:");
  const params = new URLSearchParams({
    controllerId: String(controllerId ?? "").trim(),
    token: String(authToken ?? "").trim(),
  });

  return `${wsBaseUrl}/ws/controllers?${params.toString()}`;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = await getApiBaseUrl();
  const url = `${baseUrl}${path}`;
  console.log("[API REQUEST]", options.method ?? "GET", url);
  const headers: Record<string, string> = {
    Accept: "application/json",
    "Content-Type": "application/json",
  };

  if (options.authToken) {
    headers.Authorization = `Bearer ${options.authToken}`;
  }

  // Añadimos un AbortController por si la conexión se queda colgada
  const controller = new AbortController();
  const timeoutId = setTimeout(
    () => controller.abort(),
    Number.isFinite(options.timeoutMs) && (options.timeoutMs ?? 0) > 0 ? Number(options.timeoutMs) : 10000
  );

  try {
    const response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body ? JSON.stringify(options.body) : undefined,
      signal: options.signal || controller.signal,
    });

    clearTimeout(timeoutId);

    const text = await response.text(); // Leemos como texto primero para debug
    let payload: any;
    
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      throw new Error(`La respuesta del servidor no es un JSON valido (url=${url})`);
    }

    if (!response.ok) {
      throw new Error(payload?.error || "Error en la comunicación con el servidor");
    }

    return payload as T;
  } catch (error: any) {
    if (error.name === 'AbortError') {
      throw new Error("Tiempo de espera agotado (Servidor lento)");
    }
    const msg = String(error?.message ?? "");
    if (msg.includes("Network request failed") || msg.includes("Failed to fetch")) {
      throw new Error(`No se pudo conectar con el servidor (url=${url}).`);
    }
    throw error;
  }
}

// --- FUNCIONES EXPORTADAS ---

export function registerUser(payload: RegisterPayload) {
  return request<{ message: string; user: unknown }>("/api/auth/register", { method: "POST", body: payload });
}

export function loginUser(payload: LoginPayload) {
  return request<{ token: string; user: any }>("/api/auth/login", { method: "POST", body: payload });
}

export function requestPasswordRecovery(payload: PasswordRecoveryPayload) {
  return request<{ message: string }>("/api/auth/forgot-password", {
    method: "POST",
    body: payload,
  });
}

export function verifyPasswordRecoveryCode(payload: PasswordRecoveryVerifyPayload) {
  return request<{ message: string }>("/api/auth/forgot-password/verify", {
    method: "POST",
    body: payload,
  });
}

export function resetPasswordWithRecoveryCode(payload: PasswordRecoveryResetPayload) {
  return request<{ message: string }>("/api/auth/forgot-password/reset", {
    method: "POST",
    body: payload,
  });
}

export function changeCurrentUserPassword(payload: ChangePasswordPayload, authToken: string) {
  return request<{ message: string }>("/api/auth/change-password", {
    method: "POST",
    body: payload,
    authToken,
  });
}

export function deleteCurrentUserAccount(password: string, authToken: string) {
  return request<{ message: string }>("/api/auth/me", {
    method: "DELETE",
    body: { password },
    authToken,
  });
}

export function registerPushToken(payload: PushTokenPayload, authToken: string) {
  return request<{ message: string; device: any }>("/api/auth/push/register", {
    method: "POST",
    body: payload,
    authToken,
  });
}

export function unregisterPushToken(token: string, authToken: string) {
  return request<{ message: string }>("/api/auth/push/unregister", {
    method: "POST",
    body: { token },
    authToken,
  });
}

export function createController(payload: ControllerPayload, authToken: string) {
  return request<{ controller: any }>("/api/controllers", { method: "POST", body: payload, authToken });
}

export function createAdminController(
  payload: ControllerPayload & { ownerId: string },
  authToken: string
) {
  return request<{ controller: any }>("/api/admin/controllers", {
    method: "POST",
    body: payload,
    authToken,
  });
}

export function deleteController(controllerId: string, authToken: string) {
  return request<{ message: string; controller: any }>(`/api/controllers/${controllerId}`, {
    method: "DELETE",
    authToken,
    timeoutMs: 15000,
  });
}

// Borra UN controlador puntual como admin (sin borrar al usuario).
export function deleteAdminController(controllerId: string, authToken: string) {
  return request<{ message: string; controller: any }>(`/api/admin/controllers/${controllerId}`, {
    method: "DELETE",
    authToken,
    timeoutMs: 15000,
  });
}

export function updateControllerName(controllerId: string, name: string, authToken: string) {
  return request<{ controller: any }>(`/api/controllers/${controllerId}/name`, {
    method: "PUT",
    body: { name },
    authToken,
  });
}

export function fetchControllers(authToken: string) {
  return request<{ controllers: any[] }>("/api/controllers", { method: "GET", authToken });
}

export function fetchController(controllerId: string, authToken: string) {
  return request<{ controller: any }>(`/api/controllers/${controllerId}`, {
    method: "GET",
    authToken,
  });
}

export function fetchAdminUsers(authToken: string) {
  return request<{ users: any[] }>("/api/admin/users", {
    method: "GET",
    authToken,
    timeoutMs: 15000,
  });
}

export function updateAdminUser(
  userId: string,
  payload: { fullName: string; role: "admin" | "user"; canWrite: boolean; isActive: boolean },
  authToken: string
) {
  return request<{ user: any }>(`/api/admin/users/${userId}`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function deleteAdminUser(userId: string, authToken: string) {
  return request<{ message: string; user: any }>(`/api/admin/users/${userId}`, {
    method: "DELETE",
    authToken,
    timeoutMs: 15000,
  });
}

export function sendAdminUserTestPush(userId: string, authToken: string) {
  return request<{ message: string; result: any; user: any }>(`/api/admin/users/${userId}/push-test`, {
    method: "POST",
    authToken,
    timeoutMs: 15000,
  });
}

export function fetchAdminController(controllerId: string, authToken: string) {
  return request<{ controller: any }>(`/api/admin/controllers/${controllerId}`, {
    method: "GET",
    authToken,
  });
}

export function updateAdminControllerRegisterDefinitions(
  controllerId: string,
  registerDefinitions: RegisterDefinitionPayload[],
  authToken: string
) {
  return request<{ registerDefinitions: RegisterDefinitionPayload[] }>(
    `/api/admin/controllers/${controllerId}/register-definitions`,
    {
      method: "PUT",
      body: { registerDefinitions },
      authToken,
    }
  );
}

export function updateAdminControllerAlertConfig(
  controllerId: string,
  payload: {
    enabled?: boolean;
    minTemperature?: number | null;
    maxTemperature?: number | null;
    offlineAfterMs?: number | null;
  },
  authToken: string
) {
  return request<any>(`/api/admin/controllers/${controllerId}/alert-config`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function updateAdminControllerConnectionConfig(
  controllerId: string,
  payload: {
    name?: string;
    elfinId?: string;
    gatewayMode?: "direct" | "agent-mqtt" | "elfin-mqtt" | "tcp-client";
    ipAddress?: string;
    modbusPort?: number;
    unitId?: number;
    baudRate?: number;
    probe1?: number;
    probe2?: number;
    location?: string;
  },
  authToken: string
) {
  return request<any>(`/api/admin/controllers/${controllerId}/connection-config`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function fetchDeviceModels() {
  return request<{ models: any[] }>("/api/device-models");
}

export const fetchDixellModels = fetchDeviceModels;

export function createDeviceModel(payload: any, authToken: string) {
  return request<{ model: any }>("/api/device-models", {
    method: "POST",
    body: payload,
    authToken,
  });
}

export function updateDeviceModel(modelId: string, payload: any, authToken: string) {
  return request<{ model: any }>(`/api/device-models/${modelId}`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function updateControllerSetpoint(controllerId: string, temperature: number, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/setpoint`, {
    method: "POST",
    body: { temperature },
    authToken,
    timeoutMs: 20000,
  });
}

export function updateControllerSetpointConfig(
  controllerId: string,
  payload: {
    setpointRegister?: number;
    setpointReadRegister?: number;
    setpointVerifyRegister?: number;
    setpointScale?: number;
  },
  authToken: string
) {
  return request<any>(`/api/controllers/${controllerId}/setpoint-config`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function updateControllerConnectionConfig(
  controllerId: string,
  payload: {
    name?: string;
    ipAddress?: string;
    modbusPort?: number;
    unitId?: number;
    baudRate?: number;
    probe1?: number;
    probe2?: number;
  },
  authToken: string
) {
  return request<any>(`/api/controllers/${controllerId}/connection-config`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

export function updateControllerAlertConfig(
  controllerId: string,
  payload: {
    enabled?: boolean;
    minTemperature?: number | null;
    maxTemperature?: number | null;
    offlineAfterMs?: number | null;
  },
  authToken: string
) {
  return request<any>(`/api/controllers/${controllerId}/alert-config`, {
    method: "PUT",
    body: payload,
    authToken,
  });
}

// IMPORTANTE: Esta es la que usa la pantalla Live para actualizar
export function fetchDiagnostic(controllerId: string, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/diagnostic`, {
    method: "GET",
    authToken,
  });
}

export function updateControllerRegisterDefinitions(
  controllerId: string,
  registerDefinitions: RegisterDefinitionPayload[],
  authToken: string
) {
  return request<{ registerDefinitions: RegisterDefinitionPayload[] }>(
    `/api/controllers/${controllerId}/register-definitions`,
    {
      method: "PUT",
      body: { registerDefinitions },
      authToken,
    }
  );
}

export function writeControllerRegister(
  controllerId: string,
  payload: { key?: string; register?: number; value: number | boolean },
  authToken: string
) {
  return request<any>(`/api/controllers/${controllerId}/registers/write`, {
    method: "POST",
    body: payload,
    authToken,
    timeoutMs: 20000,
  });
}

export function scanControllerSetpoint(
  controllerId: string,
  payload: { temperature: number; range?: SetpointScanRange; candidateRegisters?: number[]; persist?: boolean },
  authToken: string
) {
  return request<SetpointScanResponse>(`/api/controllers/${controllerId}/setpoint-scan`, {
    method: "POST",
    body: payload,
    authToken,
  });
}

export function updateControllerHy(controllerId: string, value: number, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/hy`, {
    method: "POST",
    body: { value },
    authToken,
    timeoutMs: 20000,
  });
}

export function updateControllerUs(controllerId: string, value: number, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/us`, {
    method: "POST",
    body: { value },
    authToken,
    timeoutMs: 20000,
  });
}

export function updateControllerSetpoint768(controllerId: string, value: number, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/setpoint768`, {
    method: "POST",
    body: { value },
    authToken,
    timeoutMs: 20000,
  });
}


export function updateControllerLs(controllerId: string, value: number, authToken: string) {
  return request<any>(`/api/controllers/${controllerId}/ls`, {
    method: "POST",
    body: { value },
    authToken,
    timeoutMs: 20000,
  });
}
