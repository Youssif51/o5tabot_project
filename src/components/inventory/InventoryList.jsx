import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import { deduplicateProductName } from '../../utils/productUtils';
import ProductInfo from './ProductInfo';
import InitialStockSetupModal from './InitialStockSetupModal';

export default function InventoryList({ 
    globalSearch, 
    setGlobalSearch,
    onOpenAddProduct, 
    onOpenEditProduct,
    onOpenScanner 
}) {
    const { state, showToast, t, deleteProduct, showConfirm } = useContext(AppContext);

    const formatLedgerDate = (dateStr) => {
        if (!dateStr) return '—';
        try {
            const d = new Date(dateStr);
            if (isNaN(d.getTime())) return dateStr;
            return d.toLocaleString('en-GB', { 
                day: '2-digit', month: '2-digit', year: 'numeric', 
                hour: '2-digit', minute: '2-digit', hour12: true 
            });
        } catch (e) {
            return dateStr;
        }
    };
    
    // Initial Stock & Price Setup modal control
    const [isInitialStockOpen, setIsInitialStockOpen] = useState(false);

    // View mode: 'list' or 'inspect'
    const [viewMode, setViewMode] = useState('list');
    const [inspectId, setInspectId] = useState(null);

    // Segment tab control for inventory view: 'catalog' or 'ledger'
    const [activeInventoryTab, setActiveInventoryTab] = useState('catalog');

    // Filters visibility toggle
    const [showFilters, setShowFilters] = useState(false);
    const [collectionFilter, setCollectionFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'in_stock', 'out_of_stock', 'low'
    // Using globalSearch instead of local searchVal

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Stock Ledger Pagination (15 items per page)
    const [ledgerPage, setLedgerPage] = useState(1);
    const ledgerPageSize = 15;

    const currency = state.storeSettings.currency || '$';
    const activeSearch = globalSearch || '';

    // Filter products by collection
    let filteredList = [];
    state.products.forEach(prod => {
        if (collectionFilter !== 'all') {
            if (collectionFilter === 'none') {
                if (prod.shopifyCollectionIds && prod.shopifyCollectionIds.length > 0) return;
            } else {
                if (!prod.shopifyCollectionIds || !prod.shopifyCollectionIds.includes(String(collectionFilter))) return;
            }
        }

        let hasLow = false;
        let hasOut = false;
        let hasInStock = false;
        prod.variants.forEach(vr => {
            const qty = Number(vr.stock?.Sulur || 0);
            const limit = vr.reorderLimit !== undefined && vr.reorderLimit !== null && vr.reorderLimit !== "" ? Number(vr.reorderLimit) : 5;
            if (qty === 0) hasOut = true;
            else if (qty <= limit) hasLow = true;
            if (qty > 0) hasInStock = true;
        });

        if (stockFilter === 'low' && !hasLow && !hasOut) return;
        if (stockFilter === 'in_stock' && !hasInStock) return;
        if (stockFilter === 'out_of_stock' && !hasOut) return;

        const query = activeSearch.toLowerCase();
        const nameMatches = (prod.name || '').toLowerCase().includes(query);
        const descMatches = (prod.description || '').toLowerCase().includes(query);

        let matchedVariants = (prod.variants || []).filter(vr => {
            const skuMatches = (vr.sku || '').toLowerCase().includes(query);
            const barcodeMatches = vr.barcode && vr.barcode.includes(query);
            const varNameMatches = (vr.name || '').toLowerCase().includes(query);

            return skuMatches || barcodeMatches || varNameMatches || nameMatches || descMatches;
        });

        if (matchedVariants.length > 0 || nameMatches || descMatches) {
            filteredList.push({
                ...prod,
                activeVariants: matchedVariants.length > 0 ? matchedVariants : (prod.variants || [])
            });
        }
    });

    // Pagination calculations for Catalog
    const totalEntries = filteredList.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const activePage = currentPage > totalPages ? totalPages : currentPage;
    
    const startIdx = (activePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalEntries);
    const paginatedList = filteredList.slice(startIdx, endIdx);

    // --- Metrics Summaries for Inventory Dashboard Block ---
    const collectionsCount = (state.collections || []).length;
    const totalProductsCount = (state.products || []).reduce((acc, p) => acc + (p.variants || []).length, 0);
    
    let totalInvValue = 0;
    (state.products || []).forEach(p => {
        (p.variants || []).forEach(v => {
            const qty = (v.stock?.Sulur || 0);
            totalInvValue += qty * (v.retailPrice || 0);
        });
    });

    let variantSales = {};
    (state.orders || []).forEach(ord => {
        if (ord.status !== "Cancelled" && ord.status !== "Rejected" && ord.status !== "Draft") {
            (ord.items || []).forEach(item => {
                const sku = item.variantSku || item.variant_sku || item.sku;
                if (sku) {
                    variantSales[sku] = (variantSales[sku] || 0) + (parseInt(item.quantity) || 1);
                }
            });
        }
    });
    let topSellingCount = Object.keys(variantSales).length;
    let topSellingCost = 0;
    (state.products || []).forEach(p => {
        (p.variants || []).forEach(v => {
            const sold = variantSales[v.sku] || 0;
            topSellingCost += sold * (v.wholesalePrice || 0);
        });
    });

    let lowStocksCount = 0;
    let outOfStockCount = 0;
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const qty = Number(v.stock?.Sulur || 0);
            const limit = v.reorderLimit !== undefined && v.reorderLimit !== null && v.reorderLimit !== "" ? Number(v.reorderLimit) : 5;
            if (qty === 0) {
                outOfStockCount++;
            } else if (qty <= limit) {
                lowStocksCount++;
            }
        });
    });

    const handleExportCSV = () => {
        const headers = ["اسم المنتج", "القسم", "رمز SKU", "الباركود", "سعر التكلفة", "سعر البيع", "المخزون المتوفر"];
        const rows = filteredList.map(item => [
            `"${item.productName}"`,
            `"${item.category || ''}"`,
            `"${item.sku}"`,
            `"${item.barcode || ''}"`,
            item.wholesalePrice || 0,
            item.retailPrice || 0,
            item.stock?.Sulur || 0
        ]);

        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `تقرير_المخزون_${getLocalDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("تم تصدير تقرير المخزون المفلتر بنجاح", "success");
    };

    if (viewMode === 'inspect') {
        return (
            <ProductInfo 
                productId={inspectId} 
                onBack={() => setViewMode('list')} 
                onEditProduct={(id) => {
                    setViewMode('list');
                    onOpenEditProduct(id);
                }}
            />
        );
    }

    return (
        <div id="inventory-view" className="view-pane active">
            
            {/* 1. Overall Inventory Summary Cards Grid */}
            <div className="page-header" style={{ marginBottom: '16px' }}>
                <div className="page-title-group">
                    <h2>{t('overallInventory')}</h2>
                </div>
            </div>
            
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                {/* Collections */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(212, 175, 55, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(212, 175, 55, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>المجموعات</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gold-primary)', letterSpacing: '-0.5px' }}>{collectionsCount}</div>
                </div>

                {/* Total Products */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(30, 144, 255, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(30, 144, 255, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(30, 144, 255, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>{t('totalProducts')}</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-info)', letterSpacing: '-0.5px' }}>{totalProductsCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        قيمة الإيراد: <strong>{currency} {totalInvValue.toLocaleString('en-US', {maximumFractionDigits: 0})}</strong>
                    </div>
                </div>

                {/* Top Selling */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(160, 132, 220, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(160, 132, 220, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(160, 132, 220, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>{t('topSelling')}</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a084dc', letterSpacing: '-0.5px' }}>{topSellingCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        إجمالي التكلفة: <strong>{currency} {topSellingCost.toLocaleString('en-US', {maximumFractionDigits: 0})}</strong>
                    </div>
                </div>

                {/* Low Stocks */}
                <div 
                    className="glass-card" 
                    onClick={() => { setStockFilter(stockFilter === 'low' ? 'all' : 'low'); setCurrentPage(1); }}
                    style={{ 
                        padding: '20px', 
                        borderRadius: '16px',
                        border: stockFilter === 'low' ? '1px solid var(--color-danger)' : '1px solid rgba(255, 71, 87, 0.25)', 
                        background: 'radial-gradient(circle at top right, rgba(255, 71, 87, 0.12) 0%, var(--glass-bg) 80%)',
                        boxShadow: '0 8px 24px rgba(255, 71, 87, 0.05)',
                        cursor: 'pointer'
                    }}
                >
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '8px' }}>{t('lowStocks')}</span>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-danger)', letterSpacing: '-0.5px' }}>{lowStocksCount}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
                        نفذت بالكامل: <strong style={{ color: 'var(--color-danger)' }}>{outOfStockCount}</strong>
                    </div>
                </div>
            </div>

            {/* Catalog vs Stock Ledger segments */}
            <div className="glass-card" style={{ display: 'flex', gap: '8px', padding: '10px 16px', marginBottom: '24px' }}>
                <button 
                    className={`btn ${activeInventoryTab === 'catalog' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveInventoryTab('catalog')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                    <i className="fa-solid fa-boxes-stacked"></i> {t('products')}
                </button>
                <button 
                    className={`btn ${activeInventoryTab === 'ledger' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveInventoryTab('ledger')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                    <i className="fa-solid fa-list-check"></i> {t('stockLedger')}
                </button>
            </div>

            {activeInventoryTab === 'catalog' ? (
                /* 2. Products table section card header */
                <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                        <h3>{t('products')}</h3>
                        
                        <div style={{ display: 'flex', gap: '10px' }}>
                            <button className="btn btn-primary" onClick={onOpenAddProduct}>
                                {t('addProduct')}
                            </button>
                            <button className="btn btn-secondary" onClick={() => setIsInitialStockOpen(true)}>
                                ضبط الرصيد الافتتاحي والأسعار
                            </button>
                            <button className="btn btn-secondary" onClick={() => setShowFilters(!showFilters)}>
                                <i className="fa-solid fa-sliders"></i> {t('filters')}
                            </button>
                            <button className="btn btn-secondary" onClick={handleExportCSV}>
                                {t('downloadAll')}
                            </button>
                        </div>
                    </div>

                    {/* Collapsible Filter Controls */}
                    {showFilters && (
                        <div className="glass-card filter-bar" style={{ padding: '16px', marginBottom: '20px', background: 'rgba(0,0,0,0.1)' }}>
                            <div className="filter-controls">
                                <div className="search-input-wrapper">
                                    <i className="fa-solid fa-magnifying-glass search-icon"></i>
                                    <input 
                                        type="text" 
                                        placeholder={t('searchPlaceholder')}
                                        value={globalSearch || ''}
                                        onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                                    />
                                </div>
                                
                                <select 
                                    className="form-select" 
                                    style={{ 
                                        flex: '1',
                                        minWidth: '220px',
                                        padding: '10px 16px'
                                    }}
                                    value={collectionFilter}
                                    onChange={(e) => { setCollectionFilter(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="all">جميع المجموعات</option>
                                    <option value="none">بدون مجموعة</option>
                                    {(state.collections || []).map(col => (
                                        <option key={col.id} value={String(col.id)}>{col.title}</option>
                                    ))}
                                </select>

                                <select 
                                    className="form-select" 
                                    style={{ 
                                        flex: '1',
                                        minWidth: '200px',
                                        padding: '10px 16px'
                                    }}
                                    value={stockFilter}
                                    onChange={(e) => { setStockFilter(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="all">جميع المنتجات</option>
                                    <option value="in_stock">✅ متوفر في المخزون</option>
                                    <option value="out_of_stock">❌ نفذ من المخزون</option>
                                    <option value="low">⚠️ مخزون منخفض / نفذ</option>
                                </select>

                            </div>
                        </div>
                    )}

                    {/* Catalog Table */}
                    <div className="table-wrapper inventory-desktop-only">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>{t('products')}</th>
                                    <th>{t('buyingPrice')}</th>
                                    <th>{t('quantity')}</th>
                                    <th>{t('thresholdValue')}</th>
                                    <th>{t('createdDate')}</th>
                                    <th>المُسجِل</th>
                                    <th>{t('runway')}</th>
                                    <th>{t('availability')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {paginatedList.length === 0 ? (
                                    <tr>
                                        <td colSpan="9" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                            {t('noProducts')}
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedList.map(prod => {
                                        // Average Wholesale / Buying price
                                        let totalQty = 0;
                                        let totalWholesale = 0;
                                        prod.variants.forEach(vr => {
                                            const qty = (vr.stock.Sulur || 0);
                                            totalQty += qty;
                                            totalWholesale += qty * vr.wholesalePrice;
                                        });
                                        const buyingPrice = totalQty > 0 ? (totalWholesale / totalQty) : (prod.variants[0]?.wholesalePrice || 0);

                                        // Threshold / Reorder limit average
                                        const threshold = prod.variants[0]?.reorderLimit || 1;

                                        // Earliest Expiry batch
                                        let earliestExpiry = '-';
                                        if (prod.batches && prod.batches.length > 0) {
                                            const sortedBatches = [...prod.batches].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                                            earliestExpiry = sortedBatches[0].expiryDate;
                                        }

                                        // Calculate Stock Runway based on average consumption rate
                                        const dailyBurnRate = (prod.totalConsumed || 0) / 30;
                                        let runwayDays = "Stable";
                                        let runwayBadgeClass = "badge-success";
                                        if (dailyBurnRate > 0) {
                                            runwayDays = Math.ceil(totalQty / dailyBurnRate);
                                            if (runwayDays <= 5) {
                                                runwayBadgeClass = "badge-danger";
                                            } else if (runwayDays <= 15) {
                                                runwayBadgeClass = "badge-warning";
                                            }
                                        }

                                        // Availability status
                                        let statusText = t('inStock');
                                        let badgeClass = "badge-success";
                                        let hasOutOfStock = false;
                                        let hasLowStock = false;

                                        prod.variants.forEach(vr => {
                                            const qty = Number(vr.stock?.Sulur || 0);
                                            const limit = vr.reorderLimit !== undefined && vr.reorderLimit !== null && vr.reorderLimit !== "" ? Number(vr.reorderLimit) : 5;
                                            if (qty === 0) hasOutOfStock = true;
                                            else if (qty <= limit) hasLowStock = true;
                                        });

                                        if (totalQty === 0) {
                                            statusText = t('outOfStock');
                                            badgeClass = "badge-danger";
                                        } else if (hasOutOfStock) {
                                            statusText = t('partialOutOfStock');
                                            badgeClass = "badge-partial-out";
                                        } else if (hasLowStock) {
                                            statusText = t('lowStock');
                                            badgeClass = "badge-warning";
                                        }

                                        return (
                                            <tr key={prod.id}>
                                                <td>
                                                    <div 
                                                        style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gold-primary)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                        onClick={() => { setInspectId(prod.id); setViewMode('inspect'); }}
                                                    >
                                                        {deduplicateProductName(prod.name)}<i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(deduplicateProductName(prod.name)); showToast('تم نسخ اسم المنتج', 'success'); }} title="نسخ اسم المنتج"></i>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {(() => {
                                                            if (!prod.shopifyCollectionIds || prod.shopifyCollectionIds.length === 0) {
                                                                return prod.category || 'بدون مجموعة';
                                                            }
                                                            const names = prod.shopifyCollectionIds.map(id => {
                                                                const col = (state.collections || []).find(c => String(c.id) === String(id));
                                                                return col ? col.title : null;
                                                            }).filter(Boolean);
                                                            return names.length > 0 ? names.join(', ') : (prod.category || 'بدون مجموعة');
                                                        })()}
                                                    </div>
                                                </td>
                                                 <td style={{ fontWeight: 600 }}>{currency} {buyingPrice.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                 <td>{totalQty} {t('packets')}</td>
                                                 <td>{threshold} {t('packets')}</td>
                                                 <td>{prod.createdDate || "2026-06-30"}</td>
                                                 <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{prod.createdBy || 'sfsf'}</td>
                                                 <td>
                                                    {runwayDays === "Stable" ? (
                                                        <span className="badge badge-success" style={{ fontSize: '11px' }}>{t('stockHealthy')}</span>
                                                    ) : (
                                                        <span className={`badge ${runwayBadgeClass}`} style={{ fontSize: '11px' }}>
                                                            {runwayDays} {t('left')}
                                                        </span>
                                                    )}
                                                </td>
                                                <td>
                                                    <span className={`badge ${badgeClass}`}>{statusText}</span>
                                                </td>
                                                <td style={{ textAlign: 'right' }}>
                                                    <div className="table-actions-cell" style={{ justifyContent: 'flex-end' }}>
                                                        <button 
                                                            className="action-btn-circle" 
                                                            title="Inspect Catalog"
                                                            onClick={() => { setInspectId(prod.id); setViewMode('inspect'); }}
                                                        >
                                                            <i className="fa-solid fa-eye"></i>
                                                        </button>
                                                        <button 
                                                            className="action-btn-circle" 
                                                            title="Edit Catalog"
                                                            onClick={() => onOpenEditProduct(prod.id)}
                                                        >
                                                            <i className="fa-solid fa-pencil"></i>
                                                        </button>
                                                        <button 
                                                            className="action-btn-circle" 
                                                            title="Delete Product"
                                                            style={{ color: 'var(--color-danger)' }}
                                                            onClick={() => {
                                                                showConfirm('هل أنت متأكد من مسح هذا المنتج من المتجر ومن شوبيفاي؟', () => {
                                                                    deleteProduct(prod.id);
                                                                });
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile view cards */}
                    <div className="inventory-mobile-cards">
                        {paginatedList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                {t('noProducts')}
                            </div>
                        ) : (
                            paginatedList.map(prod => {
                                // Average Wholesale / Buying price
                                let totalQty = 0;
                                let totalWholesale = 0;
                                prod.variants.forEach(vr => {
                                    const qty = (vr.stock.Sulur || 0);
                                    totalQty += qty;
                                    totalWholesale += qty * vr.wholesalePrice;
                                });
                                const buyingPrice = totalQty > 0 ? (totalWholesale / totalQty) : (prod.variants[0]?.wholesalePrice || 0);

                                // Threshold / Reorder limit average
                                const threshold = prod.variants[0]?.reorderLimit || 1;

                                // Calculate Stock Runway
                                const dailyBurnRate = (prod.totalConsumed || 0) / 30;
                                let runwayDays = "Stable";
                                let runwayBadgeClass = "badge-success";
                                if (dailyBurnRate > 0) {
                                    runwayDays = Math.ceil(totalQty / dailyBurnRate);
                                    if (runwayDays <= 5) {
                                        runwayBadgeClass = "badge-danger";
                                    } else if (runwayDays <= 15) {
                                        runwayBadgeClass = "badge-warning";
                                    }
                                }

                                // Availability status
                                let statusText = t('inStock');
                                let badgeClass = "badge-success";
                                let hasOutOfStock = false;
                                let hasLowStock = false;

                                prod.variants.forEach(vr => {
                                    const qty = Number(vr.stock?.Sulur || 0);
                                    const limit = vr.reorderLimit !== undefined && vr.reorderLimit !== null && vr.reorderLimit !== "" ? Number(vr.reorderLimit) : 5;
                                    if (qty === 0) hasOutOfStock = true;
                                    else if (qty <= limit) hasLowStock = true;
                                });

                                if (totalQty === 0) {
                                    statusText = t('outOfStock');
                                    badgeClass = "badge-danger";
                                } else if (hasOutOfStock) {
                                    statusText = t('partialOutOfStock');
                                    badgeClass = "badge-partial-out";
                                } else if (hasLowStock) {
                                    statusText = t('lowStock');
                                    badgeClass = "badge-warning";
                                }

                                return (
                                    <div 
                                        key={prod.id} 
                                        className="sa-mobile-card"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px'
                                        }}
                                    >
                                        {/* Header: Name & Collection */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                            <div>
                                                <strong 
                                                    style={{ color: 'var(--gold-primary)', fontSize: '14px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                                                    onClick={() => { setInspectId(prod.id); setViewMode('inspect'); }}
                                                >
                                                    {deduplicateProductName(prod.name)}<i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(deduplicateProductName(prod.name)); showToast('تم نسخ اسم المنتج', 'success'); }} title="نسخ اسم المنتج"></i>
                                                </strong>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                    {(() => {
                                                        if (!prod.shopifyCollectionIds || prod.shopifyCollectionIds.length === 0) {
                                                            return prod.category || 'بدون مجموعة';
                                                        }
                                                        const names = prod.shopifyCollectionIds.map(id => {
                                                            const col = (state.collections || []).find(c => String(c.id) === String(id));
                                                            return col ? col.title : null;
                                                        }).filter(Boolean);
                                                        return names.length > 0 ? names.join(', ') : (prod.category || 'بدون مجموعة');
                                                    })()}
                                                </div>
                                            </div>
                                            <span className={`badge ${badgeClass}`} style={{ fontSize: '10px', padding: '3px 6px' }}>{statusText}</span>
                                        </div>

                                        {/* Body info: Price, Qty, Runway */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>سعر الشراء: </span>
                                                <strong style={{ color: '#fff' }}>{currency} {buyingPrice.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>المخزون الحالي: </span>
                                                <strong style={{ color: 'var(--gold-primary)' }}>{totalQty} {t('packets')}</strong>
                                            </div>
                                        </div>

                                        {/* Threshold & Runway & Admin */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>حد التنبيه: </span>
                                                <strong style={{ color: '#fff' }}>{threshold} {t('packets')}</strong>
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>الاستهلاك: </span>
                                                {runwayDays === "Stable" ? (
                                                    <span className="badge badge-success" style={{ fontSize: '10px', padding: '2px 5px' }}>{t('stockHealthy')}</span>
                                                ) : (
                                                    <span className={`badge ${runwayBadgeClass}`} style={{ fontSize: '10px', padding: '2px 5px' }}>
                                                        {runwayDays} {t('left')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>

                                        {/* Footer details & Action buttons */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px' }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                <span>سجل بواسطة: </span>
                                                <strong>{prod.createdBy || 'الآدمن'}</strong>
                                            </div>
                                            <div style={{ display: 'flex', gap: '6px' }}>
                                                <button 
                                                    className="action-btn-circle" 
                                                    title="Inspect Catalog"
                                                    onClick={() => { setInspectId(prod.id); setViewMode('inspect'); }}
                                                    style={{ width: '30px', height: '30px', fontSize: '11px' }}
                                                >
                                                     <i className="fa-solid fa-eye"></i>
                                                </button>
                                                <button 
                                                    className="action-btn-circle" 
                                                    title="Edit Catalog"
                                                    onClick={() => onOpenEditProduct(prod.id)}
                                                    style={{ width: '30px', height: '30px', fontSize: '11px' }}
                                                >
                                                    <i className="fa-solid fa-pencil"></i>
                                                </button>
                                                <button 
                                                    className="action-btn-circle" 
                                                    title="Delete Product"
                                                    style={{ color: 'var(--color-danger)', width: '30px', height: '30px', fontSize: '11px' }}
                                                    onClick={() => {
                                                        showConfirm('هل أنت متأكد من مسح هذا المنتج من المتجر ومن شوبيفاي؟', () => {
                                                            deleteProduct(prod.id);
                                                        });
                                                    }}
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>

                    {/* Pagination Footer */}
                    <div style={{ padding: '24px 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', marginTop: '16px' }}>
                        <button 
                            className="btn btn-secondary" 
                            disabled={activePage === 1}
                            onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                            {t('previous')}
                        </button>
                        <span style={{ fontSize: '14px', color: 'var(--text-primary)' }}>
                            {t('page')} <strong style={{ color: 'var(--text-primary)' }}>{activePage}</strong> {t('of')} <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
                        </span>
                        <button 
                            className="btn btn-secondary" 
                            disabled={activePage === totalPages}
                            onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                            style={{ padding: '8px 16px', fontSize: '13px' }}
                        >
                            {t('next')}
                        </button>
                    </div>
                </div>
            ) : (
                /* Central Stock Ledger view log list */
                <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                        <h3>{t('stockLedger')}</h3>
                    </div>

                    <div className="table-wrapper inventory-desktop-only">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>{t('date')}</th>
                                    <th>{t('products')}</th>
                                    <th>{t('orderId')}</th>
                                    <th>{t('stockLocations')}</th>
                                    <th>نوع الحركة</th>
                                    <th>{t('quantity')}</th>
                                    <th>{t('remainingQuantity')}</th>
                                    <th>ملاحظات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!state.stockLedger || state.stockLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                            {t('noRecords')}
                                        </td>
                                    </tr>
                                ) : (() => {
                                    const allLedger = state.stockLedger || [];
                                    const ledgerTotalEntries = allLedger.length;
                                    const ledgerTotalPages = Math.ceil(ledgerTotalEntries / ledgerPageSize) || 1;
                                    const activeLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
                                    const ledgerStartIdx = (activeLedgerPage - 1) * ledgerPageSize;
                                    const ledgerEndIdx = Math.min(ledgerStartIdx + ledgerPageSize, ledgerTotalEntries);
                                    const paginatedLedger = allLedger.slice(ledgerStartIdx, ledgerEndIdx);

                                    return paginatedLedger.map((entry, idx) => {
                                        const prod = state.products.find(p => p.id === entry.productId);
                                        const prodName = prod ? deduplicateProductName(prod.name) : entry.productId;

                                        let typeBadge = null;
                                        if (entry.type === "Sale") {
                                            typeBadge = <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-down"></i> {t('sales')}</span>;
                                        } else if (entry.type === "Purchase") {
                                            typeBadge = <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-up"></i> {t('purchase')}</span>;
                                        } else if (entry.type === "Correction") {
                                            typeBadge = <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-wrench"></i> {t('adjustments')}</span>;
                                        } else if (entry.type === "Waste") {
                                            typeBadge = <span className="badge badge-danger" style={{ background: '#721c24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-trash-can"></i> {t('damagedWaste')}</span>;
                                        } else if (entry.type === "Edit Adjustment") {
                                            typeBadge = <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-pen-to-square"></i> تعديل أوردر</span>;
                                        } else {
                                            typeBadge = <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-rotate-left"></i> {t('return')}</span>;
                                        }
                                        return (
                                            <tr key={idx}>
                                                <td>{formatLedgerDate(entry.created_at || entry.date)}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entry.variantSku}</div>
                                                </td>
                                                <td>
                                                    {entry.orderId || entry.order_id ? (
                                                        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                            <span style={{ fontFamily: 'monospace', color: 'var(--gold-primary)', fontWeight: 600 }}>
                                                                #{entry.orderId || entry.order_id}
                                                            </span>
                                                            {!state.orders.some(o => o.id === (entry.orderId || entry.order_id)) && (
                                                                <span style={{ fontSize: '10px', color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '2px 6px', borderRadius: '4px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                                                                    تم حذفه
                                                                </span>
                                                            )}
                                                            <i 
                                                                className="fa-regular fa-copy" 
                                                                style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)' }} 
                                                                onClick={(e) => { 
                                                                    e.stopPropagation(); 
                                                                    navigator.clipboard.writeText(entry.orderId || entry.order_id); 
                                                                    showToast('تم نسخ رقم الطلب', 'success'); 
                                                                }} 
                                                                title="نسخ رقم الطلب"
                                                            ></i>
                                                        </div>
                                                    ) : (
                                                        <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '11px' }}>
                                                            {entry.type === 'Restock' ? 'مشتريات' : entry.type === 'Correction' ? 'تعديل يدوي' : entry.type === 'Waste' ? 'هالك' : 'تعديل يدوي'}
                                                        </span>
                                                    )}
                                                </td>
                                                <td><span className="badge badge-info">{entry.warehouse === 'Sulur' ? t('inSulur') : t('inSinganallur')}</span></td>
                                                <td>{typeBadge}</td>
                                                <td style={{ fontWeight: 700, color: entry.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{entry.balanceAfter}</td>
                                                <td style={{ fontSize: '11.5px', color: 'var(--text-secondary)' }}>
                                                    {(() => {
                                                        let notes = entry.notes || entry.remarks || '';
                                                        const orderId = entry.orderId || entry.order_id;
                                                        if (orderId) {
                                                            const ord = (state.orders || []).find(o => o.id === orderId) || (state.deletedOrdersWithDeposits || []).find(o => o.id === orderId);
                                                            if (ord && (ord.cancellationReason || ord.cancellation_reason)) {
                                                                const cancelReason = ord.cancellationReason || ord.cancellation_reason;
                                                                notes = notes ? `سبب الإلغاء: ${cancelReason} (${notes})` : `سبب الإلغاء: ${cancelReason}`;
                                                            }
                                                        }
                                                        return notes ? (
                                                            <span style={{ color: notes.includes('سبب الإلغاء') ? '#ef4444' : 'var(--text-secondary)', fontWeight: notes.includes('سبب الإلغاء') ? '600' : 'normal' }}>
                                                                {notes}
                                                            </span>
                                                        ) : '-';
                                                    })()}
                                                </td>
                                            </tr>
                                        );
                                    });
                                })()}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile view cards for Stock Ledger */}
                    <div className="inventory-mobile-cards">
                        {!state.stockLedger || state.stockLedger.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                                {t('noRecords')}
                            </div>
                        ) : (() => {
                            const allLedger = state.stockLedger || [];
                            const ledgerTotalEntries = allLedger.length;
                            const ledgerTotalPages = Math.ceil(ledgerTotalEntries / ledgerPageSize) || 1;
                            const activeLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
                            const ledgerStartIdx = (activeLedgerPage - 1) * ledgerPageSize;
                            const ledgerEndIdx = Math.min(ledgerStartIdx + ledgerPageSize, ledgerTotalEntries);
                            const paginatedLedger = allLedger.slice(ledgerStartIdx, ledgerEndIdx);

                            return paginatedLedger.map((entry, idx) => {
                                const prod = state.products.find(p => p.id === entry.productId);
                                const prodName = prod ? deduplicateProductName(prod.name) : entry.productId;

                                let typeBadge = null;
                                if (entry.type === "Sale") {
                                    typeBadge = <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-down"></i> {t('sales')}</span>;
                                } else if (entry.type === "Purchase") {
                                    typeBadge = <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-up"></i> {t('purchase')}</span>;
                                } else if (entry.type === "Correction") {
                                    typeBadge = <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-wrench"></i> {t('adjustments')}</span>;
                                } else if (entry.type === "Waste") {
                                    typeBadge = <span className="badge badge-danger" style={{ background: '#721c24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-trash-can"></i> {t('damagedWaste')}</span>;
                                } else if (entry.type === "Edit Adjustment") {
                                    typeBadge = <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-pen-to-square"></i> تعديل أوردر</span>;
                                } else {
                                    typeBadge = <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-rotate-left"></i> {t('return')}</span>;
                                }

                                return (
                                    <div 
                                        key={idx} 
                                        className="sa-mobile-card"
                                        style={{
                                            background: 'rgba(255, 255, 255, 0.02)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            display: 'flex',
                                            flexDirection: 'column',
                                            gap: '10px'
                                        }}
                                    >
                                        {/* Header: Product & Date */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                            <div>
                                                <strong style={{ color: 'var(--gold-primary)', fontSize: '14px' }}>{prodName}</strong>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace' }}>
                                                    {entry.variantSku}
                                                </div>
                                            </div>
                                            <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatLedgerDate(entry.created_at || entry.date)}</span>
                                        </div>
 
                                        {/* Body: Location, Type, Qty */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                                <span className="badge badge-info" style={{ fontSize: '10px' }}>{entry.warehouse === 'Sulur' ? t('inSulur') : t('inSinganallur')}</span>
                                                {typeBadge}
                                            </div>
                                            <div>
                                                <span style={{ color: 'var(--text-muted)' }}>الحركة: </span>
                                                <strong style={{ color: entry.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                                </strong>
                                            </div>
                                        </div>

                                        {/* Mobile Order ID Field */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', background: 'rgba(255,255,255,0.01)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>رقم الطلب / المصدر:</span>
                                            {entry.orderId || entry.order_id ? (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <strong style={{ fontFamily: 'monospace', color: 'var(--gold-primary)' }}>
                                                        #{entry.orderId || entry.order_id}
                                                    </strong>
                                                    {!state.orders.some(o => o.id === (entry.orderId || entry.order_id)) && (
                                                        <span style={{ fontSize: '9px', color: '#ff4d4d', background: 'rgba(255, 77, 77, 0.1)', padding: '1px 5px', borderRadius: '3px', border: '1px solid rgba(255, 77, 77, 0.2)' }}>
                                                            تم حذفه
                                                        </span>
                                                    )}
                                                    <i 
                                                        className="fa-regular fa-copy" 
                                                        style={{ cursor: 'pointer', opacity: 0.8, fontSize: '11px', color: 'var(--text-secondary)' }} 
                                                        onClick={(e) => { 
                                                            e.stopPropagation(); 
                                                            navigator.clipboard.writeText(entry.orderId || entry.order_id); 
                                                            showToast('تم نسخ رقم الطلب', 'success'); 
                                                        }} 
                                                        title="نسخ رقم الطلب"
                                                    ></i>
                                                </div>
                                            ) : (
                                                <span className="badge" style={{ background: 'rgba(255, 255, 255, 0.05)', color: 'var(--text-muted)', fontSize: '10px' }}>
                                                    {entry.type === 'Restock' ? 'مشتريات' : entry.type === 'Correction' ? 'تعديل يدوي' : entry.type === 'Waste' ? 'هالك' : 'تعديل يدوي'}
                                                </span>
                                            )}
                                        </div>
 
                                        {/* Footer: Balance after */}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px', fontSize: '12px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>الرصيد بعد الحركة:</span>
                                            <strong style={{ color: '#fff' }}>{entry.balanceAfter} قطع</strong>
                                        </div>
                                    </div>
                                );
                            });
                        })()}
                    </div>

                    {/* Stock Ledger Pagination Controls (15 items per page) */}
                    {(() => {
                        const allLedger = state.stockLedger || [];
                        const ledgerTotalEntries = allLedger.length;
                        if (ledgerTotalEntries === 0) return null;
                        const ledgerTotalPages = Math.ceil(ledgerTotalEntries / ledgerPageSize) || 1;
                        const activeLedgerPage = Math.min(ledgerPage, ledgerTotalPages);
                        const ledgerStartIdx = (activeLedgerPage - 1) * ledgerPageSize;
                        const ledgerEndIdx = Math.min(ledgerStartIdx + ledgerPageSize, ledgerTotalEntries);

                        return (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                                    عرض {ledgerStartIdx + 1} إلى {ledgerEndIdx} من أصل {ledgerTotalEntries} حركة مخزنية
                                </div>
                                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={activeLedgerPage <= 1}
                                        onClick={() => setLedgerPage(p => Math.max(1, p - 1))}
                                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', opacity: activeLedgerPage <= 1 ? 0.5 : 1, cursor: activeLedgerPage <= 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        <i className="fa-solid fa-chevron-right" style={{ marginLeft: '4px' }}></i> السابق
                                    </button>
                                    <span style={{ fontSize: '0.82rem', padding: '0 8px', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
                                        صفحة {activeLedgerPage} من {ledgerTotalPages}
                                    </span>
                                    <button
                                        type="button"
                                        className="btn btn-secondary"
                                        disabled={activeLedgerPage >= ledgerTotalPages}
                                        onClick={() => setLedgerPage(p => Math.min(ledgerTotalPages, p + 1))}
                                        style={{ padding: '6px 12px', fontSize: '0.8rem', borderRadius: '8px', opacity: activeLedgerPage >= ledgerTotalPages ? 0.5 : 1, cursor: activeLedgerPage >= ledgerTotalPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        التالي <i className="fa-solid fa-chevron-left" style={{ marginRight: '4px' }}></i>
                                    </button>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            )}

            <InitialStockSetupModal isOpen={isInitialStockOpen} onClose={() => setIsInitialStockOpen(false)} />
        </div>
    );
}

