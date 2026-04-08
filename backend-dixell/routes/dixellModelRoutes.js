import { Router } from "express";

import { createDixellModel, listDixellModels } from "../api/dixellModelController.js";
import { requireAuth } from "../middlewares/authMiddleware.js";

const router = Router();

router.get("/", listDixellModels);
router.post("/", requireAuth, createDixellModel);

export default router;
