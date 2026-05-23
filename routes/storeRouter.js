// External Module
const express = require("express");
const storeRouter = express.Router();

// Local Module
const storeController = require("../controllers/storeController");
const searchController = require("../controllers/searchController");

storeRouter.get("/", storeController.getIndex);
storeRouter.get("/homes", storeController.getHomes);
storeRouter.get("/favourites", storeController.getFavouriteList);

// Search and filter routes
storeRouter.get("/search", searchController.searchHomes);
storeRouter.get("/api/availability/:homeId", searchController.getAvailability);
storeRouter.get("/api/locations", searchController.getLocationSuggestions);
storeRouter.get("/api/filters", searchController.getFilterOptions);

storeRouter.get("/homes/:homeId", storeController.getHomeDetails);
storeRouter.post("/favourites", storeController.postAddToFavourite);
storeRouter.post("/favourites/delete/:homeId", storeController.postRemoveFromFavourite);

// Static pages
storeRouter.get("/privacy", storeController.getPrivacyPolicy);

module.exports = storeRouter;
