import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import ProductInfo from './ProductInfo';

export default function InventoryList({ 
    globalSearch, 
    setGlobalSearch,
    onOpenAddProduct, 
    onOpenEditProduct,
    onOpenScanner 
}) {
    const { state, showToast, t, deleteProduct, showConfirm } = useContext(AppContext);
    
    // View mode: 'list' or 'inspect'
    const [viewMode, setViewMode] = useState('list');
    const [inspectId, setInspectId] = useState(null);

    // Segment tab control for inventory view: 'catalog' or 'ledger'
    const [activeInventoryTab, setActiveInventoryTab] = useState('catalog');

    // Filters visibility toggle
    const [showFilters, setShowFilters] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [stockFilter, setStockFilter] = useState('all'); // 'all', 'low'
    // Using globalSearch instead of local searchVal

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const currency = state.storeSettings.currency || '$';
    const activeSearch = globalSearch || '';

    // Collect list of categories
    const categoriesList = ['all', ...new Set(state.products.map(p => p.category))];

    // Filter products
    let filteredList = [];
    state.products.forEach(prod => {
        if (categoryFilter !== 'all' && prod.category !== categoryFilter) return;

        let hasLow = false;
        let hasOut = false;
        prod.variants.forEach(vr => {
            const qty = Number(vr.stock?.Sulur || 0);
            const limit = vr.reorderLimit !== undefined && vr.reorderLimit !== null && vr.reorderLimit !== "" ? Number(vr.reorderLimit) : 5;
            if (qty === 0) hasOut = true;
            else if (qty <= limit) hasLow = true;
        });

        if (stockFilter === 'low' && !hasLow && !hasOut) return;

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
    const categoriesCount = categoriesList.filter(c => c !== 'all').length;
    const totalProductsCount = (state.products || []).reduce((acc, p) => acc + (p.variants || []).length, 0);
    
    let totalInvValue = 0;
    (state.products || []).forEach(p => {
        (p.variants || []).forEach(v => {
            const qty = (v.stock?.Sulur || 0);
            totalInvValue += qty * (v.retailPrice || 0);
        });
    });

    let variantSales = {};
    state.orders.forEach(ord => {
        if (ord.status !== "Cancelled" && ord.status !== "Draft") {
            ord.items.forEach(item => {
                variantSales[item.variantSku] = (variantSales[item.variantSku] || 0) + item.quantity;
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
        showToast("CSV exported successfully.");
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
            
            <div className="metrics-grid" style={{ marginBottom: '24px' }}>
                {/* Categories */}
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3 style={{ color: 'var(--gold-primary)' }}>{t('categories')}</h3>
                        <div className="metric-value">{categoriesCount}</div>
                        <div className="metric-change" style={{ color: 'var(--text-muted)' }}>Last 7 days</div>
                    </div>
                </div>

                {/* Total Products */}
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3 style={{ color: 'var(--color-warning)' }}>{t('totalProducts')}</h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                            <div className="metric-value">{totalProductsCount}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {currency} {totalInvValue.toLocaleString('en-US', {maximumFractionDigits: 0})} <span style={{ color: 'var(--text-muted)' }}>{t('revenue')}</span>
                            </div>
                        </div>
                        <div className="metric-change" style={{ color: 'var(--text-muted)' }}>Last 7 days</div>
                    </div>
                </div>

                {/* Top Selling */}
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3 style={{ color: '#a084dc' }}>{t('topSelling')}</h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                            <div className="metric-value">{topSellingCount}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {currency} {topSellingCost.toLocaleString('en-US', {maximumFractionDigits: 0})} <span style={{ color: 'var(--text-muted)' }}>{t('cost')}</span>
                            </div>
                        </div>
                        <div className="metric-change" style={{ color: 'var(--text-muted)' }}>Last 7 days</div>
                    </div>
                </div>

                {/* Low Stocks */}
                <div 
                    className="glass-card metric-card" 
                    onClick={() => { setStockFilter(stockFilter === 'low' ? 'all' : 'low'); setCurrentPage(1); }}
                    style={{ cursor: 'pointer', border: stockFilter === 'low' ? '1px solid var(--color-danger)' : '1px solid transparent', transition: 'border 0.3s ease' }}
                >
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3 style={{ color: 'var(--color-danger)' }}>{t('lowStocks')}</h3>
                        <div style={{ display: 'flex', alignItems: 'baseline', gap: '20px' }}>
                            <div className="metric-value">{lowStocksCount}</div>
                            <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                                {outOfStockCount} <span style={{ color: 'var(--text-muted)' }}>{t('notInStock')}</span>
                            </div>
                        </div>
                        <div className="metric-change" style={{ color: 'var(--text-muted)' }}>{t('ordered')}</div>
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
                                    style={{ width: '150px', padding: '8px 12px' }}
                                    value={categoryFilter}
                                    onChange={(e) => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
                                >
                                    <option value="all">All Categories</option>
                                    {categoriesList.filter(c => c !== 'all').map(c => (
                                        <option key={c} value={c}>{c}</option>
                                    ))}
                                </select>


                            </div>
                        </div>
                    )}

                    {/* Catalog Table */}
                    <div className="table-wrapper">
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

                                        if (hasOutOfStock) {
                                            statusText = t('outOfStock');
                                            badgeClass = "badge-danger";
                                        } else if (hasLowStock) {
                                            statusText = t('lowStock');
                                            badgeClass = "badge-warning";
                                        }

                                        return (
                                            <tr key={prod.id}>
                                                <td>
                                                    <div 
                                                        style={{ fontWeight: 600, cursor: 'pointer', color: 'var(--gold-primary)' }}
                                                        onClick={() => { setInspectId(prod.id); setViewMode('inspect'); }}
                                                    >
                                                        {prod.name}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                        {prod.category}
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
                                                            <i className="fa-solid fa-magnifying-glass"></i>
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

                    <div className="table-wrapper">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>{t('date')}</th>
                                    <th>{t('products')}</th>
                                    <th>{t('stockLocations')}</th>
                                    <th>{t('status')}</th>
                                    <th>{t('quantity')}</th>
                                    <th>{t('remainingQuantity')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {!state.stockLedger || state.stockLedger.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                            {t('noRecords')}
                                        </td>
                                    </tr>
                                ) : (
                                    state.stockLedger.map((entry, idx) => {
                                        const prod = state.products.find(p => p.id === entry.productId);
                                        const prodName = prod ? prod.name : entry.productId;

                                        let typeBadge = null;
                                        if (entry.type === "Sale") {
                                            typeBadge = <span className="badge badge-danger" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-down"></i> {t('sales')}</span>;
                                        } else if (entry.type === "Purchase") {
                                            typeBadge = <span className="badge badge-success" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-arrow-trend-up"></i> {t('purchase')}</span>;
                                        } else if (entry.type === "Correction") {
                                            typeBadge = <span className="badge badge-warning" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-wrench"></i> {t('adjustments')}</span>;
                                        } else if (entry.type === "Waste") {
                                            typeBadge = <span className="badge badge-danger" style={{ background: '#721c24', display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-trash-can"></i> {t('damagedWaste')}</span>;
                                        } else {
                                            typeBadge = <span className="badge badge-info" style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><i className="fa-solid fa-rotate-left"></i> {t('return')}</span>;
                                        }

                                        return (
                                            <tr key={idx}>
                                                <td>{entry.date}</td>
                                                <td>
                                                    <div style={{ fontWeight: 600 }}>{prodName}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{entry.variantSku}</div>
                                                </td>
                                                <td><span className="badge badge-info">{entry.warehouse === 'Sulur' ? t('inSulur') : t('inSinganallur')}</span></td>
                                                <td>{typeBadge}</td>
                                                <td style={{ fontWeight: 700, color: entry.quantity > 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {entry.quantity > 0 ? `+${entry.quantity}` : entry.quantity}
                                                </td>
                                                <td style={{ fontWeight: 600 }}>{entry.balanceAfter}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

