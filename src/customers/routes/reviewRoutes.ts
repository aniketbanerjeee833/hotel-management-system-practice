import express from "express";
import { addReview } from "../controllers/reviewController";





const router = express.Router();

router.post("/add-review", addReview);


export default router;