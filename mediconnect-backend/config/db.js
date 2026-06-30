const mongoose = require('mongoose');

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    console.error('MongoDB connection failed: MONGO_URI is not defined');
    throw new Error('MONGO_URI is not defined');
  }

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 10000, // fail fast instead of hanging
      family: 4, // force IPv4 (avoids ECONNRESET on some networks)
    });
    console.log(`MongoDB connected: ${conn.connection.host}`);
    return conn;
  } catch (err) {
    console.error(`MongoDB connection failed: ${err.message}`);
    throw err;
  }
};

module.exports = connectDB;
