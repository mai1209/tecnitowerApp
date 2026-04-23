import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createAdminController,
  getAdminController,
  listUsersWithControllers,
  updateAdminControllerConnectionConfig,
  updateAdminControllerAlertConfig,
  updateAdminControllerRegisterDefinitions,
  updateAdminUser,
} from "../api/adminController.js";

const router = Router();

router.use(requireAuth);

router.get("/users", listUsersWithControllers);
router.put("/users/:id", updateAdminUser);
router.post("/controllers", createAdminController);
router.get("/controllers/:id", getAdminController);
router.put("/controllers/:id/connection-config", updateAdminControllerConnectionConfig);
router.put("/controllers/:id/register-definitions", updateAdminControllerRegisterDefinitions);
router.put("/controllers/:id/alert-config", updateAdminControllerAlertConfig);

export default router;
