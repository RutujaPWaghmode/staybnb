const { check, validationResult } = require("express-validator");
const User = require("../models/user");
const bcrypt = require("bcryptjs");

exports.getLogin = (req, res, next) => {
  res.render("auth/login", {
    pageTitle: "Login",
    currentPage: "login",
    isLoggedIn: false,
    errors: [],
    oldInput: {email: ""},
    user: {},
  });
};

exports.getSignup = (req, res, next) => {
  res.render("auth/signup", {
    pageTitle: "Signup",
    currentPage: "signup",
    isLoggedIn: false,
    errors: [],
    oldInput: {firstName: "", lastName: "", email: "", userType: ""},
    user: {},
  });
};

exports.postSignup = [
  check("firstName")
  .trim()
  .isLength({min: 2})
  .withMessage("First Name should be atleast 2 characters long")
  .matches(/^[A-Za-z\s]+$/)
  .withMessage("First Name should contain only alphabets"),

  check("lastName")
  .matches(/^[A-Za-z\s]*$/)
  .withMessage("Last Name should contain only alphabets"),

  check("email")
  .isEmail()
  .withMessage("Please enter a valid email")
  .normalizeEmail(),

  check("password")
  .isLength({min: 8})
  .withMessage("Password should be atleast 8 characters long")
  .matches(/[A-Z]/)
  .withMessage("Password should contain atleast one uppercase letter")
  .matches(/[a-z]/)
  .withMessage("Password should contain atleast one lowercase letter")
  .matches(/[0-9]/)
  .withMessage("Password should contain atleast one number")
  .matches(/[!@&]/)
  .withMessage("Password should contain atleast one special character")
  .trim(),

  check("confirmPassword")
  .trim()
  .custom((value, {req}) => {
    if (value !== req.body.password) {
      throw new Error("Passwords do not match");
    }
    return true;
  }),

  check("userType")
  .notEmpty()
  .withMessage("Please select a user type")
  .isIn(['guest', 'host'])
  .withMessage("Invalid user type"),

  check("terms")
  .notEmpty()
  .withMessage("Please accept the terms and conditions")
  .custom((value, {req}) => {
    if (value !== "on") {
      throw new Error("Please accept the terms and conditions");
    }
    return true;
  }),
  
  (req, res, next) => {
    const {firstName, lastName, email, password, userType} = req.body;
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(422).render("auth/signup", {
        pageTitle: "Signup",
        currentPage: "signup",
        isLoggedIn: false,
        errors: errors.array().map(err => err.msg),
        oldInput: {firstName, lastName, email, password, userType},
        user: {},
      });
    }

    bcrypt.hash(password, 12)
    .then(hashedPassword => {
      const user = new User({firstName, lastName, email, password: hashedPassword, userType});
      return user.save();
    })
    .then(() => {
      res.redirect("/login");
    }).catch(err => {
      return res.status(422).render("auth/signup", {
        pageTitle: "Signup",
        currentPage: "signup",
        isLoggedIn: false,
        errors: [err.message],
        oldInput: {firstName, lastName, email, userType},
        user: {},
      });
    });
  }
]

exports.postLogin = async (req, res, next) => {
  const {email, password} = req.body;
  const user = await User.findOne({email});
  if (!user) {
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      currentPage: "login",
      isLoggedIn: false,
      errors: ["User does not exist"],
      oldInput: {email},
      user: {},
    });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(422).render("auth/login", {
      pageTitle: "Login",
      currentPage: "login",
      isLoggedIn: false,
      errors: ["Invalid Password"],
      oldInput: {email},
      user: {},
    });
  }

  req.session.isLoggedIn = true;
  req.session.user = user;
  await req.session.save();

  res.redirect("/");
}

exports.postLogout = (req, res, next) => {
  req.session.destroy((err) => {
    if (err) {
      console.error('Logout error:', err);
      return res.redirect('/');
    }
    res.clearCookie('connect.sid');
    res.redirect("/login");
  });
}

