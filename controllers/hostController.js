const Home = require("../models/home");
const fs = require("fs");

exports.getAddHome = (req, res, next) => {
  res.render("host/edit-home", {
    pageTitle: "Add Home to airbnb",
    currentPage: "addHome",
    editing: false,
    isLoggedIn: req.isLoggedIn,
    user: req.session.user,
  });
};

exports.getEditHome = (req, res, next) => {
  const homeId = req.params.homeId;
  const editing = req.query.editing === "true";

  Home.findById(homeId).then((home) => {
    if (!home) {
      console.log("Home not found for editing.");
      return res.redirect("/host/host-home-list");
    }

    console.log(homeId, editing, home);
    res.render("host/edit-home", {
      home: home,
      pageTitle: "Edit your Home",
      currentPage: "host-homes",
      editing: editing,
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  });
};

exports.getHostHomes = (req, res, next) => {
  Home.find().then((registeredHomes) => {
    res.render("host/host-home-list", {
      registeredHomes: registeredHomes,
      pageTitle: "Host Homes List",
      currentPage: "host-homes",
      isLoggedIn: req.isLoggedIn,
      user: req.session.user,
    });
  });
};

exports.postAddHome = (req, res, next) => {
  const { houseName, price, location, rating, description, maxGuests, bedrooms, bathrooms, propertyType, amenities } = req.body;
  console.log(houseName, price, location, rating, description);
  console.log(req.file);

  if (!req.file) {
    return res.status(422).send("No image provided");
  }

  // Normalize path to always use forward slashes (cross-platform compatibility)
  const photo = req.file.path.replace(/\\/g, '/');

  // Parse amenities from comma-separated string or checkbox array
  let amenitiesArray = [];
  if (amenities) {
    if (Array.isArray(amenities)) {
      amenitiesArray = amenities.filter(a => a.trim());
    } else {
      amenitiesArray = amenities.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
    }
  }

  const home = new Home({
    houseName,
    price: parseFloat(price) || 0,
    location,
    rating: parseFloat(rating) || 0,
    photo,
    description,
    maxGuests: parseInt(maxGuests) || 2,
    bedrooms: parseInt(bedrooms) || 1,
    bathrooms: parseInt(bathrooms) || 1,
    propertyType: propertyType || 'apartment',
    amenities: amenitiesArray,
  });
  home.save().then(() => {
    console.log("Home Saved successfully");
  });

  res.redirect("/host/host-home-list");
};

exports.postEditHome = (req, res, next) => {
  const { id, houseName, price, location, rating, description, maxGuests, bedrooms, bathrooms, propertyType, amenities } =
    req.body;
  
  // Parse amenities from comma-separated string or checkbox array
  let amenitiesArray = [];
  if (amenities) {
    if (Array.isArray(amenities)) {
      amenitiesArray = amenities.filter(a => a.trim());
    } else {
      amenitiesArray = amenities.split(',').map(a => a.trim().toLowerCase()).filter(a => a);
    }
  }

  Home.findById(id)
    .then((home) => {
      home.houseName = houseName;
      home.price = parseFloat(price) || 0;
      home.location = location;
      home.rating = parseFloat(rating) || 0;
      home.description = description;
      home.maxGuests = parseInt(maxGuests) || 2;
      home.bedrooms = parseInt(bedrooms) || 1;
      home.bathrooms = parseInt(bathrooms) || 1;
      home.propertyType = propertyType || 'apartment';
      home.amenities = amenitiesArray;

      if (req.file) {
        fs.unlink(home.photo, (err) => {
          if (err) {
            console.log("Error while deleting file ", err);
          }
        });
        // Normalize path to always use forward slashes
        home.photo = req.file.path.replace(/\\/g, '/');
      }

      home
        .save()
        .then((result) => {
          console.log("Home updated ", result);
        })
        .catch((err) => {
          console.log("Error while updating ", err);
        });
      res.redirect("/host/host-home-list");
    })
    .catch((err) => {
      console.log("Error while finding home ", err);
    });
};

exports.postDeleteHome = (req, res, next) => {
  const homeId = req.params.homeId;
  console.log("Came to delete ", homeId);
  Home.findByIdAndDelete(homeId)
    .then(() => {
      res.redirect("/host/host-home-list");
    })
    .catch((error) => {
      console.log("Error while deleting ", error);
    });
};
