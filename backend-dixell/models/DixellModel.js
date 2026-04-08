import mongoose from "mongoose";
import { registerDefinitionSchema } from "./schemas/registerDefinitionSchema.js";

const deviceModelSchema = new mongoose.Schema(
  {
    brand: {
      type: String,
      trim: true,
      uppercase: true,
      default: "DIXELL",
    },
    name: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      uppercase: true,
    },
    description: {
      type: String,
      trim: true,
    },
    protocol: {
      type: String,
      trim: true,
      lowercase: true,
      default: "modbus-tcp",
    },
    connectionType: {
      type: String,
      trim: true,
      lowercase: true,
      default: "tcp",
    },
    defaultUnitId: {
      type: Number,
      default: 1,
      min: 1,
      max: 247,
    },
    defaultModbusPort: {
      type: Number,
      min: 1,
      max: 65535,
      default: 502,
    },
    defaultBaudRate: {
      type: Number,
      min: 1200,
    },
    defaultDataBits: {
      type: Number,
      min: 5,
      max: 8,
    },
    defaultParity: {
      type: String,
      trim: true,
      lowercase: true,
    },
    defaultStopBits: {
      type: Number,
      min: 1,
      max: 2,
    },
    defaultProbe1: {
      type: Number,
      default: 256,
      min: 0,
    },
    defaultProbe2: {
      type: Number,
      default: 258,
      min: 0,
    },
    registerCount: {
      type: Number,
      default: 1,
      min: 1,
    },
    notes: {
      type: String,
      trim: true,
    },
    setpointRegister: {
      type: Number,
      min: 0,
    },
    setpointReadRegister: {
      type: Number,
      min: 0,
    },
    setpointVerifyRegister: {
      type: Number,
      min: 0,
    },
    setpointMin: {
      type: Number,
    },
    setpointMax: {
      type: Number,
    },
    setpointScale: {
      type: Number,
      min: 1,
    },
    registerTemplates: {
      type: [registerDefinitionSchema],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

export const DeviceModel =
  mongoose.models.DixellModel ?? mongoose.model("DixellModel", deviceModelSchema);

export const DixellModel = DeviceModel;
