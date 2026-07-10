import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Sidebar() {
    const { state, currentView, setCurrentView, authLogout, t } = useContext(AppContext);
    
    if (!state.currentUser) return null;

    const checkPermission = (perm) => {
        if (state.currentUser.role === 'SuperAdmin') return true;
        return (state.currentUser.permissions || []).includes(perm);
    };

    const pendingShopifyCount = (state.orders || []).filter(o => o.status === 'Pending' && o.source === 'shopify').length;

    const navItems = [
        { id: 'dashboard', name: t('dashboard'), icon: 'Home.png', perm: 'view_dashboard' },
        { id: 'inventory', name: t('inventory'), icon: 'Inventory.png', perm: 'manage_inventory' },
        { id: 'reports', name: t('reports'), icon: 'Report.png', perm: 'view_reports' },
        { id: 'suppliers', name: t('suppliers'), icon: 'Suppliers.png', perm: 'manage_suppliers' },
        { id: 'customers', name: t('customersList') || 'العملاء', icon: 'Support.png', perm: 'manage_customers' },
        { id: 'orders', name: t('orders'), icon: 'Order.png', perm: 'manage_orders' },
        { id: 'shopifyPending', name: 'طلبات شوبيفاي معلقة', icon: 'Order.png', perm: 'manage_orders', isShopify: true },
        { id: 'supabaseTasks', name: t('supabaseTasks'), icon: 'Calendar.png', perm: 'manage_settings' }
    ].filter(item => checkPermission(item.perm));

    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <img src="/octabot-logo-final.png" alt="Octabot Logo" />
                <h1>o5taboad store</h1>
            </div>
            
            <ul className="nav-links">
                {navItems.map(item => (
                    <li 
                        key={item.id} 
                        className={`nav-item ${currentView === item.id ? 'active' : ''}`}
                    >
                        <a href="#" onClick={(e) => { e.preventDefault(); setCurrentView(item.id); }}>
                            {item.id === 'shopifyPending' ? (
                                <i className="fa-brands fa-shopify" style={{ 
                                    fontSize: '18px', 
                                    color: '#96bf48',
                                    width: '20px',
                                    height: '20px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}></i>
                            ) : (
                                <img 
                                    src={`/icons/${item.icon}`} 
                                    alt={item.name} 
                                    style={{ 
                                        width: '20px', 
                                        height: '20px', 
                                        objectFit: 'contain',
                                        ...(item.id === 'supabaseTasks' ? { filter: 'brightness(0) saturate(100%) invert(26%) sepia(85%) saturate(7403%) hue-rotate(352deg) brightness(96%) contrast(106%)' } : {})
                                    }}
                                />
                            )}
                            <span>{item.name}</span>
                            {item.id === 'shopifyPending' && pendingShopifyCount > 0 && (
                                <span style={{
                                    background: '#2ecc71',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    marginRight: 'auto',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: '0 0 10px rgba(46,204,113,0.4)',
                                    height: '18px',
                                    minWidth: '18px'
                                }}>
                                    {pendingShopifyCount}
                                </span>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
            
            <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                <ul className="nav-links" style={{ width: '100%', marginBottom: '14px' }}>
                    {checkPermission('manage_settings') && (
                        <li className={`nav-item ${currentView === 'store' ? 'active' : ''}`}>
                            <a href="#" onClick={(e) => { e.preventDefault(); setCurrentView('store'); }}>
                                <img src="/icons/Settings.png" alt="Settings" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                                <span>{t('settings')}</span>
                            </a>
                        </li>
                    )}
                    <li className="nav-item">
                        <a href="#" onClick={(e) => { e.preventDefault(); authLogout(); }}>
                            <img src="/icons/Log Out.png" alt="Log Out" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                            <span style={{ color: 'var(--color-danger)' }}>{t('logout')}</span>
                        </a>
                    </li>
                </ul>

                <div className="user-profile" style={{ marginTop: '10px' }}>
                    <div className="user-avatar" id="user-avatar-lbl">
                        {state.currentUser.avatar || state.currentUser.name?.charAt(0)?.toUpperCase() || 'U'}
                    </div>
                    <div className="user-details">
                        <h4 id="user-display-name">{state.currentUser.name}</h4>
                        <span>{state.currentUser.role}</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}

// hmr force update
