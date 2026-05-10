const mongoose = require("mongoose");

/**
 * DYNAMIC PRICING SYSTEM ARCHITECTURE
 * ====================================
 * 
 * This implements a Rule-Based Pricing Engine with the following features:
 * 
 * 1. RULE TYPES:
 *    - WEEKEND: Friday, Saturday, Sunday pricing
 *    - HOLIDAY: Specific dates (Diwali, Christmas, etc.)
 *    - SEASONAL: Date ranges (Summer, Winter, etc.)
 *    - CUSTOM: Host-defined special dates
 * 
 * 2. ADJUSTMENT METHODS:
 *    - PERCENTAGE: Multiply base price (e.g., 1.2 = 20% increase)
 *    - FIXED: Add/subtract fixed amount
 * 
 * 3. STACKING BEHAVIOR:
 *    - stackable=true: Multipliers compound (1.2 × 1.1 = 1.32)
 *    - stackable=false: Highest priority rule wins
 * 
 * 4. SCOPE:
 *    - Global rules: Apply to all listings
 *    - Listing-specific: Apply to one listing only
 */

// Pre-defined holidays (Indian + International)
const DEFAULT_HOLIDAYS = [
  { name: "New Year", month: 1, day: 1 },
  { name: "Republic Day", month: 1, day: 26 },
  { name: "Holi", month: 3, day: 25 }, // Approximate - varies yearly
  { name: "Independence Day", month: 8, day: 15 },
  { name: "Diwali", month: 11, day: 1 }, // Approximate - varies yearly
  { name: "Christmas", month: 12, day: 25 },
  { name: "New Year Eve", month: 12, day: 31 },
];

// Season definitions
const SEASONS = {
  PEAK_SUMMER: { name: "Peak Summer", startMonth: 4, startDay: 15, endMonth: 6, endDay: 15 },
  MONSOON: { name: "Monsoon", startMonth: 7, startDay: 1, endMonth: 9, endDay: 15 },
  PEAK_WINTER: { name: "Peak Winter", startMonth: 12, startDay: 15, endMonth: 1, endDay: 15 },
  FESTIVE: { name: "Festive Season", startMonth: 10, startDay: 1, endMonth: 11, endDay: 15 },
};

const pricingRuleSchema = new mongoose.Schema({
  // Rule identification
  name: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
  },
  
  // Rule type determines how dates are matched
  ruleType: {
    type: String,
    enum: ["WEEKEND", "HOLIDAY", "SEASONAL", "CUSTOM", "LAST_MINUTE", "EARLY_BIRD"],
    required: true,
  },
  
  // Scope: global or listing-specific
  scope: {
    type: String,
    enum: ["GLOBAL", "LISTING"],
    default: "GLOBAL",
  },
  
  // If scope is LISTING, which listing does this apply to?
  listingId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Home",
    default: null,
  },
  
  // Adjustment configuration
  adjustmentType: {
    type: String,
    enum: ["PERCENTAGE", "FIXED"],
    default: "PERCENTAGE",
  },
  
  // For PERCENTAGE: 1.2 = 20% increase, 0.8 = 20% discount
  // For FIXED: positive = add, negative = subtract
  adjustmentValue: {
    type: Number,
    required: true,
    default: 1.0,
  },
  
  // Priority for conflict resolution (higher = more important)
  priority: {
    type: Number,
    default: 10,
    min: 1,
    max: 100,
  },
  
  // Can this rule stack with others or does it override?
  stackable: {
    type: Boolean,
    default: true,
  },
  
  // Date configuration (for SEASONAL and CUSTOM types)
  startDate: {
    type: Date,
  },
  endDate: {
    type: Date,
  },
  
  // For recurring rules
  recurring: {
    type: Boolean,
    default: false,
  },
  
  // Day of week for WEEKEND rules (0=Sunday, 5=Friday, 6=Saturday)
  daysOfWeek: [{
    type: Number,
    min: 0,
    max: 6,
  }],
  
  // Specific dates for HOLIDAY type
  specificDates: [{
    month: { type: Number, min: 1, max: 12 },
    day: { type: Number, min: 1, max: 31 },
    name: String,
  }],
  
  // For LAST_MINUTE: days before check-in
  daysBeforeCheckIn: {
    type: Number,
  },
  
  // For EARLY_BIRD: days in advance
  daysInAdvance: {
    type: Number,
  },
  
  // Rule status
  isActive: {
    type: Boolean,
    default: true,
  },
  
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Indexes for efficient querying
pricingRuleSchema.index({ ruleType: 1, isActive: 1 });
pricingRuleSchema.index({ listingId: 1, isActive: 1 });
pricingRuleSchema.index({ scope: 1, isActive: 1 });

// Static method to check if a date is a weekend
pricingRuleSchema.statics.isWeekend = function(date) {
  const day = date.getDay();
  return day === 0 || day === 5 || day === 6; // Sun, Fri, Sat
};

