import { Router } from "express";
import rateLimit from "express-rate-limit";

import {
  loginUser,
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
  registerUser,
  listPasswordRecoveryRequests,
  requestPasswordRecovery,
  registerPushDevice,
  resetUserPassword,
  resetPasswordWithRecoveryCode,
  unregisterPushDevice,
  verifyPasswordRecoveryCode,
} from "../api/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Limita los intentos en endpoints sensibles (login, registro, recuperación)
// para frenar fuerza bruta. Configurable por env; por defecto 10 req / 15 min por IP.
const authLimiter = rateLimit({
  windowMs: Number(process.env.AUTH_RATE_LIMIT_WINDOW_MS ?? 15 * 60 * 1000),
  limit: Number(process.env.AUTH_RATE_LIMIT_MAX ?? 10),
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Demasiados intentos. Probá de nuevo en unos minutos." },
});

router.post("/register", authLimiter, registerUser);
router.post("/login", authLimiter, loginUser);
router.post("/forgot-password", authLimiter, requestPasswordRecovery);
router.post("/forgot-password/verify", authLimiter, verifyPasswordRecoveryCode);
router.post("/forgot-password/reset", authLimiter, resetPasswordWithRecoveryCode);
router.post("/change-password", requireAuth, changeCurrentUserPassword);
router.delete("/me", requireAuth, deleteCurrentUserAccount);
router.get("/recovery-requests", requireAuth, listPasswordRecoveryRequests);
router.post("/reset-password", requireAuth, resetUserPassword);
router.post("/push/register", requireAuth, registerPushDevice);
router.post("/push/unregister", requireAuth, unregisterPushDevice);

export default router;
