import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';

export default function ProductInfo({ productId, onBack, onEditProduct }) {
    const { state, recordStockAdjustment, showToast, t } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('Overview');

    const product = state.products.find(p => p.id === productId);
    const currency = state.storeSettings.currency || '$';

    // Form states for manual stock adjustment
    const [adjVariantSku, setAdjVariantSku] = useState(product?.variants[0]?.sku || '');
    const [adjWarehouse, setAdjWarehouse] = useState('Sulur');
    const [adjType, setAdjType] = useState('increase');
    const [adjQty, setAdjQty] = useState(1);
    const [adjReason, setAdjReason] = useState('');

    if (!product) {
        return (
            <div className="glass-card" style={{ padding: '24px', textAlign: 'center' }}>
                <p style={{ color: 'var(--text-muted)' }}>Product catalog reference not found.</p>
                <button className="btn btn-secondary" onClick={onBack} style={{ marginTop: '16px' }}>
                    Return to Catalog List
                </button>
            </div>
        );
    }

    // Accumulate total stock
    let sulurStock = 0;
    let singanallurStock = 0;
    let mainWholesalePrice = 0;
    let mainRetailPrice = 0;
    let thresholdValue = 12;

    const mainVar = product.variants[0];
    if (mainVar) {
        sulurStock = mainVar.stock.Sulur || 0;
        singanallurStock = mainVar.stock.Singanallur || 0;
        mainWholesalePrice = mainVar.wholesalePrice;
        mainRetailPrice = mainVar.retailPrice;
        thresholdValue = mainVar.reorderLimit;
    }

    const totalStock = sulurStock + singanallurStock;

    // Supplier Lookup
    let supplierName = 'Ronald Martin';
    let supplierPhone = '98789 86757';
    if (product.suppliers && product.suppliers.length > 0) {
        const supObj = state.suppliers.find(s => s.id === product.suppliers[0]);
        if (supObj) {
            supplierName = supObj.name;
            supplierPhone = supObj.phone || 'N/A';
        }
    }

    // Expiry date lookup
    let expiryDateStr = '13/4/23';
    if (product.batches && product.batches.length > 0) {
        expiryDateStr = product.batches[0].expiryDate;
    }

    const handleDownloadReport = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Metric,Value\r\n";
        csvContent += `Product Name,${product.name}\r\n`;
        csvContent += `Product ID,${product.id}\r\n`;
        csvContent += `Category,${product.category}\r\n`;
        csvContent += `Expiry Date,${expiryDateStr}\r\n`;
        csvContent += `Threshold Value,${thresholdValue}\r\n`;
        csvContent += `Sulur Branch Stock,${sulurStock}\r\n`;
        csvContent += `Singanallur Branch Stock,${singanallurStock}\r\n`;
        csvContent += `Total Stock in Hand,${totalStock}\r\n`;

        const encodedUri = encodeURI(csvContent);
        const link = document.createElement("a");
        link.setAttribute("href", encodedUri);
        link.setAttribute("download", `octabot_product_${product.name.replace(/\s+/g, '_')}_report.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("Product sheet downloaded.");
    };

    return (
        <div>
            {/* Header section with actions */}
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <button 
                        className="action-btn-circle" 
                        onClick={onBack} 
                        style={{ border: 'none', background: 'rgba(255,255,255,0.05)' }}
                        title="Back to Catalog"
                    >
                        <i className="fa-solid fa-arrow-left"></i>
                    </button>
                    <div>
                        <h2 style={{ margin: 0 }}>{product.name}</h2>
                    </div>
                </div>

                <div style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={() => onEditProduct(product.id)}>
                        <i className="fa-solid fa-pencil" style={{ marginRight: '6px' }}></i> {t('edit')}
                    </button>
                    <button className="btn btn-secondary" onClick={handleDownloadReport}>
                        {t('downloadAll')}
                    </button>
                </div>
            </div>

            {/* Tab controls */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--glass-border)', gap: '24px', marginBottom: '24px' }}>
                {['Overview', 'Purchases', 'Adjustments', 'History'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        style={{
                            background: 'none',
                            border: 'none',
                            color: activeTab === tab ? 'var(--gold-primary)' : 'var(--text-secondary)',
                            fontWeight: 600,
                            padding: '12px 4px',
                            cursor: 'pointer',
                            borderBottom: activeTab === tab ? '2px solid var(--gold-primary)' : '2px solid transparent',
                            transition: 'var(--transition)',
                            fontSize: '14px'
                        }}
                    >
                        {t(tab.toLowerCase())}
                    </button>
                ))}
            </div>

            {/* Tab contents */}
            {activeTab === 'Overview' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '24px', alignItems: 'start' }}>
                    
                    {/* Left Panel */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                        
                        {/* Primary Details Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                {t('details')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('productName')}</span>
                                    <span style={{ color: '#fff', fontWeight: 500 }}>{product.name}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('productId')}</span>
                                    <span style={{ color: '#fff', fontFamily: 'monospace' }}>{product.id}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('categories')}</span>
                                    <span style={{ color: '#fff' }}>{product.category}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('expiryDate')}</span>
                                    <span style={{ color: '#fff', fontWeight: 600 }}>{expiryDateStr}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('thresholdValue')}</span>
                                    <span style={{ color: '#fff' }}>{thresholdValue} {t('packets')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Supplier Details Card */}
                        <div className="glass-card" style={{ padding: '24px' }}>
                            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                {t('supplierDetails')}
                            </h3>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', fontSize: '13px' }}>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('supplierName')}</span>
                                    <span style={{ color: '#fff', fontWeight: 500 }}>{supplierName}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('phone')}</span>
                                    <span style={{ color: '#fff' }}>{supplierPhone}</span>
                                </div>
                            </div>
                        </div>

                        {/* Stock Locations Table */}
                        <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                {t('stockLocations')}
                            </h3>
                            <div className="table-wrapper">
                                <table className="custom-table" style={{ fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            <th>{t('storeName')}</th>
                                            <th style={{ textAlign: 'right' }}>{t('quantityInHand')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        <tr>
                                            <td>{t('inSulur')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gold-primary)' }}>{sulurStock} {t('packets')}</td>
                                        </tr>
                                        <tr>
                                            <td>{t('inSinganallur')}</td>
                                            <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gold-primary)' }}>{singanallurStock} {t('packets')}</td>
                                        </tr>
                                    </tbody>
                                </table>
                            </div>
                        </div>

                    </div>

                    {/* Right Panel */}
                    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Dotted Border Product Thumbnail placeholder */}
                        <div style={{ 
                            width: '100%', 
                            height: '140px', 
                            border: '2px dashed rgba(255, 255, 255, 0.12)', 
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255,255,255,0.01)'
                        }}>
                            <i className="fa-regular fa-image" style={{ fontSize: '40px', color: 'var(--text-muted)' }}></i>
                        </div>

                        {/* Right Summary metrics */}
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', fontSize: '13px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('openingStock')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.initialStock !== undefined ? product.initialStock : (totalStock + 6)}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Added</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.totalAdded !== undefined ? product.totalAdded : 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Total Consumed</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{product.totalConsumed !== undefined ? product.totalConsumed : 0}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('remainingQuantity')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>{totalStock}</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>Burn Rate</span>
                                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{((product.totalConsumed || 0) / 30).toFixed(1)} / day</span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('thresholdValue')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{thresholdValue}</span>
                            </div>
                        </div>

                    </div>

                </div>
            ) : activeTab === 'Purchases' ? (
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        FIFO Batch Expiry queue
                    </h3>
                    {(!product.batches || product.batches.length === 0) ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>No active FIFO batches logged.</p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {[...(product.batches || [])].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate)).map((batch, index) => {
                                const daysLeft = Math.ceil((new Date(batch.expiryDate) - new Date("2026-06-30")) / (1000 * 60 * 60 * 24));
                                const isUrgent = daysLeft <= 90;
                                return (
                                    <div key={batch.batchId} style={{ 
                                        padding: '16px', 
                                        background: 'rgba(255,255,255,0.02)', 
                                        borderRadius: '8px', 
                                        border: isUrgent ? '1px solid rgba(255, 75, 75, 0.3)' : '1px solid var(--glass-border)',
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center' 
                                    }}>
                                        <div>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                <strong style={{ color: '#fff', fontSize: '14px' }}>{batch.batchId}</strong>
                                                <span className={`badge ${index === 0 ? 'badge-low' : 'badge-in'}`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                    {index === 0 ? '🚨 Next to Dispatch (FIFO #1)' : `📦 Batch FIFO #${index + 1}`}
                                                </span>
                                            </div>
                                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                                Warehouse: <span style={{ color: '#fff' }}>{batch.warehouse}</span> | SKU: <span style={{ color: '#fff' }}>{batch.variantSku}</span>
                                            </div>
                                        </div>
                                        <div style={{ textAlign: 'right' }}>
                                            <div style={{ color: isUrgent ? 'var(--color-danger)' : 'var(--color-success)', fontWeight: 600, fontSize: '13px' }}>
                                                Expires: {batch.expiryDate} {daysLeft > 0 ? `(${daysLeft} days left)` : '(Expired)'}
                                            </div>
                                            <div style={{ fontSize: '14px', color: 'var(--gold-primary)', fontWeight: 700, marginTop: '4px' }}>
                                                {batch.quantity} {t('packets')} remaining
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            ) : activeTab === 'Adjustments' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
                    {/* Record Stock Adjustment form */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            Record Stock Adjustment
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!adjVariantSku) return;
                            recordStockAdjustment(product.id, adjVariantSku, adjWarehouse, adjType, adjQty, adjReason);
                            setAdjQty(1);
                            setAdjReason('');
                        }}>
                            <div className="form-group">
                                <label className="form-label">Select Option/Variant</label>
                                <select 
                                    className="form-select"
                                    value={adjVariantSku}
                                    onChange={(e) => setAdjVariantSku(e.target.value)}
                                    required
                                >
                                    {product.variants.map(v => (
                                        <option key={v.sku} value={v.sku}>{v.name} ({v.sku})</option>
                                    ))}
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">Warehouse location</label>
                                <select 
                                    className="form-select"
                                    value={adjWarehouse}
                                    onChange={(e) => setAdjWarehouse(e.target.value)}
                                >
                                    <option value="Sulur">Sulur Branch</option>
                                    <option value="Singanallur">Singanallur Branch</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">Adjustment Type</label>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                                        <input type="radio" name="adjType" checked={adjType === 'increase'} onChange={() => setAdjType('increase')} />
                                        Increase (+)
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                                        <input type="radio" name="adjType" checked={adjType === 'decrease'} onChange={() => setAdjType('decrease')} />
                                        Decrease (-)
                                    </label>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">Adjustment Quantity</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    min="1" 
                                    value={adjQty}
                                    onChange={(e) => setAdjQty(parseInt(e.target.value) || 1)}
                                    required 
                                />
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">Reason / Justification</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder="e.g. Audit correction, recount difference" 
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    required 
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>
                                Apply Stock Correction
                            </button>
                        </form>
                    </div>

                    {/* Adjustments History log */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            Correction & Audit logs
                        </h3>
                        {(!product.adjustments || product.adjustments.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No stock corrections logged yet.</p>
                        ) : (
                            <div className="table-wrapper">
                                <table className="custom-table" style={{ fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th>Date</th>
                                            <th>Warehouse</th>
                                            <th>Type</th>
                                            <th style={{ textAlign: 'right' }}>Qty</th>
                                            <th>Reason</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {product.adjustments.map((adj, i) => (
                                            <tr key={i}>
                                                <td>{adj.date}</td>
                                                <td>{adj.warehouse}</td>
                                                <td style={{ color: adj.type === 'increase' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                                                    {adj.type === 'increase' ? '+ Increase' : '- Decrease'}
                                                </td>
                                                <td style={{ textAlign: 'right', fontWeight: 600 }}>{adj.quantity}</td>
                                                <td style={{ color: 'var(--text-secondary)' }}>{adj.reason}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>
                </div>
            ) : (
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        Sales Transaction history
                    </h3>
                    {(() => {
                        const matchingOrders = state.orders.filter(o => 
                            o.items.some(item => product.variants.some(v => v.sku === item.variantSku))
                        );
                        if (matchingOrders.length === 0) {
                            return <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>No order history found for this product.</p>;
                        }
                        return (
                            <div className="table-wrapper">
                                <table className="custom-table" style={{ fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th>Order ID</th>
                                            <th>Client</th>
                                            <th>Date</th>
                                            <th>Branch</th>
                                            <th style={{ textAlign: 'right' }}>Qty Sold</th>
                                            <th>Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {matchingOrders.map(order => {
                                            const itemSold = order.items.find(item => product.variants.some(v => v.sku === item.variantSku));
                                            return (
                                                <tr key={order.id}>
                                                    <td style={{ fontWeight: 600, color: '#fff' }}>{order.id}</td>
                                                    <td>{order.client}</td>
                                                    <td>{order.date}</td>
                                                    <td>{order.warehouse}</td>
                                                    <td style={{ textAlign: 'right', fontWeight: 600, color: 'var(--gold-primary)' }}>
                                                        {itemSold ? itemSold.quantity : 0}
                                                    </td>
                                                    <td>
                                                        <span className={`badge ${
                                                            order.status === 'Completed' ? 'badge-in' : 
                                                            order.status === 'Draft' ? 'badge-draft' : 
                                                            order.status === 'Cancelled' ? 'badge-out' : 'badge-low'
                                                        }`} style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                            {order.status}
                                                        </span>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })()}
                </div>
            )}

        </div>
    );
}
