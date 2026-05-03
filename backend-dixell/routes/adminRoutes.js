import { Router } from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import {
  createAdminController,
  deleteAdminController,
  deleteAdminUser,
  getAdminController,
  listUsersWithControllers,
  sendAdminUserTestPush,
  updateAdminControllerConnectionConfig,
  updateAdminControllerAlertConfig,
  updateAdminControllerRegisterDefinitions,
  updateAdminUser,
} from "../api/adminController.js";

const router = Router();

router.use(requireAuth);

router.get("/users", listUsersWithControllers);
router.put("/users/:id", updateAdminUser);
router.delete("/users/:id", deleteAdminUser);
router.post("/users/:id/push-test", sendAdminUserTestPush);
router.post("/controllers", createAdminController);
router.delete("/controllers/:id", deleteAdminController);
router.get("/controllers/:id", getAdminController);
router.put("/controllers/:id/connection-config", updateAdminControllerConnectionConfig);
router.put("/controllers/:id/register-definitions", updateAdminControllerRegisterDefinitions);
router.put("/controllers/:id/alert-config", updateAdminControllerAlertConfig);

export default router;
