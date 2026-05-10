const PDFDocument = require("pdfkit");

/**
 * Generate a PDF invoice for a booking
 * @param {Object} booking - Booking document with populated listingId and userId
 * @param {Object} res - Express response object to stream PDF
 */
exports.generateInvoicePDF = (booking, res) => {
  const doc = new PDFDocument({ margin: 50 });

  // Set response headers for PDF download
  const invoiceNumber = `INV-${booking._id.toString().slice(-8).toUpperCase()}`;
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader(
    "Content-Disposition",
    `attachment; filename=invoice-${invoiceNumber}.pdf`
  );

  // Pipe PDF to response
  doc.pipe(res);

  const listing = booking.listingId;
  const user = booking.userId;

  // Calculate nights
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));
  const pricePerNight = listing ? listing.price : booking.totalPrice / nights;

  // Header
  doc
    .fontSize(24)
    .fillColor("#EF4444")
    .text("Airbnb Clone", { align: "center" })
    .moveDown(0.5);

  doc
    .fontSize(18)
    .fillColor("#333333")
    .text("BOOKING INVOICE", { align: "center" })
    .moveDown(1);

  // Invoice details box
  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(`Invoice Number: ${invoiceNumber}`, 50)
    .text(`Invoice Date: ${new Date().toLocaleDateString("en-IN")}`)
    .text(`Booking Date: ${booking.createdAt.toLocaleDateString("en-IN")}`)
    .moveDown(1);

  // Horizontal line
  doc
    .strokeColor("#CCCCCC")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(1);

  // Guest Details Section
  doc
    .fontSize(14)
    .fillColor("#333333")
    .text("Guest Details", { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(`Name: ${user ? `${user.firstName} ${user.lastName || ""}` : "N/A"}`)
    .text(`Email: ${user ? user.email : "N/A"}`)
    .text(`User Type: ${user ? user.userType : "N/A"}`)
    .moveDown(1);

  // Property Details Section
  doc
    .fontSize(14)
    .fillColor("#333333")
    .text("Property Details", { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(`Property Name: ${listing ? listing.houseName : "Property Removed"}`)
    .text(`Location: ${listing ? listing.location : "N/A"}`)
    .text(`Rating: ${listing ? `${listing.rating}/5` : "N/A"}`)
    .moveDown(1);

  // Booking Details Section
  doc
    .fontSize(14)
    .fillColor("#333333")
    .text("Booking Details", { underline: true })
    .moveDown(0.5);

  doc
    .fontSize(10)
    .fillColor("#666666")
    .text(`Booking ID: ${booking._id}`)
    .text(`Check-in Date: ${checkIn.toDateString()}`)
    .text(`Check-out Date: ${checkOut.toDateString()}`)
    .text(`Number of Nights: ${nights}`)
    .text(`Booking Status: ${booking.bookingStatus.toUpperCase()}`)
    .text(`Payment Status: ${(booking.paymentStatus || "N/A").toUpperCase()}`)
    .moveDown(1);

  if (booking.razorpayPaymentId) {
    doc.text(`Payment ID: ${booking.razorpayPaymentId}`).moveDown(1);
  }

  // Horizontal line
  doc
    .strokeColor("#CCCCCC")
    .lineWidth(1)
    .moveTo(50, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(1);

  // Price Breakdown Table
  doc
    .fontSize(14)
    .fillColor("#333333")
    .text("Price Breakdown", { underline: true })
    .moveDown(0.5);

  // Table header
  const tableTop = doc.y;
  doc
    .fontSize(10)
    .fillColor("#333333")
    .text("Description", 50, tableTop)
    .text("Qty", 300, tableTop)
    .text("Rate", 380, tableTop)
    .text("Amount", 470, tableTop);

  // Table row
  const rowY = tableTop + 20;
  doc
    .fillColor("#666666")
    .text("Accommodation", 50, rowY)
    .text(`${nights} nights`, 300, rowY)
    .text(`₹${pricePerNight.toLocaleString("en-IN")}`, 380, rowY)
    .text(`₹${booking.totalPrice.toLocaleString("en-IN")}`, 470, rowY);

  // Total line
  doc.moveDown(2);
  doc
    .strokeColor("#CCCCCC")
    .lineWidth(1)
    .moveTo(350, doc.y)
    .lineTo(550, doc.y)
    .stroke()
    .moveDown(0.5);

  doc
    .fontSize(12)
    .fillColor("#333333")
    .text("Total Amount:", 350, doc.y)
    .fontSize(14)
    .fillColor("#16A34A")
    .text(`₹${booking.totalPrice.toLocaleString("en-IN")}`, 470, doc.y - 14);

  // Footer
  doc.moveDown(3);
  doc
    .fontSize(10)
    .fillColor("#999999")
    .text("Thank you for booking with Airbnb Clone!", { align: "center" })
    .moveDown(0.3)
    .text("For any queries, please contact support@airbnbclone.com", {
      align: "center",
    })
    .moveDown(2)
    .fontSize(8)
    .text("This is a computer-generated invoice and does not require a signature.", {
      align: "center",
    });

  // Finalize PDF
  doc.end();
};

/**
 * Generate invoice data object (for email attachments or other uses)
 */
exports.getInvoiceData = (booking) => {
  const listing = booking.listingId;
  const user = booking.userId;
  const checkIn = new Date(booking.checkInDate);
  const checkOut = new Date(booking.checkOutDate);
  const nights = Math.ceil((checkOut - checkIn) / (1000 * 60 * 60 * 24));

  return {
    invoiceNumber: `INV-${booking._id.toString().slice(-8).toUpperCase()}`,
    bookingId: booking._id.toString(),
    invoiceDate: new Date().toLocaleDateString("en-IN"),
    bookingDate: booking.createdAt.toLocaleDateString("en-IN"),
    guest: {
      name: user ? `${user.firstName} ${user.lastName || ""}` : "N/A",
      email: user ? user.email : "N/A",
    },
    property: {
      name: listing ? listing.houseName : "N/A",
      location: listing ? listing.location : "N/A",
    },
    checkIn: checkIn.toDateString(),
    checkOut: checkOut.toDateString(),
    nights,
    pricePerNight: listing ? listing.price : booking.totalPrice / nights,
    totalPrice: booking.totalPrice,
    bookingStatus: booking.bookingStatus,
    paymentStatus: booking.paymentStatus || "N/A",
    paymentId: booking.razorpayPaymentId || null,
  };
};
