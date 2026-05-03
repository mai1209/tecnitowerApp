import { Router } from "express";

import {
  loginUser,
  changeCurrentUserPassword,
  deleteCurrentUserAccount,
  registerUser,
  listPasswordRecoveryRequests,
  requestPasswordRecovery,
  registerPushDevice,
  resetUserPassword,
  unregisterPushDevice,
} from "../api/authController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.post("/register", registerUser);
router.post("/login", loginUser);
router.post("/forgot-password", requestPasswordRecovery);
router.post("/change-password", requireAuth, changeCurrentUserPassword);
router.delete("/me", requireAuth, deleteCurrentUserAccount);
router.get("/recovery-requests", requireAuth, listPasswordRecoveryRequests);
router.post("/reset-password", requireAuth, resetUserPassword);
router.post("/push/register", requireAuth, registerPushDevice);
router.post("/push/unregister", requireAuth, unregisterPushDevice);

export default router;
