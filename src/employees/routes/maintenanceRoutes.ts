import express from "express";

import { addMaintenance, updateMaintenance } from "../controllers/maintenanceController";





const router = express.Router();

router.post("/add-maintenance/:hotel_id/:employee_id", addMaintenance);
router.patch("/update-maintenance/:hotel_id/:employee_id/:maintenance_id", updateMaintenance);

export default router;