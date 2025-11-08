import express from "express";
import errorHandler from "./middleware/errorHandler";

import hotelRoutes from "./admin/routes/hotelRoutes";
import bookingRoutes from "./customers/routes/bookingRoutes";
import reviewRoutes from "./customers/routes/reviewRoutes";
import maintenanceRoutes from "./employees/routes/maintenanceRoutes";

const app=express();
app.use(express.json());
app.use(express.urlencoded({ extended: true })); // to handle form data (not files)


app.use("/api/hotel", hotelRoutes);
app.use("/api/booking", bookingRoutes);
app.use("/api/review", reviewRoutes);
app.use("/api/maintenance", maintenanceRoutes);

app.use(errorHandler);
app.listen(3000,()=>{

    console.log("server is running on port 3000");
})