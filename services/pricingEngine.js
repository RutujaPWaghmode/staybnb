/**
 * DYNAMIC PRICING ENGINE SERVICE
 * ===============================
 * 
 * This service implements the core pricing calculation logic using a
 * Rule-Based Pricing Engine with Multiplicative Stacking.
 * 
 * ALGORITHM:
 * ===========
 * 1. Fetch all active pricing rules (global + listing-specific)
 * 2. For each date in the booking range:
 *    a. Find all applicable rules
 *    b. Sort by priority (descending)
 *    c. Apply rules based on stacking behavior
 * 3. Calculate final price per night
 * 4. Sum up for total booking amount
 * 
 * STACKING METHODS:
 * =================
 * - Multiplicative: price = base × rule1.value × rule2.value × ...
 * - Highest Priority: price = base × highestPriorityRule.value
 * - Hybrid: Non-stackable rules override, stackable ones compound
 * 
 * TIME COMPLEXITY: O(D × R) where D = number of days, R = number of rules
 * SPACE COMPLEXITY: O(R) for storing applicable rules
 */

const PricingRule = require("../models/pricingRule");

class PricingEngine {
  constructor() {
    this.rulesCache = null;
    this.cacheExpiry = 0;
    this.CACHE_TTL = 5 * 60 * 1000; // 5 minutes cache
  }

  /**
   * Get all active pricing rules (with caching)
   */
  async getRules(listingId = null) {
    const now = Date.now();
    
    // Return cached rules if valid
    if (this.rulesCache && now < this.cacheExpiry) {
      return this.filterRulesForListing(this.rulesCache, listingId);
    }

    // Fetch all active rules from database
    const rules = await PricingRule.find({ isActive: true }).sort({ priority: -1 });
    
    // Update cache
    this.rulesCache = rules;
    this.cacheExpiry = now + this.CACHE_TTL;

    return this.filterRulesForListing(rules, listingId);
  }

  /**
   * Filter rules applicable to a specific listing
   */
  filterRulesForListing(rules, listingId) {
    return rules.filter(rule => {
      if (rule.scope === "GLOBAL") return true;
      if (rule.scope === "LISTING" && rule.listingId) {
        return rule.listingId.toString() === listingId?.toString();
      }
      return false;
    });
  }

  /**
   * Clear the rules cache (call after rule updates)
   */
  clearCache() {
    this.rulesCache = null;
    this.cacheExpiry = 0;
  }

  /**
   * Check if a rule applies to a specific date
   */
  isRuleApplicable(rule, date, bookingDate = new Date()) {
    const checkDate = new Date(date);
    const dayOfWeek = checkDate.getDay();
    const month = checkDate.getMonth() + 1;
    const day = checkDate.getDate();

    switch (rule.ruleType) {
      case "WEEKEND":
        return rule.daysOfWeek && rule.daysOfWeek.includes(dayOfWeek);

      case "HOLIDAY":
        if (!rule.specificDates || rule.specificDates.length === 0) {
          return false;
        }
        return rule.specificDates.some(h => h.month === month && h.day === day);

      case "SEASONAL":
        return this.isDateInSeason(checkDate, rule);

      case "CUSTOM":
        if (!rule.startDate || !rule.endDate) return false;
        const start = new Date(rule.startDate);
        const end = new Date(rule.endDate);
        return checkDate >= start && checkDate <= end;

      case "LAST_MINUTE":
        if (!rule.daysBeforeCheckIn) return false;
        const daysUntil = Math.ceil((checkDate - bookingDate) / (1000 * 60 * 60 * 24));
        return daysUntil <= rule.daysBeforeCheckIn;

      case "EARLY_BIRD":
        if (!rule.daysInAdvance) return false;
        const daysAhead = Math.ceil((checkDate - bookingDate) / (1000 * 60 * 60 * 24));
        return daysAhead >= rule.daysInAdvance;

      default:
        return false;
    }
  }

  /**
   * Check if a date falls within a seasonal rule (handles recurring)
   */
  isDateInSeason(date, rule) {
    if (!rule.startDate || !rule.endDate) return false;

    const start = new Date(rule.startDate);
    const end = new Date(rule.endDate);

    if (rule.recurring) {
      // For recurring rules, only compare month and day
      const checkMonth = date.getMonth();
      const checkDay = date.getDate();
      const startMonth = start.getMonth();
      const startDay = start.getDate();
      const endMonth = end.getMonth();
      const endDay = end.getDate();

      // Handle seasons that cross year boundary
      if (startMonth > endMonth) {
        return (
          (checkMonth > startMonth || (checkMonth === startMonth && checkDay >= startDay)) ||
          (checkMonth < endMonth || (checkMonth === endMonth && checkDay <= endDay))
        );
      } else {
        return (
          (checkMonth > startMonth || (checkMonth === startMonth && checkDay >= startDay)) &&
          (checkMonth < endMonth || (checkMonth === endMonth && checkDay <= endDay))
        );
      }
    } else {
      // Non-recurring: exact date comparison
      return date >= start && date <= end;
    }
  }