exports.getProfile = async (req, res, next) => {
  try {
    const user = req.session.user;
    
    if (!user) {
      return res.redirect('/login');
    }
    
    let stats = {};
    
    if (user.userType === 'guest') {
      // Guest stats
      const Booking = require('../models/booking');
      const totalBookings = await Booking.countDocuments({ userId: user._id }).catch(() => 0);
      const upcomingTrips = await Booking.countDocuments({ 
        userId: user._id, 
        checkInDate: { $gte: new Date() },
        status: { $ne: 'cancelled' }
      }).catch(() => 0);
      const completedTrips = await Booking.countDocuments({ 
        userId: user._id, 
        checkOutDate: { $lt: new Date() },
        status: 'confirmed'
      }).catch(() => 0);
      
      stats = {
        totalBookings,
        totalFavourites: user.favourites ? user.favourites.length : 0,
        upcomingTrips,
        completedTrips
      };
    } else {
      // Host stats
      const Home = require('../models/home');
      const Booking = require('../models/booking');
      
      const totalListings = await Home.countDocuments({ userId: user._id }).catch(() => 0);
      const homes = await Home.find({ userId: user._id }).select('_id').catch(() => []);
      const homeIds = homes.map(h => h._id);
      
      const totalBookings = await Booking.countDocuments({ listingId: { $in: homeIds } }).catch(() => 0);
      const bookings = await Booking.find({ listingId: { $in: homeIds }, status: 'confirmed' }).catch(() => []);
      const totalEarnings = bookings.reduce((sum, b) => sum + (b.totalPrice || 0), 0);
      
      stats = {
        totalListings,
        totalBookings,
        totalEarnings,
        avgRating: '4.5'
      };
    }
    
    res.render("auth/profile", {
      pageTitle: "My Profile",
      currentPage: "profile",
      isLoggedIn: true,
      user,
      stats,
      errors: []
    });
  } catch (err) {
    console.error('Profile error:', err);
    res.redirect('/');
  }
}

exports.postUpdateProfile = async (req, res, next) => {
  try {
    const { firstName, lastName } = req.body;
    const userId = req.session.user._id;
    
    await User.findByIdAndUpdate(userId, { firstName, lastName });
    
    // Update session
    req.session.user.firstName = firstName;
    req.session.user.lastName = lastName;
    await req.session.save();
    
    res.redirect('/profile');
  } catch (err) {
    console.error('Update profile error:', err);
    res.redirect('/profile');
  }
}

exports.getChangePassword = (req, res, next) => {
  res.render("auth/change-password", {
    pageTitle: "Change Password",
    currentPage: "profile",
    isLoggedIn: true,
    user: req.session.user,
    errors: [],
    success: false
  });
}

exports.postChangePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword, confirmPassword } = req.body;
    const userId = req.session.user._id;
    
    const user = await User.findById(userId);
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    
    if (!isMatch) {
      return res.render("auth/change-password", {
        pageTitle: "Change Password",
        currentPage: "profile",
        isLoggedIn: true,
        user: req.session.user,
        errors: ["Current password is incorrect"],
        success: false
      });
    }
    
    if (newPassword !== confirmPassword) {
      return res.render("auth/change-password", {
        pageTitle: "Change Password",
        currentPage: "profile",
        isLoggedIn: true,
        user: req.session.user,
        errors: ["New passwords do not match"],
        success: false
      });
    }
    
    if (newPassword.length < 8) {
      return res.render("auth/change-password", {
        pageTitle: "Change Password",
        currentPage: "profile",
        isLoggedIn: true,
        user: req.session.user,
        errors: ["Password must be at least 8 characters"],
        success: false
      });
    }
    
    const hashedPassword = await bcrypt.hash(newPassword, 12);
    await User.findByIdAndUpdate(userId, { password: hashedPassword });
    
    res.render("auth/change-password", {
      pageTitle: "Change Password",
      currentPage: "profile",
      isLoggedIn: true,
      user: req.session.user,
      errors: [],
      success: true
    });
  } catch (err) {
    console.error('Change password error:', err);
    res.redirect('/profile');
  }
}
