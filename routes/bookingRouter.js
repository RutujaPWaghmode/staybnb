const express = require("express");
const bookingRouter = express.Router();

const bookingController = require("../controllers/bookingController");

// Auth guard - all booking routes require a logged-in user.
const requireLogin = (req, res, next) => {
  if (!req.isLoggedIn) {
    return res.redirect("/login");
  }
  next();
};

bookingRouter.get("/new/:homeId", requireLogin, bookingController.getBookingForm);
bookingRouter.post("/create", requireLogin, bookingController.postCreateBooking);
bookingRouter.get("/my", requireLogin, bookingController.getMyBookings);
bookingRouter.get("/policy", bookingController.getCancellationPolicy);
bookingRouter.get("/:id/cancel", requireLogin, bookingController.getCancelBooking);
bookingRouter.post("/:id/cancel", requireLogin, bookingController.postCancelBooking);
bookingRouter.get("/:id", requireLogin, bookingController.getBookingDetails);

module.exports = bookingRouter;
