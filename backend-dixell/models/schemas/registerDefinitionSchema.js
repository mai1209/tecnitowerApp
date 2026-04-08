import mongoose from "mongoose";

export const registerDefinitionSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      maxlength: 80,
    },
    label: {
      type: String,
      required: true,
      trim: true,
      maxlength: 160,
    },
    register: {
      type: Number,
      required: true,
      min: 0,
    },
    verifyRegister: {
      type: Number,
      min: 0,
    },
    scale: {
      type: Number,
      default: 10,
      min: 1,
    },
    min: {
      type: Number,
    },
    max: {
      type: Number,
    },
    step: {
      type: Number,
      default: 0.1,
    },
    dataType: {
      type: String,
      enum: ["number", "integer", "boolean"],
      default: "number",
    },
    writable: {
      type: Boolean,
      default: true,
    },
    visible: {
      type: Boolean,
      default: true,
    },
    accessLevel: {
      type: String,
      enum: ["user", "technician"],
      default: "user",
    },
    functionCode: {
      type: String,
      enum: ["auto", "0x06", "0x10"],
      default: "auto",
    },
    description: {
      type: String,
      trim: true,
      maxlength: 300,
    },
    sortOrder: {
      type: Number,
      default: 0,
    },
  },
  { _id: false }
);
