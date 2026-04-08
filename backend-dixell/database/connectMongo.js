import mongoose from "mongoose";

const DEFAULT_URI = "mongodb://127.0.0.1:27017/tecnitower";
const DEFAULT_DB_NAME = "tecnitower";
const DEFAULT_TIMEOUT = 5000;

let mongoReadyPromise;

export async function connectMongo() {
  if (mongoReadyPromise) return mongoReadyPromise;

  const uri = process.env.MONGODB_URI ?? DEFAULT_URI;
  const dbName = process.env.MONGODB_DB_NAME ?? DEFAULT_DB_NAME;
  const timeout = Number(process.env.MONGODB_TIMEOUT_MS ?? DEFAULT_TIMEOUT);

  if (!uri) {
    throw new Error("Falta la variable MONGODB_URI");
  }

  mongoose.set("strictQuery", true);

  mongoReadyPromise = mongoose.connect(uri, {
    dbName,
    serverSelectionTimeoutMS: timeout,
  });

  mongoose.connection.on("connected", () => {
    console.log(`[MongoDB] Conectado a ${mongoose.connection.name}`);
  });

  mongoose.connection.on("error", (err) => {
    console.error("[MongoDB] Error de conexión", err);
  });

  mongoose.connection.on("disconnected", () => {
    console.warn("[MongoDB] Conexión cerrada");
  });

  return mongoReadyPromise;
}

export async function disconnectMongo() {
  if (mongoose.connection.readyState !== 0) {
    await mongoose.connection.close();
  }
  mongoReadyPromise = null;
}
