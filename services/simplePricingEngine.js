/**
 * SIMPLIFIED DYNAMIC PRICING ENGINE
 * ==================================
 * 
 * This service implements a simplified pricing calculation with 3 fixed rules:
 * 
 * 1. WEEKEND RULE - Auto-activates on Saturday & Sunday
 *    - Increases prices by a configured percentage
 * 
 * 2. FESTIVE RULE - Active during festivals/holidays
 *    - Increases prices during peak festive periods
 * 
 * 3. OFFSEASON RULE - Active during low-demand periods
 *    - Decreases prices to attract bookings
 * 
 * All rules apply GLOBALLY to ALL houses.
 * Rules are automatically activated/deactivated based on date conditions.
 */

// ============================================
// RULE CONFIGURATIONS (Easily adjustable)
// ============================================

const PRICING_CONFIG = {
  // Weekend Rule: Active on Saturday (6) and Sunday (0)
  weekend: {
    name: "Weekend Pricing",
    description: "Higher demand on weekends",
    multiplier: 1.15, // 15% increase
    daysOfWeek: [0, 6], // Sunday=0, Saturday=6
    priority: 20,
  },

  // Festive Rule: Active during major holidays
  festive: {
    name: "Festive Season Pricing",
    description: "Peak pricing during festivals and holidays",
    multiplier: 1.25, // 25% increase
    // Format: { month: 1-12, day: 1-31 }
    dates: [
      // New Year
      { month: 1, day: 1, name: "New Year" },
      { month: 12, day: 31, name: "New Year Eve" },
      // Indian Holidays
      { month: 1, day: 26, name: "Republic Day" },
      { month: 8, day: 15, name: "Independence Day" },
      // Diwali season (usually October-November)
      { month: 10, day: 24, name: "Diwali" },
      { month: 10, day: 25, name: "Diwali" },
      { month: 10, day: 26, name: "Diwali" },
      { month: 11, day: 1, name: "Diwali" },
      { month: 11, day: 2, name: "Diwali" },
      // Holi (usually March)
      { month: 3, day: 25, name: "Holi" },
      { month: 3, day: 26, name: "Holi" },
      // Christmas Season
      { month: 12, day: 24, name: "Christmas Eve" },
      { month: 12, day: 25, name: "Christmas" },
      { month: 12, day: 26, name: "Christmas" },
    ],
    // Extended festive periods (ranges)
    periods: [
      // Christmas to New Year period
      { startMonth: 12, startDay: 20, endMonth: 1, endDay: 5, name: "Year End Holiday" },
    ],
    priority: 30,
  },

  // Offseason Rule: Active during low-demand periods
  offseason: {
    name: "Offseason Discount",
    description: "Lower prices during off-peak periods",
    multiplier: 0.85, // 15% discount
    // Monsoon season (July-August) and post-winter slump (February)
    periods: [
      { startMonth: 7, startDay: 1, endMonth: 8, endDay: 31, name: "Monsoon Season" },
      { startMonth: 2, startDay: 1, endMonth: 2, endDay: 28, name: "Post-Winter Slump" },
    ],
    priority: 10,
  },
};

// ============================================
// PRICING ENGINE CLASS
// ============================================

class SimplePricingEngine {
  constructor() {
    this.config = PRICING_CONFIG;
  }

  /**
   * Check if a date is a weekend
   */
  isWeekend(date) {
    const day = date.getDay();
    return this.config.weekend.daysOfWeek.includes(day);
  }

  /**
   * Check if a date is a festive day
   */
  isFestiveDay(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Check specific dates
    for (const festive of this.config.festive.dates) {
      if (festive.month === month && festive.day === day) {
        return { active: true, name: festive.name };
      }
    }

    // Check festive periods
    for (const period of this.config.festive.periods) {
      if (this.isDateInPeriod(date, period)) {
        return { active: true, name: period.name };
      }
    }

    return { active: false, name: null };
  }

  /**
   * Check if a date is in offseason
   */
  isOffseason(date) {
    for (const period of this.config.offseason.periods) {
      if (this.isDateInPeriod(date, period)) {
        return { active: true, name: period.name };
      }
    }
    return { active: false, name: null };
  }

  /**
   * Check if date falls within a period (handles year boundary)
   */
  isDateInPeriod(date, period) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    // Handle periods that cross year boundary
    if (period.startMonth > period.endMonth) {
      return (
        (month > period.startMonth || (month === period.startMonth && day >= period.startDay)) ||
        (month < period.endMonth || (month === period.endMonth && day <= period.endDay))
      );
    }

