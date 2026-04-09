import mongoose from "mongoose";
import { registerDefinitionSchema } from "./schemas/registerDefinitionSchema.js";

const controllerSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 150,
    },
    dixellModelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DixellModel",
    },
    deviceModelId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "DixellModel",
    },
    dixellModel: {
      type: String,
      trim: true,
      uppercase: true,
    },
    deviceModel: {
      type: String,
      trim: true,
      uppercase: true,
    },
    deviceBrand: {
      type: String,
      trim: true,
      uppercase: true,
    },
    protocol: {
      type: String,
      trim: true,
      lowercase: true,
    },
    connectionType: {
      type: String,
      trim: true,
      lowercase: true,
    },
    gatewayMode: {
      type: String,
      trim: true,
      lowercase: true,
      enum: ["direct", "agent-mqtt", "elfin-mqtt", "tcp-client"],
    },
    elfinId: {
      type: String,
      trim: true,
      maxlength: 120,
      uppercase: true,
      index: { unique: true },
      required: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    modbusPort: {
      type: Number,
      min: 1,
      max: 65535,
    },
    baudRate: {
      type: Number,
      min: 1200,
    },
    dataBits: {
      type: Number,
      min: 5,
      max: 8,
    },
    parity: {
      type: String,
      trim: true,
      lowercase: true,
    },
    stopBits: {
      type: Number,
      min: 1,
      max: 2,
    },
    unitId: {
      type: Number,
      min: 1,
      max: 247,
      default: 1,
    },
    probe1: {
      type: Number,
      default: 256,
    },
    probe2: {
      type: Number,
      default: 258,
    },
    location: {
      type: String,
      trim: true,
    },
    notes: {
      type: String,
      trim: true,
    },
    lastTelemetry: {
      type: {
        probe1Value: Number,
        probe2Value: Number,
        raw1: Number,
        raw2: Number,
        temperature: Number,
        humidity: Number,
        payload: mongoose.Schema.Types.Mixed,
        topic: String,
        receivedAt: Date,
      },
      default: null,
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
    registerDefinitions: {
      type: [registerDefinitionSchema],
      default: [],
    },
  },
  { timestamps: true, versionKey: false }
);

controllerSchema.index({ owner: 1, name: 1 }, { unique: false });

export const ControllerModel =
  mongoose.models.Controller ?? mongoose.model("Controller", controllerSchema);
