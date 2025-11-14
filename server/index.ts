// server/index.ts
import express, { type Request, type Response, type NextFunction } from "express";
import cookieParser from "cookie-parser";
import { registerRoutes } from "./routes.js"; // named import
import mongoose from "mongoose";
import dotenv from "dotenv";
dotenv.config();

import { setupVite, serveStatic, log } from "./vite.js";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());

// ------------------ Logging Middleware ------------------
app.use((req, res, next) => {
  const start = Date.now();
  let capturedJsonResponse: Record<string, any> | undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    if (req.path.startsWith("/api")) {
      let logLine = `${req.method} ${req.path} ${res.statusCode} in ${Date.now() - start}ms`;
      if (capturedJsonResponse) logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      if (logLine.length > 100) logLine = logLine.slice(0, 99) + "…";
      log(logLine);
    }
  });

  next();
});

// ------------------ MongoDB Connection ------------------
let isConnected = false;
async function connectDB() {
  if (isConnected) return;
  const uri = process.env.MONGO_URI || "mongodb://127.0.0.1:27017/loginDB";
  mongoose.set("strictQuery", true);
  await mongoose.connect(uri);
  log("✅ MongoDB connected");
  isConnected = true;
}

// ------------------ Register API Routes ------------------
registerRoutes(app);

// ------------------ Global Error Handler (after routes) ------------------
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  res.status(status).json({ message: err.message || "Internal Server Error" });
  console.error("Server error:", err);
});

// ------------------ Frontend Setup ------------------
let frontendReady = false;
async function setupFrontendOnce() {
  if (frontendReady) return;
  if (process.env.NODE_ENV === "development") {
    await setupVite(app);
  } else {
    serveStatic(app);
  }
  frontendReady = true;
}

// ------------------ Serverless Handler ------------------
export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    await setupFrontendOnce();

    // Use Express as a "request handler"
    // Wrap in a promise to ensure Vercel waits for it
    await new Promise<void>((resolve, reject) => {
      app(req, res, (err?: any) => (err ? reject(err) : resolve()));
    });
  } catch (err) {
    console.error("Serverless handler error:", err);
    res.status(500).json({ message: "Server error" });
  }
}
