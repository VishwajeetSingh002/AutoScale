import React, { useState } from 'react';
import { Trash2, Plus, Minus, CreditCard, ShoppingBag, CheckCircle, AlertTriangle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  price: number;
  image_url: string;
  stock: number;
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface Props {
  apiBase: string;
  cart: CartItem[];
  updateQuantity: (productId: number, qty: number) => void;
  removeFromCart: (productId: number) => void;
  clearCart: () => void;
  setView: (view: string) => void;
  token: string | null;
}

const Cart: React.FC<Props> = ({ apiBase, cart, updateQuantity, removeFromCart, clearCart, setView, token }) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [orderSuccess, setOrderSuccess] = useState<number | null>(null);

  const calculateSubtotal = () => {
    return cart.reduce((acc, item) => acc + item.product.price * item.quantity, 0);
  };

  const subtotal = calculateSubtotal();
  const tax = subtotal * 0.08; // 8% tax
  const shipping = subtotal > 150 ? 0 : 15.00;
  const total = subtotal + tax + shipping;

  const handleCheckout = async () => {
    if (!token) {
      setView('login');
      return;
    }

    setLoading(true);
    setError(null);

    // Format items matching schema requirements
    const orderItems = cart.map(item => ({
      product_id: item.product.id,
      quantity: item.quantity
    }));

    try {
      const res = await fetch(`${apiBase}/orders`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ items: orderItems }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Order checkout failed');
      }

      setOrderSuccess(data.orderId);
      clearCart();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const resolveImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const host = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
    return `${host}${url}`;
  };

  // Success view
  if (orderSuccess) {
    return (
      <div className="app-container" style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
        <div className="glass-card" style={{ width: '100%', maxWidth: '500px', textAlign: 'center', padding: '40px' }}>
          <div style={{ display: 'inline-flex', padding: '16px', borderRadius: '50%', background: 'rgba(16, 185, 129, 0.1)', color: 'var(--color-emerald)', marginBottom: '24px' }}>
            <CheckCircle size={48} />
          </div>
          <h2 style={{ fontSize: '1.8rem', marginBottom: '8px' }}>Order Confirmed!</h2>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '16px' }}>Your payment has been simulated and processed successfully.</p>
          <div style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px', marginBottom: '24px', fontFamily: 'var(--font-mono)', fontSize: '0.9rem' }}>
            Order Reference ID: #ORD-{orderSuccess}
          </div>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '30px' }}>
            Simulated database inventories have been successfully updated. Target group traffic continues normally.
          </p>
          <button className="btn btn-primary" onClick={() => setView('catalog')} style={{ width: '100%' }}>
            Continue Shopping
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="app-container">
      <h1 style={{ fontSize: '2rem', marginBottom: '24px' }}>Your Shopping Cart</h1>

      {cart.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 0' }}>
          <ShoppingBag size={48} style={{ color: 'var(--text-muted)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Your cart is empty</h3>
          <p style={{ color: 'var(--text-secondary)', marginBottom: '24px' }}>Add some products from the catalog to get started.</p>
          <button className="btn btn-primary" onClick={() => setView('catalog')}>
            Explore Catalog
          </button>
        </div>
      ) : (
        <div className="grid-cols-12">
          {/* Left Column: Cart Items List */}
          <div style={{ gridColumn: 'span 8', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {cart.map(item => (
              <div 
                key={item.product.id} 
                className="glass-card"
                style={{ 
                  display: 'flex', 
                  flexDirection: 'row', 
                  alignItems: 'center', 
                  padding: '16px', 
                  justifyContent: 'space-between',
                  gap: '16px' 
                }}
              >
                {/* Product Thumbnail & Details */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flex: '1' }}>
                  <img 
                    src={resolveImageUrl(item.product.image_url)} 
                    alt={item.product.name}
                    style={{ width: '70px', height: '70px', objectFit: 'cover', borderRadius: '8px', background: '#111827' }}
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23111827%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%236b7280%22 font-size=%2210%22>Item</text></svg>';
                    }}
                  />
                  <div>
                    <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '4px' }}>{item.product.name}</h3>
                    <p style={{ fontSize: '0.9rem', color: 'var(--color-cyan)', fontWeight: 600 }}>
                      ${item.product.price} each
                    </p>
                  </div>
                </div>

                {/* Quantity adjustments */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                    style={{ padding: '6px', borderRadius: '4px' }}
                  >
                    <Minus size={14} />
                  </button>
                  <span style={{ fontSize: '1rem', fontWeight: 600, width: '20px', textAlign: 'center' }}>
                    {item.quantity}
                  </span>
                  <button 
                    className="btn btn-secondary"
                    onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                    disabled={item.quantity >= item.product.stock}
                    style={{ padding: '6px', borderRadius: '4px', opacity: item.quantity >= item.product.stock ? 0.5 : 1 }}
                  >
                    <Plus size={14} />
                  </button>
                </div>

                {/* Subtotal & Delete */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '20px', minWidth: '120px', justifyContent: 'flex-end' }}>
                  <span style={{ fontSize: '1.05rem', fontWeight: 700, fontFamily: 'var(--font-header)' }}>
                    ${(item.product.price * item.quantity).toFixed(2)}
                  </span>
                  <button 
                    onClick={() => removeFromCart(item.product.id)}
                    style={{ 
                      background: 'none', 
                      border: 'none', 
                      color: 'var(--text-muted)', 
                      cursor: 'pointer',
                      transition: 'var(--transition-smooth)'
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = 'var(--color-rose)')}
                    onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
                  >
                    <Trash2 size={18} />
                  </button>
                </div>

              </div>
            ))}
          </div>

          {/* Right Column: Order Summary */}
          <div style={{ gridColumn: 'span 4' }}>
            <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <h3 style={{ fontSize: '1.2rem', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                Order Summary
              </h3>

              {error && (
                <div style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '8px', 
                  background: 'rgba(244, 63, 94, 0.1)', 
                  border: '1px solid rgba(244, 63, 94, 0.2)',
                  borderRadius: '8px', 
                  padding: '12px', 
                  color: 'var(--color-rose)', 
                  fontSize: '0.8rem'
                }}>
                  <AlertTriangle size={14} style={{ flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Items Subtotal</span>
                <span>${subtotal.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Sales Tax (8%)</span>
                <span>${tax.toFixed(2)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Shipping</span>
                <span>{shipping === 0 ? 'FREE' : `$${shipping.toFixed(2)}`}</span>
              </div>

              {shipping > 0 && (
                <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'right' }}>
                  Spend ${(150 - subtotal).toFixed(2)} more for free shipping!
                </p>
              )}

              <div 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  fontSize: '1.2rem', 
                  fontWeight: 800, 
                  borderTop: '1px solid var(--border-color)', 
                  paddingTop: '16px',
                  fontFamily: 'var(--font-header)',
                  color: 'var(--color-cyan)'
                }}
              >
                <span>Total Amount</span>
                <span>${total.toFixed(2)}</span>
              </div>

              <div style={{ marginTop: '12px' }}>
                {token ? (
                  <button 
                    className="btn btn-primary" 
                    onClick={handleCheckout} 
                    style={{ width: '100%', padding: '12px' }}
                    disabled={loading}
                  >
                    <CreditCard size={18} /> {loading ? 'Processing...' : 'Place Secure Order'}
                  </button>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setView('login')} 
                      style={{ width: '100%', padding: '12px', border: '1px dashed var(--color-amber)', color: 'var(--color-amber)' }}
                    >
                      Login to Complete Purchase
                    </button>
                    <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                      Authorization is required to link checkout transactions.
                    </p>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Cart;
