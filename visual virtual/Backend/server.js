const { MongoClient, ServerApiVersion } = require('mongodb');

// 🔥 Usa conexión SIN SRV (reemplaza con la tuya)
const uri = "mongodb://santiagomartinezaaz009_db_user:Fy7lqQn6ADpDDB2G@ac-cl3k5su-shard-00-00.9joqo3s.mongodb.net:27017,ac-cl3k5su-shard-00-01.9joqo3s.mongodb.net:27017,ac-cl3k5su-shard-00-02.9joqo3s.mongodb.net:27017/?ssl=true&replicaSet=atlas-14lg3a-shard-0&authSource=admin&appName=ProyectoLexim";

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    console.log("⏳ Conectando...");

    await client.connect();

    await client.db("admin").command({ ping: 1 });

    console.log("✅ Conectado correctamente a MongoDB");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.close();
  }
}

run();