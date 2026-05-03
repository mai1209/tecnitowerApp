import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
  {
    fullName: {
      type: String,
      trim: true,
      required: true,
      minlength: 3,
      maxlength: 120,
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      match: /^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/,
    },
    passwordHash: {
      type: String,
      required: true,
      minlength: 10,
    },
    role: {
      type: String,
      enum: ["admin", "user", "technician", "viewer"],
      default: "user",
    },
    canWrite: {
      type: Boolean,
      default: true,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

//userSchema.index({ email: 1 }, { unique: true });

userSchema.method("toJSON", function toJSON() {
  const obj = this.toObject();
  delete obj.passwordHash;
  return obj;
});

export const UserModel = mongoose.models.User ?? mongoose.model("User", userSchema);
