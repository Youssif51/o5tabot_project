import React, { useContext, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppContext } from './context/AppContext';

// Common components
import Sidebar from './components/common/Sidebar';
import Topbar from './components/common/Topbar';
import Modal from './components/common/Modal';
import SmartDateFilter from './components/common/SmartDateFilter';

// Dashboard components
import MetricsRow from './components/dashboard/MetricsRow';
import ChartsSection from './components/dashboard/ChartsSection';
import TopSelling from './components/dashboard/TopSelling';
import LowQuantity from './components/dashboard/LowQuantity';

// Module components
import InventoryList from './components/inventory/InventoryList';
import OrdersList from './components/orders/OrdersList';
import ShopifyPendingList from './components/orders/ShopifyPendingList';
import SuppliersList from './components/suppliers/SuppliersList';
import CustomersList from './components/customers/CustomersList';
import ReportsView from './components/reports/ReportsView';
import StoreSettings from './components/store/StoreSettings';
import MarketingView from './components/marketing/MarketingView';
import SupabaseTodos from './components/supabase/SupabaseTodos';
import DepositConfirmList from './components/orders/DepositConfirmList';

// Modal Forms
import AddProductModal from './components/inventory/AddProductModal';
import RecordOrderModal from './components/orders/RecordOrderModal';

// Global styles
import './assets/style.css';

