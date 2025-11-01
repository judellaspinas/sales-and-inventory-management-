import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { createServer } from "http";

dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

/* =========================
   Request Logging Middleware
========================= */
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 120) logLine = logLine.slice(0, 119) + "…";
      log(logLine);
    }
  });

  next();
});

(async () => {
  /* =========================
     MongoDB Connection
  ========================= */
  const uri =
    process.env.MONGODB_URI || process.env.MONGO_URI || "mongodb://127.0.0.1:27017/loginDB";

  try {
    mongoose.set("strictQuery", true);
    await mongoose.connect(uri);
    log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }

  const server = createServer(app); // ✅ Create HTTP server here
  await registerRoutes(app);

  /* =========================
     Global Error Handler
  ========================= */
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    res.status(status).json({ message: err.message || "Internal Server Error" });
    console.error("Server error:", err);
  });

  /* =========================
     Environment Handling
  ========================= */
  if (app.get("env") === "development") {
    // ✅ Pass both app and server to setupVite (fixes your TS error)
    await setupVite(app, server);

    const port = parseInt(process.env.PORT || "3000", 10);
    server.listen(port, () => log(`✅ Dev server running at http://localhost:${port}`));
  } else {
    // ✅ For production (Vercel), no server.listen()
    serveStatic(app);
  }

  /* =========================
     Graceful Shutdown
  ========================= */
  const shutdown = async () => {
    try {
      await mongoose.disconnect();
      log("🛑 MongoDB disconnected, shutting down server...");
    } finally {
      process.exit(0);
    }
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
})();

/* =========================
   ✅ Export Express App for Vercel
========================= */
export default app;
