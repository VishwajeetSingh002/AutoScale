import React, { useState, useEffect } from 'react';
import { ShoppingCart, Server, Shield, LogOut, LogIn, ShoppingBag, User } from 'lucide-react';

// Import views
import Catalog from './views/Catalog.tsx';
import AutoscalingTelemetry from './views/AutoscalingTelemetry.tsx';
import Cart from './views/Cart.tsx';
import Admin from './views/Admin.tsx';
import Login from './views/Login.tsx';
import Register from './views/Register.tsx';

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

interface UserData {
  id: number;
  name: string;
  email: string;
  role: string;
}

const App: React.FC = () => {
  // Resolve API Base dynamic path
  // If local, uses Express dev server on 5000, otherwise relative (routing through ALB)
  const apiBase = window.location.hostname === 'localhost' 
    ? 'http://localhost:5000/api' 
    : `${window.location.protocol}//${window.location.host}/api`;

  const [activeView, setActiveView] = useState<string>('catalog');
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [user, setUser] = useState<UserData | null>(null);
  const [cart, setCart] = useState<CartItem[]>([]);

  // Load user data if token is active on load
  const loadUser = async (authToken: string) => {
    try {
      const res = await fetch(`${apiBase}/auth/me`, {
        headers: { 'Authorization': `Bearer ${authToken}` }
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        // Token expired/invalid
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to load user profile:', err);
    }
  };

  useEffect(() => {
    if (token) {
      loadUser(token);
    }
  }, [token]);

  // Load cart from sessionStorage on mount
  useEffect(() => {
    const savedCart = sessionStorage.getItem('cart');
    if (savedCart) {
      try {
        setCart(JSON.parse(savedCart));
      } catch (err) {
        console.error(err);
      }
    }
  }, []);

  // Save cart to sessionStorage when changed
  const saveCart = (updatedCart: CartItem[]) => {
    setCart(updatedCart);
    sessionStorage.setItem('cart', JSON.stringify(updatedCart));
  };

  const handleLoginSuccess = (userData: UserData, authToken: string) => {
    localStorage.setItem('token', authToken);
    setToken(authToken);
    setUser(userData);
    setActiveView('catalog');
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    setActiveView('catalog');
  };

  const addToCart = (product: Product) => {
    const existingIndex = cart.findIndex(item => item.product.id === product.id);
    const updated = [...cart];

    if (existingIndex > -1) {
      const newQty = updated[existingIndex].quantity + 1;
      if (newQty <= product.stock) {
        updated[existingIndex].quantity = newQty;
      }
    } else {
      updated.push({ product, quantity: 1 });
    }

    saveCart(updated);
  };

  const updateQuantity = (productId: number, qty: number) => {
    if (qty <= 0) {
      removeFromCart(productId);
      return;
    }

    const updated = cart.map(item => {
      if (item.product.id === productId) {
        // Bound checks against stock
        const finalQty = Math.min(qty, item.product.stock);
        return { ...item, quantity: finalQty };
      }
      return item;
    });

    saveCart(updated);
  };

  const removeFromCart = (productId: number) => {
    const updated = cart.filter(item => item.product.id !== productId);
    saveCart(updated);
  };

  const clearCart = () => {
    saveCart([]);
  };

  const getCartCount = () => {
    return cart.reduce((acc, item) => acc + item.quantity, 0);
  };

  return (
    <div>
      {/* Navigation bar */}
      <nav className="navbar">
        <div className="navbar-content">
          <div className="logo" onClick={() => setActiveView('catalog')} style={{ cursor: 'pointer' }}>
            <span>🛍️</span> CloudScale E-Shop
          </div>

          <ul className="nav-links">
            <li 
              className={`nav-link ${activeView === 'catalog' ? 'active' : ''}`}
              onClick={() => setActiveView('catalog')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ShoppingBag size={15} /> Catalog</span>
            </li>
            <li 
              className={`nav-link ${activeView === 'telemetry' ? 'active' : ''}`}
              onClick={() => setActiveView('telemetry')}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><Server size={15} /> Telemetry Monitor</span>
            </li>
            <li 
              className={`nav-link ${activeView === 'cart' ? 'active' : ''}`}
              onClick={() => setActiveView('cart')}
              style={{ position: 'relative' }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <ShoppingCart size={15} /> Cart
                {getCartCount() > 0 && (
                  <span style={{
                    background: 'var(--color-cyan)',
                    color: '#0b0f19',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    borderRadius: '50%',
                    padding: '2px 6px',
                    marginLeft: '2px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    {getCartCount()}
                  </span>
                )}
              </span>
            </li>

            {user?.role === 'admin' && (
              <li 
                className={`nav-link ${activeView === 'admin' ? 'active' : ''}`}
                onClick={() => setActiveView('admin')}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px', color: 'var(--color-purple)' }}>
                  <Shield size={15} /> Admin Panel
                </span>
              </li>
            )}
          </ul>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
            {user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <User size={14} /> {user.name}
                </span>
                <button 
                  className="btn btn-secondary" 
                  onClick={handleLogout}
                  style={{ padding: '6px 12px', fontSize: '0.8rem' }}
                >
                  <LogOut size={14} /> Sign Out
                </button>
              </div>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={() => setActiveView('login')}
                style={{ padding: '8px 16px', fontSize: '0.85rem' }}
              >
                <LogIn size={14} /> Sign In
              </button>
            )}
          </div>
        </div>
      </nav>

      {/* Main Views Container */}
      <main style={{ padding: '30px 0' }}>
        {activeView === 'catalog' && (
          <Catalog 
            apiBase={apiBase} 
            addToCart={addToCart} 
            setView={setActiveView} 
          />
        )}
        {activeView === 'telemetry' && (
          <AutoscalingTelemetry 
            apiBase={apiBase} 
          />
        )}
        {activeView === 'cart' && (
          <Cart 
            apiBase={apiBase} 
            cart={cart}
            updateQuantity={updateQuantity}
            removeFromCart={removeFromCart}
            clearCart={clearCart}
            setView={setActiveView}
            token={token}
          />
        )}
        {activeView === 'admin' && user?.role === 'admin' && (
          <Admin 
            apiBase={apiBase} 
            token={token} 
          />
        )}
        {activeView === 'login' && (
          <Login 
            apiBase={apiBase} 
            onLoginSuccess={handleLoginSuccess} 
            setView={setActiveView} 
          />
        )}
        {activeView === 'register' && (
          <Register 
            apiBase={apiBase} 
            onLoginSuccess={handleLoginSuccess} 
            setView={setActiveView} 
          />
        )}
      </main>

      {/* Footer */}
      <footer style={{ 
        borderTop: '1px solid var(--border-color)', 
        padding: '30px 0', 
        marginTop: '60px', 
        textAlign: 'center', 
        fontSize: '0.8rem', 
        color: 'var(--text-muted)'
      }}>
        <div className="app-container">
          <p>© 2026 CloudScale Cluster. Demo Infrastructure Powered by AWS Auto Scaling & Application Load Balancers.</p>
          <p style={{ marginTop: '6px' }}>Project Design: Member 1 (Frontend), Member 2 (Backend), Member 3 (Database), Member 4 (AWS/ASG), Member 5 (QA/Testing)</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
