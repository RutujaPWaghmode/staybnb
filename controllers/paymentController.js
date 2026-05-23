const Razorpay = require("razorpay");
const crypto = require("crypto");
const Booking = require("../models/booking");
const Home = require("../models/home");
const User = require("../models/user");
const emailService = require("../services/emailService");

// Check if Razorpay credentials are configured (not placeholder values)
const isRazorpayConfigured = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  return keyId && keySecret && 
         keyId !== 'rzp_test_yourkeyid' && 
         keySecret !== 'yourkeysecret' &&
         keyId.startsWith('rzp_');
};

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || "rzp_test_yourkeyid",
  key_secret: process.env.RAZORPAY_KEY_SECRET || "yourkeysecret",
});

// GET /payment/:bookingId - Show payment page for a booking
exports.getPaymentPage = async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    const booking = await Booking.findById(bookingId).populate("listingId");

    if (!booking) {
      return res.redirect("/bookings/my");
    }

    // Verify the booking belongs to the current user
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.redirect("/bookings/my");
    }

    // If already paid, redirect to bookings
    if (booking.paymentStatus === "completed") {
      return res.redirect("/bookings/my?success=1");
    }

    res.render("store/payment", {
      booking,
      home: booking.listingId,
      razorpayKeyId: process.env.RAZORPAY_KEY_ID || "rzp_test_yourkeyid",
      isDemoMode: !isRazorpayConfigured(),
      pageTitle: "Complete Payment",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};

// POST /payment/create-order - Create Razorpay order
exports.createOrder = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId).populate("listingId");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Verify ownership
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    // Create Razorpay order (amount in paise - smallest currency unit)
    const options = {
      amount: booking.totalPrice * 100, // Convert to paise
      currency: "INR",
      receipt: `booking_${booking._id}`,
      notes: {
        bookingId: booking._id.toString(),
        userId: booking.userId.toString(),
        listingId: booking.listingId._id.toString(),
      },
    };

    const order = await razorpay.orders.create(options);

    // Save order ID to booking
    booking.razorpayOrderId = order.id;
    await booking.save();

    res.json({
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      bookingId: booking._id,
    });
  } catch (err) {
    console.error("Create order error:", err);
    res.status(500).json({ error: "Failed to create order" });
  }
};

// POST /payment/verify - Verify payment and confirm booking
exports.verifyPayment = async (req, res, next) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature, bookingId } = req.body;

    // Find the booking
    const booking = await Booking.findById(bookingId);
    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // Verify ownership
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Verify the payment signature using HMAC SHA256
    const body = razorpay_order_id + "|" + razorpay_payment_id;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET || "yourkeysecret")
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === razorpay_signature;

    if (isValid) {
      // Payment verified - update booking status
      booking.razorpayPaymentId = razorpay_payment_id;
      booking.razorpaySignature = razorpay_signature;
      booking.paymentStatus = "completed";
      booking.bookingStatus = "confirmed";
      await booking.save();

      // Send email notifications (async, non-blocking)
      try {
        const populatedBooking = await Booking.findById(bookingId)
          .populate("listingId")
          .populate("userId");
        
        const user = populatedBooking.userId;
        const listing = populatedBooking.listingId;
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);
        const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

        // Queue payment success email
        await emailService.queueEmail(emailService.EMAIL_TYPES.PAYMENT_SUCCESS, {
          email: user.email,
          guestName: `${user.firstName} ${user.lastName || ""}`,
          amount: booking.totalPrice,
          paymentId: razorpay_payment_id,
          bookingId: booking._id.toString(),
          propertyName: listing ? listing.houseName : "Property",
        });

        // Queue booking confirmation email
        await emailService.queueEmail(emailService.EMAIL_TYPES.BOOKING_CONFIRMATION, {
          email: user.email,
          guestName: `${user.firstName} ${user.lastName || ""}`,
          bookingId: booking._id.toString(),
          propertyName: listing ? listing.houseName : "Property",
          location: listing ? listing.location : "N/A",
          checkIn: checkIn.toDateString(),
          checkOut: checkOut.toDateString(),
          nights,
          totalPrice: booking.totalPrice,
        });
      } catch (emailError) {
        console.error("Email notification error:", emailError.message);
        // Don't fail the payment verification due to email error
      }

      return res.json({ success: true, message: "Payment verified successfully" });
    } else {
      // Payment verification failed
      booking.paymentStatus = "failed";
      await booking.save();

      return res.status(400).json({ success: false, error: "Payment verification failed" });
    }
  } catch (err) {
    console.error("Verify payment error:", err);
    res.status(500).json({ success: false, error: "Payment verification error" });
  }
};

