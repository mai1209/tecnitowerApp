import { Router } from "express";

import {
  loginUser,
  registerUser,
  listPasswordRecoveryRequests,
  requestPasswordRecovery,
  resetUserPassword,
} from "../api/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordRecovery);
router.get("/recovery-requests", requireAuth, listPasswordRecoveryRequests);
router.post("/reset-password", requireAuth, resetUserPassword);

export default router;
