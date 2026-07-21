import React, { useContext, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppContext } from './context/AppContext';

// Common components
import Sidebar from './components/common/Sidebar';
import Topbar from './components/common/Topbar';
import Modal from './components/common/Modal';

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
    const [dashTimeFilter, setDashTimeFilter] = useState('all');

    // Barcode scanner simulation state
    const [isScannerOpen, setIsScannerOpen] = useState(false);
    const [scannerSource, setScannerSource] = useState('search'); // 'search' or 'field'
    const [scannerSelectedBarcode, setScannerSelectedBarcode] = useState('');
    const [scannerCallback, setScannerCallback] = useState(null);
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
        <div className={`app-container ${sidebarOpen ? 'sidebar-open' : ''}`}>
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
                            {/* Dashboard Time Filter Header */}
                            <div className="page-header" style={{ marginBottom: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
                                <div className="page-title-group">
                                    <h2 style={{ fontSize: '22px', fontWeight: 'bold' }}>لوحة التحكم والتحليلات</h2>
                                </div>
                                <div className="page-actions" style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                                    <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.6)' }}>تصفية الفترة الزمنية:</span>
                                    <select 
                                        className="form-select" 
                                        value={dashTimeFilter} 
                                        onChange={(e) => setDashTimeFilter(e.target.value)}
                                        style={{ width: '180px', backgroundColor: 'rgba(255,255,255,0.02)', color: '#fff', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px' }}
                                    >
                                        <option value="all" style={{ background: '#1a1a1a' }}>كل الأوقات</option>
                                        <option value="today" style={{ background: '#1a1a1a' }}>اليوم</option>
                                        <option value="week" style={{ background: '#1a1a1a' }}>آخر 7 أيام (أسبوع)</option>
                                        <option value="month" style={{ background: '#1a1a1a' }}>آخر 30 يوماً (شهر)</option>
                                        <option value="year" style={{ background: '#1a1a1a' }}>آخر 365 يوماً (سنة)</option>
                                    </select>
                                </div>
                            </div>

                            <MetricsRow timeFilter={dashTimeFilter} />
                            <ChartsSection timeFilter={dashTimeFilter} />
                            <div className="dashboard-grid" style={{ marginTop: '24px' }}>
                                <TopSelling />
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
                        <ReportsView />
                    } />


                    <Route path="/depositConfirm" element={
                        <DepositConfirmList />
                    } />

                    <Route path="/store" element={
                        <StoreSettings />
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
                    @keyframes slideUp {
                        from {
                            transform: translateY(100px);
                            opacity: 0;
                        }
                        to {
                            transform: translateY(0);
                            opacity: 1;
                        }
                    }
                `}</style>
                <div 
                    id="shopify-order-popup"
                    style={{
                        position: 'fixed',
                        bottom: '24px',
                        right: '24px',
                        width: '360px',
                        maxWidth: 'calc(100vw - 48px)',
                        background: 'rgba(26, 26, 26, 0.95)',
                        backdropFilter: 'blur(16px)',
                        border: '1px solid rgba(150, 191, 72, 0.4)',
                        boxShadow: '0 10px 40px rgba(0, 0, 0, 0.5), 0 0 20px rgba(150, 191, 72, 0.2)',
                        borderRadius: '12px',
                        padding: '16px',
                        zIndex: 2001,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '12px',
                        animation: 'slideUp 0.4s cubic-bezier(0.165, 0.84, 0.44, 1) forwards',
                        direction: 'rtl'
                    }}
                >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: 'linear-gradient(135deg, #96bf48, #5a8a1e)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#fff',
                                boxShadow: '0 0 10px rgba(150, 191, 72, 0.5)'
                            }}>
                                <i className="fa-solid fa-shopping-bag" style={{ fontSize: '14px' }}></i>
                            </div>
                            <span style={{ fontWeight: 'bold', fontSize: '14px', color: '#96bf48' }}>
                                طلب جديد من شوبيفاي! 🛒
                            </span>
                        </div>
                        <button 
                            onClick={() => setShopifyNotification(prev => ({ ...prev, visible: false }))}
                            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: '16px' }}
                        >
                            <i className="fa-solid fa-xmark"></i>
                        </button>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '13px', color: 'rgba(255,255,255,0.85)' }}>
                        <div>
                            <strong>رقم الطلب:</strong> <span style={{ fontFamily: 'monospace', color: '#fff' }}>{shopifyNotification.orderId}</span>
                        </div>
                        <div>
                            <strong>اسم العميل:</strong> <span style={{ color: '#fff', fontWeight: 500 }}>{shopifyNotification.client}</span>
                        </div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                            <span><strong>عدد المنتجات:</strong> {shopifyNotification.itemCount} قطع</span>
                            <span style={{ color: '#96bf48', fontWeight: 'bold' }}>{shopifyNotification.totalValue.toLocaleString('en-US', {maximumFractionDigits: 2})} EGP</span>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                        <button 
                            onClick={() => {
                                setCurrentView('shopifyPending');
                                setShopifyNotification(prev => ({ ...prev, visible: false }));
                            }}
                            style={{
                                flex: 1,
                                background: 'linear-gradient(135deg, #96bf48, #5a8a1e)',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '6px',
                                transition: 'all 0.2s'
                            }}
                        >
                            <i className="fa-solid fa-eye"></i> عرض الطلب
                        </button>
                        <button 
                            onClick={() => setShopifyNotification(prev => ({ ...prev, visible: false }))}
                            style={{
                                background: 'rgba(255,255,255,0.1)',
                                color: '#fff',
                                border: 'none',
                                padding: '8px 12px',
                                borderRadius: '6px',
                                fontSize: '12px',
                                cursor: 'pointer',
                                transition: 'all 0.2s'
                            }}
                        >
                            إغلاق
                        </button>
                    </div>
                </div>
                </>
            )}
        </div>
    );
}
