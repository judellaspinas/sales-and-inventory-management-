import { Schema, model } from "mongoose";
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
} from "@shared/schema";

/* ----------------------------- INTERFACE ---------------------------- */

export interface IStorage {
  getProductByManualId(id: any): Promise<Product | undefined>;
  unlockUserAccount(username: string): Promise<void>;
  updateUserPassword(username: string, hashed: string): Promise<void>;
  getAllUsers(): Promise<User[]>;

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
  deductProductStock(id: string, quantity: number): Promise<void>;

  // Reports
  getSalesReport(period: "daily" | "weekly"): Promise<{
    totalProductsSold: number;
    totalSales: number;
    lowStockProducts: Product[];
    timestamp: string;
  }>;
}

/* ----------------------------- MONGOOSE MODELS ---------------------------- */

const UserSchema = new Schema(
  {
    username: { type: String, required: true, unique: true, index: true },
    password: { type: String, required: true },
    firstName: String,
    lastName: String,
    email: String,
    phone: String,
    role: { type: String, default: "Admin" },
    supply: String,
    supplyQuantity: Number,
    loginAttempts: { type: Number, default: 0 },
    lastFailedLogin: Date,
    cooldownUntil: Date,
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
const UserModel = model("User", UserSchema);

const ProductSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    description: { type: String, default: "" },
    price: { type: Number, required: true, default: 0 },
    quantity: { type: Number, required: true },
    weighted: { type: Boolean, default: false },
    category: { type: String, required: true, default: "Uncategorized" }, 
    createdAt: { type: Date, default: () => new Date() },
    updatedAt: { type: Date, default: () => new Date() },

  },
  { versionKey: false }
);
const ProductModel = model("Product", ProductSchema);

/* ----------------------------- SALES MODEL ---------------------------- */

const SaleSchema = new Schema(
  {
    productId: { type: String, required: true },
    productName: { type: String, required: true },
    quantitySold: { type: Number, required: true },
    totalPrice: { type: Number, required: true },
    createdAt: { type: Date, default: () => new Date() },
  },
  { versionKey: false }
);
const SaleModel = model("Sale", SaleSchema);

/* ----------------------------- SESSION MODEL ---------------------------- */

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

/* ------------------------------- MAPPERS ---------------------------------- */

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
    id: doc.id || doc._id.toString(),
    name: doc.name,
    description: doc.description || "",
    price: doc.price || 0,
    quantity: doc.quantity || 0,
    weighted: doc.weighted || false,
     category: doc.category || "Uncategorized", 
    createdAt: doc.createdAt || new Date(),
    updatedAt: doc.updatedAt || new Date(),
    
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

/* ----------------------------- STORAGE CLASS ------------------------------ */

