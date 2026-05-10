// Load environment variables
require('dotenv').config();

// Core Module
const path = require('path');

// External Module
const express = require('express');
const session = require('express-session');
const MongoDBStore = require('connect-mongodb-session')(session);
const { default: mongoose } = require('mongoose');
const multer = require('multer');

// Database configuration
let DB_PATH = process.env.MONGODB_URI || "mongodb://localhost:27017/airbnb";
const SESSION_SECRET = process.env.SESSION_SECRET || "KnowledgeGate AI with Complete Coding";
const PORT = process.env.PORT || 8090;

//Local Module
const storeRouter = require("./routes/storeRouter")
const hostRouter = require("./routes/hostRouter")
const authRouter = require("./routes/authRouter")
const bookingRouter = require("./routes/bookingRouter")
const paymentRouter = require("./routes/paymentRouter")
const invoiceRouter = require("./routes/invoiceRouter")
const pricingRouter = require("./routes/pricingRouter")
const rootDir = require("./utils/pathUtil");
const errorsController = require("./controllers/errors");
const emailService = require("./services/emailService");
const pricingController = require("./controllers/pricingController");

const app = express();

app.set('view engine', 'ejs');
app.set('views', 'views');

const randomString = (length) => {
  const characters = 'abcdefghijklmnopqrstuvwxyz';
  let result = '';
  for (let i = 0; i < length; i++) {
    result += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  return result;
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, "uploads/");
  },
  filename: (req, file, cb) => {
    cb(null, randomString(10) + '-' + file.originalname);
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype === 'image/png' || file.mimetype === 'image/jpg' || file.mimetype === 'image/jpeg') {
    cb(null, true);
  } else {
    cb(null, false);
  }
}

const multerOptions = {
  storage, fileFilter
};

app.use(express.urlencoded({ extended: true }));
app.use(express.json());
app.use(multer(multerOptions).single('photo'));
app.use(express.static(path.join(rootDir, 'public')))
app.use("/uploads", express.static(path.join(rootDir, 'uploads')))
app.use("/host/uploads", express.static(path.join(rootDir, 'uploads')))
app.use("/homes/uploads", express.static(path.join(rootDir, 'uploads')))

// Start the server
async function startServer() {
  let mongoUri = DB_PATH;
  
  // If USE_MEMORY_DB is set, use mongodb-memory-server
  if (process.env.USE_MEMORY_DB === 'true') {
    try {
      const { MongoMemoryServer } = require('mongodb-memory-server');
      const mongoServer = await MongoMemoryServer.create();
      mongoUri = mongoServer.getUri();
      console.log('Using in-memory MongoDB for development');
    } catch (error) {
      console.error('Failed to start memory server:', error.message);
      console.log('Falling back to configured MongoDB URI');
    }
  }
  
  // Create session store after we have the correct URI
  const store = new MongoDBStore({
    uri: mongoUri,
    collection: 'sessions'
  });
  
  // Handle MongoDB session store errors
  store.on('error', function(error) {
    console.error('MongoDB Session Store Error:', error);
  });
  
  app.use(session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store,
    cookie: {
      maxAge: 1000 * 60 * 60 * 24 // 24 hours
    }
  }));
  
  app.use((req, res, next) => {
    req.isLoggedIn = req.session.isLoggedIn
    next();
  })
  
  app.use(authRouter)
  app.use("/bookings", bookingRouter);
  app.use("/payment", paymentRouter);
  app.use("/invoice", invoiceRouter);
  app.use(storeRouter);
  app.use("/host", (req, res, next) => {
    if (req.isLoggedIn) {
      next();
    } else {
      res.redirect("/login");
    }
  });
  app.use("/host", hostRouter);
  
  // Pricing routes
  app.use("/pricing", pricingRouter);
  
  // Pricing API routes (public)
  app.get("/api/pricing/calculate", pricingController.apiCalculatePrice);
  app.get("/api/pricing/preview/:listingId", pricingController.apiPricingPreview);
  app.get("/api/pricing/rules", pricingController.apiGetRules);
  
  app.use(errorsController.pageNotFound);
  
  try {
    await mongoose.connect(mongoUri);
    console.log('Connected to MongoDB');
    
    // Start RabbitMQ email consumer (non-blocking, fails silently if RabbitMQ unavailable)
    emailService.startEmailConsumer().catch(err => {
      console.log('Email consumer not started (RabbitMQ may not be running):', err.message);
    });
    
    app.listen(PORT, () => {
      console.log(`Server running on address http://localhost:${PORT}`);
    });
  } catch (err) {
    console.error('Error while connecting to MongoDB:', err.message);
    console.log('\nPlease ensure MongoDB is running or set USE_MEMORY_DB=true in .env for development');
    console.log('\nTo install MongoDB locally, visit: https://www.mongodb.com/docs/manual/installation/');
    process.exit(1);
  }
}

startServer();
