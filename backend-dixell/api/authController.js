import { UserModel } from "../models/User.js";
import { PushDeviceModel } from "../models/PushDevice.js";
import { ControllerModel } from "../models/Controller.js";
import { PasswordRecoveryRequestModel } from "../models/PasswordRecoveryRequest.js";
import { hashPassword, verifyPassword } from "../token/passwordManager.js";
import { signAccessToken } from "../token/jwtManager.js";
import { buildPublicUser, normalizeUserRole } from "../utils/userAccess.js";
import { sendPasswordRecoveryCode } from "../services/passwordRecoveryEmailService.js";

const RECOVERY_CODE_TTL_MINUTES = Number(process.env.PASSWORD_RECOVERY_CODE_TTL_MINUTES ?? 15);
const RECOVERY_MAX_ATTEMPTS = Number(process.env.PASSWORD_RECOVERY_MAX_ATTEMPTS ?? 5);

function sanitizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(String(email ?? "").trim());
}

function canManageRecovery(role) {
  return normalizeUserRole(role) === "admin";
}

function sanitizePushToken(token) {
  return String(token ?? "").trim();
}

function generateRecoveryCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sanitizeRecoveryCode(code) {
  return String(code ?? "").replace(/\D/g, "").slice(0, 6);
}

function sanitizePlatform(platform) {
  const normalized = String(platform ?? "").trim().toLowerCase();
  if (normalized === "ios" || normalized === "android") return normalized;
  return null;
}

async function deleteOwnUserResources(userId) {
  await ControllerModel.deleteMany({ owner: userId });
  await PushDeviceModel.deleteMany({ user: userId });
  await PasswordRecoveryRequestModel.deleteMany({ userId });
}

export async function registerUser(req, res, next) {
  try {
    const fullName = String(req.body?.fullName ?? "").trim();
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");

    if (!fullName || !email || !password) {
      return res.status(400).json({
        error: "fullName, email y password son obligatorios",
      });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: "El password debe tener al menos 8 caracteres" });
    }

    const existingUser = await UserModel.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ error: "Ya existe un usuario con ese email" });
    }

    const passwordHash = await hashPassword(password);

    // Auto-registro: la cuenta nace SIN permiso de escritura. Un admin habilita
    // canWrite desde el panel cuando corresponde. Evita que cualquiera que se
    // registre pueda escribir setpoints/registros en controladores.
    const userDoc = await UserModel.create({
      fullName,
      email,
      passwordHash,
      role: "user",
      canWrite: false,
    });

    return res.status(201).json({
      message: "Usuario registrado correctamente",
      user: userDoc,
    });
  } catch (err) {
    return next(err);
  }
}

export async function loginUser(req, res, next) {
  try {
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");

    if (!email || !password) {
      return res.status(400).json({
        error: "email y password son obligatorios",
      });
    }

    const userDoc = await UserModel.findOne({ email, isActive: true }).select("+passwordHash");
    if (!userDoc) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const isValidPassword = await verifyPassword(password, userDoc.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: "Credenciales inválidas" });
    }

    const token = signAccessToken({
      sub: userDoc._id.toString(),
      email: userDoc.email,
      role: normalizeUserRole(userDoc.role),
    });

    return res.json({
      message: "Login exitoso",
      token,
      user: buildPublicUser(userDoc),
    });
  } catch (err) {
    return next(err);
  }
}

