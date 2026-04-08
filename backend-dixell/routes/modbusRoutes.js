import { Router } from "express";

import { readModbusTemperatures } from "../api/modbusController.js";

const router = Router();

router.get("/", readModbusTemperatures);

export default router;