    // Normal period within same year
    const afterStart = month > period.startMonth || (month === period.startMonth && day >= period.startDay);
    const beforeEnd = month < period.endMonth || (month === period.endMonth && day <= period.endDay);
    return afterStart && beforeEnd;
  }

  /**
   * Get all currently active rules for a specific date
   */
  getActiveRulesForDate(date) {
    const activeRules = [];
    const dateObj = new Date(date);

    // Check Weekend Rule
    if (this.isWeekend(dateObj)) {
      activeRules.push({
        type: "WEEKEND",
        name: this.config.weekend.name,
        description: this.config.weekend.description,
        multiplier: this.config.weekend.multiplier,
        priority: this.config.weekend.priority,
        displayAdjustment: `+${Math.round((this.config.weekend.multiplier - 1) * 100)}%`,
      });
    }

    // Check Festive Rule
    const festive = this.isFestiveDay(dateObj);
    if (festive.active) {
      activeRules.push({
        type: "FESTIVE",
        name: this.config.festive.name,
        description: `${this.config.festive.description} - ${festive.name}`,
        multiplier: this.config.festive.multiplier,
        priority: this.config.festive.priority,
        displayAdjustment: `+${Math.round((this.config.festive.multiplier - 1) * 100)}%`,
      });
    }

    // Check Offseason Rule (only if not festive - festive takes priority)
    const offseason = this.isOffseason(dateObj);
    if (offseason.active && !festive.active) {
      activeRules.push({
        type: "OFFSEASON",
        name: this.config.offseason.name,
        description: `${this.config.offseason.description} - ${offseason.name}`,
        multiplier: this.config.offseason.multiplier,
        priority: this.config.offseason.priority,
        displayAdjustment: `${Math.round((this.config.offseason.multiplier - 1) * 100)}%`,
      });
    }

    return activeRules.sort((a, b) => b.priority - a.priority);
  }

  /**
   * Calculate combined price multiplier for a date
   * Uses multiplicative stacking for multiple rules
   */
  calculateDateMultiplier(date) {
    const rules = this.getActiveRulesForDate(date);
    let multiplier = 1.0;

    for (const rule of rules) {
      multiplier *= rule.multiplier;
    }

    return {
      multiplier: Math.round(multiplier * 100) / 100,
      appliedRules: rules,
    };
  }

  /**
   * Calculate dynamic price for a date range
   * @param {Number} basePrice - Base price per night
   * @param {Date} checkIn - Check-in date
   * @param {Date} checkOut - Check-out date
   * @returns {Object} - Detailed pricing breakdown
   */
  calculatePrice(basePrice, checkIn, checkOut) {
    const startDate = new Date(checkIn);
    const endDate = new Date(checkOut);

    const dailyPrices = [];
    const allAppliedRules = new Map(); // Track unique rules
    let totalPrice = 0;
    let currentDate = new Date(startDate);

    // Calculate price for each night
    while (currentDate < endDate) {
      const { multiplier, appliedRules } = this.calculateDateMultiplier(currentDate);
      const nightPrice = Math.round(basePrice * multiplier);

      dailyPrices.push({
        date: new Date(currentDate),
        basePrice,
        multiplier,
        finalPrice: nightPrice,
        appliedRules: appliedRules.map(r => r.name),
      });

      totalPrice += nightPrice;
      appliedRules.forEach(rule => allAppliedRules.set(rule.type, rule));

      currentDate.setDate(currentDate.getDate() + 1);
    }

    const nights = dailyPrices.length;
    const originalTotal = basePrice * nights;
    const difference = totalPrice - originalTotal;

    return {
      basePrice,
      nights,
      dailyPrices,
      totalPrice,
      originalTotal,
      difference,
      differencePercent: Math.round((difference / originalTotal) * 100),
      averagePricePerNight: Math.round(totalPrice / nights),
      appliedRules: Array.from(allAppliedRules.values()),
    };
  }

  /**
   * Get currently active rules for TODAY
   * Used for UI display
   */
  getTodaysActiveRules() {
    return this.getActiveRulesForDate(new Date());
  }

  /**
   * Get all possible rules with their current status
   * Used for displaying the rules list in UI
   */
  getAllRulesWithStatus() {
    const today = new Date();
    const activeRules = this.getActiveRulesForDate(today);
    const activeTypes = activeRules.map(r => r.type);

    return [
      {
        type: "WEEKEND",
        name: this.config.weekend.name,
        description: this.config.weekend.description,
        multiplier: this.config.weekend.multiplier,
        displayAdjustment: `+${Math.round((this.config.weekend.multiplier - 1) * 100)}%`,
        isActive: activeTypes.includes("WEEKEND"),
        condition: "Active on Saturdays and Sundays",
        scope: "GLOBAL",
      },
      {
        type: "FESTIVE",
        name: this.config.festive.name,
        description: this.config.festive.description,
        multiplier: this.config.festive.multiplier,
        displayAdjustment: `+${Math.round((this.config.festive.multiplier - 1) * 100)}%`,
        isActive: activeTypes.includes("FESTIVE"),
        condition: "Active during festivals and holidays",
        scope: "GLOBAL",
      },
      {
        type: "OFFSEASON",
        name: this.config.offseason.name,
        description: this.config.offseason.description,
        multiplier: this.config.offseason.multiplier,
        displayAdjustment: `${Math.round((this.config.offseason.multiplier - 1) * 100)}%`,
        isActive: activeTypes.includes("OFFSEASON"),
        condition: "Active during monsoon and off-peak seasons",
        scope: "GLOBAL",
      },
    ];
  }
}

// Export singleton instance
module.exports = new SimplePricingEngine();
