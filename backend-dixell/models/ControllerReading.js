import mongoose from "mongoose";

const controllerReadingSchema = new mongoose.Schema(
  {
    controller: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Controller",
      required: true,
      index: true,
    },
    elfinId: {
      type: String,
      required: true,
      index: true,
      uppercase: true,
      trim: true,
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
    },
    topic: {
      type: String,
    },
    receivedAt: {
      type: Date,
      default: () => new Date(),
    },
  },
  { timestamps: false, versionKey: false }
);

// Retención automática del historial de lecturas (evita que la colección crezca
// sin límite). Configurable por env; por defecto 90 días.
const READING_TTL_DAYS = Number(process.env.CONTROLLER_READING_TTL_DAYS ?? 90);
controllerReadingSchema.index(
  { receivedAt: 1 },
  { expireAfterSeconds: Math.max(1, READING_TTL_DAYS) * 24 * 60 * 60 }
);

export const ControllerReading =
  mongoose.models.ControllerReading ?? mongoose.model("ControllerReading", controllerReadingSchema);
