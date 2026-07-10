import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function ProductInfo({ productId, onBack, onEditProduct }) {
    const { state, recordStockAdjustment, showToast, language, t } = useContext(AppContext);
    const [activeTab, setActiveTab] = useState('Overview');

    // Barcode Printing State
    const [printVariant, setPrintVariant] = useState(null);
    const [selectedImageIdx, setSelectedImageIdx] = useState(0);

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
    let mainAverageCost = 0;
    let mainRetailPrice = 0;
    let thresholdValue = 12;

    const mainVar = product.variants[0];
    if (mainVar) {
        sulurStock = mainVar.stock.Sulur || 0;
        singanallurStock = mainVar.stock.Singanallur || 0;
        mainWholesalePrice = mainVar.wholesalePrice;
        mainAverageCost = mainVar.averageCost || mainVar.wholesalePrice || 0;
        mainRetailPrice = mainVar.retailPrice;
        thresholdValue = mainVar.reorderLimit;
    }

    const totalStock = sulurStock + singanallurStock;

    // Supplier Lookup
    let supplierName = t('notSpecified') || 'غير محدد';
    let supplierPhone = t('notSpecified') || 'غير محدد';
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

    const handleTriggerPrint = () => {
        window.print();
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
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('createdDate')}</span>
                                    <span style={{ color: '#fff', fontWeight: 600 }}>{product.createdDate || "2026-06-30"}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>المُسجِل (المسؤول)</span>
                                    <span style={{ color: '#fff', fontWeight: 600 }}>{product.createdBy || 'sfsf'}</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 3fr' }}>
                                    <span style={{ color: 'var(--text-secondary)' }}>{t('thresholdValue')}</span>
                                    <span style={{ color: '#fff' }}>{thresholdValue} {t('packets')}</span>
                                </div>
                            </div>
                        </div>

                        {/* Variants Specifications Card */}
                        <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                            <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                                {t('variants')}
                            </h3>
                            <div className="table-wrapper">
                                <table className="custom-table" style={{ fontSize: '12px' }}>
                                    <thead>
                                        <tr>
                                            <th>{t('optionName')}</th>
                                            <th>{t('buyingPrice')}</th>
                                            <th>متوسط التكلفة (WAC)</th>
                                            <th>{t('price')}</th>
                                            <th>{t('margin')}</th>
                                            <th>{t('stock')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {product.variants.map(v => {
                                            const vQty = (v.stock?.Sulur || 0);
                                            const costVal = v.averageCost || v.wholesalePrice || 0;
                                            const profitMargin = v.retailPrice > 0 ? ((v.retailPrice - costVal) / v.retailPrice * 100).toFixed(1) : 0;
                                            return (
                                                <tr key={v.sku}>
                                                    <td style={{ fontWeight: 600 }}>{v.name === 'Standard Option' ? (t('defaultOption') || 'المنتج الأساسي') : v.name}</td>
                                                    <td>{currency}{v.wholesalePrice.toFixed(2)}</td>
                                                    <td style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{currency}{costVal.toFixed(2)}</td>
                                                    <td style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>{currency}{v.retailPrice.toFixed(2)}</td>
                                                    <td><span className="badge badge-success">{profitMargin}%</span></td>
                                                    <td>{vQty} {t('packets')}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
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



                    </div>

                    {/* Right Panel */}
                    <div className="glass-card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
                        
                        {/* Product Images Gallery */}
                        {(() => {
                            let validImages = [];
                            // Try images array first
                            if (product.images && Array.isArray(product.images)) {
                                validImages = product.images.filter(img => img && (img.startsWith('data:') || img.startsWith('http')));
                            }
                            // Fallback to image field
                            if (validImages.length === 0 && product.image && typeof product.image === 'string') {
                                try {
                                    const parsed = JSON.parse(product.image);
                                    if (Array.isArray(parsed)) {
                                        validImages = parsed.filter(img => img && (img.startsWith('data:') || img.startsWith('http')));
                                    }
                                } catch {
                                    if (product.image.startsWith('data:') || product.image.startsWith('http')) {
                                        validImages = [product.image];
                                    }
                                }
                            }

                            if (validImages.length === 0) {
                                return (
                                    <div style={{ 
                                        width: '100%', height: '180px', border: '2px dashed rgba(255, 255, 255, 0.12)', 
                                        borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        background: 'rgba(255,255,255,0.02)'
                                    }}>
                                        <i className="fa-regular fa-image" style={{ fontSize: '40px', color: 'var(--text-muted)' }}></i>
                                    </div>
                                );
                            }

                            return (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {/* Main large image */}
                                    <div style={{ 
                                        width: '100%', height: '220px', borderRadius: '8px', overflow: 'hidden',
                                        background: 'rgba(255,255,255,0.03)', display: 'flex', alignItems: 'center', justifyContent: 'center'
                                    }}>
                                        <img src={validImages[selectedImageIdx] || validImages[0]} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                                    </div>
                                    {/* Thumbnails row */}
                                    {validImages.length > 1 && (
                                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                                            {validImages.map((img, idx) => (
                                                <div key={idx} onClick={() => setSelectedImageIdx(idx)} style={{ 
                                                    width: '52px', height: '52px', borderRadius: '6px', overflow: 'hidden',
                                                    border: idx === (selectedImageIdx || 0) ? '2px solid var(--gold-primary)' : '2px solid rgba(255,255,255,0.08)',
                                                    cursor: 'pointer', flexShrink: 0,
                                                    opacity: idx === (selectedImageIdx || 0) ? 1 : 0.6,
                                                    transition: 'all 0.2s ease'
                                                }}>
                                                    <img src={img} alt={`${product.name} ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            );
                        })()}

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
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                 <span style={{ color: 'var(--text-secondary)' }}>{t('buyingPrice')}</span>
                                 <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency}{mainWholesalePrice.toFixed(2)}</span>
                             </div>
                             <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                 <span style={{ color: 'var(--text-secondary)' }}>متوسط التكلفة (WAC)</span>
                                 <span style={{ fontWeight: 600, color: 'var(--color-warning)' }}>{currency}{mainAverageCost.toFixed(2)}</span>
                             </div>
                             <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('markup')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                    {mainRetailPrice > 0 ? ((mainRetailPrice - mainAverageCost) / mainAverageCost * 100).toFixed(0) : 0}%
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('profitMargin')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-success)' }}>
                                    {mainRetailPrice > 0 ? ((mainRetailPrice - mainAverageCost) / mainRetailPrice * 100).toFixed(1) : 0}%
                                </span>
                            </div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px' }}>
                                <span style={{ color: 'var(--text-secondary)' }}>{t('thresholdValue')}</span>
                                <span style={{ fontWeight: 600, color: 'var(--color-danger)' }}>{thresholdValue}</span>
                            </div>
                        </div>

                    </div>

                </div>
            ) : activeTab === 'Purchases' ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {/* Purchase History and Cost Fluctuations */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            تاريخ المشتريات وتقلبات الأسعار
                        </h3>
                        {(() => {
                            const productSkus = product.variants.map(v => v.sku);
                            const purchaseHistory = [];
                            (state.purchaseOrders || []).forEach(po => {
                                const supplier = state.suppliers.find(s => s.id === po.supplierId);
                                (po.items || []).forEach(item => {
                                    if (productSkus.includes(item.variantSku)) {
                                        const variant = product.variants.find(v => v.sku === item.variantSku);
                                        purchaseHistory.push({
                                            id: po.id,
                                            date: po.date,
                                            supplierName: supplier ? supplier.name : po.supplierId,
                                            variantName: variant ? variant.name : item.variantSku,
                                            sku: item.variantSku,
                                            quantity: item.quantity,
                                            cost: item.cost
                                        });
                                    }
                                });
                            });
                            purchaseHistory.sort((a, b) => new Date(b.date) - new Date(a.date));

                            if (purchaseHistory.length === 0) {
                                return (
                                    <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>
                                        لا توجد عمليات شراء مسجلة لهذا المنتج بعد.
                                    </p>
                                );
                            }

                            return (
                                <div className="table-wrapper">
                                    <table className="custom-table" style={{ fontSize: '12px' }}>
                                        <thead>
                                            <tr>
                                                <th>التاريخ</th>
                                                <th>رقم الفاتورة</th>
                                                <th>المورد</th>
                                                <th>الخيار (Variant)</th>
                                                <th>الكمية</th>
                                                <th>سعر الشراء الفعلي</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {purchaseHistory.map((item, idx) => (
                                                <tr key={idx}>
                                                    <td>{item.date}</td>
                                                    <td style={{ fontWeight: 600 }}>{item.id}</td>
                                                    <td>{item.supplierName}</td>
                                                    <td>{item.variantName === 'Standard Option' ? 'الأساسي' : item.variantName}</td>
                                                    <td>{item.quantity} قطعة</td>
                                                    <td style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>
                                                        {currency}{item.cost.toFixed(2)}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            );
                        })()}
                    </div>

                    {/* FIFO Batches */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '20px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            {t('fifoQueue')}
                        </h3>
                        {(!product.batches || product.batches.length === 0) ? (
                            <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px' }}>{t('noFifoBatches')}</p>
                        ) : (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                {[...(product.batches || [])].map((batch, index) => {
                                    return (
                                        <div key={batch.batchId} style={{ 
                                            padding: '16px', 
                                            background: 'rgba(255,255,255,0.02)', 
                                            borderRadius: '8px', 
                                            border: '1px solid var(--glass-border)',
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center' 
                                        }}>
                                            <div>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                    <strong style={{ color: '#fff', fontSize: '14px' }}>{batch.batchId}</strong>
                                                    <span className="badge badge-in" style={{ fontSize: '10px', padding: '2px 8px' }}>
                                                        {index === 0 ? t('nextToDispatch') : `${t('batchFifo')}${index + 1}`}
                                                    </span>
                                                </div>
                                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '6px' }}>
                                                    {t('warehouse') || 'المستودع'}: <span style={{ color: '#fff' }}>{t('inSulur')}</span>
                                                </div>
                                            </div>
                                            <div style={{ textAlign: 'right' }}>
                                                <div style={{ fontSize: '14px', color: 'var(--gold-primary)', fontWeight: 700 }}>
                                                    {batch.quantity} {t('packets')} {t('remainingQty') || 'متبقي'}
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            ) : activeTab === 'Adjustments' ? (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.5fr', gap: '24px' }}>
                    {/* Record Stock Adjustment form */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            {t('recordStockAdjustment')}
                        </h3>
                        <form onSubmit={(e) => {
                            e.preventDefault();
                            if (!adjVariantSku) return;
                            recordStockAdjustment(product.id, adjVariantSku, adjWarehouse, adjType, adjQty, adjReason);
                            setAdjQty(1);
                            setAdjReason('');
                        }}>
                            <div className="form-group">
                                <label className="form-label">{t('selectOptionVariant')}</label>
                                <select 
                                    className="form-select"
                                    value={adjVariantSku}
                                    onChange={(e) => setAdjVariantSku(e.target.value)}
                                    required
                                >
                                    {product.variants.map(v => (
                                        <option key={v.sku} value={v.sku}>
                                            {v.name === 'Standard Option' ? (t('defaultOption') || 'المنتج الأساسي') : v.name}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">{t('adjustmentType')}</label>
                                <div style={{ display: 'flex', gap: '16px', marginTop: '6px' }}>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                                        <input type="radio" name="adjType" checked={adjType === 'increase'} onChange={() => setAdjType('increase')} />
                                        {t('increase')}
                                    </label>
                                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', color: '#fff' }}>
                                        <input type="radio" name="adjType" checked={adjType === 'decrease'} onChange={() => setAdjType('decrease')} />
                                        {t('decrease')}
                                    </label>
                                </div>
                            </div>
                            <div className="form-group" style={{ marginTop: '12px' }}>
                                <label className="form-label">{t('adjustmentQuantity')}</label>
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
                                <label className="form-label">{t('reasonJustification')}</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    placeholder={language === 'ar' ? "مثال: تصحيح جرد، تالف..." : "e.g. Audit correction, recount difference"} 
                                    value={adjReason}
                                    onChange={(e) => setAdjReason(e.target.value)}
                                    required 
                                />
                            </div>
                            <button type="submit" className="btn btn-primary" style={{ width: '100%', marginTop: '20px' }}>
                                {t('applyStockCorrection')}
                            </button>
                        </form>
                    </div>

                    {/* Adjustments History log */}
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                            {t('correctionAuditLogs')}
                        </h3>
                        {(!product.adjustments || product.adjustments.length === 0) ? (
                            <p style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '40px' }}>{t('noStockCorrections')}</p>
                        ) : (
                            <div className="table-wrapper">
                                <table className="custom-table" style={{ fontSize: '11px' }}>
                                    <thead>
                                        <tr>
                                            <th>{t('date')}</th>
                                            <th>{t('warehouse') || 'المستودع'}</th>
                                            <th>{t('type')}</th>
                                            <th style={{ textAlign: 'right' }}>{t('qty') || 'الكمية'}</th>
                                            <th>{t('reason')}</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {product.adjustments.map((adj, i) => (
                                            <tr key={i}>
                                                <td>{adj.date}</td>
                                                <td>{t('inSulur')}</td>
                                                <td style={{ color: adj.type === 'increase' ? 'var(--color-success)' : 'var(--color-danger)', fontWeight: 600 }}>
                                                    {adj.type === 'increase' ? `+ ${t('increase')}` : `- ${t('decrease')}`}
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
                                                    <td>{t('inSulur')}</td>
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

            {/* Printable Barcode Label Modal */}
            {printVariant && (
                <Modal 
                    isOpen={printVariant !== null} 
                    onClose={() => setPrintVariant(null)} 
                    title={t('printLabel')}
                >
                    <div style={{ padding: '8px' }}>
                        {/* CSS Hack to inject print stylesheet dynamically */}
                        <style dangerouslySetInnerHTML={{__html: `
                            @media print {
                                body * {
                                    visibility: hidden !important;
                                }
                                #printable-barcode-sticker, #printable-barcode-sticker * {
                                    visibility: visible !important;
                                }
                                #printable-barcode-sticker {
                                    position: absolute !important;
                                    left: 0 !important;
                                    top: 0 !important;
                                    width: 100% !important;
                                    height: 100% !important;
                                    background: white !important;
                                    color: black !important;
                                    padding: 24px !important;
                                    box-shadow: none !important;
                                    border: none !important;
                                    border-radius: 0 !important;
                                    display: flex !important;
                                    flex-direction: column !important;
                                    align-items: center !important;
                                    justify-content: center !important;
                                }
                            }
                        `}} />

                        {/* Visual Sticker Container */}
                        <div 
                            id="printable-barcode-sticker" 
                            style={{ 
                                background: 'rgba(255,255,255,0.02)', 
                                border: '1px solid var(--glass-border)', 
                                borderRadius: '8px', 
                                padding: '24px', 
                                textAlign: 'center', 
                                maxWidth: '280px', 
                                margin: '0 auto', 
                                boxShadow: '0 8px 32px rgba(0,0,0,0.2)' 
                            }}
                        >
                            <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--gold-primary)', letterSpacing: '0.5px', marginBottom: '2px' }}>
                                {state.storeSettings.name || 'o5taboad store'}
                            </div>
                            <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {product.name}
                            </div>

                            {/* CSS Barcode Lines Simulator */}
                            <div style={{ 
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'stretch', 
                                height: '55px', 
                                margin: '12px 0', 
                                background: '#ffffff', 
                                padding: '8px 14px', 
                                borderRadius: '4px' 
                            }}>
                                {[3,1,2,1,4,1,2,3,1,3,1,2,4,2,1,3,1,2,1,3,2,1,4].map((width, index) => (
                                    <div 
                                        key={index} 
                                        style={{ 
                                            width: `${width}px`, 
                                            background: index % 2 === 0 ? '#000000' : 'transparent',
                                            marginRight: '1px' 
                                        }} 
                                    />
                                ))}
                            </div>

                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'monospace', letterSpacing: '2px', marginBottom: '16px' }}>
                                {printVariant.barcode || '100001'}
                            </div>

                            <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--gold-primary)' }}>
                                {currency}{printVariant.retailPrice.toLocaleString(undefined, {minimumFractionDigits:2})}
                            </div>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setPrintVariant(null)}>
                                {t('discard')}
                            </button>
                            <button type="button" className="btn btn-primary" onClick={handleTriggerPrint}>
                                <i className="fa-solid fa-print"></i> Print
                            </button>
                        </div>
                    </div>
                </Modal>
            )}
        </div>
    );
}
