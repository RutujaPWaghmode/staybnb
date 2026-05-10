const Booking = require("../models/booking");
const Home = require("../models/home");
const User = require("../models/user");
const emailService = require("../services/emailService");
const pricingEngine = require("../services/pricingEngine");

// Helper: parse YYYY-MM-DD string to a Date at midnight UTC.
// Returns null if invalid.
const parseDate = (value) => {
  if (!value) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
};

// Helper: today at 00:00 (local) for past-date checks.
const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

// Helper: number of nights between two dates (>=1).
const nightsBetween = (start, end) => {
  const ms = end.getTime() - start.getTime();
  return Math.ceil(ms / (1000 * 60 * 60 * 24));
};

// Core overlap check. Two ranges [aIn, aOut) and [bIn, bOut) overlap if
// aIn < bOut AND aOut > bIn. We only consider 'confirmed' bookings as blocking.
const findOverlappingBooking = async (listingId, checkIn, checkOut) => {
  return Booking.findOne({
    listingId,
    bookingStatus: "confirmed",
    checkInDate: { $lt: checkOut },
    checkOutDate: { $gt: checkIn },
  });
};

// GET /bookings/new/:homeId  - render the booking form for a specific listing.
exports.getBookingForm = async (req, res, next) => {
  try {
    const home = await Home.findById(req.params.homeId);
    if (!home) {
      return res.redirect("/homes");
    }
    res.render("store/reserve", {
      home,
      pageTitle: `Book ${home.houseName}`,
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      errors: [],
      oldInput: { checkInDate: "", checkOutDate: "" },
      successMessage: null,
    });
  } catch (err) {
    next(err);
  }
};

// POST /bookings/create  - validate input, check overlap, save booking.
exports.postCreateBooking = async (req, res, next) => {
  const { listingId, checkInDate, checkOutDate } = req.body;
  
  // Check if user is logged in
  if (!req.session.user) {
    return res.redirect("/login");
  }
  
  const userId = req.session.user._id;

  try {
    const home = await Home.findById(listingId);
    if (!home) {
      return res.redirect("/homes");
    }

    const errors = [];
    const checkIn = parseDate(checkInDate);
    const checkOut = parseDate(checkOutDate);

    // Validation: presence + parsability
    if (!checkIn || !checkOut) {
      errors.push("Please provide valid check-in and check-out dates");
    } else {
      // Validation: dates cannot be in the past
      if (checkIn < startOfToday()) {
        errors.push("Check-in date cannot be in the past");
      }
      // Validation: check-out must be strictly after check-in
      if (checkOut <= checkIn) {
        errors.push("Check-out date must be after check-in date");
      }
    }

    // If validation passed, check for overlapping confirmed bookings
    if (errors.length === 0) {
      const overlap = await findOverlappingBooking(listingId, checkIn, checkOut);
      if (overlap) {
        errors.push("Property is unavailable for selected dates");
      }
    }

    if (errors.length > 0) {
      // Redirect back to home detail page with error message
      const errorMsg = encodeURIComponent(errors[0]);
      return res.redirect(`/homes/${listingId}?error=${errorMsg}`);
    }

    // Compute total price using dynamic pricing engine
    const nights = nightsBetween(checkIn, checkOut);
    const pricingDetails = await pricingEngine.calculatePrice(
      home.price,
      checkIn,
      checkOut,
      listingId
    );
    const totalPrice = pricingDetails.totalPrice;
    const originalPrice = pricingDetails.originalTotal;
    const appliedPricingRules = pricingDetails.appliedRules;

    // Check if payment is enabled
    const paymentEnabled = process.env.PAYMENT_ENABLED === 'true';

    // Persist booking - status depends on whether payment is required
    const booking = new Booking({
      userId,
      listingId,
      checkInDate: checkIn,
      checkOutDate: checkOut,
      totalPrice,
      originalPrice,
      appliedPricingRules,
      pricePerNight: pricingDetails.averagePricePerNight,
      bookingStatus: paymentEnabled ? "pending" : "confirmed",
      paymentStatus: paymentEnabled ? "pending" : "completed",
    });
    await booking.save();

    // Log dynamic pricing applied
    if (appliedPricingRules.length > 0) {
      console.log(`Dynamic pricing applied for booking ${booking._id}:`);
      console.log(`  Original price: ₹${originalPrice}, Final price: ₹${totalPrice}`);
      console.log(`  Rules applied: ${appliedPricingRules.join(", ")}`);
    }

    // If payment is disabled, directly confirm and send confirmation email
    if (!paymentEnabled) {
      // Get user details for email
      const user = await User.findById(userId);
      
      // Send booking confirmation email
      const nights = nightsBetween(checkIn, checkOut);
      try {
        await emailService.queueEmail(emailService.EMAIL_TYPES.BOOKING_CONFIRMATION, {
          email: user.email,
          guestName: user.name || user.email,
          propertyName: home.houseName,
          location: home.location || "Location not specified",
          bookingId: booking._id.toString(),
          checkIn: checkIn.toLocaleDateString("en-IN", { dateStyle: "long" }),
          checkOut: checkOut.toLocaleDateString("en-IN", { dateStyle: "long" }),
          nights: nights,
          totalPrice: totalPrice,
        });
        console.log(`Booking confirmation email queued for ${user.email}`);
      } catch (emailErr) {
        console.error("Failed to queue confirmation email:", emailErr.message);
        // Don't fail the booking if email fails
      }
      
      return res.redirect("/bookings/my?success=1");
    }

    // Redirect to payment page to complete the booking
    return res.redirect(`/payment/${booking._id}`);
  } catch (err) {
    next(err);
  }
};

