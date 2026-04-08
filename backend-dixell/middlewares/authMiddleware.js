import { verifyAccessToken } from "../token/jwtManager.js";
import { UserModel } from "../models/User.js";

export async function requireAuth(req, res, next) {
  try {
    const header = req.headers.authorization || "";
    const token = header.startsWith("Bearer ") ? header.slice(7) : null;

    if (!token) {
      return res.status(401).json({ error: "Falta token de autenticación" });
    }

    const payload = verifyAccessToken(token);
    if (!payload?.sub) {
      return res.status(401).json({ error: "Token inválido o expirado" });
    }

    const user = await UserModel.findById(payload.sub).lean();
    if (!user || user.isActive === false) {
      return res.status(401).json({ error: "Usuario no autorizado" });
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    };

    return next();
  } catch (err) {
    return next(err);
  }
}