  /**
   * Calculate the price adjustment for a single date
   * Returns: { multiplier, appliedRules, breakdown }
   */
  calculateDateAdjustment(rules, date, bookingDate = new Date()) {
    const applicableRules = rules.filter(rule => this.isRuleApplicable(rule, date, bookingDate));
    
    if (applicableRules.length === 0) {
      return {
        multiplier: 1.0,
        appliedRules: [],
        breakdown: [],
      };
    }

    // Sort by priority (highest first)
    applicableRules.sort((a, b) => b.priority - a.priority);

    let multiplier = 1.0;
    const breakdown = [];
    const appliedRules = [];

    // Find highest non-stackable rule
    const highestNonStackable = applicableRules.find(r => !r.stackable);

    if (highestNonStackable) {
      // Non-stackable rule overrides all others of equal or lower priority
      const overridePriority = highestNonStackable.priority;
      
      // Apply the non-stackable rule
      if (highestNonStackable.adjustmentType === "PERCENTAGE") {
        multiplier *= highestNonStackable.adjustmentValue;
      }
      breakdown.push({
        name: highestNonStackable.name,
        type: highestNonStackable.ruleType,
        adjustment: highestNonStackable.adjustmentValue,
        adjustmentType: highestNonStackable.adjustmentType,
        priority: highestNonStackable.priority,
      });
      appliedRules.push(highestNonStackable);

      // Apply stackable rules with higher priority
      for (const rule of applicableRules) {
        if (rule.stackable && rule.priority > overridePriority) {
          if (rule.adjustmentType === "PERCENTAGE") {
            multiplier *= rule.adjustmentValue;
          }
          breakdown.push({
            name: rule.name,
            type: rule.ruleType,
            adjustment: rule.adjustmentValue,
            adjustmentType: rule.adjustmentType,
            priority: rule.priority,
          });
          appliedRules.push(rule);
        }
      }
    } else {
      // All rules are stackable - multiply all
      for (const rule of applicableRules) {
        if (rule.adjustmentType === "PERCENTAGE") {
          multiplier *= rule.adjustmentValue;
        }
        breakdown.push({
          name: rule.name,
          type: rule.ruleType,
          adjustment: rule.adjustmentValue,
          adjustmentType: rule.adjustmentType,
          priority: rule.priority,
        });
        appliedRules.push(rule);
      }
    }

    return {
      multiplier: Math.round(multiplier * 100) / 100, // Round to 2 decimal places
      appliedRules,
      breakdown,
    };
  }

  /**
   * Calculate dynamic price for a date range
   * @param {Number} basePrice - Base price per night
   * @param {Date} checkIn - Check-in date
   * @param {Date} checkOut - Check-out date
   * @param {String} listingId - Optional listing ID for specific rules
   * @returns {Object} - Pricing details
   */
  async calculatePrice(basePrice, checkIn, checkOut, listingId = null) {
    const rules = await this.getRules(listingId);
    const bookingDate = new Date(); // When the booking is being made

    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);
    
    const dailyPrices = [];
    const allAppliedRules = new Set();
    let totalPrice = 0;
    let currentDate = new Date(startDate);

    // Calculate price for each night (check-out day is not charged)
    while (currentDate < endDate) {
      const { multiplier, appliedRules, breakdown } = this.calculateDateAdjustment(
        rules,
        currentDate,
        bookingDate
      );

      const nightPrice = Math.round(basePrice * multiplier);
      
      dailyPrices.push({
        date: new Date(currentDate),
        basePrice,
        multiplier,
        finalPrice: nightPrice,
        breakdown,
      });

      totalPrice += nightPrice;
      appliedRules.forEach(rule => allAppliedRules.add(rule.name));

      // Move to next day
      currentDate.setDate(currentDate.getDate() + 1);
    }

    const nights = dailyPrices.length;
    const averageMultiplier = dailyPrices.reduce((sum, d) => sum + d.multiplier, 0) / nights;
    const averagePrice = Math.round(totalPrice / nights);
    const originalTotal = basePrice * nights;
    const savings = originalTotal - totalPrice;

    return {
      basePrice,
      nights,
      dailyPrices,
      totalPrice,
      originalTotal,
      savings,
      savingsPercent: Math.round((savings / originalTotal) * 100),
      averageMultiplier: Math.round(averageMultiplier * 100) / 100,
      averagePricePerNight: averagePrice,
      appliedRules: Array.from(allAppliedRules),
      priceBreakdown: {
        subtotal: totalPrice,
        serviceFee: Math.round(totalPrice * 0.10), // 10% service fee
        total: Math.round(totalPrice * 1.10),
      },
    };
  }

  /**
   * Get pricing preview for a listing (shows potential price variations)
   */
  async getPricingPreview(basePrice, listingId = null) {
    const today = new Date();
    const preview = {
      basePrice,
      samples: [],
    };

    // Sample next 7 days
    for (let i = 0; i < 7; i++) {
      const date = new Date(today);
      date.setDate(date.getDate() + i);
      
      const rules = await this.getRules(listingId);
      const { multiplier, breakdown } = this.calculateDateAdjustment(rules, date);
      
      const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      preview.samples.push({
        date,
        dayName: dayNames[date.getDay()],
        multiplier,
        price: Math.round(basePrice * multiplier),
        rulesApplied: breakdown.map(b => b.name),
      });
    }

    return preview;
  }

  /**
   * Get all active rules with their configurations
   */
  async getActiveRules() {
    const rules = await PricingRule.find({ isActive: true }).sort({ priority: -1 });
    return rules.map(rule => ({
      id: rule._id,
      name: rule.name,
      description: rule.description,
      type: rule.ruleType,
      scope: rule.scope,
      adjustmentType: rule.adjustmentType,
      adjustmentValue: rule.adjustmentValue,
      adjustmentPercent: rule.adjustmentType === "PERCENTAGE" 
        ? Math.round((rule.adjustmentValue - 1) * 100) 
        : null,
      priority: rule.priority,
      stackable: rule.stackable,
      isActive: rule.isActive,
    }));
  }
}

// Export singleton instance
const pricingEngine = new PricingEngine();

module.exports = pricingEngine;
module.exports.PricingEngine = PricingEngine;