// POST /payment/cancel/:bookingId - Cancel unpaid booking
exports.cancelBooking = async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;
    const booking = await Booking.findById(bookingId)
      .populate("listingId")
      .populate("userId");

    if (!booking) {
      return res.redirect("/bookings/my");
    }

    // Verify ownership
    if (booking.userId._id.toString() !== req.session.user._id.toString()) {
      return res.redirect("/bookings/my");
    }

    // Only allow cancellation of pending bookings
    if (booking.paymentStatus === "pending") {
      booking.bookingStatus = "cancelled";
      booking.paymentStatus = "failed";
      await booking.save();

      // Send cancellation email
      try {
        const user = booking.userId;
        const listing = booking.listingId;
        const checkIn = new Date(booking.checkInDate);
        const checkOut = new Date(booking.checkOutDate);

        await emailService.queueEmail(emailService.EMAIL_TYPES.BOOKING_CANCELLATION, {
          email: user.email,
          guestName: `${user.firstName} ${user.lastName || ""}`,
          bookingId: booking._id.toString(),
          propertyName: listing ? listing.houseName : "Property",
          checkIn: checkIn.toDateString(),
          checkOut: checkOut.toDateString(),
          totalPrice: booking.totalPrice,
        });
      } catch (emailError) {
        console.error("Cancellation email error:", emailError.message);
      }
    }

    res.redirect("/bookings/my");
  } catch (err) {
    next(err);
  }
};

// POST /payment/demo - Complete payment in demo mode (no real payment)
exports.demoPayment = async (req, res, next) => {
  try {
    const { bookingId } = req.body;
    const booking = await Booking.findById(bookingId)
      .populate("listingId")
      .populate("userId");

    if (!booking) {
      return res.status(404).json({ success: false, error: "Booking not found" });
    }

    // Verify ownership
    if (booking.userId._id.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Unauthorized" });
    }

    // Only allow demo payment for pending bookings
    if (booking.paymentStatus !== "pending") {
      return res.status(400).json({ success: false, error: "Booking is not pending payment" });
    }

    // Mark as paid (demo mode)
    booking.razorpayPaymentId = `demo_${Date.now()}`;
    booking.paymentStatus = "completed";
    booking.bookingStatus = "confirmed";
    await booking.save();

    // Send confirmation emails
    try {
      const user = booking.userId;
      const listing = booking.listingId;
      const checkIn = new Date(booking.checkInDate);
      const checkOut = new Date(booking.checkOutDate);
      const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

      await emailService.queueEmail(emailService.EMAIL_TYPES.BOOKING_CONFIRMATION, {
        email: user.email,
        guestName: `${user.firstName} ${user.lastName || ""}`,
        bookingId: booking._id.toString(),
        propertyName: listing ? listing.houseName : "Property",
        location: listing ? listing.location : "N/A",
        checkIn: checkIn.toDateString(),
        checkOut: checkOut.toDateString(),
        nights,
        totalPrice: booking.totalPrice,
      });
    } catch (emailError) {
      console.error("Demo payment email error:", emailError.message);
    }

    return res.json({ success: true, message: "Demo payment completed successfully" });
  } catch (err) {
    console.error("Demo payment error:", err);
    res.status(500).json({ success: false, error: "Demo payment failed" });
  }
};
