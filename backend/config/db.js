const mongoose = require('mongoose');

const connectDB = async () => {
  // Accept common alternative names some hosts inject, but MONGO_URI is primary.
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
  if (!uri) {
    console.error('❌ MONGO_URI is not set. Add it to your deployment environment variables ' +
      '(a cloud MongoDB connection string, e.g. mongodb+srv://...). The local .env file is git-ignored ' +
      'and not deployed, so the hosting platform must provide this value.');
    process.exit(1);
  }
  try {
    const conn = await mongoose.connect(uri);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`MongoDB connection error: ${error.message}`);
    process.exit(1);
  }
};

module.exports = connectDB;
