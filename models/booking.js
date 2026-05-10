const mongoose = require("mongoose");

// Cancellation policy configuration
// Free cancellation: Full refund if cancelled more than 48 hours before check-in
// Partial refund: 50% refund if cancelled 24-48 hours before check-in
// No refund: No refund if cancelled less than 24 hours before check-in
const CANCELLATION_POLICIES = {
  FLEXIBLE: {
    name: "Flexible",
    fullRefundHours: 24, // Full refund if cancelled 24+ hours before check-in
    partialRefundHours: 0,
    partialRefundPercent: 0,
    description: "Full refund if cancelled at least 24 hours before check-in"
  },
  MODERATE: {
    name: "Moderate",
    fullRefundHours: 48, // Full refund if cancelled 48+ hours before check-in
    partialRefundHours: 24, // 50% refund if cancelled 24-48 hours before
    partialRefundPercent: 50,
    description: "Full refund 48+ hours before check-in, 50% refund 24-48 hours before"
  },
  STRICT: {
    name: "Strict",
    fullRefundHours: 168, // Full refund if cancelled 7+ days before check-in
    partialRefundHours: 48, // 50% refund if cancelled 48 hours - 7 days before
    partialRefundPercent: 50,
    description: "Full refund 7+ days before check-in, 50% refund 48 hours to 7 days before"
  }
};

// Booking schema captures a reservation made by a user for a home/listing.
// It stores the date range, computed total price and current status.
const bookingSchema = mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true,
  },
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Home",
    required: true,
    index: true,
  },
  checkInDate: {
    type: Date,
    required: true,
  },
  checkOutDate: {
    type: Date,
    required: true,
  },
  totalPrice: {
    type: Number,
    required: true,
  },
  // Dynamic Pricing fields
  originalPrice: {
    type: Number,
    default: 0,  // Base price without dynamic adjustments
  },
  appliedPricingRules: [{
    type: String,  // Names of pricing rules that were applied
  }],
  pricePerNight: {
    type: Number,  // Average price per night after adjustments
  },
  bookingStatus: {
    type: String,
    enum: ["pending", "confirmed", "cancelled", "completed"],
    default: "pending",
  },
  // Payment related fields
  paymentStatus: {
    type: String,
    enum: ["pending", "completed", "failed", "refunded"],
    default: "pending",
  },
  razorpayOrderId: {
    type: String,
  },
  razorpayPaymentId: {
    type: String,
  },
  razorpaySignature: {
    type: String,
  },
  // Cancellation related fields
  cancellationPolicy: {
    type: String,
    enum: ["FLEXIBLE", "MODERATE", "STRICT"],
    default: "MODERATE",
  },
  cancelledAt: {
    type: Date,
  },
  cancellationReason: {
    type: String,
  },
  refundAmount: {
    type: Number,
    default: 0,
  },
  refundStatus: {
    type: String,
    enum: ["none", "pending", "processed", "failed"],
    default: "none",
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound index to speed up overlap queries by listing + dates.
bookingSchema.index({ listingId: 1, checkInDate: 1, checkOutDate: 1 });

// Static method to get cancellation policies
bookingSchema.statics.getCancellationPolicies = function() {
  return CANCELLATION_POLICIES;
};

// Instance method to calculate refund based on cancellation policy
bookingSchema.methods.calculateRefund = function() {
  const policy = CANCELLATION_POLICIES[this.cancellationPolicy] || CANCELLATION_POLICIES.MODERATE;
  const now = new Date();
  const checkIn = new Date(this.checkInDate);
  const hoursUntilCheckIn = (checkIn.getTime() - now.getTime()) / (1000 * 60 * 60);

  // Cannot cancel if check-in has already passed
  if (hoursUntilCheckIn <= 0) {
    return { refundAmount: 0, refundPercent: 0, message: "Cannot cancel after check-in date" };
  }

  // Full refund
  if (hoursUntilCheckIn >= policy.fullRefundHours) {
    return {
      refundAmount: this.totalPrice,
      refundPercent: 100,
      message: `Full refund (cancelled ${Math.floor(hoursUntilCheckIn)} hours before check-in)`
    };
  }

  // Partial refund
  if (policy.partialRefundHours > 0 && hoursUntilCheckIn >= policy.partialRefundHours) {
    const refundAmount = Math.floor(this.totalPrice * (policy.partialRefundPercent / 100));
    return {
      refundAmount,
      refundPercent: policy.partialRefundPercent,
      message: `${policy.partialRefundPercent}% refund (cancelled ${Math.floor(hoursUntilCheckIn)} hours before check-in)`
    };
  }

  // No refund
  return {
    refundAmount: 0,
    refundPercent: 0,
    message: "No refund (cancelled too close to check-in date)"
  };
};

// Instance method to check if booking can be cancelled
bookingSchema.methods.canCancel = function() {
  // Can only cancel confirmed or pending bookings
  if (!["confirmed", "pending"].includes(this.bookingStatus)) {
    return { canCancel: false, reason: "Booking is already cancelled or completed" };
  }
  
  // Cannot cancel if check-in date has passed
  const now = new Date();
  const checkIn = new Date(this.checkInDate);
  if (now >= checkIn) {
    return { canCancel: false, reason: "Cannot cancel after check-in date" };
  }

  return { canCancel: true, reason: null };
};

module.exports = mongoose.model("Booking", bookingSchema);
module.exports.CANCELLATION_POLICIES = CANCELLATION_POLICIES;