export async function requestPasswordRecovery(req, res, next) {
  try {
    const email = sanitizeEmail(req.body?.email);

    if (!email) {
      return res.status(400).json({ error: "email es obligatorio" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Ingresá un email válido" });
    }

    const userDoc = await UserModel.findOne({ email, isActive: true }).select("_id email");
    const code = generateRecoveryCode();
    const codeExpiresAt = new Date(Date.now() + RECOVERY_CODE_TTL_MINUTES * 60 * 1000);

    await PasswordRecoveryRequestModel.create({
      email,
      userId: userDoc?._id ?? null,
      requestIp: String(req.ip ?? ""),
      userAgent: String(req.get("user-agent") ?? ""),
      codeHash: userDoc?._id ? await hashPassword(code) : "",
      codeExpiresAt: userDoc?._id ? codeExpiresAt : null,
    });

    if (userDoc?._id) {
      await sendPasswordRecoveryCode({
        email,
        code,
        expiresInMinutes: RECOVERY_CODE_TTL_MINUTES,
      });
      console.info(`[AUTH] Código de recuperación generado para ${email}`);
    }

    return res.json({
      message:
        "Si existe una cuenta con ese correo, enviamos un código de verificación para restablecer la contraseña.",
    });
  } catch (err) {
    return next(err);
  }
}

async function findLatestRecoveryRequest(email) {
  return PasswordRecoveryRequestModel.findOne({
    email,
    status: { $in: ["pending", "verified"] },
    codeExpiresAt: { $gt: new Date() },
  })
    .sort({ createdAt: -1 })
    .select("+codeHash");
}

export async function verifyPasswordRecoveryCode(req, res, next) {
  try {
    const email = sanitizeEmail(req.body?.email);
    const code = sanitizeRecoveryCode(req.body?.code);

    if (!email || !code) {
      return res.status(400).json({ error: "email y code son obligatorios" });
    }

    if (!isValidEmail(email) || code.length !== 6) {
      return res.status(400).json({ error: "El email o el código no son válidos" });
    }

    const requestDoc = await findLatestRecoveryRequest(email);
    if (!requestDoc || !requestDoc.codeHash || requestDoc.codeAttempts >= RECOVERY_MAX_ATTEMPTS) {
      return res.status(400).json({ error: "El código no es válido o está vencido" });
    }

    const validCode = await verifyPassword(code, requestDoc.codeHash);
    if (!validCode) {
      requestDoc.codeAttempts += 1;
      await requestDoc.save();
      return res.status(400).json({ error: "El código no es válido o está vencido" });
    }

    requestDoc.status = "verified";
    requestDoc.verifiedAt = new Date();
    await requestDoc.save();

    return res.json({ message: "Código verificado correctamente" });
  } catch (err) {
    return next(err);
  }
}

export async function resetPasswordWithRecoveryCode(req, res, next) {
  try {
    const email = sanitizeEmail(req.body?.email);
    const code = sanitizeRecoveryCode(req.body?.code);
    const newPassword = String(req.body?.newPassword ?? "");

    if (!email || !code || !newPassword) {
      return res.status(400).json({ error: "email, code y newPassword son obligatorios" });
    }

    if (!isValidEmail(email) || code.length !== 6) {
      return res.status(400).json({ error: "El email o el código no son válidos" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
    }

    const requestDoc = await findLatestRecoveryRequest(email);
    if (!requestDoc || !requestDoc.codeHash || requestDoc.codeAttempts >= RECOVERY_MAX_ATTEMPTS) {
      return res.status(400).json({ error: "El código no es válido o está vencido" });
    }

    const validCode = await verifyPassword(code, requestDoc.codeHash);
    if (!validCode) {
      requestDoc.codeAttempts += 1;
      await requestDoc.save();
      return res.status(400).json({ error: "El código no es válido o está vencido" });
    }

    const userDoc = await UserModel.findOne({ email, isActive: true }).select("+passwordHash");
    if (!userDoc) {
      return res.status(400).json({ error: "El código no es válido o está vencido" });
    }

    userDoc.passwordHash = await hashPassword(newPassword);
    await userDoc.save();

    requestDoc.status = "resolved";
    requestDoc.verifiedAt = requestDoc.verifiedAt ?? new Date();
    requestDoc.resolvedAt = new Date();
    await requestDoc.save();

    await PasswordRecoveryRequestModel.updateMany(
      { email, status: "pending", _id: { $ne: requestDoc._id } },
      { $set: { status: "dismissed" } }
    );

    return res.json({ message: "Contraseña restablecida correctamente" });
  } catch (err) {
    return next(err);
  }
}

export async function listPasswordRecoveryRequests(req, res, next) {
  try {
    if (!canManageRecovery(req.user?.role)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const requests = await PasswordRecoveryRequestModel.find({})
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    return res.json({
      requests: requests.map((item) => ({
        _id: item._id?.toString(),
        email: item.email,
        userId: item.userId?.toString?.() ?? null,
        status: item.status,
        source: item.source,
        requestIp: item.requestIp,
        userAgent: item.userAgent,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
        resolvedAt: item.resolvedAt,
      })),
    });
  } catch (err) {
    return next(err);
  }
}

export async function resetUserPassword(req, res, next) {
  try {
    if (!canManageRecovery(req.user?.role)) {
      return res.status(403).json({ error: "No autorizado" });
    }

    const email = sanitizeEmail(req.body?.email);
    const newPassword = String(req.body?.newPassword ?? "");

    if (!email || !newPassword) {
      return res.status(400).json({ error: "email y newPassword son obligatorios" });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({ error: "Ingresá un email válido" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
    }

    const userDoc = await UserModel.findOne({ email, isActive: true }).select("+passwordHash");
    if (!userDoc) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    userDoc.passwordHash = await hashPassword(newPassword);
    await userDoc.save();

    await PasswordRecoveryRequestModel.updateMany(
      { email, status: "pending" },
      { $set: { status: "resolved", resolvedAt: new Date() } }
    );

    console.info(`[AUTH] Password reseteado manualmente por ${req.user?.email} para ${email}`);

    return res.json({
      message: "Contraseña restablecida correctamente",
      user: buildPublicUser(userDoc),
    });
  } catch (err) {
    return next(err);
  }
}

export async function changeCurrentUserPassword(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const currentPassword = String(req.body?.currentPassword ?? "");
    const newPassword = String(req.body?.newPassword ?? "");

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "currentPassword y newPassword son obligatorios" });
    }

    if (newPassword.length < 8) {
      return res.status(400).json({ error: "La nueva contraseña debe tener al menos 8 caracteres" });
    }

    const userDoc = await UserModel.findById(req.user.id).select("+passwordHash");
    if (!userDoc || userDoc.isActive === false) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const validPassword = await verifyPassword(currentPassword, userDoc.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "La contraseña actual es incorrecta" });
    }

    userDoc.passwordHash = await hashPassword(newPassword);
    await userDoc.save();

    return res.json({ message: "Contraseña actualizada correctamente" });
  } catch (err) {
    return next(err);
  }
}

export async function deleteCurrentUserAccount(req, res, next) {
  try {
    if (!req.user?.id) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    const password = String(req.body?.password ?? "");
    if (!password) {
      return res.status(400).json({ error: "password es obligatorio" });
    }

    const userDoc = await UserModel.findById(req.user.id).select("+passwordHash");
    if (!userDoc || userDoc.isActive === false) {
      return res.status(404).json({ error: "Usuario no encontrado" });
    }

    const validPassword = await verifyPassword(password, userDoc.passwordHash);
    if (!validPassword) {
      return res.status(401).json({ error: "La contraseña es incorrecta" });
    }

    await deleteOwnUserResources(userDoc._id);
    await userDoc.deleteOne();

    return res.json({ message: "Cuenta eliminada correctamente" });
  } catch (err) {
    return next(err);
  }
}

export async function registerPushDevice(req, res, next) {
  try {
    const token = sanitizePushToken(req.body?.token);
    const platform = sanitizePlatform(req.body?.platform);
    const deviceId = String(req.body?.deviceId ?? "").trim() || undefined;
    const appVersion = String(req.body?.appVersion ?? "").trim() || undefined;

    if (!req.user?.id) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!token || !platform) {
      return res.status(400).json({ error: "token y platform son obligatorios" });
    }

    const device = await PushDeviceModel.findOneAndUpdate(
      { token },
      {
        $set: {
          user: req.user.id,
          token,
          platform,
          deviceId,
          appVersion,
          enabled: true,
          lastSeenAt: new Date(),
        },
      },
      {
        new: true,
        upsert: true,
        setDefaultsOnInsert: true,
      }
    ).lean();

    return res.json({
      message: "Push token registrado",
      device: {
        _id: device?._id?.toString?.() ?? null,
        platform: device?.platform ?? platform,
        token,
      },
    });
  } catch (err) {
    return next(err);
  }
}

export async function unregisterPushDevice(req, res, next) {
  try {
    const token = sanitizePushToken(req.body?.token);

    if (!req.user?.id) {
      return res.status(401).json({ error: "Usuario no autenticado" });
    }

    if (!token) {
      return res.status(400).json({ error: "token es obligatorio" });
    }

    await PushDeviceModel.deleteOne({
      token,
      user: req.user.id,
    });

    return res.json({
      message: "Push token eliminado",
    });
  } catch (err) {
    return next(err);
  }
}
