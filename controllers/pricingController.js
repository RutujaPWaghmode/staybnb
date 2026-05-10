/**
 * PRICING CONTROLLER
 * ==================
 * 
 * Handles dynamic pricing rule management and price calculation APIs.
 * 
 * Features:
 * - View all pricing rules (admin/host)
 * - Create/update/delete pricing rules
 * - Get price preview for specific dates
 * - Seed default pricing rules
 */

const PricingRule = require("../models/pricingRule");
const Home = require("../models/home");
const pricingEngine = require("../services/pricingEngine");

/**
 * GET /pricing/rules - List all pricing rules
 */
exports.getAllRules = async (req, res, next) => {
  try {
    const rules = await PricingRule.find().sort({ priority: -1, createdAt: -1 });
    const formattedRules = rules.map(rule => ({
      id: rule._id,
      name: rule.name,
      description: rule.description,
      type: rule.ruleType,
      scope: rule.scope,
      adjustmentType: rule.adjustmentType,
      adjustmentValue: rule.adjustmentValue,
      displayAdjustment: rule.adjustmentType === "PERCENTAGE"
        ? `${Math.round((rule.adjustmentValue - 1) * 100)}%`
        : `₹${rule.adjustmentValue}`,
      priority: rule.priority,
      stackable: rule.stackable,
      isActive: rule.isActive,
      createdAt: rule.createdAt,
    }));

    res.render("host/pricing-rules", {
      rules: formattedRules,
      pageTitle: "Dynamic Pricing Rules",
      currentPage: "pricing",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      successMessage: req.query.success ? "Rule updated successfully!" : null,
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /pricing/rules/new - Show form to create new rule
 */
exports.getNewRuleForm = async (req, res, next) => {
  try {
    const homes = await Home.find({ userId: req.session.user._id }).select("houseName _id");
    
    res.render("host/pricing-rule-form", {
      rule: null,
      homes,
      ruleTypes: ["WEEKEND", "HOLIDAY", "SEASONAL", "CUSTOM", "LAST_MINUTE", "EARLY_BIRD"],
      pageTitle: "Create Pricing Rule",
      currentPage: "pricing",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      errors: [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pricing/rules - Create new pricing rule
 */
exports.postCreateRule = async (req, res, next) => {
  try {
    const {
      name,
      description,
      ruleType,
      scope,
      listingId,
      adjustmentType,
      adjustmentValue,
      priority,
      stackable,
      daysOfWeek,
      startDate,
      endDate,
      recurring,
      daysBeforeCheckIn,
      daysInAdvance,
    } = req.body;

    // Convert percentage input (e.g., 15 for 15%) to multiplier (1.15)
    let processedValue = parseFloat(adjustmentValue);
    if (adjustmentType === "PERCENTAGE") {
      processedValue = 1 + (processedValue / 100);
    }

    const rule = new PricingRule({
      name,
      description,
      ruleType,
      scope: scope || "GLOBAL",
      listingId: scope === "LISTING" ? listingId : undefined,
      adjustmentType: adjustmentType || "PERCENTAGE",
      adjustmentValue: processedValue,
      priority: parseInt(priority) || 10,
      stackable: stackable === "on" || stackable === true,
      daysOfWeek: daysOfWeek ? daysOfWeek.map(Number) : undefined,
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      recurring: recurring === "on" || recurring === true,
      daysBeforeCheckIn: daysBeforeCheckIn ? parseInt(daysBeforeCheckIn) : undefined,
      daysInAdvance: daysInAdvance ? parseInt(daysInAdvance) : undefined,
      isActive: true,
    });

    await rule.save();
    pricingEngine.clearCache();

    res.redirect("/pricing/rules?success=1");
  } catch (err) {
    next(err);
  }
};

/**
 * GET /pricing/rules/:id/edit - Show edit form for a rule
 */
exports.getEditRuleForm = async (req, res, next) => {
  try {
    const rule = await PricingRule.findById(req.params.id);
    if (!rule) {
      return res.redirect("/pricing/rules");
    }

    const homes = await Home.find({ userId: req.session.user._id }).select("houseName _id");

    res.render("host/pricing-rule-form", {
      rule: {
        ...rule.toObject(),
        displayAdjustment: rule.adjustmentType === "PERCENTAGE"
          ? Math.round((rule.adjustmentValue - 1) * 100)
          : rule.adjustmentValue,
      },
      homes,
      ruleTypes: ["WEEKEND", "HOLIDAY", "SEASONAL", "CUSTOM", "LAST_MINUTE", "EARLY_BIRD"],
      pageTitle: "Edit Pricing Rule",
      currentPage: "pricing",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      errors: [],
    });
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pricing/rules/:id - Update pricing rule
 */
exports.postUpdateRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findById(req.params.id);
    if (!rule) {
      return res.redirect("/pricing/rules");
    }

    const {
      name,
      description,
      ruleType,
      scope,
      listingId,
      adjustmentType,
      adjustmentValue,
      priority,
      stackable,
      isActive,
      daysOfWeek,
      startDate,
      endDate,
      recurring,
      daysBeforeCheckIn,
      daysInAdvance,
    } = req.body;

    // Convert percentage input to multiplier
    let processedValue = parseFloat(adjustmentValue);
    if (adjustmentType === "PERCENTAGE") {
      processedValue = 1 + (processedValue / 100);
    }

    rule.name = name;
    rule.description = description;
    rule.ruleType = ruleType;
    rule.scope = scope || "GLOBAL";
    rule.listingId = scope === "LISTING" ? listingId : undefined;
    rule.adjustmentType = adjustmentType || "PERCENTAGE";
    rule.adjustmentValue = processedValue;
    rule.priority = parseInt(priority) || 10;
    rule.stackable = stackable === "on" || stackable === true;
    rule.isActive = isActive === "on" || isActive === true;
    rule.daysOfWeek = daysOfWeek ? daysOfWeek.map(Number) : undefined;
    rule.startDate = startDate || undefined;
    rule.endDate = endDate || undefined;
    rule.recurring = recurring === "on" || recurring === true;
    rule.daysBeforeCheckIn = daysBeforeCheckIn ? parseInt(daysBeforeCheckIn) : undefined;
    rule.daysInAdvance = daysInAdvance ? parseInt(daysInAdvance) : undefined;

    await rule.save();
    pricingEngine.clearCache();

    res.redirect("/pricing/rules?success=1");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pricing/rules/:id/toggle - Toggle rule active status
 */
exports.postToggleRule = async (req, res, next) => {
  try {
    const rule = await PricingRule.findById(req.params.id);
    if (rule) {
      rule.isActive = !rule.isActive;
      await rule.save();
      pricingEngine.clearCache();
    }
    res.redirect("/pricing/rules?success=1");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pricing/rules/:id/delete - Delete a pricing rule
 */
exports.postDeleteRule = async (req, res, next) => {
  try {
    await PricingRule.findByIdAndDelete(req.params.id);
    pricingEngine.clearCache();
    res.redirect("/pricing/rules?success=1");
  } catch (err) {
    next(err);
  }
};

/**
 * POST /pricing/seed - Seed default pricing rules
 */
exports.postSeedRules = async (req, res, next) => {
  try {
    await PricingRule.seedDefaultRules();
    pricingEngine.clearCache();
    res.redirect("/pricing/rules?success=1");
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

    const pricing = await pricingEngine.calculatePrice(
      home.price,
      checkInDate,
      checkOutDate,
      listingId
    );

    res.json({
      success: true,
      pricing: {
        basePrice: home.price,
        nights: pricing.nights,
        originalTotal: pricing.originalTotal,
        dynamicTotal: pricing.totalPrice,
        savings: pricing.savings,
        savingsPercent: pricing.savingsPercent,
        averagePricePerNight: pricing.averagePricePerNight,
        appliedRules: pricing.appliedRules,
        dailyBreakdown: pricing.dailyPrices.map(d => ({
          date: d.date.toISOString().split("T")[0],
          basePrice: d.basePrice,
          finalPrice: d.finalPrice,
          multiplier: d.multiplier,
          rules: d.breakdown.map(b => b.name),
        })),
      },
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/preview/:listingId - Get 7-day pricing preview
 */
exports.apiPricingPreview = async (req, res, next) => {
  try {
    const home = await Home.findById(req.params.listingId);
    if (!home) {
      return res.status(404).json({ error: "Listing not found" });
    }

    const preview = await pricingEngine.getPricingPreview(home.price, home._id.toString());

    res.json({
      success: true,
      listingId: home._id,
      houseName: home.houseName,
      basePrice: home.price,
      preview: preview.samples.map(s => ({
        date: s.date.toISOString().split("T")[0],
        dayName: s.dayName,
        price: s.price,
        multiplier: s.multiplier,
        rules: s.rulesApplied,
        hasAdjustment: s.multiplier !== 1,
      })),
    });
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/pricing/rules - Get all active rules (API)
 */
exports.apiGetRules = async (req, res, next) => {
  try {
    const rules = await pricingEngine.getActiveRules();
    res.json({
      success: true,
      rules,
    });
  } catch (err) {
    next(err);
  }
};
