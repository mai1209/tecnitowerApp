import "dotenv/config";
import express from "express";
import cors from "cors";

import { connectMongo, disconnectMongo } from "./database/connectMongo.js";
import authRoutes from "./routes/authRoutes.js";
import modbusRoutes from "./routes/modbusRoutes.js";
import controllerRoutes from "./routes/controllerRoutes.js";
import dixellModelRoutes from "./routes/dixellModelRoutes.js";
import { errorHandler, notFoundHandler } from "./middlewares/errorHandler.js";
import { startMqttListener } from "./mqtt/mqttListener.js";
import { startTcpGatewayServer, stopTcpGatewayServer } from "./tcp/elfinTcpGatewayServer.js";

const app = express();
app.use(cors());
app.use(express.json());

const PORT = Number(process.env.PORT ?? 3001);
const HOST = process.env.HOST ?? "0.0.0.0";

app.use("/api/auth", authRoutes);
app.use("/api/modbus", modbusRoutes);
app.use("/api/controllers", controllerRoutes);
app.use("/api/dixell-models", dixellModelRoutes);
app.use("/api/device-models", dixellModelRoutes);

app.get("/api/health", (_req, res) => {
  res.json({
    service: "tecnitower-api",
    status: "ok",
    timestamp: new Date().toISOString(),
  });
});

app.use(notFoundHandler);
app.use(errorHandler);

let server = null;
let tcpGatewayServer = null;
// Cambiamos esto para que sea accesible si es necesario, 
// aunque lo ideal es importarlo desde el mqttService
let mqttClientInstance = null; 

async function shutdown(signal, exitCode = 0) {
  try {
    console.log(`[SHUTDOWN] Recibida señal ${signal}, cerrando recursos...`);
    
    if (server) {
      server.close();
      console.log("✔ HTTP server cerrado");
    }

    if (mqttClientInstance) {
      mqttClientInstance.end(true);
      console.log("✔ MQTT client desconectado");
    }

    if (tcpGatewayServer) {
      await stopTcpGatewayServer();
      tcpGatewayServer = null;
      console.log("✔ TCP gateway cerrado");
    }

    await disconnectMongo();
    console.log("✔ MongoDB desconectado");

    setTimeout(() => process.exit(exitCode), 500);
  } catch (err) {
    console.error("Error durante shutdown:", err);
    process.exit(1);
  }
}

async function bootstrap() {
  try {
    await connectMongo();
    
    // Iniciamos el listener y guardamos la instancia
    mqttClientInstance = startMqttListener();
    tcpGatewayServer = startTcpGatewayServer();

    server = app.listen(PORT, HOST, () => {
      console.log(`🚀 Servidor listo en http://${HOST}:${PORT}`);
    });

    process.on("SIGINT", () => shutdown("SIGINT", 0));
    process.on("SIGTERM", () => shutdown("SIGTERM", 0));
  } catch (err) {
    console.error("❌ Error iniciando el servidor:", err);
    await shutdown("bootstrap_error", 1);
  }
}

bootstrap();

/**
 * Filtro de errores para evitar que el servidor se caiga por 
 * problemas temporales de red con los Elfin/Dixell
 */
function isIgnorableError(err) {
  const msg = err?.message?.toLowerCase() || "";
  return (
    msg.includes("connection timed out") ||
    msg.includes("timeout esperando respuesta tcp del elfin") ||
    msg.includes("elfin tcp client no conectado") ||
    msg.includes("elfin tcp client ocupado") ||
    msg.includes("modbus exception") ||
    msg.includes("socket hang up") ||
    msg.includes("econnrefused")
  );
}

process.on("unhandledRejection", (reason) => {
  if (isIgnorableError(reason)) {
    console.warn("⚠️ Advertencia Modbus/Red controlada:", reason.message || reason);
    return;
  }
  console.error("🚨 Critical Unhandled Rejection:", reason);
  shutdown("unhandledRejection", 1);
});

process.on("uncaughtException", (err) => {
  if (isIgnorableError(err)) {
    console.warn("⚠️ Advertencia Modbus/Red controlada:", err.message);
    return;
  }
  console.error("🚨 Critical Uncaught Exception:", err);
  shutdown("uncaughtException", 1);
});

process.once("SIGUSR2", async () => {
  await shutdown("SIGUSR2", 0);
  process.kill(process.pid, "SIGUSR2");
});
