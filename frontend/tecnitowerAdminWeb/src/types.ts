export type UserRole = "admin" | "technician" | "viewer";

export type SessionUser = {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
};

export type AlertConfig = {
  enabled?: boolean;
  minTemperature?: number;
  maxTemperature?: number;
  offlineAfterMs?: number;
};

export type AlertState = {
  active?: boolean;
  type?: string;
  severity?: string;
  message?: string;
};

export type ConnectionState = {
  online?: boolean;
  lastSeenAt?: string;
  lastPollAt?: string;
  lastPollError?: string;
};

export type RegisterDefinition = {
  key: string;
  label: string;
  register: number;
  verifyRegister?: number;
  scale?: number;
  step?: number;
  min?: number;
  max?: number;
  accessLevel?: "user" | "technician";
  functionCode?: "auto" | "0x06" | "0x10";
  writable?: boolean;
  visible?: boolean;
  description?: string;
};

export type ControllerSummary = {
  _id: string;
  owner: string;
  name: string;
  elfinId: string;
  ipAddress?: string;
  modbusPort?: number;
  location?: string;
  gatewayMode?: string;
  deviceBrand?: string;
  deviceModel?: string;
  dixellModel?: string;
  unitId?: number;
  baudRate?: number;
  probe1?: number;
  probe2?: number;
  lastTelemetry?: {
    probe1Value?: number;
    probe2Value?: number;
    temperature?: number;
    humidity?: number;
    receivedAt?: string;
  } | null;
  connectionState?: ConnectionState;
  alertState?: AlertState;
  alertConfig?: AlertConfig;
  registerDefinitions?: RegisterDefinition[];
  registerDefinitionsCount?: number;
  updatedAt?: string;
};

export type UserWithControllers = {
  _id: string;
  fullName: string;
  email: string;
  role: UserRole;
  isActive: boolean;
  createdAt?: string;
  controllersCount: number;
  controllers: ControllerSummary[];
};

export type DeviceModel = {
  _id: string;
  brand: string;
  name: string;
  description?: string;
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
  registerTemplates?: RegisterDefinition[];
};

export type AdminControllerDetail = ControllerSummary & {
  registerDefinitions: RegisterDefinition[];
};
