const mongoose = require("mongoose");

const homeSchema = mongoose.Schema({
  houseName: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  location: {
    type: String,
    required: true,
  },
  rating: {
    type: Number,
    required: true,
  },
  photo: {
    type: String,
    get: function(v) {
      // Normalize path to forward slashes for cross-platform compatibility
      return v ? v.replace(/\\/g, '/') : v;
    }
  },
  description: String,
  // New fields for search functionality
  maxGuests: {
    type: Number,
    default: 2,
    min: 1,
  },
  bedrooms: {
    type: Number,
    default: 1,
    min: 0,
  },
  bathrooms: {
    type: Number,
    default: 1,
    min: 0,
  },
  propertyType: {
    type: String,
    enum: ["apartment", "house", "villa", "cottage", "cabin", "studio", "other"],
    default: "apartment",
  },
  amenities: {
    type: [String],
    default: [],
    // Common amenities: wifi, pool, parking, ac, kitchen, washer, tv, workspace
  },
}, {
  // Enable getters when converting to JSON/Object (for path normalization)
  toJSON: { getters: true },
  toObject: { getters: true },
});

// Create text index for location search
homeSchema.index({ location: "text", houseName: "text" });

// homeSchema.pre('findOneAndDelete', async function(next) {
//   console.log('Came to pre hook while deleting a home');
//   const homeId = this.getQuery()._id;
//   await favourite.deleteMany({houseId: homeId});
//   next();
// });

module.exports = mongoose.model("Home", homeSchema);
