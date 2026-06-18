const mongoose = require('mongoose');

// Some local/dev networks can't resolve MongoDB SRV records (querySrv
// ECONNREFUSED), which mongodb+srv:// needs. Fall back to public DNS resolvers
// outside production. Railway resolves SRV fine, so production is left untouched.
if (process.env.NODE_ENV !== 'production') {
  try { require('dns').setServers(['8.8.8.8', '1.1.1.1']); } catch {}
}

const connectDB = async () => {
  // Accept common alternative names some hosts inject, but MONGO_URI is primary.
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL || process.env.DATABASE_URL;
  if (!uri) {
    console.error('❌ MONGO_URI is not set. Add it to your deployment environment variables ' +
      '(a cloud MongoDB connection string, e.g. mongodb+srv://...). The local .env file is git-ignored ' +
      'and not deployed, so the hosting platform must provide this value.');
    process.exit(1);
  }
  // Log connection lifecycle so transient drops are visible without crashing.
  mongoose.connection.on('disconnected', () => console.warn('⚠️  MongoDB disconnected — retrying…'));
  mongoose.connection.on('reconnected', () => console.log('✅ MongoDB reconnected'));

  // Retry with backoff instead of exiting the process. Exiting on a transient
  // failure (Atlas cold start, brief network blip, IP/auth not yet propagated)
  // turns one bad connect into a container crash-loop on the host.
  let attempt = 0;
  for (;;) {
    try {
      const conn = await mongoose.connect(uri, { serverSelectionTimeoutMS: 10000 });
      console.log(`MongoDB Connected: ${conn.connection.host}`);
      return;
    } catch (error) {
      attempt += 1;
      const wait = Math.min(30000, 2000 * attempt);   // 2s,4s,…capped 30s
      console.error(`MongoDB connection error (attempt ${attempt}): ${error.message}. Retrying in ${wait / 1000}s…`);
      await new Promise(r => setTimeout(r, wait));
    }
  }
};

module.exports = connectDB;
