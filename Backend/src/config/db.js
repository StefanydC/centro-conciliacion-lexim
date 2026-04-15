const { MongoClient, ServerApiVersion } = require("mongodb");

let client;
let db;

const connectDB = async (mongoUri, dbName) => {
  if (!client) {
    client = new MongoClient(mongoUri, {
      serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true
      }
    });

    await client.connect();
  }

  db = client.db(dbName);
  await db.command({ ping: 1 });
  console.log(`backend connected to MongoDB database: ${dbName}`);

  return db;
};

const getDB = () => {
  if (!db) {
    throw new Error("Database is not initialized");
  }

  return db;
};

module.exports = { connectDB, getDB };
