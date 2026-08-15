import mysql from "mysql2/promise";
import dotenv from "dotenv";

dotenv.config();

const dbConfig = {
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "password",
  database: process.env.DB_NAME || "ecommerce_db",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
};

let pool = null;
let useMockDb = false;

// Mock database storage in RAM
let mockUsers = [
  {
    id: 1,
    name: "Store Administrator",
    email: "admin@ecommerce.com",
    password: "$2a$10$tZ2z/4d3j8yH22.e.PUpI.P92tXUeJ8xQo/hN2PvhT048w0Lz.5Iq",
    role: "admin",
    created_at: new Date(),
  },
  {
    id: 2,
    name: "John Doe User",
    email: "user@ecommerce.com",
    password: "$2a$10$wE99KqU.Y2p8K8O6W2WvxeR09lVd/uG2mHhUf4aL777lU.e/q3Sg6",
    role: "user",
    created_at: new Date(),
  },
];

let mockProducts = [
  {
    id: 1,
    name: "Spectre Gaming Laptop",
    description:
      "15.6 inch UHD display, Intel i9 CPU, 32GB RAM, 1TB NVMe SSD, NVIDIA RTX 4080 Graphics.",
    price: 1899.99,
    image_url: "/uploads/spectre_laptop.jpg",
    category: "Electronics",
    stock: 15,
    created_at: new Date(),
  },
  {
    id: 2,
    name: "Acoustic Pro Headphones",
    description:
      "Wireless over-ear headphones with advanced active noise cancelling, high fidelity sound, and 40 hour battery life.",
    price: 249.99,
    image_url: "/uploads/acoustic_headphones.jpg",
    category: "Electronics",
    stock: 40,
    created_at: new Date(),
  },
  {
    id: 3,
    name: "E-Reader Oasis",
    description:
      "6.8 inch glare-free screen, adjustable warm light, waterproof design, and 8GB storage.",
    price: 129.5,
    image_url: "/uploads/ereader_oasis.jpg",
    category: "Electronics",
    stock: 25,
    created_at: new Date(),
  },
  {
    id: 4,
    name: "Minimalist Leather Wallet",
    description:
      "Genuine full-grain leather slim wallet featuring RFID blocking tech and 6 card slots.",
    price: 35.0,
    image_url: "/uploads/leather_wallet.jpg",
    category: "Apparel",
    stock: 50,
    created_at: new Date(),
  },
  {
    id: 5,
    name: "Classic Canvas Backpack",
    description:
      "Water-resistant vintage travel backpack with padded laptop sleeve and durable brass buckles.",
    price: 59.99,
    image_url: "/uploads/canvas_backpack.jpg",
    category: "Apparel",
    stock: 35,
    created_at: new Date(),
  },
  {
    id: 6,
    name: "Ergonomic Mesh Chair",
    description:
      "High-back desk chair with 3D lumbar support, adjustable headrest, and armrests for office comfort.",
    price: 199.0,
    image_url: "/uploads/mesh_chair.jpg",
    category: "Home & Office",
    stock: 20,
    created_at: new Date(),
  },
  {
    id: 7,
    name: "Smart Thermo Mug",
    description:
      "Temperature control smart mug with LED display, leakproof lid, and 12-hour thermal retention.",
    price: 45.0,
    image_url: "/uploads/thermo_mug.jpg",
    category: "Home & Office",
    stock: 60,
    created_at: new Date(),
  },
  {
    id: 8,
    name: "Luxe Velvet Cushion",
    description:
      "Set of 2 ultra soft decorative throw pillow covers (18x18 inches) in midnight blue.",
    price: 22.99,
    image_url: "/uploads/velvet_cushion.jpg",
    category: "Home & Office",
    stock: 80,
    created_at: new Date(),
  },
];

let mockOrders = [];
let mockOrderItems = [];

