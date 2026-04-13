import { UserModel } from "../models/User.js";
import { PasswordRecoveryRequestModel } from "../models/PasswordRecoveryRequest.js";
import { hashPassword, verifyPassword } from "../token/passwordManager.js";
import { signAccessToken } from "../token/jwtManager.js";

function sanitizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
}

function isValidEmail(email) {
  return /^[\w-.]+@([\w-]+\.)+[\w-]{2,}$/i.test(String(email ?? "").trim());
}

function canManageRecovery(role) {
  return role === "admin" || role === "technician";
}

export async function registerUser(req, res, next) {
  try {
    const fullName = String(req.body?.fullName ?? "").trim();
    const email = sanitizeEmail(req.body?.email);
    const password = String(req.body?.password ?? "");
    const role = req.body?.role;

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

    const userDoc = await UserModel.create({
      fullName,
      email,
      passwordHash,
      role,
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
      role: userDoc.role,
    });

    const user = {
      _id: userDoc._id.toString(),
      fullName: userDoc.fullName,
      email: userDoc.email,
      role: userDoc.role,
    };

    return res.json({
      message: "Login exitoso",
      token,
      user,
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

    await PasswordRecoveryRequestModel.create({
      email,
      userId: userDoc?._id ?? null,
      requestIp: String(req.ip ?? ""),
      userAgent: String(req.get("user-agent") ?? ""),
    });

    if (userDoc?._id) {
      console.info(`[AUTH] Solicitud de recuperación registrada para ${email}`);
    }

    return res.json({
      message:
        "Si existe una cuenta con ese correo, registramos el pedido de recuperación. Soporte te ayudará a restablecer la contraseña.",
    });
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
      user: {
        _id: userDoc._id.toString(),
        email: userDoc.email,
        fullName: userDoc.fullName,
      },
    });
  } catch (err) {
    return next(err);
  }
}
