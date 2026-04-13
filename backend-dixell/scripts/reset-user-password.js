import mongoose from "mongoose";

import { connectMongo } from "../database/connectMongo.js";
import { UserModel } from "../models/User.js";
import { PasswordRecoveryRequestModel } from "../models/PasswordRecoveryRequest.js";
import { hashPassword } from "../token/passwordManager.js";

function sanitizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

async function main() {
  const [, , rawEmail, newPassword] = process.argv;
  const email = sanitizeEmail(rawEmail);

  if (!email || !newPassword) {
    console.error("Uso: node scripts/reset-user-password.js <email> <nueva_password>");
    process.exit(1);
  }

  if (newPassword.length < 8) {
    console.error("La nueva contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  await connectMongo();

  const userDoc = await UserModel.findOne({ email, isActive: true }).select("+passwordHash");
  if (!userDoc) {
    console.error(`Usuario no encontrado: ${email}`);
    process.exit(1);
  }

  userDoc.passwordHash = await hashPassword(newPassword);
  await userDoc.save();

  await PasswordRecoveryRequestModel.updateMany(
    { email, status: "pending" },
    { $set: { status: "resolved", resolvedAt: new Date() } }
  );

  console.log(
    JSON.stringify(
      {
        ok: true,
        email: userDoc.email,
        fullName: userDoc.fullName,
        message: "Contraseña actualizada",
      },
      null,
      2
    )
  );
}

main()
  .catch((error) => {
    console.error(error?.message || error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await mongoose.disconnect();
    } catch {}
  });
