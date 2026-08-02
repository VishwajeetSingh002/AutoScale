import express from 'express';
import pool, { query } from '../config/db.js';
import { authenticateToken, authorizeAdmin } from './auth.js';

const router = express.Router();

// POST /api/orders - Place a new order
router.post('/', authenticateToken, async (req, res) => {
  const { items } = req.body; // Array of { product_id, quantity }
  const userId = req.user.id;

  if (!items || !Array.isArray(items) || items.length === 0) {
    return res.status(400).json({ message: 'Order items are required' });
  }

  // Get a database connection for transaction management
  let conn;
  try {
    conn = await pool.getConnection();
    await conn.beginTransaction();

    let totalAmount = 0;
    const validatedItems = [];

    // Verify stock and calculate price for all items
    for (const item of items) {
      const { product_id, quantity } = item;
      const parsedQty = parseInt(quantity, 10);

      if (!product_id || isNaN(parsedQty) || parsedQty <= 0) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({ message: 'Invalid product_id or quantity' });
      }

      // Query product details with connection (to ensure isolation)
      const [products] = await conn.execute('SELECT * FROM products WHERE id = ? FOR UPDATE', [product_id]);
      if (products.length === 0) {
        await conn.rollback();
        conn.release();
        return res.status(404).json({ message: `Product with ID ${product_id} not found` });
      }

      const product = products[0];

      if (product.stock < parsedQty) {
        await conn.rollback();
        conn.release();
        return res.status(400).json({
          message: `Insufficient stock for product '${product.name}'. Available: ${product.stock}, Requested: ${parsedQty}`
        });
      }

      const itemTotal = product.price * parsedQty;
      totalAmount += itemTotal;

      validatedItems.push({
        product_id,
        quantity: parsedQty,
        price: product.price,
        newStock: product.stock - parsedQty
      });
    }

    // 1. Create Order entry
    const [orderResult] = await conn.execute(
      'INSERT INTO orders (user_id, total_amount, status) VALUES (?, ?, ?)',
      [userId, totalAmount, 'completed']
    );

    const orderId = orderResult.insertId;

    // 2. Create Order Items and update Product stock
    for (const item of validatedItems) {
      // Insert item
      await conn.execute(
        'INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)',
        [orderId, item.product_id, item.quantity, item.price]
      );

      // Update product stock
      await conn.execute(
        'UPDATE products SET stock = ? WHERE id = ?',
        [item.newStock, item.product_id]
      );
    }

    // Commit Transaction
    await conn.commit();
    conn.release();

    res.status(201).json({
      message: 'Order placed successfully',
      orderId,
      totalAmount
    });

  } catch (error) {
    console.error('Order transaction error:', error);
    if (conn) {
      try {
        await conn.rollback();
      } catch (rollbackErr) {
        console.error('Rollback error:', rollbackErr);
      }
      conn.release();
    }
    res.status(500).json({ message: 'Error processing order transaction' });
  }
});

// GET /api/orders/mine - Get user orders
router.get('/mine', authenticateToken, async (req, res) => {
  try {
    const userId = req.user.id;
    // Retrieve orders alongside items list
    const sql = `
      SELECT o.id as order_id, o.total_amount, o.status, o.created_at,
             oi.product_id, oi.quantity, oi.price, p.name as product_name, p.image_url
      FROM orders o
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      WHERE o.user_id = ?
      ORDER BY o.id DESC
    `;
    
    const rows = await query(sql, [userId]);
    
    // Structure items nested inside orders
    const ordersMap = {};
    rows.forEach(row => {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = {
          id: row.order_id,
          total_amount: row.total_amount,
          status: row.status,
          created_at: row.created_at,
          items: []
        };
      }
      ordersMap[row.order_id].items.push({
        product_id: row.product_id,
        product_name: row.product_name,
        image_url: row.image_url,
        quantity: row.quantity,
        price: row.price
      });
    });

    res.json(Object.values(ordersMap));
  } catch (error) {
    console.error('Fetch user orders error:', error);
    res.status(500).json({ message: 'Error retrieving your orders' });
  }
});

// GET /api/orders/all - Get all orders (Admin only)
router.get('/all', authenticateToken, authorizeAdmin, async (req, res) => {
  try {
    const sql = `
      SELECT o.id as order_id, o.total_amount, o.status, o.created_at, o.user_id, u.name as user_name, u.email as user_email,
             oi.product_id, oi.quantity, oi.price, p.name as product_name
      FROM orders o
      JOIN users u ON o.user_id = u.id
      JOIN order_items oi ON o.id = oi.order_id
      JOIN products p ON oi.product_id = p.id
      ORDER BY o.id DESC
    `;

    const rows = await query(sql);

    const ordersMap = {};
    rows.forEach(row => {
      if (!ordersMap[row.order_id]) {
        ordersMap[row.order_id] = {
          id: row.order_id,
          user_id: row.user_id,
          user_name: row.user_name,
          user_email: row.user_email,
          total_amount: row.total_amount,
          status: row.status,
          created_at: row.created_at,
          items: []
        };
      }
      ordersMap[row.order_id].items.push({
        product_id: row.product_id,
        product_name: row.product_name,
        quantity: row.quantity,
        price: row.price
      });
    });

    res.json(Object.values(ordersMap));
  } catch (error) {
    console.error('Fetch all orders error:', error);
    res.status(500).json({ message: 'Error retrieving all orders' });
  }
});

export default router;
