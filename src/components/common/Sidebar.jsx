import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Sidebar() {
    const { state, currentView, setCurrentView, authLogout, t } = useContext(AppContext);
    
    if (!state.currentUser) return null;

    const navItems = [
        { id: 'dashboard', name: t('dashboard'), icon: 'Home.png' },
        { id: 'inventory', name: t('inventory'), icon: 'Inventory.png' },
        { id: 'reports', name: t('reports'), icon: 'Report.png' },
        { id: 'suppliers', name: t('suppliers'), icon: 'Suppliers.png' },
        { id: 'orders', name: t('orders'), icon: 'Order.png' },
        { id: 'store', name: t('manageStore'), icon: 'Manage Store.png' }
    ];

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
                                style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                            />
                            <span>{item.name}</span>
                        </a>
                    </li>
                ))}
            </ul>
            
            <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0 }}>
                {/* Settings custom link */}
                <ul className="nav-links" style={{ width: '100%', marginBottom: '14px' }}>
                    <li className={`nav-item ${currentView === 'store' ? 'active' : ''}`}>
                        <a href="#" onClick={(e) => { e.preventDefault(); setCurrentView('store'); }}>
                            <img src="/icons/Settings.png" alt="Settings" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                            <span>{t('settings')}</span>
                        </a>
                    </li>
                    <li className="nav-item">
                        <a href="#" onClick={(e) => { e.preventDefault(); authLogout(); }}>
                            <img src="/icons/Log Out.png" alt="Log Out" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
                            <span style={{ color: 'var(--color-danger)' }}>{t('logout')}</span>
                        </a>
                    </li>
                </ul>

                <div className="user-profile" style={{ marginTop: '10px' }}>
                    <div className="user-avatar" id="user-avatar-lbl">
                        {state.currentUser.avatar || 'A'}
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
