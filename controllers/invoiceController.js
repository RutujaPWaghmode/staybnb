const Booking = require("../models/booking");
const invoiceService = require("../services/invoiceService");

/**
 * GET /invoice/:bookingId - Download PDF invoice for a booking
 */
exports.downloadInvoice = async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;

    // Find booking with populated references
    const booking = await Booking.findById(bookingId)
      .populate("listingId")
      .populate("userId");

    if (!booking) {
      return res.status(404).send("Booking not found");
    }

    // Verify the booking belongs to the current user
    if (booking.userId._id.toString() !== req.session.user._id.toString()) {
      return res.status(403).send("Unauthorized");
    }

    // Only allow invoice download for confirmed/completed bookings with completed payment
    if (booking.paymentStatus !== "completed") {
      return res.status(400).send("Invoice available only after successful payment");
    }

    // Generate and stream PDF
    invoiceService.generateInvoicePDF(booking, res);
  } catch (err) {
    console.error("Download invoice error:", err);
    next(err);
  }
};

/**
 * GET /invoice/data/:bookingId - Get invoice data as JSON (for API use)
 */
exports.getInvoiceData = async (req, res, next) => {
  try {
    const bookingId = req.params.bookingId;

    const booking = await Booking.findById(bookingId)
      .populate("listingId")
      .populate("userId");

    if (!booking) {
      return res.status(404).json({ error: "Booking not found" });
    }

    // Verify ownership
    if (booking.userId._id.toString() !== req.session.user._id.toString()) {
      return res.status(403).json({ error: "Unauthorized" });
    }

    const invoiceData = invoiceService.getInvoiceData(booking);
    res.json(invoiceData);
  } catch (err) {
    console.error("Get invoice data error:", err);
    next(err);
  }
};
