import { Router } from "express";

import {
  createDixellModel,
  listDixellModels,
  updateDeviceModel,
} from "../api/dixellModelController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", listDixellModels);
router.post("/", requireAuth, createDixellModel);
router.put("/:id", requireAuth, updateDeviceModel);

export default router;
