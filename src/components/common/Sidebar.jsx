import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Sidebar() {
    const { state, currentView, setCurrentView, authLogout, t } = useContext(AppContext);
    
    if (!state.currentUser) return null;

    const checkPermission = (perm) => {
        if (state.currentUser.role === 'SuperAdmin') return true;
        return (state.currentUser.permissions || []).includes(perm);
    };

    const navItems = [
        { id: 'dashboard', name: t('dashboard'), icon: 'Home.png', perm: 'view_dashboard' },
        { id: 'inventory', name: t('inventory'), icon: 'Inventory.png', perm: 'manage_inventory' },
        { id: 'reports', name: t('reports'), icon: 'Report.png', perm: 'view_reports' },
        { id: 'suppliers', name: t('suppliers'), icon: 'Suppliers.png', perm: 'manage_suppliers' },
        { id: 'customers', name: t('customersList') || 'العملاء', icon: 'Support.png', perm: 'manage_customers' },
        { id: 'orders', name: t('orders'), icon: 'Order.png', perm: 'manage_orders' },
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
                            <span>{item.name}</span>
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
