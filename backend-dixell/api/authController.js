import { UserModel } from "../models/User.js";
import { hashPassword, verifyPassword } from "../token/passwordManager.js";
import { signAccessToken } from "../token/jwtManager.js";

function sanitizeEmail(email) {
  return String(email ?? "").trim().toLowerCase();
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
