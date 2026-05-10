# Airbnb Clone Application

A full-stack Airbnb clone application built with Node.js, Express, MongoDB, and Tailwind CSS.

## Features

- User authentication (signup/login/logout)
- Two user types: Guest and Host
- Home listings management (CRUD operations)
- Image upload functionality
- Favorites system
- Session-based authentication
- Responsive design with Tailwind CSS

## Tech Stack

- **Backend**: Node.js, Express.js
- **Database**: MongoDB (with Mongoose ODM)
- **Templating**: EJS
- **CSS**: Tailwind CSS
- **Authentication**: bcryptjs, express-session
- **Validation**: express-validator
- **File Upload**: Multer

## Prerequisites

- Node.js >= 16.0.0 (recommended: 18.x)
- MongoDB (local installation or MongoDB Atlas account)
- npm or yarn

## Installation

1. **Clone the repository** (if applicable)

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Copy the example environment file:
   ```bash
   cp .env.example .env
   ```
   
   Edit `.env` file with your configuration:
   ```env
   # For production with MongoDB Atlas:
   MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/airbnb?retryWrites=true&w=majority
   
   # For local MongoDB:
   MONGODB_URI=mongodb://localhost:27017/airbnb
   
   # For development without MongoDB installed:
   USE_MEMORY_DB=true
   
   SESSION_SECRET=your-secret-key-change-in-production
   PORT=3003
   ```

4. **Build Tailwind CSS**
   ```bash
   npm run tailwind:build
   ```

## Running the Application

### Development Mode (with in-memory MongoDB)

If you don't have MongoDB installed, you can use the in-memory database:

1. Set `USE_MEMORY_DB=true` in your `.env` file
2. Run the server:
   ```bash
   npm run dev
   ```
   
   Note: Data will not persist when the server restarts.

### Development Mode (with local/Atlas MongoDB)

1. Ensure MongoDB is running locally or you have a valid MongoDB Atlas connection string
2. Set `USE_MEMORY_DB=false` in your `.env` file
3. Run the server:
   ```bash
   npm run dev
   ```

### Production Mode

```bash
npm start
```

### With Tailwind CSS Watch

To run both the server and Tailwind CSS in watch mode:

**Terminal 1:**
```bash
npm run dev
```

**Terminal 2:**
```bash
npm run tailwind
```

## Available Scripts

| Script | Description |
|--------|-------------|
| `npm start` | Start the production server |
| `npm run dev` | Start the development server with nodemon |
| `npm run tailwind` | Watch and compile Tailwind CSS |
| `npm run tailwind:build` | Build and minify Tailwind CSS for production |

## Project Structure

```
├── app.js                 # Main application entry point
├── package.json           # Project dependencies and scripts
├── tailwind.config.js     # Tailwind CSS configuration
├── nodemon.json          # Nodemon configuration
├── .env                  # Environment variables (create from .env.example)
├── .env.example          # Example environment variables
├── controllers/          # Route controllers
│   ├── authController.js  # Authentication logic
│   ├── hostController.js  # Host/CRUD operations
│   ├── storeController.js # Store/listing pages
│   └── errors.js         # Error handling
├── models/               # Mongoose models
│   ├── home.js           # Home listing model
│   └── user.js           # User model
├── routes/               # Express routes
│   ├── authRouter.js     # Auth routes
│   ├── hostRouter.js     # Host routes
│   └── storeRouter.js    # Store routes
├── views/                # EJS templates
│   ├── auth/             # Authentication pages
│   ├── host/             # Host management pages
│   ├── store/            # Store/listing pages
│   └── partials/         # Reusable components
├── public/               # Static files
│   ├── output.css        # Compiled Tailwind CSS
│   ├── home.css          # Additional styles
│   └── images/           # Static images
├── uploads/              # Uploaded images
└── utils/                # Utility functions
    └── pathUtil.js       # Path utilities
```

## API Routes

### Authentication
- `GET /login` - Login page
- `POST /login` - Login user
- `GET /signup` - Signup page
- `POST /signup` - Register user
- `POST /logout` - Logout user

### Store (Public)
- `GET /` - Home page
- `GET /homes` - List all homes
- `GET /homes/:homeId` - Home details

### Store (Authenticated)
- `GET /favourites` - User's favorites
- `POST /favourites` - Add to favorites
- `POST /favourites/delete/:homeId` - Remove from favorites
- `GET /bookings` - User's bookings

### Host (Authenticated)
- `GET /host/add-home` - Add home form
- `POST /host/add-home` - Create home listing
- `GET /host/host-home-list` - Host's listings
- `GET /host/edit-home/:homeId` - Edit home form
- `POST /host/edit-home` - Update home listing
- `POST /host/delete-home/:homeId` - Delete home listing

## Troubleshooting

### Node.js Version Issues

If you encounter syntax errors or compatibility issues, ensure you're using Node.js 16+:

```bash
# Install NVM (Node Version Manager)
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Install and use Node.js 18
nvm install 18
nvm use 18
```

### MongoDB Connection Issues

1. **Using in-memory database for development:**
   Set `USE_MEMORY_DB=true` in `.env`

2. **Local MongoDB not running:**
   - Install MongoDB: https://www.mongodb.com/docs/manual/installation/
   - Start MongoDB service: `sudo systemctl start mongod`

3. **MongoDB Atlas connection issues:**
   - Check your connection string format
   - Ensure your IP is whitelisted in Atlas
   - Verify username/password are correct

### Session/Login Issues

- Clear browser cookies
- Ensure MongoDB is connected (sessions are stored in MongoDB)
- Check SESSION_SECRET is set in `.env`

## License

ISC

## Author

Knowledge Gate AI
