import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Sidebar() {
    const { state, currentView, setCurrentView, authLogout, t, theme } = useContext(AppContext);
    const [showUserDropdown, setShowUserDropdown] = useState(false);
    
    if (!state.currentUser) return null;

    const checkPermission = (perm) => {
        if (state.currentUser.role === 'SuperAdmin') return true;
        return (state.currentUser.permissions || []).includes(perm);
    };

    const pendingShopifyCount = (state.orders || []).filter(o => o.status === 'Pending' && o.source === 'shopify').length;
    const pendingDepositCount = (state.orders || []).filter(o => 
        o.depositReceiverId === state.currentUser?.id && 
        o.depositStatus === 'pending' &&
        (parseFloat(o.deposit) || 0) > 0
    ).length;
    // Cancelled orders where this admin still needs to confirm deposit return
    const pendingRefundCount = (state.orders || []).filter(o =>
        o.depositReceiverId === state.currentUser?.id &&
        o.status === 'Cancelled' &&
        (parseFloat(o.deposit) || 0) > 0 &&
        o.depositRefundStatus === 'awaiting_return'
    ).length;
    const totalDepositAlerts = pendingDepositCount + pendingRefundCount;

    const navItems = [
        { id: 'dashboard', name: t('dashboard'), icon: 'Home.png', perm: 'view_dashboard' },
        { id: 'inventory', name: t('inventory'), icon: 'Inventory.png', perm: 'manage_inventory' },
        { id: 'reports', name: t('reports'), icon: 'Report.png', perm: 'view_reports' },
        { id: 'suppliers', name: t('suppliers'), icon: 'Suppliers.png', perm: 'manage_suppliers' },
        { id: 'customers', name: t('customersList') || 'العملاء', icon: 'Support.png', perm: 'manage_customers' },
        { id: 'orders', name: t('orders'), icon: 'Order.png', perm: 'manage_orders' },
        { id: 'marketing', name: 'التسويق والمؤثرين', icon: 'promo-code.png', perm: 'view_dashboard' },
        { id: 'shopifyPending', name: 'طلبات شوبيفاي', icon: 'Cart.png', perm: 'manage_orders', isShopify: true },
        { id: 'depositConfirm', name: 'تأكيد العرابين', icon: 'Wallet.svg', perm: 'manage_orders', isDeposit: true }
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
                                    fontSize: '22px', 
                                    color: '#96bf48',
                                    width: '24px',
                                    height: '24px',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center'
                                }}></i>
                            ) : (
                                <img 
                                    src={`/icons/${item.icon}`} 
                                    alt={item.name} 
                                    style={{ 
                                        width: '24px', 
                                        height: '24px', 
                                        objectFit: 'contain',
                                        ...(item.id === 'depositConfirm' ? { filter: theme === 'dark' ? 'invert(1)' : 'none' } : {}),
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
                            {item.id === 'depositConfirm' && totalDepositAlerts > 0 && (
                                <span style={{
                                    background: pendingRefundCount > 0 ? '#ef4444' : '#ef4444',
                                    color: '#fff',
                                    fontSize: '10px',
                                    fontWeight: 'bold',
                                    padding: '2px 7px',
                                    borderRadius: '10px',
                                    marginRight: 'auto',
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    boxShadow: pendingRefundCount > 0
                                        ? '0 0 12px rgba(239,68,68,0.7)'
                                        : '0 0 10px rgba(239,68,68,0.4)',
                                    height: '18px',
                                    minWidth: '18px',
                                    animation: pendingRefundCount > 0 ? 'pulse 1.5s infinite' : 'none'
                                }}>
                                    {totalDepositAlerts}
                                </span>
                            )}
                        </a>
                    </li>
                ))}
            </ul>
            
            <div className="sidebar-footer" style={{ borderTop: 'none', paddingTop: 0, position: 'relative' }}>
                {showUserDropdown && (
                    <div style={{
                        position: 'absolute',
                        bottom: '70px',
                        left: '16px',
                        right: '16px',
                        background: 'rgba(30, 30, 40, 0.95)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
                        zIndex: 999,
                        overflow: 'hidden',
                        display: 'flex',
                        flexDirection: 'column'
                    }}>
                        {checkPermission('manage_settings') && (
                            <a 
                                href="#" 
                                onClick={(e) => { 
                                    e.preventDefault(); 
                                    setCurrentView('store'); 
                                    setShowUserDropdown(false); 
                                }}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px',
                                    padding: '12px 16px',
                                    color: 'var(--text-primary)',
                                    fontSize: '13px',
                                    textDecoration: 'none',
                                    borderBottom: '1px solid rgba(255,255,255,0.05)',
                                    transition: 'background 0.2s'
                                }}
                                onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                                onMouseLeave={(e) => e.target.style.background = 'transparent'}
                            >
                                <img src="/icons/Settings.png" alt="Settings" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                                <span>{t('settings')}</span>
                            </a>
                        )}
                        <a 
                            href="#" 
                            onClick={(e) => { 
                                e.preventDefault(); 
                                authLogout(); 
                                setShowUserDropdown(false); 
                            }}
                            style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '10px',
                                padding: '12px 16px',
                                color: 'var(--color-danger)',
                                fontSize: '13px',
                                textDecoration: 'none',
                                transition: 'background 0.2s'
                            }}
                            onMouseEnter={(e) => e.target.style.background = 'rgba(255,255,255,0.05)'}
                            onMouseLeave={(e) => e.target.style.background = 'transparent'}
                        >
                            <img src="/icons/Log Out.png" alt="Log Out" style={{ width: '18px', height: '18px', objectFit: 'contain' }} />
                            <span>{t('logout')}</span>
                        </a>
                    </div>
                )}

                <div 
                    className="user-profile" 
                    style={{ marginTop: '10px', cursor: 'pointer' }}
                    onClick={() => setShowUserDropdown(prev => !prev)}
                >
                    <div 
                        className="user-avatar" 
                        id="user-avatar-lbl"
                        style={{
                            backgroundImage: (state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || (state.currentUser.role === 'SuperAdmin' && state.storeSettings?.adminAvatar)) ? `url(${state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || state.storeSettings?.adminAvatar})` : 'none',
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            color: (state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || (state.currentUser.role === 'SuperAdmin' && state.storeSettings?.adminAvatar)) ? 'transparent' : 'inherit'
                        }}
                    >
                        {!(state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || (state.currentUser.role === 'SuperAdmin' && state.storeSettings?.adminAvatar)) && 
                            (state.currentUser.name?.charAt(0)?.toUpperCase() || 'U')
                        }
                    </div>
                    <div className="user-details">
                        <h4 id="user-display-name">{state.currentUser.name}</h4>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            {state.currentUser.role}
                            <i className={`fa-solid fa-chevron-${showUserDropdown ? 'down' : 'up'}`} style={{ fontSize: '10px', opacity: 0.7 }}></i>
                        </span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
