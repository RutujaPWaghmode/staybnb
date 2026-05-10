// External Module
const express = require("express");
const authRouter = express.Router();

// Local Module
const authController = require("../controllers/authController");

// Auth middleware
const isAuth = (req, res, next) => {
  if (!req.session.isLoggedIn) {
    return res.redirect('/login');
  }
  next();
};

authRouter.get("/login", authController.getLogin);
authRouter.post("/login", authController.postLogin);
authRouter.post("/logout", authController.postLogout);
authRouter.get("/signup", authController.getSignup);
authRouter.post("/signup", authController.postSignup);

// Profile routes (protected)
authRouter.get("/profile", isAuth, authController.getProfile);
authRouter.post("/profile/update", isAuth, authController.postUpdateProfile);
authRouter.get("/profile/change-password", isAuth, authController.getChangePassword);
authRouter.post("/profile/change-password", isAuth, authController.postChangePassword);

module.exports = authRouter;
