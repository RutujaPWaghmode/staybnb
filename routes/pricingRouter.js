/**
 * PRICING ROUTES
 * ==============
 * 
 * Routes for managing dynamic pricing rules.
 * 
 * Admin/Host Routes:
 * - GET  /pricing/rules         - List all pricing rules
 * - GET  /pricing/rules/new     - Show create rule form
 * - POST /pricing/rules         - Create new rule
 * - GET  /pricing/rules/:id/edit - Show edit rule form
 * - POST /pricing/rules/:id     - Update rule
 * - POST /pricing/rules/:id/toggle - Toggle rule active status
 * - POST /pricing/rules/:id/delete - Delete rule
 * - POST /pricing/seed          - Seed default rules
 * 
 * API Routes:
 * - GET  /api/pricing/calculate - Calculate price for dates
 * - GET  /api/pricing/preview/:listingId - Get 7-day price preview
 * - GET  /api/pricing/rules     - Get all active rules
 */

const express = require("express");
const pricingController = require("../controllers/pricingController");

const router = express.Router();

// Middleware to check if user is logged in (for admin routes)
const isAuth = (req, res, next) => {
  if (!req.session.user) {
    return res.redirect("/login");
  }
  next();
};

// Admin/Host Routes - Require authentication
router.get("/rules", isAuth, pricingController.getAllRules);
router.get("/rules/new", isAuth, pricingController.getNewRuleForm);
router.post("/rules", isAuth, pricingController.postCreateRule);
router.get("/rules/:id/edit", isAuth, pricingController.getEditRuleForm);
router.post("/rules/:id", isAuth, pricingController.postUpdateRule);
router.post("/rules/:id/toggle", isAuth, pricingController.postToggleRule);
router.post("/rules/:id/delete", isAuth, pricingController.postDeleteRule);
router.post("/seed", isAuth, pricingController.postSeedRules);

module.exports = router;
