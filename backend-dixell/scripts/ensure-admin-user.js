import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../database/connectMongo.js";
import { UserModel } from "../models/User.js";
import { hashPassword } from "../token/passwordManager.js";

const email = String(process.env.ADMIN_EMAIL ?? "admin@admin.com").trim().toLowerCase();
const password = String(process.env.ADMIN_PASSWORD ?? "admin");

await connectMongo();

const passwordHash = await hashPassword(password);
const user = await UserModel.findOneAndUpdate(
  { email },
  {
    $set: {
      fullName: "Administrador Tecnitower",
      email,
      passwordHash,
      role: "admin",
      isActive: true,
    },
  },
  { new: true, upsert: true, setDefaultsOnInsert: true }
).lean();

console.log(
  JSON.stringify(
    {
      ok: true,
      email: user.email,
      role: user.role,
      message: "Admin listo. Cambiar esta contraseña antes de producción real.",
    },
    null,
    2
  )
);

await mongoose.disconnect();
