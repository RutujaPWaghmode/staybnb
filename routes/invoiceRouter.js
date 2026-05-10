const express = require("express");
const invoiceRouter = express.Router();

const invoiceController = require("../controllers/invoiceController");

// Auth guard - all invoice routes require a logged-in user
const requireLogin = (req, res, next) => {
  if (!req.isLoggedIn) {
    return res.redirect("/login");
  }
  next();
};

// GET download PDF invoice
invoiceRouter.get("/:bookingId", requireLogin, invoiceController.downloadInvoice);

// GET invoice data as JSON
invoiceRouter.get("/data/:bookingId", requireLogin, invoiceController.getInvoiceData);

module.exports = invoiceRouter;