// GET /bookings/my  - list all bookings for the logged-in user.
exports.getMyBookings = async (req, res, next) => {
  try {
    const userId = req.session.user._id;
    const bookings = await Booking.find({ userId })
      .populate("listingId")
      .sort({ createdAt: -1 });

    let successMessage = null;
    if (req.query.success) {
      successMessage = "Booking confirmed successfully!";
    } else if (req.query.cancelled) {
      successMessage = null; // Handled separately in view
    }

    res.render("store/bookings", {
      bookings,
      pageTitle: "My Bookings",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      successMessage,
      cancelled: req.query.cancelled || false,
    });
  } catch (err) {
    next(err);
  }
};

// GET /bookings/:id  - show single booking details (only owner can view).
exports.getBookingDetails = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("listingId");
    if (!booking) {
      return res.redirect("/bookings/my");
    }
    // Authorization: ensure the booking belongs to the requesting user
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.redirect("/bookings/my");
    }
    res.render("store/booking-detail", {
      booking,
      pageTitle: "Booking Details",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};

// Exported for use by store controller (home-detail page) to compute availability.
exports.findOverlappingBooking = findOverlappingBooking;

// Helper: returns true if listing has any active future bookings (used to display
// a generic "currently has bookings" indicator on the detail page).
exports.getUpcomingBookingsForHome = async (listingId) => {
  return Booking.find({
    listingId,
    bookingStatus: "confirmed",
    checkOutDate: { $gte: startOfToday() },
  }).select("checkInDate checkOutDate");
};

// GET /bookings/:id/cancel - Show cancellation confirmation page
exports.getCancelBooking = async (req, res, next) => {
  try {
    const booking = await Booking.findById(req.params.id).populate("listingId");
    
    if (!booking) {
      return res.redirect("/bookings/my");
    }

    // Authorization: ensure the booking belongs to the requesting user
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.redirect("/bookings/my");
    }

    // Check if cancellation is allowed
    const { canCancel, reason } = booking.canCancel();
    if (!canCancel) {
      return res.redirect(`/bookings/${booking._id}?error=${encodeURIComponent(reason)}`);
    }

    // Calculate potential refund
    const refundInfo = booking.calculateRefund();
    const { CANCELLATION_POLICIES } = require("../models/booking");
    const policy = CANCELLATION_POLICIES[booking.cancellationPolicy];

    res.render("store/cancel-booking", {
      booking,
      home: booking.listingId,
      refundInfo,
      policy,
      pageTitle: "Cancel Booking",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};

// POST /bookings/:id/cancel - Process booking cancellation
exports.postCancelBooking = async (req, res, next) => {
  try {
    const { reason } = req.body;
    const booking = await Booking.findById(req.params.id).populate("listingId");
    
    if (!booking) {
      return res.redirect("/bookings/my");
    }

    // Authorization: ensure the booking belongs to the requesting user
    if (booking.userId.toString() !== req.session.user._id.toString()) {
      return res.redirect("/bookings/my");
    }

    // Check if cancellation is allowed
    const { canCancel, reason: cancelReason } = booking.canCancel();
    if (!canCancel) {
      return res.redirect(`/bookings/${booking._id}?error=${encodeURIComponent(cancelReason)}`);
    }

    // Calculate refund amount
    const refundInfo = booking.calculateRefund();

    // Update booking status
    booking.bookingStatus = "cancelled";
    booking.cancelledAt = new Date();
    booking.cancellationReason = reason || "No reason provided";
    booking.refundAmount = refundInfo.refundAmount;
    
    // Update refund status based on payment
    if (booking.paymentStatus === "completed" && refundInfo.refundAmount > 0) {
      booking.refundStatus = "pending"; // Would be processed by payment gateway
      booking.paymentStatus = "refunded";
    }

    await booking.save();

    // Send cancellation email
    const user = await User.findById(booking.userId);
    try {
      await emailService.queueEmail(emailService.EMAIL_TYPES.BOOKING_CANCELLATION, {
        email: user.email,
        guestName: user.name || user.email,
        propertyName: booking.listingId.houseName,
        bookingId: booking._id.toString(),
        checkIn: booking.checkInDate.toLocaleDateString("en-IN", { dateStyle: "long" }),
        checkOut: booking.checkOutDate.toLocaleDateString("en-IN", { dateStyle: "long" }),
        totalPrice: booking.totalPrice,
        refundAmount: refundInfo.refundAmount,
        refundPercent: refundInfo.refundPercent,
        cancellationReason: booking.cancellationReason,
      });
      console.log(`Cancellation email queued for ${user.email}`);
    } catch (emailErr) {
      console.error("Failed to queue cancellation email:", emailErr.message);
    }

    // Redirect with success message
    res.redirect("/bookings/my?cancelled=1");
  } catch (err) {
    next(err);
  }
};

// GET /bookings/policy - Show cancellation policy information
exports.getCancellationPolicy = async (req, res, next) => {
  try {
    const { CANCELLATION_POLICIES } = require("../models/booking");
    
    res.render("store/cancellation-policy", {
      policies: CANCELLATION_POLICIES,
      pageTitle: "Cancellation Policy",
      currentPage: "bookings",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};
