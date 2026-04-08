import "dotenv/config";
import process from "node:process";

import { connectMongo, disconnectMongo } from "../database/connectMongo.js";
import { DixellModel } from "../models/DixellModel.js";

const DIXELL_MODELS = [
  {
    brand: "DIXELL",
    name: "XR35CX",
    description: "Controlador Dixell Prime CX para cámaras y vitrinas (Modbus RS-485)",
    protocol: "modbus-tcp",
    connectionType: "tcp",
    defaultUnitId: 1,
    defaultModbusPort: 502,
    defaultProbe1: 256,
    defaultProbe2: 258,
    registerCount: 1,
    notes:
      "XR35CX: Setpoint es el parámetro SEt (bloque de parámetros desde 768). Se escribe en el holding register 768. Valores en décimas cuando rES=dE.",
    setpointRegister: 768,
    setpointReadRegister: 1536,
    setpointVerifyRegister: 1536,
    setpointMin: -50,
    setpointMax: 110,
    setpointScale: 10,
  },
  {
    brand: "FULL GAUGE",
    name: "TC900E LOG",
    description: "Controlador Full Gauge TC-900E Log con protocolo Modbus RTU",
    protocol: "modbus-rtu",
    connectionType: "serial",
    defaultUnitId: 1,
    defaultBaudRate: 9600,
    defaultDataBits: 8,
    defaultParity: "none",
    defaultStopBits: 1,
    defaultProbe1: 101,
    defaultProbe2: 102,
    registerCount: 116,
    notes:
      "Manual TC-900E Log Modbus RTU v04r01: F31 (0x1F / 31) es el setpoint normal; F03 (0x03 / 3) y F04 (0x04 / 4) son límites mínimo y máximo. Temperaturas en Celsius usan escala x10.",
    setpointRegister: 31,
    setpointReadRegister: 31,
    setpointVerifyRegister: 31,
    setpointMin: -50,
    setpointMax: 105,
    setpointScale: 10,
    registerTemplates: [
      {
        key: "SET",
        label: "Setpoint normal",
        register: 31,
        verifyRegister: 31,
        scale: 10,
        min: -50,
        max: 105,
        step: 0.1,
        dataType: "number",
        writable: true,
        visible: true,
        accessLevel: "user",
        functionCode: "auto",
        description: "F31 Normal setpoint (manual TC-900E Log)",
        sortOrder: 0,
      },
      {
        key: "LS",
        label: "Setpoint minimo",
        register: 3,
        verifyRegister: 3,
        scale: 10,
        min: -50,
        max: 105,
        step: 0.1,
        dataType: "number",
        writable: true,
        visible: true,
        accessLevel: "technician",
        functionCode: "auto",
        description: "F03 Minimum setpoint allowed to the end user",
        sortOrder: 1,
      },
      {
        key: "US",
        label: "Setpoint maximo",
        register: 4,
        verifyRegister: 4,
        scale: 10,
        min: -50,
        max: 105,
        step: 0.1,
        dataType: "number",
        writable: true,
        visible: true,
        accessLevel: "technician",
        functionCode: "auto",
        description: "F04 Maximum setpoint allowed to the end user",
        sortOrder: 2,
      },
      {
        key: "TMP1",
        label: "Temperatura S1",
        register: 101,
        verifyRegister: 101,
        scale: 10,
        step: 0.1,
        dataType: "number",
        writable: false,
        visible: true,
        accessLevel: "user",
        functionCode: "auto",
        description: "tmp1 Temperature measurement on sensor 1",
        sortOrder: 3,
      },
      {
        key: "TMP2",
        label: "Temperatura S2",
        register: 102,
        verifyRegister: 102,
        scale: 10,
        step: 0.1,
        dataType: "number",
        writable: false,
        visible: true,
        accessLevel: "user",
        functionCode: "auto",
        description: "tmp2 Temperature measurement on sensor 2",
        sortOrder: 4,
      },
      {
        key: "TMP3",
        label: "Temperatura S3",
        register: 103,
        verifyRegister: 103,
        scale: 10,
        step: 0.1,
        dataType: "number",
        writable: false,
        visible: true,
        accessLevel: "user",
        functionCode: "auto",
        description: "tmp3 Temperature measurement on sensor 3",
        sortOrder: 5,
      },
    ],
  },
];

async function upsertModel(payload) {
  const normalized = {
    ...payload,
    name: payload.name.trim().toUpperCase(),
  };

  const doc = await DixellModel.findOneAndUpdate(
    { name: normalized.name },
    { $set: normalized },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  console.log(`✅ ${doc.name} listo (id: ${doc._id.toString()})`);
}

async function run() {
  try {
    await connectMongo();
    for (const payload of DIXELL_MODELS) {
      await upsertModel(payload);
    }
  } catch (err) {
    console.error("Error sembrando modelos Dixell", err);
    process.exitCode = 1;
  } finally {
    await disconnectMongo().catch(() => {});
  }
}

run();
