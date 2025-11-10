import express from "express";
import { addHotel, getAllHotelsWithRooms, updateHotel,filterHotels} from "../controllers/hotelController";



const router = express.Router();

router.post("/add-hotel", addHotel);
router.put("/update-hotel", updateHotel);
router.get("/get-all-hotels", getAllHotelsWithRooms);
// router.get("/filter-hotel-rooms-by-availability", filterHotelsByRoomsAvailability); 
// router.get("/filter-hotel-by-ratings", filterHotelsByRatings);
router.get("/filter-hotels", 
    filterHotels);
// router.get("/filter-hotels-by-booking-count", filterHotelsByBookingCount);
export default router;