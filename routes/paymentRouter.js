const express = require("express");
const paymentRouter = express.Router();

const paymentController = require("../controllers/paymentController");

// Auth guard - all payment routes require a logged-in user
const requireLogin = (req, res, next) => {
  if (!req.isLoggedIn) {
    return res.redirect("/login");
  }
  next();
};

// GET payment page for a booking
paymentRouter.get("/:bookingId", requireLogin, paymentController.getPaymentPage);

// POST create Razorpay order
paymentRouter.post("/create-order", requireLogin, paymentController.createOrder);

// POST verify payment after completion
paymentRouter.post("/verify", requireLogin, paymentController.verifyPayment);

// POST cancel unpaid booking
paymentRouter.post("/cancel/:bookingId", requireLogin, paymentController.cancelBooking);

module.exports = paymentRouter;
