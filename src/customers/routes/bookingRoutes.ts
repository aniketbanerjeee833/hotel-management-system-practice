import express from "express";
import { addBooking, cancelWholeBooking } from "../controllers/bookingController";




const router = express.Router();

router.post("/add-booking", addBooking);
router.put("/cancel-booking/:booking_id", cancelWholeBooking);

export default router;