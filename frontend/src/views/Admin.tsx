import React, { useState, useEffect } from 'react';
import { PlusCircle, FileText, Check, AlertCircle, ShoppingBag, DollarSign } from 'lucide-react';

interface OrderItem {
  product_id: number;
  product_name: string;
  quantity: number;
  price: number;
}

interface Order {
  id: number;
  user_id: number;
  user_name: string;
  user_email: string;
  total_amount: number;
  status: string;
  created_at: string;
  items: OrderItem[];
}

interface Props {
  apiBase: string;
  token: string | null;
}

const Admin: React.FC<Props> = ({ apiBase, token }) => {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loadingOrders, setLoadingOrders] = useState(true);
  
  // Product Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [category, setCategory] = useState('');
  const [stock, setStock] = useState('10');
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [formLoading, setFormLoading] = useState(false);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const fetchOrders = async () => {
    if (!token) return;
    setLoadingOrders(true);
    try {
      const res = await fetch(`${apiBase}/orders/all`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setOrders(data);
      }
    } catch (err) {
      console.error('Error fetching admin orders:', err);
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    fetchOrders();
  }, [token]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setImageFile(e.target.files[0]);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !price) {
      setFormError('Name and Price are required fields');
      return;
    }

    setFormLoading(true);
    setFormError(null);
    setFormSuccess(null);

    // Build Multipart FormData
    const formData = new FormData();
    formData.append('name', name);
    formData.append('description', description);
    formData.append('price', price);
    formData.append('category', category || 'General');
    formData.append('stock', stock);
    if (imageFile) {
      formData.append('image', imageFile);
    }

    try {
      const res = await fetch(`${apiBase}/products`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
          // Note: Do NOT set Content-Type header when sending FormData.
          // The browser will automatically set it with boundary limits.
        },
        body: formData,
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to create product');
      }

      setFormSuccess(`Product "${name}" created successfully!`);
      // Reset form fields
      setName('');
      setDescription('');
      setPrice('');
      setCategory('');
      setStock('10');
      setImageFile(null);
      
      // Clear file input element
      const fileInput = document.getElementById('product-image') as HTMLInputElement;
      if (fileInput) fileInput.value = '';

    } catch (err: any) {
      setFormError(err.message);
    } finally {
      setFormLoading(false);
    }
  };

  const calculateTotalSales = () => {
    return orders.reduce((acc, order) => acc + Number(order.total_amount), 0);
  };

  return (
    <div className="app-container">
      <h1 style={{ fontSize: '2rem', marginBottom: '24px' }}>Administrative Control Panel</h1>

      {/* Admin Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '20px', marginBottom: '30px' }}>
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: 'rgba(6, 182, 212, 0.1)', color: 'var(--color-cyan)', borderRadius: '12px', padding: '12px' }}>
            <ShoppingBag size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Orders</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>{orders.length}</h3>
          </div>
        </div>
        
        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: 'rgba(168, 85, 247, 0.1)', color: 'var(--color-purple)', borderRadius: '12px', padding: '12px' }}>
            <DollarSign size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Total Revenue</span>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800 }}>${calculateTotalSales().toFixed(2)}</h3>
          </div>
        </div>

        <div className="glass-card" style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '20px' }}>
          <div style={{ background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-emerald)', borderRadius: '12px', padding: '12px' }}>
            <Check size={24} />
          </div>
          <div>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sync Node Status</span>
            <h3 style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--color-emerald)' }}>SYNCED // ONLINE</h3>
          </div>
        </div>
      </div>

      <div className="grid-cols-12">
        {/* Left Column: Register New Product */}
        <div style={{ gridColumn: 'span 5' }} className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <PlusCircle size={18} style={{ color: 'var(--color-cyan)' }} /> Register New Product
          </h3>

          {formSuccess && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.2)', borderRadius: '8px', padding: '12px', color: 'var(--color-emerald)', fontSize: '0.85rem', marginBottom: '16px' }}>
              <Check size={16} />
              <span>{formSuccess}</span>
            </div>
          )}

          {formError && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(244, 63, 94, 0.1)', border: '1px solid rgba(244, 63, 94, 0.2)', borderRadius: '8px', padding: '12px', color: 'var(--color-rose)', fontSize: '0.85rem', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <form onSubmit={handleAddProduct}>
            <div className="form-group">
              <label className="form-label" htmlFor="product-name">Product Name *</label>
              <input 
                id="product-name"
                type="text" 
                className="form-input" 
                placeholder="e.g. Smart Watch Active"
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={formLoading}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-desc">Description</label>
              <textarea 
                id="product-desc"
                className="form-input" 
                placeholder="Provide details about specs, dimensions, material..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                style={{ resize: 'vertical' }}
                disabled={formLoading}
              />
            </div>

            <div style={{ display: 'flex', gap: '16px' }}>
              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="product-price">Price ($) *</label>
                <input 
                  id="product-price"
                  type="number" 
                  step="0.01"
                  className="form-input" 
                  placeholder="29.99"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  disabled={formLoading}
                />
              </div>

              <div className="form-group" style={{ flex: 1 }}>
                <label className="form-label" htmlFor="product-stock">Stock Qty</label>
                <input 
                  id="product-stock"
                  type="number" 
                  className="form-input" 
                  placeholder="10"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  disabled={formLoading}
                />
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="product-cat">Category</label>
              <input 
                id="product-cat"
                type="text" 
                className="form-input" 
                placeholder="e.g. Electronics, Apparel"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                disabled={formLoading}
              />
            </div>

            <div className="form-group" style={{ marginBottom: '24px' }}>
              <label className="form-label" htmlFor="product-image">Product Image File</label>
              <input 
                id="product-image"
                type="file" 
                accept="image/*"
                onChange={handleFileChange}
                style={{ 
                  background: 'var(--bg-input)', 
                  border: '1px solid var(--border-color)', 
                  borderRadius: '8px', 
                  padding: '8px', 
                  width: '100%',
                  color: 'var(--text-secondary)',
                  fontSize: '0.85rem'
                }}
                disabled={formLoading}
              />
              <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '6px' }}>
                Note: Uploads directly to Amazon S3 (if configured) or local target folders.
              </p>
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px' }}
              disabled={formLoading}
            >
              {formLoading ? 'Registering Catalog Item...' : 'Upload & Add Product'}
            </button>
          </form>
        </div>

        {/* Right Column: Customer Orders Log */}
        <div style={{ gridColumn: 'span 7' }} className="glass-card">
          <h3 style={{ fontSize: '1.2rem', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={18} style={{ color: 'var(--color-purple)' }} /> Client Orders Log
          </h3>

          {loadingOrders ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Synchronizing order entries...</p>
          ) : orders.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>No orders have been recorded in the database yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '550px', overflowY: 'auto', paddingRight: '8px' }}>
              {orders.map(order => (
                <div 
                  key={order.id} 
                  style={{
                    background: 'rgba(255,255,255,0.02)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '10px',
                    padding: '16px'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                    <span style={{ fontWeight: 600, color: 'var(--color-cyan)', fontSize: '0.9rem', fontFamily: 'var(--font-mono)' }}>
                      ORDER #ORD-{order.id}
                    </span>
                    <span style={{ 
                      fontSize: '0.75rem', 
                      background: 'rgba(16, 185, 129, 0.1)', 
                      color: 'var(--color-emerald)', 
                      padding: '2px 8px', 
                      borderRadius: '4px',
                      fontWeight: 600
                    }}>
                      {order.status}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '8px' }}>
                    <p>Client: <strong>{order.user_name}</strong> ({order.user_email})</p>
                    <p>Timestamp: {new Date(order.created_at).toLocaleString()}</p>
                  </div>

                  {/* Order Items sub-list */}
                  <div style={{ borderTop: '1px dashed rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '8px' }}>
                    <p style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase' }}>Items Purchased:</p>
                    <ul style={{ listStyle: 'none', paddingLeft: 0 }}>
                      {order.items.map((item, idx) => (
                        <li key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-primary)', padding: '2px 0' }}>
                          <span>{item.product_name} <span style={{ color: 'var(--text-secondary)' }}>x{item.quantity}</span></span>
                          <span>${(item.price * item.quantity).toFixed(2)}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', marginTop: '8px', fontSize: '0.9rem', color: 'var(--color-cyan)' }}>
                    <span>Total Value</span>
                    <span>${Number(order.total_amount).toFixed(2)}</span>
                  </div>

                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Admin;