// Evaluator for standard SQL queries to replicate MySQL response structures in JS RAM
async function evaluateMockQuery(sql, params = []) {
  const queryStr = sql.trim().replace(/\s+/g, " ");
  const queryLower = queryStr.toLowerCase();

  // 1. SELECT id FROM users WHERE email = ?
  if (queryLower.includes("select id from users where email =")) {
    const email = params[0];
    const u = mockUsers.find((user) => user.email === email);
    return u ? [{ id: u.id }] : [];
  }

  // 2. SELECT * FROM users WHERE email = ?
  if (queryLower.includes("select * from users where email =")) {
    const email = params[0];
    const u = mockUsers.find((user) => user.email === email);
    return u ? [u] : [];
  }

  // 3. SELECT id, name, email, role, created_at FROM users WHERE id = ?
  if (
    queryLower.includes(
      "select id, name, email, role, created_at from users where id =",
    )
  ) {
    const id = parseInt(params[0], 10);
    const u = mockUsers.find((user) => user.id === id);
    return u ? [u] : [];
  }

  // 4. INSERT INTO users (name, email, password, role)
  if (queryLower.startsWith("insert into users")) {
    const [name, email, password, role] = params;
    const newId = mockUsers.length + 1;
    const newUser = {
      id: newId,
      name,
      email,
      password,
      role,
      created_at: new Date(),
    };
    mockUsers.push(newUser);
    return { insertId: newId };
  }

  // 5. SELECT DISTINCT category FROM products
  if (queryLower.includes("select distinct category from products")) {
    const cats = [...new Set(mockProducts.map((p) => p.category))];
    return cats.map((cat) => ({ category: cat }));
  }

  // 6. SELECT * FROM products WHERE id = ?
  if (queryLower.includes("select * from products where id =")) {
    const id = parseInt(params[0], 10);
    const p = mockProducts.find((product) => product.id === id);
    return p ? [p] : [];
  }

  // 7. INSERT INTO products
  if (queryLower.startsWith("insert into products")) {
    const [name, description, price, image_url, category, stock] = params;
    const newId = mockProducts.length + 1;
    const newP = {
      id: newId,
      name,
      description,
      price: parseFloat(price),
      image_url,
      category,
      stock: parseInt(stock, 10),
      created_at: new Date(),
    };
    mockProducts.push(newP);
    return { insertId: newId };
  }

  // 8. SELECT * FROM products (catalog query with optional category and search terms)
  if (queryLower.startsWith("select * from products")) {
    let filtered = [...mockProducts];

    if (queryLower.includes("category = ?")) {
      const cat = params[0];
      filtered = filtered.filter((p) => p.category === cat);
    }

    if (queryLower.includes("like ?")) {
      const termParam = params.find(
        (p) => typeof p === "string" && p.startsWith("%") && p.endsWith("%"),
      );
      if (termParam) {
        const cleanTerm = termParam.replace(/%/g, "").toLowerCase();
        filtered = filtered.filter(
          (p) =>
            p.name.toLowerCase().includes(cleanTerm) ||
            p.description.toLowerCase().includes(cleanTerm),
        );
      }
    }

    if (queryLower.includes("order by id desc")) {
      filtered.sort((a, b) => b.id - a.id);
    }
    return filtered;
  }

  // 9. INSERT INTO orders (user_id, total_amount, status)
  if (queryLower.startsWith("insert into orders")) {
    const [user_id, total_amount, status] = params;
    const newId = mockOrders.length + 1;
    const newOrder = {
      id: newId,
      user_id,
      total_amount: parseFloat(total_amount),
      status,
      created_at: new Date(),
    };
    mockOrders.push(newOrder);
    return { insertId: newId };
  }

  // 10. INSERT INTO order_items (order_id, product_id, quantity, price)
  if (queryLower.startsWith("insert into order_items")) {
    const [order_id, product_id, quantity, price] = params;
    const newId = mockOrderItems.length + 1;
    const newItem = {
      id: newId,
      order_id,
      product_id,
      quantity: parseInt(quantity, 10),
      price: parseFloat(price),
    };
    mockOrderItems.push(newItem);
    return { insertId: newId };
  }

  // 11. UPDATE products SET stock = ? WHERE id = ?
  if (queryLower.startsWith("update products set stock = ? where id = ?")) {
    const [stock, id] = params;
    const pIdx = mockProducts.findIndex((p) => p.id === parseInt(id, 10));
    if (pIdx > -1) {
      mockProducts[pIdx].stock = parseInt(stock, 10);
    }
    return { affectedRows: 1 };
  }

  // 12. SELECT o.id as order_id, ... FROM orders JOIN order_items JOIN products WHERE user_id = ?
  if (
    queryLower.includes("join order_items") &&
    queryLower.includes("where o.user_id = ?")
  ) {
    const userId = parseInt(params[0], 10);
    const rows = [];
    const userOrders = mockOrders.filter((o) => o.user_id === userId);

    for (const order of userOrders) {
      const items = mockOrderItems.filter((oi) => oi.order_id === order.id);
      for (const item of items) {
        const product = mockProducts.find((p) => p.id === item.product_id);
        if (product) {
          rows.push({
            order_id: order.id,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            product_name: product.name,
            image_url: product.image_url,
          });
        }
      }
    }
    return rows;
  }

  // 13. SELECT o.id as order_id ... JOIN order_items JOIN products JOIN users (Admin order log)
  if (
    queryLower.includes("join order_items") &&
    queryLower.includes("join users")
  ) {
    const rows = [];
    for (const order of mockOrders) {
      const user = mockUsers.find((u) => u.id === order.user_id);
      const items = mockOrderItems.filter((oi) => oi.order_id === order.id);
      for (const item of items) {
        const product = mockProducts.find((p) => p.id === item.product_id);
        if (product && user) {
          rows.push({
            order_id: order.id,
            user_id: order.user_id,
            user_name: user.name,
            user_email: user.email,
            total_amount: order.total_amount,
            status: order.status,
            created_at: order.created_at,
            product_id: item.product_id,
            quantity: item.quantity,
            price: item.price,
            product_name: product.name,
          });
        }
      }
    }
    return rows;
  }

  console.warn("[Mock DB Warning] Unhandled query mapping request:", sql);
  return [];
}

