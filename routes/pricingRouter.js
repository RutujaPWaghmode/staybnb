/**
 * PRICING ROUTES (SIMPLIFIED)
 * ============================
 * 
 * Routes for viewing dynamic pricing rules.
 * Rules are automatically managed - no add/edit/delete needed.
 * 
 * Routes:
 * - GET  /pricing/rules - View all pricing rules with status
 * 
 * API Routes (defined in app.js):
 * - GET  /api/pricing/calculate - Calculate price for dates
 * - GET  /api/pricing/preview/:listingId - Get 7-day price preview
 * - GET  /api/pricing/rules - Get all rules with status
 */

const express = require("express");
const pricingController = require("../controllers/simplePricingController");

const router = express.Router();

// Middleware to check if user is logged in
const isAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// View pricing rules (read-only)
router.get("/rules", isAuth, pricingController.getAllRules);

module.exports = router;
