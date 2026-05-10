const Home = require("../models/home");
const Booking = require("../models/booking");

/**
 * Search and filter listings based on various criteria
 * 
 * Supported filters:
 * - checkIn/checkOut: Date availability (excludes properties with overlapping bookings)
 * - guests: Minimum guest capacity
 * - minPrice/maxPrice: Price range
 * - location: Text search in location
 * - propertyType: Type of property
 * - amenities: Required amenities (comma-separated)
 * - minRating: Minimum rating
 * - bedrooms: Minimum bedrooms
 * - bathrooms: Minimum bathrooms
 * - sortBy: Sort field (price, rating, bedrooms)
 * - sortOrder: asc or desc
 */
exports.searchHomes = async (req, res, next) => {
  try {
    const {
      checkIn,
      checkOut,
      guests,
      minPrice,
      maxPrice,
      location,
      propertyType,
      amenities,
      minRating,
      bedrooms,
      bathrooms,
      sortBy,
      sortOrder,
    } = req.query;

    // Build MongoDB query
    const query = {};

    // Location filter (case-insensitive regex search)
    if (location && location.trim()) {
      query.location = { $regex: location.trim(), $options: "i" };
    }

    // Guest count filter - only apply if value is provided
    if (guests && guests !== '' && !isNaN(parseInt(guests))) {
      query.maxGuests = { $gte: parseInt(guests) };
    }

    // Price range filter
    if (minPrice && minPrice !== '' && !isNaN(parseFloat(minPrice))) {
      query.price = { ...query.price, $gte: parseFloat(minPrice) };
    }
    if (maxPrice && maxPrice !== '' && !isNaN(parseFloat(maxPrice))) {
      query.price = { ...query.price, $lte: parseFloat(maxPrice) };
    }

    // Property type filter
    if (propertyType && propertyType !== "" && propertyType !== "all") {
      query.propertyType = propertyType;
    }

    // Rating filter
    if (minRating && minRating !== '' && !isNaN(parseFloat(minRating))) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Bedrooms filter
    if (bedrooms && bedrooms !== '' && !isNaN(parseInt(bedrooms))) {
      query.bedrooms = { $gte: parseInt(bedrooms) };
    }

    // Bathrooms filter
    if (bathrooms && bathrooms !== '' && !isNaN(parseInt(bathrooms))) {
      query.bathrooms = { $gte: parseInt(bathrooms) };
    }

    // Amenities filter (all specified amenities must be present)
    if (amenities && amenities.trim()) {
      const amenityList = amenities.split(",").map((a) => a.trim().toLowerCase()).filter(a => a);
      if (amenityList.length > 0) {
        query.amenities = { $all: amenityList };
      }
    }

    // Build sort options
    let sortOptions = {};
    if (sortBy) {
      const order = sortOrder === "desc" ? -1 : 1;
      switch (sortBy) {
        case "price":
          sortOptions.price = order;
          break;
        case "rating":
          sortOptions.rating = order;
          break;
        case "bedrooms":
          sortOptions.bedrooms = order;
          break;
        case "guests":
          sortOptions.maxGuests = order;
          break;
        default:
          sortOptions.rating = -1; // Default: highest rated first
      }
    } else {
      sortOptions.rating = -1; // Default sort
    }

    // First, get all homes matching the basic criteria
    let homes = await Home.find(query).sort(sortOptions);

    // If date availability filter is specified, exclude homes with overlapping bookings
    if (checkIn && checkOut) {
      const checkInDate = new Date(checkIn);
      const checkOutDate = new Date(checkOut);

      if (!isNaN(checkInDate.getTime()) && !isNaN(checkOutDate.getTime()) && checkOutDate > checkInDate) {
        // Get all confirmed bookings that overlap with the requested dates
        const overlappingBookings = await Booking.find({
          bookingStatus: "confirmed",
          checkInDate: { $lt: checkOutDate },
          checkOutDate: { $gt: checkInDate },
        }).select("listingId");

        // Get set of unavailable listing IDs
        const unavailableIds = new Set(
          overlappingBookings.map((b) => b.listingId.toString())
        );

        // Filter out unavailable homes
        homes = homes.filter((home) => !unavailableIds.has(home._id.toString()));
      }
    }

    // Render results
    res.render("store/home-list", {
      registeredHomes: homes,
      pageTitle: "Search Results",
      currentPage: "Home",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
      // Pass search params back to maintain form state
      searchParams: {
        checkIn: checkIn || "",
        checkOut: checkOut || "",
        guests: guests || "",
        minPrice: minPrice || "",
        maxPrice: maxPrice || "",
        location: location || "",
        propertyType: propertyType || "",
        amenities: amenities || "",
        minRating: minRating || "",
        bedrooms: bedrooms || "",
        bathrooms: bathrooms || "",
        sortBy: sortBy || "",
        sortOrder: sortOrder || "asc",
      },
      resultsCount: homes.length,
    });
  } catch (err) {
    console.error("Search error:", err);
    next(err);
  }
};

/**
 * Get available dates for a specific listing
 * Returns array of date ranges that are booked
 */
exports.getAvailability = async (req, res, next) => {
  try {
    const { homeId } = req.params;
    const { month, year } = req.query;

    // Get all confirmed bookings for this listing
    const bookings = await Booking.find({
      listingId: homeId,
      bookingStatus: "confirmed",
    }).select("checkInDate checkOutDate");

    // Return booked date ranges
    const bookedRanges = bookings.map((b) => ({
      checkIn: b.checkInDate,
      checkOut: b.checkOutDate,
    }));

    res.json({
      success: true,
      homeId,
      bookedRanges,
    });
  } catch (err) {
    console.error("Get availability error:", err);
    res.status(500).json({ success: false, error: "Failed to get availability" });
  }
};

/**
 * Quick search suggestions based on location
 */
exports.getLocationSuggestions = async (req, res, next) => {
  try {
    const { q } = req.query;
    
    if (!q || q.length < 2) {
      return res.json({ suggestions: [] });
    }

    // Get unique locations matching the query
    const homes = await Home.find({
      location: { $regex: q, $options: "i" },
    }).select("location").limit(10);

    // Get unique locations
    const uniqueLocations = [...new Set(homes.map((h) => h.location))];

    res.json({ suggestions: uniqueLocations.slice(0, 5) });
  } catch (err) {
    console.error("Location suggestions error:", err);
    res.status(500).json({ suggestions: [] });
  }
};

/**
 * Get filter options (for dynamic dropdowns)
 */
exports.getFilterOptions = async (req, res, next) => {
  try {
    // Get unique property types in use
    const propertyTypes = await Home.distinct("propertyType");
    
    // Get all unique amenities
    const amenitiesResult = await Home.aggregate([
      { $unwind: "$amenities" },
      { $group: { _id: "$amenities" } },
      { $sort: { _id: 1 } },
    ]);
    const amenities = amenitiesResult.map((a) => a._id);

    // Get price range
    const priceStats = await Home.aggregate([
      {
        $group: {
          _id: null,
          minPrice: { $min: "$price" },
          maxPrice: { $max: "$price" },
        },
      },
    ]);

    // Get unique locations
    const locations = await Home.distinct("location");

    res.json({
      propertyTypes,
      amenities,
      priceRange: priceStats[0] || { minPrice: 0, maxPrice: 10000 },
      locations,
    });
  } catch (err) {
    console.error("Get filter options error:", err);
    res.status(500).json({ error: "Failed to get filter options" });
  }
};
