/**
 * SIMPLIFIED PRICING CONTROLLER
 * ==============================
 * 
 * Handles dynamic pricing display and API endpoints.
 * 
 * Features:
 * - View active pricing rules (read-only)
 * - Get price preview for specific dates
 * - API for calculating dynamic prices
 * 
 * NOTE: Rules are fixed and auto-activate based on date conditions.
 *       No add/edit/delete functionality - rules are managed in simplePricingEngine.js
 */

const Home = require("../models/home");
const pricingEngine = require("../services/simplePricingEngine");

/**
 * GET /pricing/rules - Display all pricing rules with their current status
 */
exports.getAllRules = async (req, res, next) => {
  try {
    const rules = pricingEngine.getAllRulesWithStatus();
    const activeRules = pricingEngine.getTodaysActiveRules();

    res.render("host/pricing-rules", {
      rules,
      activeRules,
      pageTitle: "Dynamic Pricing Rules",
      currentPage: "pricing",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/calculate - Calculate price for given dates (API)
 * Query params: listingId, checkIn (YYYY-MM-DD), checkOut (YYYY-MM-DD)
 */
exports.apiCalculatePrice = async (req, res, next) => {
  try {
    const { listingId, checkIn, checkOut } = req.query;

    if (!listingId || !checkIn || !checkOut) {
      return res.status(400).json({
        error: "Missing required parameters: listingId, checkIn, checkOut",
      });
    }

    const home = await Home.findById(listingId);
    if (!home) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const checkInDate = new Date(checkIn);
    const checkOutDate = new Date(checkOut);

    if (isNaN(checkInDate.getTime()) || isNaN(checkOutDate.getTime())) {
      return res.status(400).json({ error: "Invalid date format" });
    }

    const pricing = pricingEngine.calculatePrice(
      home.price,
      checkInDate,
      checkOutDate
    );

    res.json({
      listingId,
      listingName: home.houseName,
      checkIn: checkIn,
      checkOut: checkOut,
      basePrice: home.price,
      ...pricing,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/preview/:listingId - Get pricing preview for next 7 days
 */
exports.apiPricingPreview = async (req, res, next) => {
  try {
    const home = await Home.findById(req.params.listingId);
    if (!home) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const today = new Date();
    const preview = [];

    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);

      const { multiplier, appliedRules } = pricingEngine.calculateDateMultiplier(date);
      const dynamicPrice = Math.round(home.price * multiplier);

      preview.push({
        date: date.toISOString().split("T")[0],
        dayOfWeek: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][date.getDay()],
        basePrice: home.price,
        dynamicPrice,
        multiplier,
        appliedRules: appliedRules.map(r => ({
          type: r.type,
          name: r.name,
          adjustment: r.displayAdjustment,
        })),
      });
    }

    res.json({
      listingId: home._id,
      listingName: home.houseName,
      basePrice: home.price,
      preview,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/rules - Get all pricing rules (API)
 */
exports.apiGetRules = async (req, res, next) => {
  try {
    const rules = pricingEngine.getAllRulesWithStatus();
    const activeToday = pricingEngine.getTodaysActiveRules();

    res.json({
      rules,
      activeToday: activeToday.map(r => r.type),
      date: new Date().toISOString().split("T")[0],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/active - Get only currently active rules (API)
 */
exports.apiGetActiveRules = async (req, res, next) => {
  try {
    const activeRules = pricingEngine.getTodaysActiveRules();

    res.json({
      date: new Date().toISOString().split("T")[0],
      activeRules,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * Calculate and return pricing for a booking
 * Used internally by other controllers
 */
exports.calculateBookingPrice = (basePrice, checkIn, checkOut) => {
  return pricingEngine.calculatePrice(basePrice, checkIn, checkOut);
};

/**
 * Get active rules for displaying on homepage/listings
 */
exports.getActiveRulesForDisplay = () => {
  return pricingEngine.getTodaysActiveRules();
};