class MongoStorage implements IStorage {
  /* -------------------- USERS -------------------- */
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
    const doc = await UserModel.create({ ...insertUser, password: hashedPassword });
    return mapUser(doc.toObject());
  }

  async registerUser(userData: Omit<RegisterRequest, "confirmPassword">): Promise<User> {
    const exists = await UserModel.exists({ username: userData.username });
    if (exists) throw new Error("Username already exists");

    const hashedPassword = await bcrypt.hash(userData.password, 10);
    const doc = await UserModel.create({ ...userData, password: hashedPassword });
    return mapUser(doc.toObject());
  }

  async updateUser(id: string, updates: Partial<User>): Promise<User | undefined> {
    const doc = await UserModel.findByIdAndUpdate(id, updates, { new: true }).lean();
    return doc ? mapUser(doc) : undefined;
  }

  async getAllUsers(): Promise<User[]> {
    const docs = await UserModel.find({ role: { $in: ["staff", "supplier"] } }).lean();
    return docs.map(mapUser);
  }

  async updateUserPassword(username: string, hashed: string) {
    await UserModel.updateOne({ username }, { $set: { password: hashed } });
  }

  async unlockUserAccount(username: string) {
    await UserModel.updateOne({ username }, { $set: { loginAttempts: 0, cooldownUntil: null } });
  }

  async incrementLoginAttempts(username: string) {
    await UserModel.updateOne(
      { username },
      { $inc: { loginAttempts: 1 }, $set: { lastFailedLogin: new Date() } }
    );
  }

  async resetLoginAttempts(username: string) {
    await UserModel.updateOne(
      { username },
      { $set: { loginAttempts: 0, cooldownUntil: null, lastFailedLogin: null } }
    );
  }

  async setCooldown(username: string, cooldownUntil: Date | null) {
    await UserModel.updateOne({ username }, { $set: { cooldownUntil } });
  }

  async clearCooldown(username: string) {
    await UserModel.updateOne({ username }, { $set: { cooldownUntil: null } });
  }

  /* -------------------- PRODUCTS -------------------- */
  async getAllProducts(): Promise<Product[]> {
    const docs = await ProductModel.find({}).lean();
    return docs.map(mapProduct);
  }

  async getProductByManualId(id: string): Promise<Product | undefined> {
    let doc = await ProductModel.findOne({ id }).lean();
    if (!doc && /^[0-9a-fA-F]{24}$/.test(id)) doc = await ProductModel.findById(id).lean();
    return doc ? mapProduct(doc) : undefined;
  }

  async getProduct(id: string): Promise<Product | undefined> {
    const doc = await ProductModel.findOne({ id }).lean();
    return doc ? mapProduct(doc) : undefined;
  }

  async createProduct(productData: InsertProduct): Promise<Product> {
   const id = (productData as any).id || randomUUID();
    const doc = await ProductModel.create({ ...productData, id, createdAt: new Date(), updatedAt: new Date() });
    return mapProduct(doc.toObject());
  }

  async updateProduct(id: string, updates: UpdateProduct): Promise<Product | undefined> {
    const doc = await ProductModel.findOneAndUpdate(
      { id },
      { ...updates, updatedAt: new Date() },
      { new: true }
    ).lean();
    return doc ? mapProduct(doc) : undefined;
  }

  async deleteProduct(id: string): Promise<boolean> {
    const res = await ProductModel.deleteOne({ id });
    return res.deletedCount === 1;
  }

  async deductProductStock(id: string, quantity: number) {
    const product = await ProductModel.findOne({ id });
    if (!product) throw new Error("Product not found");

    product.quantity = Math.max(0, (product.quantity || 0) - quantity);
    product.updatedAt = new Date();
    await product.save();

    await SaleModel.create({
      productId: product.id,
      productName: product.name,
      quantitySold: quantity,
      totalPrice: (product.price || 0) * quantity,
      createdAt: new Date(),
    });
  }

  /* -------------------- REPORTS -------------------- */
  async getSalesReport(period: "daily" | "weekly") {
    const now = new Date();
    const startDate =
      period === "daily"
        ? new Date(now.getFullYear(), now.getMonth(), now.getDate())
        : new Date(now.getFullYear(), now.getMonth(), now.getDate() - 7);

    const sales = await SaleModel.find({ createdAt: { $gte: startDate } }).lean();
    const totalProductsSold = sales.reduce((sum, s) => sum + s.quantitySold, 0);
    const totalSales = sales.reduce((sum, s) => sum + s.totalPrice, 0);
    const lowStockProducts = await ProductModel.find({ quantity: { $lt: 10 } }).lean();

    return {
      totalProductsSold,
      totalSales,
      lowStockProducts: lowStockProducts.map(mapProduct),
      timestamp: new Date().toLocaleString(),
    };
  }

  /* -------------------- SESSIONS -------------------- */
  async createSession(userId: string): Promise<Session> {
    const id = randomUUID();
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const doc = await SessionModel.create({ id, userId, expiresAt });
    return mapSession(doc.toObject());
  }

  async getSession(sessionId: string): Promise<Session | undefined> {
    const doc = await SessionModel.findOne({ id: sessionId }).lean();
    return doc ? mapSession(doc) : undefined;
  }

  async deleteSession(sessionId: string): Promise<boolean> {
    const res = await SessionModel.deleteOne({ id: sessionId });
    return res.deletedCount === 1;
  }
}

export const storage: IStorage = new MongoStorage();

