require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const { MongoClient, ServerApiVersion } = require('mongodb');

const uri = process.env.MONGO_URI;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function conectarDB() {
  await client.connect();
  await client.db("admin").command({ ping: 1 });
  console.log("✅ Conectado correctamente a MongoDB");
  return client;
}

module.exports = { client, conectarDB };