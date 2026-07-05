import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import UserManagement from './UserManagement';

export default function StoreSettings() {
    const { state, saveStoreConfig, restoreStoreData, showToast, t } = useContext(AppContext);
    
    const [storeName, setStoreName] = useState(state.storeSettings.name || 'Octabot Retail Ltd');
    const [storeAddress, setStoreAddress] = useState(state.storeSettings.address || '');
    const [currency, setCurrency] = useState(state.storeSettings.currency || '$');

    const handleSave = (e) => {
        e.preventDefault();
        saveStoreConfig(storeName, storeAddress, currency);
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
                {/* Store configuration form */}
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
                                <option value="£">GBP (£)</option>
                            </select>
                        </div>
                        
                        <button type="submit" className="btn btn-primary" style={{ marginTop: '12px' }}>
                            {t('saveSettings')}
                        </button>
                    </form>
                </div>

                {/* Database Backups Maintenance card */}
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
            </div>
            <UserManagement />
        </div>
    );
}