import express from "express";
import { requireAuth } from "../middlewares/authMiddleware.js";
import * as controllerController from "../api/controllerController.js";

const router = express.Router();

// A partir de acá, TODAS las rutas requieren autenticación.
router.use(requireAuth);

// Movido detrás de requireAuth: antes quedaba expuesto sin login y disparaba
// una lectura Modbus. Si es un endpoint legacy y nadie lo usa, conviene borrarlo.
router.get("/setpoint", controllerController.getSetpoint);

router.post("/", controllerController.createController);
router.get("/", controllerController.listControllers);
router.delete("/:id", controllerController.deleteController);
router.put("/:id/name", controllerController.updateControllerName);
router.get("/:id", controllerController.getController);
router.put("/:id/register-definitions", controllerController.updateControllerRegisterDefinitions);
router.put("/:id/setpoint-config", controllerController.updateControllerSetpointConfig);
router.put("/:id/connection-config", controllerController.updateControllerConnectionConfig);
router.put("/:id/alert-config", controllerController.updateControllerAlertConfig);
router.post("/:id/registers/write", controllerController.writeControllerRegister);
router.post("/:id/setpoint", controllerController.setControllerSetpoint);
router.post("/:id/setpoint-scan", controllerController.scanControllerSetpoint);
router.post("/:id/hy", controllerController.setControllerHy);
router.post("/:id/us", controllerController.setControllerUs);
router.post("/:id/ls", controllerController.setControllerLs);
router.post("/:id/setpoint768", controllerController.setControllerSetpoint768);
router.get("/:id/diagnostic", controllerController.diagnosticController);


export default router;
