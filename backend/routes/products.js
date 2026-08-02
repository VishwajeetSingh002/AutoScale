import express from 'express';
import { query } from '../config/db.js';
import { upload, useS3, uploadToS3 } from '../config/s3.js';
import { authenticateToken, authorizeAdmin } from './auth.js';

const router = express.Router();

// GET /api/products - Get all products (with category filter and search search)
router.get('/', async (req, res) => {
  const { category, search } = req.query;
  let sql = 'SELECT * FROM products';
  let params = [];

  let conditions = [];
  if (category && category !== 'All') {
    conditions.push('category = ?');
    params.push(category);
  }
  if (search) {
    conditions.push('(name LIKE ? OR description LIKE ?)');
    params.push(`%${search}%`, `%${search}%`);
  }

  if (conditions.length > 0) {
    sql += ' WHERE ' + conditions.join(' AND ');
  }

  // Sort by newest
  sql += ' ORDER BY id DESC';

  try {
    const products = await query(sql, params);
    res.json(products);
  } catch (error) {
    console.error('Fetch products error:', error);
    res.status(500).json({ message: 'Error retrieving products' });
  }
});

// GET /api/products/categories - Get unique categories list
router.get('/categories', async (req, res) => {
  try {
    const results = await query('SELECT DISTINCT category FROM products WHERE category IS NOT NULL');
    const categories = results.map(row => row.category);
    res.json(['All', ...categories]);
  } catch (error) {
    console.error('Fetch categories error:', error);
    res.status(500).json({ message: 'Error retrieving categories' });
  }
});

// GET /api/products/:id - Get product details
router.get('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const products = await query('SELECT * FROM products WHERE id = ?', [id]);
    if (products.length === 0) {
      return res.status(404).json({ message: 'Product not found' });
    }
    res.json(products[0]);
  } catch (error) {
    console.error('Fetch product details error:', error);
    res.status(500).json({ message: 'Error retrieving product details' });
  }
});

// POST /api/products - Create a new product (Admin Only)
// Uses multer upload middleware. Handles single image upload with field name 'image'.
router.post('/', authenticateToken, authorizeAdmin, (req, res) => {
  upload.single('image')(req, res, async function (err) {
    if (err) {
      console.error('[Upload Error]', err);
      return res.status(400).json({ message: err.message });
    }

    const { name, description, price, category, stock } = req.body;

    if (!name || !price) {
      return res.status(400).json({ message: 'Name and price are required' });
    }

    // Determine the image URL
    let imageUrl = '/uploads/placeholder.jpg';
    if (req.file) {
      if (useS3) {
        const uploaded = await uploadToS3(req.file.buffer, req.file.originalname, req.file.mimetype);
        imageUrl = uploaded.url;
      } else {
        imageUrl = `/uploads/${req.file.filename}`;
      }
      console.log(`[Upload Success] File stored. Path/URL: ${imageUrl}`);
    }

    try {
      const parsedPrice = parseFloat(price);
      const parsedStock = parseInt(stock || '10', 10);

      const result = await query(
        'INSERT INTO products (name, description, price, image_url, category, stock) VALUES (?, ?, ?, ?, ?, ?)',
        [name, description, parsedPrice, imageUrl, category || 'General', parsedStock]
      );

      const newProduct = {
        id: result.insertId,
        name,
        description,
        price: parsedPrice,
        image_url: imageUrl,
        category: category || 'General',
        stock: parsedStock
      };

      res.status(201).json({
        message: 'Product created successfully',
        product: newProduct
      });
    } catch (error) {
      console.error('Create product error:', error);
      res.status(500).json({ message: 'Error creating product' });
    }
  });
});

export default router;
