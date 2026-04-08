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
      index: true,
    },
  },
  { timestamps: false, versionKey: false }
);

export const ControllerReading =
  mongoose.models.ControllerReading ?? mongoose.model("ControllerReading", controllerReadingSchema);
