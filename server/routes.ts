import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import {
  loginSchema,
  registerSchema,
} from "@shared/schema";
import bcrypt from "bcrypt";
import { ZodError } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  /* ==========================
     AUTHENTICATION ROUTES
  ========================== */

  app.post("/api/login", async (req, res) => {
    try {
      const { username, password } = loginSchema.parse(req.body);
      const user = await storage.getUserByUsername(username);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });

      // Check cooldown
      if (user.cooldownUntil && user.cooldownUntil > new Date()) {
        const remaining = Math.ceil((user.cooldownUntil.getTime() - Date.now()) / 1000);
        return res.status(429).json({
          message: "Account temporarily locked. Try again later.",
          cooldownUntil: user.cooldownUntil,
          remainingSeconds: remaining,
        });
      }

      const isValid = await bcrypt.compare(password, user.password);
      if (!isValid) {
        await storage.incrementLoginAttempts(username);

        if ((user.loginAttempts || 0) >= 2) {
          const cooldownUntil = new Date(Date.now() + 5 * 60 * 1000);
          await storage.setCooldown(username, cooldownUntil);
          return res.status(429).json({
            message: "Too many failed attempts. Account locked for 5 minutes.",
            cooldownUntil,
          });
        }

        return res.status(401).json({ message: "Invalid credentials" });
      }

      await storage.resetLoginAttempts(username);
      const session = await storage.createSession(user.id);

      res.cookie("sessionId", session.id, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 24 * 60 * 60 * 1000,
      });

      const { password: _, ...safeUser } = user;
      res.json({ user: safeUser, session });
    } catch {
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  app.post("/api/register", async (req, res) => {
    try {
      console.log("POST /api/register body:", req.body);

      const userData = registerSchema.parse(req.body);
      const { confirmPassword, ...userWithoutConfirm } = userData;
      const user = await storage.registerUser(userWithoutConfirm);

      const { password: _, ...safeUser } = user;
      res.status(201).json({ user: safeUser });
    } catch (error: any) {
      if (error instanceof ZodError) {
        console.error("Zod validation errors:", error.errors);
        return res.status(400).json({
          message: "Invalid request data",
          errors: error.errors,
        });
      }

      if (error.message === "Username already exists") {
        return res.status(409).json({ message: error.message });
      }

      console.error("Register error:", error);
      res.status(400).json({ message: "Invalid request data" });
    }
  });

  app.post("/api/logout", async (req, res) => {
    const sessionId = req.cookies.sessionId;
    if (sessionId) await storage.deleteSession(sessionId);
    res.clearCookie("sessionId");
    res.json({ message: "Logged out successfully" });
  });

  /* ==========================
     ADMIN: RESET OR UNLOCK STAFF ACCOUNT
  ========================== */

  app.post("/api/admin/reset-password", async (req, res) => {
    try {
      const sessionId = req.cookies.sessionId;
      if (!sessionId) return res.status(401).json({ message: "Unauthorized" });

      const session = await storage.getSession(sessionId);
      if (!session) return res.status(401).json({ message: "Invalid session" });

      const adminUser = await storage.getUser(session.userId);
      if (!adminUser || adminUser.role.toLowerCase() !== "admin") {
        return res.status(403).json({ message: "Access denied" });
      }

      const { username, newPassword } = req.body;
      if (!username) return res.status(400).json({ message: "Username is required" });

      const staff = await storage.getUserByUsername(username);
      if (!staff) return res.status(404).json({ message: "User not found" });

      if (newPassword && newPassword.trim().length > 0) {
        const hashed = await bcrypt.hash(newPassword, 10);
        await storage.updateUserPassword(username, hashed);
      } else {
        await storage.unlockUserAccount(username);
      }

      res.json({
        message: `Account for '${username}' has been ${
          newPassword ? "unlocked and password reset" : "unlocked"
        }.`,
      });
    } catch (err) {
      console.error("Admin reset error:", err);
      res.status(500).json({ message: "Server error" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}

import TransactionPage from "@/pages/TransactionPage";
import Dashboard from "@/pages/dashboard";

export const routes = [
  { path: "/", component: Dashboard },
  { path: "/transaction", component: TransactionPage },
  // ... other routes
];

