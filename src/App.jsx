import React, { useContext, useState } from 'react';
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
import SuppliersList from './components/suppliers/SuppliersList';
import ReportsView from './components/reports/ReportsView';
import StoreSettings from './components/store/StoreSettings';
import SupabaseTodos from './components/supabase/SupabaseTodos';

// Modal Forms
import AddProductModal from './components/inventory/AddProductModal';
import RecordOrderModal from './components/orders/RecordOrderModal';

// Global styles
import './assets/style.css';

export default function App() {
    const { 
        state, 
        currentView, 
        toast, 
        authLogin, 
        authSignup 
    } = useContext(AppContext);

    // Auth screen toggling
    const [authMode, setAuthMode] = useState('login');
    const [loginUsername, setLoginUsername] = useState('sfsf');
    const [signupStore, setSignupStore] = useState('Octabot Retail Ltd');
    const [signupEmail, setSignupEmail] = useState('admin@octabot.com');

    // Global Search State
    const [globalSearch, setGlobalSearch] = useState('');

    // Modal Forms Visibility
    const [isAddProductOpen, setIsAddProductOpen] = useState(false);
    const [editProductId, setEditProductId] = useState(null);
    const [isAddOrderOpen, setIsAddOrderOpen] = useState(false);

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
            alert("No registered barcodes available to scan.");
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
                            <form onSubmit={(e) => { e.preventDefault(); authLogin(loginUsername); }}>
                                <div className="form-group">
                                    <label className="form-label">Username / Email*</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        placeholder="Enter your name" 
                                        value={loginUsername}
                                        onChange={(e) => setLoginUsername(e.target.value)}
                                        required 
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">Password*</label>
                                    <input 
                                        type="password" 
                                        className="form-input" 
                                        placeholder="••••••••" 
                                        required 
                                    />
                                </div>
                                <button type="submit" className="btn btn-primary btn-auth-submit">
                                    Sign In
                                </button>
                                <p className="auth-switch-text">
                                    Don't have an account? <a href="#" onClick={(e) => { e.preventDefault(); setAuthMode('signup'); }}>Sign up</a>
                                </p>
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
        );
    }

    return (
        <div className="app-container">
            {/* Sidebar Navigation */}
            <Sidebar />

            {/* Main Content Pane */}
            <main className="main-content">
                {/* Search Header Topbar */}
                <Topbar 
                    globalSearch={globalSearch} 
                    setGlobalSearch={setGlobalSearch} 
                />

                {/* Main Views Router */}
                {currentView === 'dashboard' && (
                    <div id="dashboard-view" className="view-pane active">
                        <MetricsRow />
                        <ChartsSection />
                        <div className="dashboard-grid" style={{ marginTop: '24px' }}>
                            <TopSelling />
                            <LowQuantity />
                        </div>
                    </div>
                )}

                {currentView === 'inventory' && (
                    <InventoryList 
                        globalSearch={globalSearch}
                        onOpenAddProduct={() => { setEditProductId(null); setIsAddProductOpen(true); }}
                        onOpenEditProduct={(id) => { setEditProductId(id); setIsAddProductOpen(true); }}
                        onOpenScanner={handleOpenScanner}
                    />
                )}

                {currentView === 'orders' && (
                    <OrdersList 
                        globalSearch={globalSearch}
                        onOpenAddOrder={() => setIsAddOrderOpen(true)}
                    />
                )}

                {currentView === 'suppliers' && (
                    <SuppliersList globalSearch={globalSearch} />
                )}

                {currentView === 'reports' && (
                    <ReportsView />
                )}

                {currentView === 'supabaseTasks' && (
                    <SupabaseTodos />
                )}

                {currentView === 'store' && (
                    <StoreSettings />
                )}
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
                onClose={() => setIsAddOrderOpen(false)}
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
        </div>
    );
}
