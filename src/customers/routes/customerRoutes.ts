import express from "express";
import { filterHotelRoomsByPricePerNightRatings, filterHotelsByCityAndCountry, getBookingsHistoryForCustomer } from "../controllers/customerController";






const router = express.Router();
router.get("/filter-hotels-by-city-and-country",filterHotelsByCityAndCountry);
router.get("/get-bookings-history/:customerId",getBookingsHistoryForCustomer);
router.get("/filter-hotel-rooms-by-price-per-night",filterHotelRoomsByPricePerNightRatings);
export default router;