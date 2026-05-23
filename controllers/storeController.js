const Home = require("../models/home");
const User = require("../models/user");
const bookingController = require("./bookingController");

exports.getIndex = (req, res, next) => {
  console.log("Session Value: ", req.session);
  Home.find().then((registeredHomes) => {
    res.render("store/index", {
      registeredHomes: registeredHomes,
      pageTitle: "airbnb Home",
      currentPage: "index",
      isLoggedIn: req.isLoggedIn, 
      user: req.session.user,
    });
  });
};

exports.getHomes = (req, res, next) => {
  Home.find().then((registeredHomes) => {
    res.render("store/home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Homes List",
      currentPage: "Home",
      isLoggedIn: req.isLoggedIn, 
      user: req.session.user,
      searchParams: {
        checkIn: "",
        checkOut: "",
        guests: "",
        minPrice: "",
        maxPrice: "",
        location: "",
        propertyType: "",
        amenities: "",
        minRating: "",
        bedrooms: "",
        bathrooms: "",
        sortBy: "",
        sortOrder: "asc",
      },
      resultsCount: null,
    });
  });
};

exports.getBookings = (req, res, next) => {
  res.render("store/bookings", {
    pageTitle: "My Bookings",
    currentPage: "bookings",
    isLoggedIn: req.isLoggedIn, 
    user: req.session.user,
  });
};

exports.getFavouriteList = async (req, res, next) => {
  const userId = req.session.user._id;
  const user = await User.findById(userId).populate('favourites');
  res.render("store/favourite-list", {
    favouriteHomes: user.favourites,
    pageTitle: "My Favourites",
    currentPage: "favourites",
    isLoggedIn: req.isLoggedIn, 
    user: req.session.user,
  });
};

exports.postAddToFavourite = async (req, res, next) => {
  const homeId = req.body.id;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (!user.favourites.includes(homeId)) {
    user.favourites.push(homeId);
    await user.save();
  }
  res.redirect("/favourites");
};

exports.postRemoveFromFavourite = async (req, res, next) => {
  const homeId = req.params.homeId;
  const userId = req.session.user._id;
  const user = await User.findById(userId);
  if (user.favourites.includes(homeId)) {
    user.favourites = user.favourites.filter(fav => fav != homeId);
    await user.save();
  }
  res.redirect("/favourites");
};

exports.getHomeDetails = (req, res, next) => {
  const homeId = req.params.homeId;
  const errorMessage = req.query.error || null;
  
  Home.findById(homeId).then(async (home) => {
    if (!home) {
      console.log("Home not found");
      res.redirect("/homes");
    } else {
      // Fetch upcoming/active bookings to display availability indicator.
      const upcomingBookings = await bookingController.getUpcomingBookingsForHome(homeId);
      res.render("store/home-detail", {
        home: home,
        upcomingBookings,
        pageTitle: "Home Detail",
        currentPage: "Home",
        isLoggedIn: req.isLoggedIn,
        user: req.session.user,
        errorMessage,
      });
    }
  });
};

exports.getPrivacyPolicy = (req, res, next) => {
  res.render("store/privacy-policy", {
    pageTitle: "Privacy Policy",
    currentPage: "privacy",
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
  });
};