// Transaction simulation connection interface for database pools
const mockConnectionObj = {
  beginTransaction: async () => {},
  commit: async () => {},
  rollback: async () => {},
  release: () => {},
  execute: async (sql, params) => {
    const result = await evaluateMockQuery(sql, params);
    return [result, undefined];
  },
};

// Mock Connection Pool interface
const mockPoolObj = {
  getConnection: async () => mockConnectionObj,
  execute: async (sql, params) => {
    const result = await evaluateMockQuery(sql, params);
    return [result, undefined];
  },
  end: async () => {
    console.log("[Mock DB] Connection pool end called.");
  },
};

console.log(`[Database] Connecting to: ${dbConfig.host}:${dbConfig.port}`);

// Create the connection pool immediately without blocking top-level await
pool = mysql.createPool(dbConfig);

// Test the connection asynchronously in the background so Express starts instantly
pool
  .getConnection()
  .then((connection) => {
    console.log("[Database] Connection pool established successfully.");
    connection.release();
  })
  .catch((error) => {
    console.error(
      "[Database Error] Initial connection pool check failed:",
      error.message,
    );
    console.log(
      "[Database Fallback] >>> Launching Zero-Dependency In-Memory SQL Simulator <<<",
    );
    useMockDb = true;
    pool = mockPoolObj;
  });

// Unified query wrapper
export const query = async (sql, params) => {
  if (useMockDb) {
    return evaluateMockQuery(sql, params);
  }
  try {
    const [results] = await pool.execute(sql, params);
    return results;
  } catch (err) {
    console.error(`[Database SQL Error] ${sql} :`, err.message);
    throw err;
  }
};

export default pool;
