import { Router } from "express";

import { readModbusTemperatures } from "../api/modbusController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

// Requiere autenticación: este endpoint abre una conexión Modbus a la IP
// recibida por query. Sin auth, cualquiera podría forzar al servidor a
// conectarse a hosts/puertos arbitrarios (SSRF).
// TODO (recomendado): además validar/whitelistear la IP destino contra los
// controladores del usuario autenticado.
router.get("/", requireAuth, readModbusTemperatures);

export default router;