export default function App() {
    const { 
        state, 
        currentView, 
        setCurrentView,
        toast, 
        shopifyNotification,
        setShopifyNotification,
        authLogin, 
        authSignup,
        language,
        showAlert
    } = useContext(AppContext);

    // Auth screen toggling
    const [authMode, setAuthMode] = useState('login');
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPassword, setLoginPassword] = useState('');
    const [signupStore, setSignupStore] = useState('');
    const [signupEmail, setSignupEmail] = useState('');
    const [signupPassword, setSignupPassword] = useState('');
    const [signupName, setSignupName] = useState('');

    // Sidebar Mobile/Tablet Drawer Toggle state
    const [sidebarOpen, setSidebarOpen] = useState(false);

    // Auto-close sidebar on view change (mobile)
    React.useEffect(() => {
        setSidebarOpen(false);
    }, [currentView]);

    // Auto-hide Shopify notification popup
    React.useEffect(() => {
        if (shopifyNotification?.visible) {
            const timer = setTimeout(() => {
                setShopifyNotification(prev => ({ ...prev, visible: false }));
            }, 10000);
            return () => clearTimeout(timer);
        }
    }, [shopifyNotification?.visible, setShopifyNotification]);

    // Global Search State
    const [globalSearch, setGlobalSearch] = useState('');

    // Modal Forms Visibility
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [editProductId, setEditProductId] = useState(null);
    const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);
    const [editOrderId, setEditOrderId] = useState(null);
    const [dashTimeFilter, setDashTimeFilter] = useState({ type: 'preset', preset: 'all' });

    // Barcode scanner simulation state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerSource, setScannerSource] = useState('search'); // 'search' or 'field'
    const [scannerSelectedBarcode, setScannerSelectedBarcode] = useState('');
    const [scannerCallback, setScannerCallback] = useState(null);

    // Realtime connection check
    const [isOnline, setIsOnline] = useState(navigator.onLine);

    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);

        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, []);
    const [isScanning, setIsScanning] = useState(false);

    // Gather all active barcodes for scanner dropdown
    const availableBarcodes = [];
    state.products.forEach(p => {
        p.variants.forEach(v => {
            if (v.barcode) {
                availableBarcodes.push({
                    barcode: v.barcode,
                    label: `${p.name} - ${v.name} (Barcode: ${v.barcode})`
                });
            }
        });
    });

    const handleOpenScanner = (source, callback) => {
        setScannerSource(source);
        setScannerCallback(() => callback);
        if (availableBarcodes.length > 0) {
            setScannerSelectedBarcode(availableBarcodes[0].barcode);
        } else {
            setScannerSelectedBarcode('');
        }
        setIsScanning(false);
        setIsScannerOpen(true);
    };

    const handleSimulateScan = (e) => {
        e.preventDefault();
        if (!scannerSelectedBarcode) {
            showAlert("لا توجد أكواد باركود مسجلة للمسح الضوئي.");
            return;
        }

        setIsScanning(true);

        // Simulate 1.2s delay for barcode scan animation
        setTimeout(() => {
            setIsScanning(false);
            setIsScannerOpen(false);
            if (scannerCallback) {
                scannerCallback(scannerSelectedBarcode);
            }
        }, 1200);
    };

    // Render Auth split screen
    if (!state.currentUser) {
        return (
            <>
            <div className="auth-wrapper">
                <div className="auth-background-glow"></div>
                <div className="auth-background-ambient"></div>
                
                {/* Left Side Branding */}
                <div className="auth-left">
                    <div className="auth-left-content">
                        <img 
                            src="/octabot-logo-final.png" 
                            className="auth-brand-logo" 
                            alt="Octabot Octopus Logo" 
                        />
                        <h1 className="auth-brand-name">OCTABOT</h1>
                    </div>
                </div>

                {/* Right Side Forms */}
                <div className="auth-right">
                    {authMode === 'login' ? (
                        <div className="auth-card">
                            <div className="auth-header">
                                <img src="/octabot-logo-final.png" alt="Octabot Icon" className="auth-mini-logo" />
                                <h2 className="auth-title">Welcome back</h2>
                                <p className="auth-subtitle">Log in to your workspace ledger.</p>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); authLogin(loginEmail, loginPassword); }}>
                                <div className="form-group">
                                    <label className="form-label">Username / Email*</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Enter your name" 
                                        value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password*</label>
                                    <input 
                                        type="password" className="form-input" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />
                                </div>
                                <button type="submit" className="btn btn-primary btn-auth-submit">
                                    Sign In
                                </button>
                            </form>
                        </div>
                    ) : (
                        <div className="auth-card">
                            <div className="auth-header">
                                <img src="/octabot-logo-final.png" alt="Octabot Icon" className="auth-mini-logo" />
                                <h2 className="auth-title">Create an account</h2>
                                <p className="auth-subtitle">Start your 30-day free trial.</p>
                            </div>
                            <form onSubmit={(e) => { e.preventDefault(); authSignup(signupStore, signupEmail); }}>
                                <div className="form-group">
                                    <label className="form-label">Store Brand Name*</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Enter your store name" 
                                        value={signupStore}
                                        onChange={(e) => setSignupStore(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Email*</label>
                                    <input 
                                        type="email" 
                                        className="form-input" 
                                        placeholder="Enter your email" 
                                        value={signupEmail}
                                        onChange={(e) => setSignupEmail(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password*</label>
                                    <input 
                                        type="password" 
                                        className="form-input" 
                                        placeholder="Create a password" 
                                        required 
                                    />
                                    <span className="form-input-footnote">Must be at least 8 characters.</span>
                                </div>
                                <button type="submit" className="btn btn-primary btn-auth-submit">
                                    Get started
                                </button>
                                <p className="auth-switch-text">
                                    Already have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('login'); }}>Log in</a>
                                </p>
                            </form>
                        </div>
                    )}
                </div>
                </div>
                {/* Toast Notification dialog overlay for Auth screen */}
                <div 
                    id="toast-notification-auth" 
                    style={{ 
                        position: 'fixed', 
                        top: '20px', 
                        right: '20px', 
                        transform: toast.visible ? 'translateY(0)' : 'translateY(-100px)', 
                        background: 'var(--glass-bg)', 
                        backdropFilter: 'var(--blur)', 
                        border: '1px solid var(--glass-border)', 
                        boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 0 15px var(--gold-glow)', 
                        color: 'var(--text-primary)',
                        padding: '16px 24px', 
                        borderRadius: 'var(--radius-md)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '12px', 
                        zIndex: 2000, 
                        opacity: toast.visible ? 1 : 0, 
                        transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease' 
                    }}
                >
                    <i 
                        className={
                            toast.type === 'success' 
                                ? 'fa-solid fa-circle-check' 
                                : toast.type === 'warning' 
                                    ? 'fa-solid fa-circle-exclamation' 
                                    : 'fa-solid fa-triangle-exclamation'
                        }
                        style={{ 
                            color: toast.type === 'success' 
                                ? 'var(--gold-primary)' 
                                : toast.type === 'warning' 
                                    ? 'var(--color-warning)' 
                                    : 'var(--color-danger)', 
                            fontSize: '18px' 
                        }}
                    ></i>
                    <div id="toast-message-auth" style={{ fontSize: '13px', fontWeight: 500 }}>
                        {toast.message}
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`} dir={language === 'ar' ? 'rtl' : 'ltr'}>
            {/* Sidebar Navigation */}
            <Sidebar sidebarOpen={sidebarOpen} setSidebarOpen={setSidebarOpen} />

            {/* Mobile/Tablet Drawer Backdrop Overlay */}
            {sidebarOpen && (
                <div 
                    className="sidebar-backdrop" 
                    onClick={() => setSidebarOpen(false)}
                ></div>
            )}

            {/* Main Content Pane */}
            <main className="main-content">
                {/* Search Header Topbar */}
                <Topbar 
                    globalSearch={globalSearch} 
                    setGlobalSearch={setGlobalSearch} 
                    toggleSidebar={() => setSidebarOpen(prev => !prev)}
                />

                {/* Main Views Router */}
                <Routes>
                    <Route path="/dashboard" element={
                        <div id="dashboard-view" className="view-pane active" dir="rtl">
                            {/* Premium Welcome & Time Filter Header */}
                            <div className="page-header" style={{ marginBottom: '28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '20px', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '18px' }}>
                                <div className="page-title-group">
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                                        <h2 style={{ fontSize: '24px', fontWeight: '800', background: 'linear-gradient(135deg, #fff 30%, var(--gold-primary) 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
                                            لوحة التحكم والتحليلات
                                        </h2>
                                        <div className={`live-indicator ${isOnline ? '' : 'offline'}`} title={isOnline ? "اتصال مباشر بسيرفر النظام وقاعدة البيانات" : "تم قطع الاتصال بالسيرفر"}>
                                            <span className="live-indicator-dot"></span>
                                            <span>{isOnline ? "اتصال السيرفر نشط" : "السيرفر غير متصل"}</span>
                                        </div>
                                    </div>
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '6px', lineHeight: 1.5 }}>
                                        مرحباً بك مجدداً يا رئيس! إليك نظرة شاملة على مؤشرات الأداء ومستوى المخزون لمتجرك <strong style={{ color: 'var(--gold-primary)' }}>{state.storeSettings?.storeName || 'a5tabot'}</strong>.
                                    </p>
                                </div>
                                <div className="page-actions" style={{ marginRight: 'auto', marginLeft: 0 }}>
                                    <SmartDateFilter filterConfig={dashTimeFilter} setFilterConfig={setDashTimeFilter} />
                                </div>
                            </div>

                            <MetricsRow timeFilter={dashTimeFilter} />
                            <ChartsSection timeFilter={dashTimeFilter} />
                            <div className="dashboard-grid" style={{ marginTop: '24px' }}>
                                <TopSelling timeFilter={dashTimeFilter} />
                                <LowQuantity />
                            </div>
                        </div>
                    } />

                    <Route path="/inventory" element={
                        <InventoryList 
                            globalSearch={globalSearch}
                            setGlobalSearch={setGlobalSearch}
                            onOpenAddProduct={() => { setEditProductId(null); setIsAddProductOpen(true); }}
                            onOpenEditProduct={(id) => { setEditProductId(id); setIsAddProductOpen(true); }}
                            onOpenScanner={handleOpenScanner}
                        />
                    } />

                    <Route path="/orders" element={
                        <OrdersList 
                            globalSearch={globalSearch}
                            setGlobalSearch={setGlobalSearch}
                            onOpenAddOrder={() => { setEditOrderId(null); setIsAddOrderOpen(true); }}
                            onOpenEditOrder={(id) => { setEditOrderId(id); setIsAddOrderOpen(true); }}
                        />
                    } />

                    <Route path="/shopifyPending" element={
                        <ShopifyPendingList 
                            onOpenEditOrder={(id) => { setEditOrderId(id); setIsAddOrderOpen(true); }}
                        />
                    } />

                    <Route path="/suppliers" element={
                        <SuppliersList globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} />
                    } />

                    <Route path="/customers" element={
                        <CustomersList globalSearch={globalSearch} setGlobalSearch={setGlobalSearch} />
                    } />

                    <Route path="/reports" element={
                        (state.currentUser?.role === 'SuperAdmin' || (state.currentUser?.permissions || []).includes('view_reports')) ? (
                            <ReportsView />
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )
                    } />

                    <Route path="/depositConfirm" element={
                        <DepositConfirmList />
                    } />

                    <Route path="/store" element={
                        state.currentUser ? (
                            <StoreSettings />
                        ) : (
                            <Navigate to="/dashboard" replace />
                        )
                    } />

                    <Route path="/marketing" element={
                        <MarketingView />
                    } />

                    <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
            </main>

            {/* Global Modals overlay registry */}
            <AddProductModal 
                isOpen={isAddProductOpen}
                onClose={() => setIsAddProductOpen(false)}
                editProductId={editProductId}
                onOpenScanner={handleOpenScanner}
            />

            <RecordOrderModal 
                isOpen={isAddOrderOpen}
                onClose={() => { setIsAddOrderOpen(false); setEditOrderId(null); }}
                editOrderId={editOrderId}
            />

            {/* Scanner simulation Modal */}
            <Modal 
                isOpen={isScannerOpen} 
                onClose={() => setIsScannerOpen(false)} 
                title="Simulation: Barcode Laser Scanner"
            >
                <form onSubmit={handleSimulateScan}>
                    <p style={{ fontSize: '13px', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.5 }}>
                        Select a barcode from the active inventory database to simulate the hardware laser trigger read action.
                    </p>
                    
                    <div className="form-group">
                        <label className="form-label">Available Product Barcodes</label>
                        {availableBarcodes.length === 0 ? (
                            <select className="form-select" disabled>
                                <option>-- No barcodes registered in catalog --</option>
                            </select>
                        ) : (
                            <select 
                                className="form-select"
                                value={scannerSelectedBarcode}
                                onChange={(e) => setScannerSelectedBarcode(e.target.value)}
                                required
                            >
                                {availableBarcodes.map((item, idx) => (
                                    <option key={`scan-opt-${idx}`} value={item.barcode}>
                                        {item.label}
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Scanner Simulation Laser Visual animation */}
                    <div className="scanner-container" style={{ marginTop: '20px' }}>
                        <div className="scanner-video-mock">
                            {isScanning && <div className="scanner-laser"></div>}
                            <div className="scanner-target-box">
                                <i className="fa-solid fa-expand"></i>
                            </div>
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => setIsScannerOpen(false)}
                        >
                            Close
                        </button>
                        <button 
                            type="submit" 
                            className="btn btn-primary"
                            disabled={isScanning || availableBarcodes.length === 0}
                        >
                            {isScanning ? 'Reading laser...' : 'Trigger Scan Action'}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Toast Notification dialog overlay */}
            <div 
                id="toast-notification" 
                style={{ 
                    position: 'fixed', 
                    top: '20px', 
                    right: '20px', 
                    transform: toast.visible ? 'translateY(0)' : 'translateY(-100px)', 
                    background: 'var(--glass-bg)', 
                    backdropFilter: 'var(--blur)', 
                    border: '1px solid var(--glass-border)', 
                    boxShadow: '0 10px 30px rgba(0,0,0,0.15), 0 0 15px var(--gold-glow)', 
                    color: 'var(--text-primary)',
                    padding: '16px 24px', 
                    borderRadius: 'var(--radius-md)', 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '12px', 
                    zIndex: 2000, 
                    opacity: toast.visible ? 1 : 0, 
                    transition: 'transform 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275), opacity 0.3s ease' 
                }}
            >
                <i 
                    className={
                        toast.type === 'success' 
                            ? 'fa-solid fa-circle-check' 
                            : toast.type === 'warning' 
                                ? 'fa-solid fa-circle-exclamation' 
                                : 'fa-solid fa-triangle-exclamation'
                    }
                    style={{ 
                        color: toast.type === 'success' 
                            ? 'var(--gold-primary)' 
                            : toast.type === 'warning' 
                                ? 'var(--color-warning)' 
                                : 'var(--color-danger)', 
                        fontSize: '18px' 
                    }}
                ></i>
                <div id="toast-message" style={{ fontSize: '13px', fontWeight: 500 }}>
                    {toast.message}
                </div>
            </div>

            {/* Facebook-style Shopify Webhook Notification Popup */}
            {shopifyNotification?.visible && (
                <>
                <style>{`
                    @keyframes slideInCreative {
                        0% {
                            transform: translateY(30px) scale(0.95);
                            opacity: 0;
                        }
                        100% {
                            transform: translateY(0) scale(1);
                            opacity: 1;
                        }
                    }
                    @keyframes greenPulse {
                        0% {
                            box-shadow: 0 0 0 0 rgba(150, 191, 72, 0.7);
                        }
                        70% {
                            box-shadow: 0 0 0 6px rgba(150, 191, 72, 0);
                        }
                        100% {
                            box-shadow: 0 0 0 0 rgba(150, 191, 72, 0);
                        }
                    }
                    .shopify-popup-btn-view:hover {
                        transform: translateY(-1px);
                        box-shadow: 0 4px 12px rgba(150, 191, 72, 0.4);
                        background: linear-gradient(135deg, #a7d452, #689f22) !important;
                    }
                    .shopify-popup-btn-close:hover {
                        background: rgba(255, 255, 255, 0.15) !important;
                        color: #fff !important;
                    }
                `}</style>
                <div 
                    id="shopify-order-popup"
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        width: '290px',
                        background: 'rgba(15, 22, 12, 0.95)',
                        backdropFilter: 'blur(20px)',
                        border: '1px solid rgba(150, 191, 72, 0.35)',
                        boxShadow: '0 12px 36px rgba(0, 0, 0, 0.6), inset 0 1px 1px rgba(255,255,255,0.05)',
                        borderRadius: '16px',
                        padding: '12px 14px',
                        zIndex: 2001,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '10px',
                        animation: 'slideInCreative 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards',
                        direction: 'rtl'
                    }}
                >
                    {/* Header */}
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{
                                width: '6px',
                                height: '6px',
                                borderRadius: '50%',
                                background: '#96bf48',
                                display: 'inline-block',
                                animation: 'greenPulse 1.8s infinite'
                            }}></span>
                            <span style={{ fontWeight: 800, fontSize: '11px', color: '#96bf48', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                طلب شوبيفاي جديد
                            </span>
                        </div>
                        <button 
                            onClick={() => setShopifyNotification(prev => ({ ...prev, visible: false }))}
                            className="shopify-popup-btn-close"
                            style={{ 
                                background: 'rgba(255,255,255,0.05)', 
                                border: 'none', 
                                color: 'rgba(255,255,255,0.5)', 
                                cursor: 'pointer', 
                                width: '18px', 
                                height: '18px', 
                                borderRadius: '50%', 
                                display: 'flex', 
                                alignItems: 'center', 
                                justifyContent: 'center',
                                fontSize: '10px',
                                transition: 'all 0.2s'
                            }}
                        >
                            ✕
                        </button>
                    </div>

                    {/* Order Meta & Price */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                        <span style={{ fontSize: '15px', fontWeight: 'bold', color: '#fff', fontFamily: 'monospace' }}>
                            #{shopifyNotification.orderId}
                        </span>
                        <span style={{ fontSize: '14px', color: '#96bf48', fontWeight: 800 }}>
                            {shopifyNotification.totalValue.toLocaleString('en-US', {maximumFractionDigits: 0})} EGP
                        </span>
                    </div>

                    {/* Customer & Item count */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', borderTop: '1px solid rgba(255,255,255,0.05)', paddingTop: '8px', fontSize: '12px' }}>
                        <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>العميل:</span>
                            <strong style={{ color: '#fff', fontWeight: 500 }}>{shopifyNotification.client}</strong>
                        </div>
                        <div style={{ color: 'rgba(255,255,255,0.7)' }}>
                            <span style={{ color: 'rgba(255,255,255,0.4)', marginLeft: '4px' }}>المنتجات:</span>
                            <span style={{ color: '#fff' }}>{shopifyNotification.itemCount} قطع</span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button 
                        onClick={() => {
                            setCurrentView('shopifyPending');
                            setShopifyNotification(prev => ({ ...prev, visible: false }));
                        }}
                        className="shopify-popup-btn-view"
                        style={{
                            width: '100%',
                            background: 'linear-gradient(135deg, #96bf48, #5a8a1e)',
                            color: '#fff',
                            border: 'none',
                            padding: '6px 12px',
                            borderRadius: '8px',
                            fontSize: '11px',
                            fontWeight: 'bold',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            gap: '4px',
                            transition: 'all 0.2s',
                            marginTop: '2px'
                        }}
                    >
                        <i className="fa-solid fa-eye" style={{ fontSize: '10px' }}></i> عرض الطلب
                    </button>
                </div>
                </>
            )}
        </div>
    );
}