// Static method to check if a date is a holiday
pricingRuleSchema.statics.isHoliday = function(date, holidays = DEFAULT_HOLIDAYS) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return holidays.find(h => h.month === month && h.day === day);
};

// Static method to determine season
pricingRuleSchema.statics.getSeason = function(date) {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  
  for (const [key, season] of Object.entries(SEASONS)) {
    // Handle seasons that cross year boundary (like Peak Winter)
    if (season.startMonth > season.endMonth) {
      if ((month === season.startMonth && day >= season.startDay) ||
          (month > season.startMonth) ||
          (month < season.endMonth) ||
          (month === season.endMonth && day <= season.endDay)) {
        return { key, ...season };
      }
    } else {
      if ((month > season.startMonth || (month === season.startMonth && day >= season.startDay)) &&
          (month < season.endMonth || (month === season.endMonth && day <= season.endDay))) {
        return { key, ...season };
      }
    }
  }
  return null; // Off-season
};

// Static method to seed default pricing rules
pricingRuleSchema.statics.seedDefaultRules = async function() {
  const PricingRule = this;
  
  // Check if rules already exist
  const existingCount = await PricingRule.countDocuments();
  if (existingCount > 0) {
    console.log("Pricing rules already exist, skipping seed");
    return;
  }
  
  const defaultRules = [
    // Weekend pricing - 15% increase
    {
      name: "Weekend Premium",
      description: "Higher prices for Friday, Saturday, and Sunday stays",
      ruleType: "WEEKEND",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 1.15, // 15% increase
      priority: 20,
      stackable: true,
      daysOfWeek: [0, 5, 6], // Sun, Fri, Sat
      isActive: true,
    },
    
    // Holiday pricing - 25% increase
    {
      name: "Holiday Premium",
      description: "Premium pricing for major holidays",
      ruleType: "HOLIDAY",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 1.25, // 25% increase
      priority: 30,
      stackable: true,
      specificDates: DEFAULT_HOLIDAYS,
      isActive: true,
    },
    
    // Peak Summer - 20% increase
    {
      name: "Peak Summer Season",
      description: "Summer vacation surge pricing",
      ruleType: "SEASONAL",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 1.20, // 20% increase
      priority: 15,
      stackable: true,
      recurring: true,
      startDate: new Date(2024, 3, 15), // April 15
      endDate: new Date(2024, 5, 15), // June 15
      isActive: true,
    },
    
    // Festive Season (Diwali period) - 30% increase
    {
      name: "Festive Season",
      description: "Diwali and festive period pricing",
      ruleType: "SEASONAL",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 1.30, // 30% increase
      priority: 25,
      stackable: true,
      recurring: true,
      startDate: new Date(2024, 9, 1), // October 1
      endDate: new Date(2024, 10, 15), // November 15
      isActive: true,
    },
    
    // Peak Winter / New Year - 35% increase
    {
      name: "Peak Winter & New Year",
      description: "Christmas and New Year premium",
      ruleType: "SEASONAL",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 1.35, // 35% increase
      priority: 28,
      stackable: true,
      recurring: true,
      startDate: new Date(2024, 11, 15), // December 15
      endDate: new Date(2025, 0, 15), // January 15
      isActive: true,
    },
    
    // Monsoon discount - 10% decrease
    {
      name: "Monsoon Discount",
      description: "Off-season monsoon discount",
      ruleType: "SEASONAL",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 0.90, // 10% discount
      priority: 10,
      stackable: true,
      recurring: true,
      startDate: new Date(2024, 6, 1), // July 1
      endDate: new Date(2024, 8, 15), // September 15
      isActive: true,
    },
    
    // Last-minute discount - 10% off for bookings within 24 hours
    {
      name: "Last Minute Deal",
      description: "Discount for bookings made within 24 hours of check-in",
      ruleType: "LAST_MINUTE",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 0.90, // 10% discount
      priority: 5,
      stackable: false, // Override other discounts
      daysBeforeCheckIn: 1,
      isActive: false, // Disabled by default
    },
    
    // Early bird discount - 5% off for 30+ days advance booking
    {
      name: "Early Bird Discount",
      description: "Discount for bookings made 30+ days in advance",
      ruleType: "EARLY_BIRD",
      scope: "GLOBAL",
      adjustmentType: "PERCENTAGE",
      adjustmentValue: 0.95, // 5% discount
      priority: 8,
      stackable: true,
      daysInAdvance: 30,
      isActive: true,
    },
  ];
  
  await PricingRule.insertMany(defaultRules);
  console.log("Default pricing rules seeded successfully");
};

// Update timestamp on save
pricingRuleSchema.pre("save", function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model("PricingRule", pricingRuleSchema);
module.exports.DEFAULT_HOLIDAYS = DEFAULT_HOLIDAYS;
module.exports.SEASONS = SEASONS;
