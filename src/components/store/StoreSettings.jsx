import React, { useContext, useState, useEffect } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import UserManagement from './UserManagement';

export default function StoreSettings() {
    const { state, saveStoreConfig, saveUserAvatar, restoreStoreData, showToast, t } = useContext(AppContext);
    
    const [storeName, setStoreName] = useState(state.storeSettings.name || 'Octabot Retail Ltd');
    const [storeAddress, setStoreAddress] = useState(state.storeSettings.address || '');
    const [currency, setCurrency] = useState(state.storeSettings.currency || '$');
    
    const currentUserAvatar = state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || state.storeSettings.adminAvatar || '';
    const [userAvatar, setUserAvatar] = useState(currentUserAvatar);
    const [selectedAdminImage, setSelectedAdminImage] = useState(null);

    useEffect(() => {
        const avatar = state.userAvatars?.[state.currentUser?.id] || state.currentUser?.avatar || state.storeSettings.adminAvatar || '';
        if (avatar) {
            setUserAvatar(avatar);
        }
    }, [state.userAvatars, state.currentUser?.id, state.currentUser?.avatar, state.storeSettings.adminAvatar]);

    const admins = (state.users || []).filter(u => u.role === 'SuperAdmin' || u.role === 'Admin');

    const PERMISSIONS_MAP = {
        'view_dashboard': 'التقارير والإحصائيات',
        'manage_inventory': 'إدارة المخزون',
        'manage_orders': 'إدارة المبيعات',
        'manage_suppliers': 'إدارة الموردين',
        'manage_customers': 'إدارة العملاء',
        'view_reports': 'تصدير التقارير',
        'manage_settings': 'إعدادات المتجر'
    };

    const handleAvatarUpload = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            setUserAvatar(event.target.result);
        };
        reader.readAsDataURL(file);
    };

    const handleSaveAvatar = (e) => {
        e.preventDefault();
        saveUserAvatar(state.currentUser.id, userAvatar);
        if (state.currentUser?.role === 'SuperAdmin') {
            saveStoreConfig(storeName, storeAddress, currency, userAvatar);
        }
        showToast("Profile image saved successfully!");
    };

    const handleSave = (e) => {
        e.preventDefault();
        saveStoreConfig(storeName, storeAddress, currency, state.currentUser?.role === 'SuperAdmin' ? userAvatar : undefined);
    };

    const handleExportBackup = () => {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(state));
        const dlAnchorElem = document.createElement('a');
        dlAnchorElem.setAttribute("href", dataStr);
        dlAnchorElem.setAttribute("download", `octabot_db_backup_${new Date().toISOString().substring(0,10)}.json`);
        dlAnchorElem.click();
        showToast("Database backup downloaded successfully.");
    };

    const handleRestoreBackup = (e) => {
        const file = e.target.files[0];
        if (!file) return;
        
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const restoredState = JSON.parse(event.target.result);
                restoreStoreData(restoredState);
            } catch (err) {
                showToast("Failed to parse JSON backup file.", "error");
            }
        };
        reader.readAsText(file);
    };

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Product Name,Category,Variant SKU,Barcode,Wholesale Price,Retail Price,Stock\r\n";
        
        state.products.forEach(p => {
            p.variants.forEach(vr => {
                const row = [
                    `"${p.name}"`,
                    `"${p.category}"`,
                    `"${vr.sku}"`,
                    `"${vr.barcode || ""}"`,
                    vr.wholesalePrice,
                    vr.retailPrice,
                    vr.stock.Sulur
                ].join(",");
                csvContent += row + "\r\n";
            });
        });

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `octabot_inventory_report_${new Date().toISOString().substring(0,10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Inventory list exported as CSV.");
    };

    return (
        <div id="store-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('storeSettings')}</h2>
                </div>
            </div>

            <div className="dashboard-grid">
                {/* User Profile / Avatar Section (Visible to everyone) */}
                <div className="glass-card dashboard-widget" style={{ padding: '24px' }}>
                    <div className="widget-header" style={{ marginBottom: '20px' }}>
                        <h3>صورة الحساب الشخصي</h3>
                    </div>
                    <form onSubmit={handleSaveAvatar}>
                        <div className="form-group">
                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                <div 
                                    style={{ 
                                        width: '60px', 
                                        height: '60px', 
                                        borderRadius: '50%', 
                                        backgroundColor: 'var(--surface-color)', 
                                        border: '1px solid var(--glass-border)',
                                        backgroundImage: userAvatar ? `url(${userAvatar})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        overflow: 'hidden'
                                    }}
                                >
                                    {!userAvatar && <i className="fa-solid fa-user" style={{ fontSize: '24px', color: 'var(--text-secondary)' }}></i>}
                                </div>
                                <input 
                                    type="file" 
                                    accept="image/*"
                                    onChange={handleAvatarUpload}
                                    className="form-input"
                                    style={{ flex: 1 }}
                                />
                            </div>
                        </div>
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                            حفظ الصورة
                        </button>
                    </form>
                </div>

                {/* Admins Section (Visible to everyone) */}
                <div className="glass-card dashboard-widget" style={{ padding: '24px', gridColumn: '1 / -1' }}>
                    <div className="widget-header" style={{ marginBottom: '20px' }}>
                        <h3>الادمنز</h3>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px' }}>
                        {admins.map(admin => {
                            const adminAvatar = state.userAvatars?.[admin.id] || admin.avatar || (admin.role === 'SuperAdmin' ? state.storeSettings.adminAvatar : '');
                            
                            return (
                                <div key={admin.id} style={{ 
                                    padding: '16px', 
                                    borderRadius: '12px', 
                                    background: 'var(--bg-color)', 
                                    border: '1px solid var(--glass-border)',
                                    display: 'flex',
                                    alignItems: 'flex-start',
                                    gap: '16px',
                                    minWidth: '280px',
                                    flex: '1 1 300px'
                                }}>
                                    <div 
                                        style={{ 
                                            width: '60px', 
                                            height: '60px', 
                                            borderRadius: '50%', 
                                            backgroundColor: 'var(--surface-color)', 
                                            backgroundImage: adminAvatar ? `url(${adminAvatar})` : 'none',
                                            backgroundSize: 'cover',
                                            backgroundPosition: 'center',
                                            cursor: adminAvatar ? 'pointer' : 'default',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            border: '2px solid var(--primary-color)',
                                            flexShrink: 0
                                        }}
                                        onClick={() => adminAvatar && setSelectedAdminImage(adminAvatar)}
                                    >
                                        {!adminAvatar && <i className="fa-solid fa-user-shield" style={{ fontSize: '24px', color: 'var(--primary-color)' }}></i>}
                                    </div>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                                        <div>
                                            <h4 style={{ margin: 0, fontSize: '16px', color: 'var(--text-color)' }}>{admin.name}</h4>
                                            <span style={{ fontSize: '12px', color: 'var(--primary-color)', fontWeight: 'bold' }}>
                                                {admin.role === 'SuperAdmin' ? 'مدير النظام (SuperAdmin)' : 'مشرف (Admin)'}
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                                            {admin.role === 'SuperAdmin' ? (
                                                <span className="status-badge" style={{ background: 'rgba(150,191,72,0.1)', color: '#96bf48', fontSize: '11px', padding: '2px 6px' }}>
                                                    كافة الصلاحيات
                                                </span>
                                            ) : (
                                                (admin.permissions || []).map(pid => (
                                                    <span key={pid} className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-color)', fontSize: '11px', padding: '2px 6px' }}>
                                                        {PERMISSIONS_MAP[pid] || pid}
                                                    </span>
                                                ))
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        {admins.length === 0 && <p style={{ color: 'var(--text-secondary)' }}>لا يوجد مسؤولين حالياً.</p>}
                    </div>
                </div>

                {/* Store configuration form (Visible to SuperAdmin only) */}
                {state.currentUser?.role === 'SuperAdmin' && (
                    <div className="glass-card dashboard-widget" style={{ padding: '24px' }}>
                        <div className="widget-header" style={{ marginBottom: '20px' }}>
                            <h3>{t('details')}</h3>
                        </div>
                        <form onSubmit={handleSave}>
                            <div className="form-group">
                                <label className="form-label">{t('storeName')}</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={storeName}
                                    onChange={(e) => setStoreName(e.target.value)}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('description')}</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={storeAddress}
                                    onChange={(e) => setStoreAddress(e.target.value)}
                                />
                            </div>
                            <div className="form-group">
                                <label className="form-label">{t('currency')}</label>
                                <select 
                                    className="form-select" 
                                    value={currency}
                                    onChange={(e) => setCurrency(e.target.value)}
                                    required
                                >
                                    <option value="$">USD ($)</option>
                                    <option value="EGP">EGP (ج.م)</option>
                                    <option value="INR">INR (₹)</option>
                                    <option value="€">EUR (€)</option>
                                    <option value="A£">GBP (A£)</option>
                                </select>
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                                {t('saveSettings')}
                            </button>
                        </form>
                    </div>
                )}

                {/* Database Backups Maintenance card (Visible to SuperAdmin only) */}
                {state.currentUser?.role === 'SuperAdmin' && (
                    <div className="glass-card dashboard-widget" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        <div className="widget-header">
                            <h3>{t('databaseMaintenance')}</h3>
                        </div>
                        <p style={{ color: 'var(--text-secondary)', fontSize: '13px', lineHeight: 1.6 }}>
                            {t('backupDescription')}
                        </p>

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <button className="btn btn-secondary" onClick={handleExportBackup}>
                                <i className="fa-solid fa-cloud-arrow-down"></i> {t('downloadBackup')}
                            </button>

                            <button 
                                className="btn btn-secondary" 
                                onClick={() => document.getElementById("db-restore-input").click()}
                            >
                                <i className="fa-solid fa-cloud-arrow-up"></i> {t('uploadBackup')}
                            </button>
                            <input 
                                type="file" 
                                id="db-restore-input" 
                                style={{ display: 'none' }} 
                                accept=".json"
                                onChange={handleRestoreBackup}
                            />

                            <button className="btn btn-secondary" onClick={handleExportCSV}>
                                <i className="fa-solid fa-file-csv"></i> {t('downloadCSV')}
                            </button>
                        </div>
                    </div>
                )}
            </div>
            {state.currentUser?.role === 'SuperAdmin' && <UserManagement />}

            {/* Lightbox Modal for Admin Image */}
            {selectedAdminImage && (
                <div 
                    style={{
                        position: 'fixed',
                        top: 0, left: 0, right: 0, bottom: 0,
                        backgroundColor: 'rgba(0,0,0,0.85)',
                        zIndex: 9999,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backdropFilter: 'blur(5px)'
                    }}
                    onClick={() => setSelectedAdminImage(null)}
                >
                    <div style={{ position: 'relative', maxWidth: '90%', maxHeight: '90%' }}>
                        <button 
                            onClick={() => setSelectedAdminImage(null)}
                            style={{
                                position: 'absolute',
                                top: '-40px',
                                right: '-40px',
                                background: 'transparent',
                                border: 'none',
                                color: 'white',
                                fontSize: '30px',
                                cursor: 'pointer',
                                padding: '10px'
                            }}
                        >
                            <i className="fa-solid fa-times"></i>
                        </button>
                        <img 
                            src={selectedAdminImage} 
                            alt="Admin Preview" 
                            style={{
                                maxWidth: '100%', 
                                maxHeight: '90vh', 
                                borderRadius: '12px', 
                                boxShadow: '0 10px 40px rgba(0,0,0,0.6)',
                                border: '2px solid var(--glass-border)',
                                objectFit: 'contain'
                            }}
                        />
                    </div>
                </div>
            )}
        </div>
    );
}