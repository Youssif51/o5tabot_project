import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Topbar({ globalSearch, setGlobalSearch, toggleSidebar }) {
    const { state, currentView, setCurrentView, language, setLanguage, theme, setTheme, t } = useContext(AppContext);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!state.currentUser) return null;

    // 1. Compute pending Shopify orders
    const pendingShopifyOrders = (state.orders || []).filter(o => o.status === 'Pending' && o.source === 'shopify');

    // 2. Compute low stock items
    const lowStockItems = [];
    (state.products || []).forEach(p => {
        (p.variants || []).forEach(v => {
            const limit = v.reorderLimit || 5;
            const stockQty = v.stock?.Sulur || 0;
            if (stockQty <= limit) {
                lowStockItems.push({
                    productId: p.id,
                    sku: v.sku,
                    name: v.name === 'Standard Option' ? p.name : `${p.name} (${v.name})`,
                    stock: stockQty
                });
            }
        });
    });

    // 3. Combine notifications
    const notificationsList = [
        ...pendingShopifyOrders.map(o => ({
            id: `shopify-${o.id}`,
            type: 'shopify',
            title: language === 'en' ? 'New Shopify Order' : 'طلب شوبيفاي معلق جديد',
            text: language === 'en' 
                ? `Order ${o.id} for ${o.client} (${o.totalValue.toLocaleString('en-US', {maximumFractionDigits: 2})} EGP)`
                : `طلب جديد بقيمة ${o.totalValue.toLocaleString('en-US', {maximumFractionDigits: 2})} ج.م للعميل ${o.client}`,
            targetView: 'shopifyPending'
        })),
        ...lowStockItems.map(item => ({
            id: `stock-${item.sku}`,
            type: 'lowstock',
            title: language === 'en' ? 'Low Stock Warning' : 'تنبيه نقص مخزون',
            text: language === 'en'
                ? `Item "${item.name}" has only ${item.stock} left.`
                : `الصنف "${item.name}" متبقي منه ${item.stock} قطعة فقط.`,
            targetView: 'inventory'
        }))
    ];

    const notificationCount = notificationsList.length;

    const handleNotificationClick = (item) => {
        setCurrentView(item.targetView);
        setIsOpen(false);
    };

    return (
        <div className="top-bar">
            {/* Mobile/Tablet Hamburger Toggle Button */}
            <button 
                className="top-bar-hamburger-btn" 
                onClick={toggleSidebar}
                title="Toggle Sidebar Menu"
            >
                <i className="fa-solid fa-bars"></i>
            </button>

            <div className="top-bar-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <img 
                    src="/icons/Search.png" 
                    alt="Search" 
                    style={{ position: 'absolute', left: '14px', width: '18px', height: '18px', objectFit: 'contain', pointerEvents: 'none' }} 
                />
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')}
                    value={globalSearch || ''}
                    onChange={(e) => {
                        setGlobalSearch(e.target.value);
                        if (currentView !== 'inventory' && currentView !== 'orders' && currentView !== 'suppliers') {
                            setCurrentView('inventory');
                        }
                    }}
                    style={{ paddingLeft: '44px' }}
                />
            </div>
            
            <div className="top-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Theme Switch Button */}
                <button 
                    className="top-bar-icon-btn" 
                    onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? (
                        <i className="fa-solid fa-sun" style={{ color: '#fff', fontSize: '16px' }}></i>
                    ) : (
                        <i className="fa-solid fa-moon" style={{ color: '#121214', fontSize: '16px' }}></i>
                    )}
                </button>

                {/* Language Switch Button */}
                <button 
                    className="btn btn-secondary" 
                    onClick={() => setLanguage(prev => prev === 'en' ? 'ar' : 'en')}
                    style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                >
                    {language === 'en' ? 'العربية' : 'English'}
                </button>

                {/* Dynamic Notifications Dropdown */}
                <div 
                    ref={dropdownRef}
                    style={{ position: 'relative' }}
                >
                    <div 
                        className="top-bar-icon-btn" 
                        onClick={() => setIsOpen(!isOpen)}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative', cursor: 'pointer' }}
                    >
                        <img 
                            src="/icons/Notification.png" 
                            alt="Notifications" 
                            style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                        />
                        {notificationCount > 0 && (
                            <span style={{
                                position: 'absolute',
                                top: '-4px',
                                right: '-4px',
                                background: '#e74c3c',
                                color: 'white',
                                fontSize: '9px',
                                fontWeight: 'bold',
                                borderRadius: '50%',
                                minWidth: '15px',
                                height: '15px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                padding: '2px',
                                border: '1.5px solid var(--bg-primary)'
                            }}>
                                {notificationCount}
                            </span>
                        )}
                    </div>

                    {isOpen && (
                        <div className="glass-card" style={{
                            position: 'absolute',
                            top: '120%',
                            left: language === 'ar' ? 0 : 'auto',
                            right: language === 'en' ? 0 : 'auto',
                            width: '320px',
                            background: 'var(--bg-secondary)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '8px',
                            boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                            zIndex: 1000,
                            overflow: 'hidden',
                            animation: 'fadeIn 0.2s ease'
                        }}>
                            {/* Header */}
                            <div style={{
                                padding: '12px 16px',
                                borderBottom: '1px solid var(--glass-border)',
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                background: 'rgba(255,255,255,0.02)'
                            }}>
                                <strong style={{ fontSize: '13px', color: 'var(--text-primary)' }}>
                                    {language === 'en' ? 'Notifications' : 'التنبيهات التفاعلية'}
                                </strong>
                                <span style={{ fontSize: '10.5px', background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '10px', color: 'var(--text-secondary)' }}>
                                    {notificationCount} {language === 'en' ? 'New' : 'جديد'}
                                </span>
                            </div>

                            {/* List */}
                            <div style={{ maxHeight: '280px', overflowY: 'auto' }}>
                                {notificationsList.length === 0 ? (
                                    <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
                                        <i className="fa-regular fa-bell-slash" style={{ fontSize: '24px', display: 'block', marginBottom: '8px', opacity: 0.3 }}></i>
                                        <span style={{ fontSize: '12px' }}>
                                            {language === 'en' ? 'No new notifications' : 'لا توجد تنبيهات جديدة'}
                                        </span>
                                    </div>
                                ) : (
                                    notificationsList.map(item => (
                                        <div 
                                            key={item.id}
                                            onClick={() => handleNotificationClick(item)}
                                            style={{
                                                padding: '12px 16px',
                                                borderBottom: '1px solid var(--glass-border)',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                gap: '12px',
                                                alignItems: 'flex-start',
                                                transition: 'background 0.2s ease',
                                                background: item.type === 'shopify' ? 'rgba(150,191,72,0.02)' : 'rgba(231,76,60,0.02)'
                                            }}
                                            className="autocomplete-option"
                                        >
                                            {/* Icon */}
                                            <div style={{
                                                width: '28px',
                                                height: '28px',
                                                borderRadius: '6px',
                                                background: item.type === 'shopify' ? 'linear-gradient(135deg, #96bf48, #5a8a1e)' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                                                color: 'white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                fontSize: '12px',
                                                flexShrink: 0
                                            }}>
                                                {item.type === 'shopify' ? (
                                                    <i className="fa-brands fa-shopify"></i>
                                                ) : (
                                                    <i className="fa-solid fa-triangle-exclamation"></i>
                                                )}
                                            </div>
                                            
                                            {/* Content */}
                                            <div style={{ flex: 1 }}>
                                                <div style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '3px' }}>
                                                    {item.title}
                                                </div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-secondary)', lineBreak: 'anywhere' }}>
                                                    {item.text}
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>

                            {/* Footer */}
                            {pendingShopifyOrders.length > 0 && (
                                <div 
                                    onClick={() => {
                                        setCurrentView('shopifyPending');
                                        setIsOpen(false);
                                    }}
                                    style={{
                                        padding: '10px 16px',
                                        textAlign: 'center',
                                        fontSize: '11.5px',
                                        borderTop: '1px solid var(--glass-border)',
                                        color: '#96bf48',
                                        fontWeight: 'bold',
                                        cursor: 'pointer',
                                        background: 'rgba(150,191,72,0.03)',
                                        transition: 'background 0.2s ease'
                                    }}
                                    className="autocomplete-option"
                                >
                                    {language === 'en' ? 'Review Shopify Orders' : 'مراجعة طلبات شوبيفاي معلقة'}
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div 
                    className="top-profile-avatar" 
                    onClick={() => setCurrentView('store')}
                >
                    <div className="user-avatar" id="top-avatar-lbl">
                        {state.currentUser.avatar || 'A'}
                    </div>
                </div>
            </div>
        </div>
    );
}
