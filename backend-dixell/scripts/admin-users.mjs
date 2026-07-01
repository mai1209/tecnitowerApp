// Diagnóstico / administración de usuarios contra la MISMA base que usa el backend.
// Uso (siempre desde la carpeta backend-dixell, para que cargue el .env):
//   node scripts/admin-users.mjs                         -> lista los usuarios de la base conectada
//   node scripts/admin-users.mjs reset <email> <pass>    -> resetea la clave de un usuario existente
//   node scripts/admin-users.mjs create-admin <email> <pass> [nombre]  -> crea un admin nuevo
import "dotenv/config";
import mongoose from "mongoose";
import { connectMongo } from "../database/connectMongo.js";
import { UserModel } from "../models/User.js";
import { hashPassword } from "../token/passwordManager.js";

const [, , cmd, emailArg, passwordArg, ...rest] = process.argv;

async function main() {
  await connectMongo();
  console.log(`\n[DB] Conectado a: host=${mongoose.connection.host} · db=${mongoose.connection.name}\n`);

  const users = await UserModel.find().select("email role isActive createdAt").lean();
  console.log(`Usuarios en ESTA base: ${users.length}`);
  for (const u of users) {
    const fecha = u.createdAt instanceof Date ? u.createdAt.toISOString() : "";
    console.log(`  - ${u.email}  | role=${u.role}  | activo=${u.isActive}  | ${fecha}`);
  }
  console.log("");

  if (cmd === "reset") {
    if (!emailArg || !passwordArg) {
      console.log("Uso: node scripts/admin-users.mjs reset <email> <nuevaPassword>");
    } else {
      const email = String(emailArg).toLowerCase().trim();
      const user = await UserModel.findOne({ email });
      if (!user) {
        console.log(`✗ No existe el usuario ${email} en esta base.`);
        console.log(`  (Si la base es la correcta y querés crearlo: create-admin ${email} <pass>)`);
      } else {
        user.passwordHash = await hashPassword(passwordArg);
        user.isActive = true;
        await user.save();
        console.log(`✔ Clave reseteada para ${user.email} (role=${user.role}). Ya podés loguearte.`);
      }
    }
  } else if (cmd === "create-admin") {
    if (!emailArg || !passwordArg) {
      console.log("Uso: node scripts/admin-users.mjs create-admin <email> <password> [nombre]");
    } else {
      const email = String(emailArg).toLowerCase().trim();
      const existing = await UserModel.findOne({ email });
      if (existing) {
        console.log(`Ya existe ${email}; usá 'reset' para cambiarle la clave.`);
      } else {
        const fullName = rest.join(" ").trim() || "Administrador";
        await UserModel.create({
          fullName,
          email,
          passwordHash: await hashPassword(passwordArg),
          role: "admin",
          canWrite: true,
          isActive: true,
        });
        console.log(`✔ Admin creado: ${email}. Ya podés loguearte.`);
      }
    }
  } else if (cmd) {
    console.log(`Comando desconocido: "${cmd}". Usá: reset | create-admin (o sin args para listar).`);
  }

  await mongoose.connection.close();
  process.exit(0);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
