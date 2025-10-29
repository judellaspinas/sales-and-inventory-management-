import mongoose, { Schema, model } from "mongoose";
import { randomUUID } from "crypto";
import bcrypt from "bcrypt";
import {
  type User,
  type InsertUser,
  type Session,
  type RegisterRequest,
  type Product,
  type InsertProduct,
  type UpdateProduct,
  type Order,
  type InsertOrder,
  type UpdateOrder,
} from "@shared/schema";

/* ----------------------------- INTERFACE ---------------------------- */

export interface IStorage {
  unlockUserAccount: any;
  updateUserPassword(username: any, hashed: string): unknown;
  // Users
  getUser(id: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  registerUser(userData: Omit<RegisterRequest, "confirmPassword">): Promise<User>;
  updateUser(id: string, updates: Partial<User>): Promise<User | undefined>;
  createSession(userId: string): Promise<Session>;
  getSession(sessionId: string): Promise<Session | undefined>;
  deleteSession(sessionId: string): Promise<boolean>;
  incrementLoginAttempts(username: string): Promise<void>;
  resetLoginAttempts(username: string): Promise<void>;
  setCooldown(username: string, cooldownUntil: Date | null): Promise<void>;
  clearCooldown(username: string): Promise<void>;

  // Products
  getAllProducts(): Promise<Product[]>;
  getProduct(id: string): Promise<Product | undefined>;
  createProduct(product: InsertProduct): Promise<Product>;
  updateProduct(id: string, updates: UpdateProduct): Promise<Product | undefined>;
  deleteProduct(id: string): Promise<boolean>;

  // Orders
  getAllOrders(): Promise<Order[]>;
  getOrder(id: string): Promise<Order | undefined>;
  getOrdersByUser(userId: string): Promise<Order[]>;
  createOrder(order: InsertOrder): Promise<Order>;
  updateOrder(id: string, updates: UpdateOrder): Promise<Order | undefined>;
  deleteOrder(id: string): Promise<boolean>;
}

/* ----------------------------- Mongoose Models ---------------------------- */

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    firstName: { type: String, default: null },
    lastName: { type: String, default: null },
    email: { type: String, default: null },
    phone: { type: String, default: null },
    role: { type: String, default: "Admin" },
    supply: { type: String, default: null },
    supplyQuantity: { type: Number, default: null },
    loginAttempts: { type: Number, default: 0 },
    lastFailedLogin: { type: Date, default: null },
    cooldownUntil: { type: Date, default: null },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
const UserModel = model("User", UserSchema);

const ProductSchema = new Schema(
  {
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true },
    weighted: { type: Boolean, default: false },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
const ProductModel = model("Product", ProductSchema);

const OrderSchema = new Schema(
  {
    userId: { type: String, required: true },
    productId: { type: String, required: true },
    quantity: { type: Number, required: true },
    status: {
      type: String,
      enum: ["pending", "confirmed", "shipped", "delivered", "cancelled"],
      default: "pending",
    },
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
const OrderModel = model("Order", OrderSchema);

const SessionSchema = new Schema(
  {
    id: { type: String, unique: true, index: true },
    userId: { type: String, required: true },
    expiresAt: { type: Date, required: true, index: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
SessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
const SessionModel = model("Session", SessionSchema);

/* ------------------------------- Mappers ---------------------------------- */

function mapUser(doc: any): User {
  if (!doc) return undefined as any;
  return {
    id: doc._id.toString(),
    username: doc.username,
    password: doc.password,
    firstName: doc.firstName,
    lastName: doc.lastName,
    email: doc.email,
    phone: doc.phone,
    role: doc.role,
    supply: doc.supply,
    supplyQuantity: doc.supplyQuantity,
    loginAttempts: doc.loginAttempts ?? 0,
    lastFailedLogin: doc.lastFailedLogin ?? null,
    cooldownUntil: doc.cooldownUntil ?? null,
    createdAt: doc.createdAt ?? new Date(),
  };
}

function mapProduct(doc: any): Product {
  if (!doc) return undefined as any;
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description || "",
    price: doc.price || 0,
    quantity: doc.quantity || 0,
    weighted: doc.weighted || false,
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
  };
}

function mapOrder(doc: any): Order {
  return {
    id: doc._id.toString(),
    userId: doc.userId,
    productId: doc.productId,
    quantity: doc.quantity,
    status: doc.status,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

function mapSession(doc: any): Session {
  return {
    id: doc.id,
    userId: doc.userId,
    expiresAt: doc.expiresAt,
    createdAt: doc.createdAt,
  };
}

/* ----------------------------- Storage Class ------------------------------ */

class MongoStorage implements IStorage {
  /* -------------------- Users -------------------- */
  async getUser(id: string): Promise<User | undefined> {
    const doc = await UserModel.findById(id).lean();
    return doc ? mapUser(doc) : undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const doc = await UserModel.findOne({ username }).lean();
    return doc ? mapUser(doc) : undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const hashedPassword = await bcrypt.hash(insertUser.password, 10);
    const doc = await UserModel.create({
      ...insertUser,
      password: hashedPassword,
      loginAttempts: 0,
      cooldownUntil: null,
      createdAt: new Date(),
    });
    return mapUser(doc.toObject());
  }

  async registerUser(userData: Omit<RegisterRequest, "confirmPassword">): Promise<User> {
    const existing = await UserModel.findOne({ username: userData.username }).lean();
    if (existing) throw new Error("Username already exists");

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const doc = await UserModel.create({
      ...userData,
      password: hashedPassword,
      loginAttempts: 0,
      cooldownUntil: null,
      createdAt: new Date(),
    });
    return mapUser(doc.toObject());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const doc = await UserModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    return doc ? mapUser(doc) : undefined;
  }

    /* -------------------- Admin Controls -------------------- */
    async updateUserPassword(username: string, hashed: string): Promise<void> {
      await UserModel.updateOne(
        { username },
        { $set: { password: hashed, loginAttempts: 0, cooldownUntil: null } }
      );
    }
  
    async unlockUserAccount(username: string): Promise<void> {
      await UserModel.updateOne(
        { username },
        { $set: { loginAttempts: 0, cooldownUntil: null } }
      );
    }  

  /* -------------------- Sessions -------------------- */
  async createSession(userId: string): Promise<Session> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const doc = await SessionModel.create({ id, userId, expiresAt, createdAt: new Date() });
    return mapSession(doc.toObject());
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const doc = await SessionModel.findOne({ id: sessionId }).lean();
    if (!doc || (doc.expiresAt && doc.expiresAt < new Date())) {
      if (doc) await SessionModel.deleteOne({ id: sessionId });
      return undefined;
    }
    return mapSession(doc);
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await SessionModel.deleteOne({ id: sessionId });
    return res.deletedCount === 1;
  }

  /* -------------------- Login Security -------------------- */
  async incrementLoginAttempts(username: string): Promise<void> {
    await UserModel.updateOne(
      { username },
      { $inc: { loginAttempts: 1 }, $set: { lastFailedLogin: new Date() } }
    );
  }

  async resetLoginAttempts(username: string): Promise<void> {
    await UserModel.updateOne(
      { username },
      { $set: { loginAttempts: 0, lastFailedLogin: null, cooldownUntil: null } }
    );
  }

  async setCooldown(username: string, cooldownUntil: Date | null): Promise<void> {
    await UserModel.updateOne(
      { username },
      { $set: { cooldownUntil, loginAttempts: 0 } }
    );
  }

  async clearCooldown(username: string): Promise<void> {
    await UserModel.updateOne(
      { username },
      { $set: { cooldownUntil: null, loginAttempts: 0 } }
    );
  }

  /* -------------------- Products -------------------- */
  async getAllProducts(): Promise<Product[]> {
    const docs = await ProductModel.find({}).lean();
    return docs.map(mapProduct);
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const doc = await ProductModel.findById(id).lean();
    return doc ? mapProduct(doc) : undefined;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
    const doc = await ProductModel.create({
      ...productData,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return mapProduct(doc.toObject());
  }

  async updateProduct(id: string, updates: UpdateProduct): Promise<Product | undefined> {
    const doc = await ProductModel.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc ? mapProduct(doc) : undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const res = await ProductModel.deleteOne({ _id: id });
    return res.deletedCount === 1;
  }

  /* -------------------- Orders -------------------- */
  async getAllOrders(): Promise<Order[]> {
    const docs = await OrderModel.find({}).lean();
    return docs.map(mapOrder);
  }

  async getOrder(id: string): Promise<Order | undefined> {
    const doc = await OrderModel.findById(id).lean();
    return doc ? mapOrder(doc) : undefined;
  }

  async getOrdersByUser(userId: string): Promise<Order[]> {
    const docs = await OrderModel.find({ userId }).lean();
    return docs.map(mapOrder);
  }

  async createOrder(orderData: InsertOrder): Promise<Order> {
    const doc = await OrderModel.create({
      ...orderData,
      status: "pending",
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    return mapOrder(doc.toObject());
  }

  async updateOrder(id: string, updates: UpdateOrder): Promise<Order | undefined> {
    const doc = await OrderModel.findByIdAndUpdate(
      id,
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc ? mapOrder(doc) : undefined;
  }

  async deleteOrder(id: string): Promise<boolean> {
    const res = await OrderModel.deleteOne({ _id: id });
    return res.deletedCount === 1;
  }
}

/* ----------------------------- EXPORT ------------------------------ */

export const storage: IStorage = new MongoStorage();
