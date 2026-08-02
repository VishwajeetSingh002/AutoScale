import React, { useState, useEffect } from 'react';
import { ShoppingCart, Search, Filter, AlertCircle } from 'lucide-react';

interface Product {
  id: number;
  name: string;
  description: string;
  price: number;
  image_url: string;
  category: string;
  stock: number;
}

interface Props {
  apiBase: string;
  addToCart: (product: Product) => void;
  setView: (view: string) => void;
}

const Catalog: React.FC<Props> = ({ apiBase, addToCart, setView }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>(['All']);
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch unique categories
  const fetchCategories = async () => {
    try {
      const res = await fetch(`${apiBase}/products/categories`);
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

  // Fetch products based on category and search query
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const queryParams = new URLSearchParams();
      if (selectedCategory && selectedCategory !== 'All') {
        queryParams.append('category', selectedCategory);
      }
      if (searchQuery) {
        queryParams.append('search', searchQuery);
      }

      const res = await fetch(`${apiBase}/products?${queryParams.toString()}`);
      if (!res.ok) throw new Error('Failed to load products');
      const data = await res.json();
      setProducts(data);
      setError(null);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    // Debounce product fetches on search typing
    const delayDebounce = setTimeout(() => {
      fetchProducts();
    }, 300);

    return () => clearTimeout(delayDebounce);
  }, [selectedCategory, searchQuery]);

  const resolveImageUrl = (url: string) => {
    if (url.startsWith('http')) return url;
    const host = window.location.hostname === 'localhost' ? 'http://localhost:5000' : '';
    return `${host}${url}`;
  };

  return (
    <div className="app-container">
      {/* Search and Filters bar */}
      <div className="glass-card" style={{ padding: '16px', marginBottom: '30px', display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
        
        {/* Search Input */}
        <div style={{ position: 'relative', flex: '1 1 300px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            className="form-input" 
            placeholder="Search items..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: '40px' }}
          />
        </div>

        {/* Category Filters */}
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px', flexWrap: 'wrap' }}>
          {categories.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                background: selectedCategory === cat ? 'var(--color-cyan)' : 'rgba(255,255,255,0.05)',
                color: selectedCategory === cat ? '#0b0f19' : 'var(--text-primary)',
                border: '1px solid ' + (selectedCategory === cat ? 'var(--color-cyan)' : 'var(--border-color)'),
              }}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {loading && products.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'inline-block', width: '40px', height: '40px', border: '3px solid rgba(6, 182, 212, 0.1)', borderTopColor: 'var(--color-cyan)', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px' }}>Catalog synchronization in progress...</p>
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      ) : error ? (
        <div className="glass-card" style={{ borderColor: 'var(--color-rose)', textAlign: 'center', padding: '40px' }}>
          <AlertCircle size={48} style={{ color: 'var(--color-rose)', marginBottom: '16px' }} />
          <h3 style={{ fontSize: '1.2rem', marginBottom: '8px' }}>Synchronization Interrupted</h3>
          <p style={{ color: 'var(--text-secondary)' }}>{error}. Make sure the Node server is active.</p>
        </div>
      ) : products.length === 0 ? (
        <div className="glass-card" style={{ textAlign: 'center', padding: '60px 0' }}>
          <p style={{ color: 'var(--text-secondary)' }}>No items found matching the selected filters.</p>
        </div>
      ) : (
        /* Products Grid */
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '24px' }}>
          {products.map(product => (
            <div key={product.id} className="glass-card" style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: '0', overflow: 'hidden' }}>
              
              {/* Product Image */}
              <div style={{ width: '100%', height: '200px', overflow: 'hidden', background: '#111827', position: 'relative' }}>
                <img 
                  src={resolveImageUrl(product.image_url)} 
                  alt={product.name}
                  style={{ width: '100%', height: '100%', objectFit: 'cover', transition: 'var(--transition-smooth)' }}
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = 'data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22100%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 fill=%22%23111827%22/><text x=%2250%25%22 y=%2250%25%22 dominant-baseline=%22middle%22 text-anchor=%22middle%22 fill=%22%236b7280%22 font-size=%2212%22>No Image</text></svg>';
                  }}
                />
                <span style={{ 
                  position: 'absolute', 
                  top: '12px', 
                  right: '12px', 
                  background: 'rgba(11, 15, 25, 0.75)', 
                  border: '1px solid var(--border-color)',
                  color: 'var(--text-primary)',
                  fontSize: '0.75rem',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  fontWeight: 600
                }}>
                  {product.category}
                </span>
              </div>

              {/* Product Info */}
              <div style={{ padding: '20px', display: 'flex', flexDirection: 'column', flexGrow: 1, gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0 }}>{product.name}</h3>
                  <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--color-cyan)', fontFamily: 'var(--font-header)' }}>
                    ${product.price}
                  </span>
                </div>

                <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', lineBreak: 'strict', flexGrow: 1 }}>
                  {product.description}
                </p>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                  <span style={{ 
                    fontSize: '0.75rem', 
                    color: product.stock > 5 ? 'var(--color-emerald)' : product.stock > 0 ? 'var(--color-amber)' : 'var(--color-rose)',
                    fontWeight: 600
                  }}>
                    {product.stock > 0 ? `Stock: ${product.stock} units` : 'Out of Stock'}
                  </span>
                </div>

                <button 
                  className="btn btn-primary" 
                  onClick={() => addToCart(product)}
                  disabled={product.stock <= 0}
                  style={{ width: '100%', marginTop: '8px', opacity: product.stock <= 0 ? 0.5 : 1 }}
                >
                  <ShoppingCart size={16} /> Add to Cart
                </button>
              </div>

            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Catalog;
