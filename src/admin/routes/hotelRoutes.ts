import express from "express";
import { addHotel, getAllHotelsWithRooms, filterHotelsByRoomsAvailability, updateHotel, filterHotelsByRatings, filterHotelsByCityAndCountry } from "../controllers/hotelController";



const router = express.Router();

router.post("/add-hotel", addHotel);
router.put("/update-hotel", updateHotel);
router.get("/get-all-hotels", getAllHotelsWithRooms);
router.get("/filter-hotel-rooms-by-availability", filterHotelsByRoomsAvailability); 
router.get("/filter-hotel-by-ratings", filterHotelsByRatings);
router.get("/filter-hotels-by-city-and-country", filterHotelsByCityAndCountry);
export default router;