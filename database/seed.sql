-- Seed Data for Auto-Scaling E-Commerce App
USE ecommerce_db;

-- Seed Default Users (Passwords are bcrypt hashed)
-- admin@ecommerce.com / admin123 -> $2a$10$tZ2z/4d3j8yH22.e.PUpI.P92tXUeJ8xQo/hN2PvhT048w0Lz.5Iq
-- user@ecommerce.com / user123 -> $2a$10$wE99KqU.Y2p8K8O6W2WvxeR09lVd/uG2mHhUf4aL777lU.e/q3Sg6
INSERT INTO users (name, email, password, role) VALUES
('Store Administrator', 'admin@ecommerce.com', '$2a$10$tZ2z/4d3j8yH22.e.PUpI.P92tXUeJ8xQo/hN2PvhT048w0Lz.5Iq', 'admin'),
('John Doe User', 'user@ecommerce.com', '$2a$10$wE99KqU.Y2p8K8O6W2WvxeR09lVd/uG2mHhUf4aL777lU.e/q3Sg6', 'user');

-- Seed Products
INSERT INTO products (name, description, price, image_url, category, stock) VALUES
('Spectre Gaming Laptop', '15.6 inch UHD display, Intel i9 CPU, 32GB RAM, 1TB NVMe SSD, NVIDIA RTX 4080 Graphics.', 1899.99, '/uploads/spectre_laptop.jpg', 'Electronics', 15),
('Acoustic Pro Headphones', 'Wireless over-ear headphones with advanced active noise cancelling, high fidelity sound, and 40 hour battery life.', 249.99, '/uploads/acoustic_headphones.jpg', 'Electronics', 40),
('E-Reader Oasis', '6.8 inch glare-free screen, adjustable warm light, waterproof design, and 8GB storage.', 129.50, '/uploads/ereader_oasis.jpg', 'Electronics', 25),
('Minimalist Leather Wallet', 'Genuine full-grain leather slim wallet featuring RFID blocking tech and 6 card slots.', 35.00, '/uploads/leather_wallet.jpg', 'Apparel', 50),
('Classic Canvas Backpack', 'Water-resistant vintage travel backpack with padded laptop sleeve and durable brass buckles.', 59.99, '/uploads/canvas_backpack.jpg', 'Apparel', 35),
('Ergonomic Mesh Chair', 'High-back desk chair with 3D lumbar support, adjustable headrest, and armrests for office comfort.', 199.00, '/uploads/mesh_chair.jpg', 'Home & Office', 20),
('Smart Thermo Mug', 'Temperature control smart mug with LED display, leakproof lid, and 12-hour thermal retention.', 45.00, '/uploads/thermo_mug.jpg', 'Home & Office', 60),
('Luxe Velvet Cushion', 'Set of 2 ultra soft decorative throw pillow covers (18x18 inches) in midnight blue.', 22.99, '/uploads/velvet_cushion.jpg', 'Home & Office', 80);
