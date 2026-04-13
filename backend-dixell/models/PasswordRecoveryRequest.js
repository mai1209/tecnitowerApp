import mongoose from "mongoose";

const passwordRecoveryRequestSchema = new mongoose.Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    source: {
      type: String,
      default: "mobile-app",
      trim: true,
    },
    requestIp: {
      type: String,
      default: "",
      trim: true,
    },
    userAgent: {
      type: String,
      default: "",
      trim: true,
    },
    status: {
      type: String,
      enum: ["pending", "resolved", "dismissed"],
      default: "pending",
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

passwordRecoveryRequestSchema.index({ email: 1, createdAt: -1 });
passwordRecoveryRequestSchema.index({ status: 1, createdAt: -1 });

export const PasswordRecoveryRequestModel =
  mongoose.models.PasswordRecoveryRequest ??
  mongoose.model("PasswordRecoveryRequest", passwordRecoveryRequestSchema);
