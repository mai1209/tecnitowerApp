import mongoose from "mongoose";

const pushDeviceSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    token: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    platform: {
      type: String,
      enum: ["ios", "android"],
      required: true,
    },
    deviceId: {
      type: String,
      trim: true,
    },
    appVersion: {
      type: String,
      trim: true,
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    lastSeenAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

pushDeviceSchema.index({ user: 1, enabled: 1 });

export const PushDeviceModel =
  mongoose.models.PushDevice ?? mongoose.model("PushDevice", pushDeviceSchema);
