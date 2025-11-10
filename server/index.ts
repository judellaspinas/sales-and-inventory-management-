import express, { type Request, Response, NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes.js"; // keep .js for ESM
import { setupVite, serveStatic, log } from "./vite";

import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// --- Logging Middleware ---
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

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

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

// -------------------- Async Setup --------------------
(async () => {
  // --- MongoDB Connection ---
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/loginDB";
  mongoose.set("strictQuery", true);
  try {
    await mongoose.connect(uri);
    log("✅ MongoDB connected");
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }

  // --- Register API Routes ---
  await registerRoutes(app);

  // --- Serve frontend ---
  if (process.env.NODE_ENV === "development") {
    await setupVite(app); // dev only
  } else {
    serveStatic(app); // production
  }
})().catch(err => {
  console.error("Failed to initialize server:", err);
  process.exit(1);
});

// --- Global Error Handler ---
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
  console.error("Server error:", err);
});

// --- Export the app for Vercel Serverless ---
export default app;
