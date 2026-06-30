import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import ProductInfo from './ProductInfo';

export default function InventoryList({ 
    globalSearch, 
    onOpenAddProduct, 
    onOpenEditProduct,
    onOpenScanner 
}) {
    const { state, showToast, t } = useContext(AppContext);
    
    // View mode: 'list' or 'inspect'
    const [viewMode, setViewMode] = useState('list');
    const [inspectId, setInspectId] = useState(null);

    // Filters visibility toggle
    const [showFilters, setShowFilters] = useState(false);
    const [categoryFilter, setCategoryFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [searchVal, setSearchVal] = useState('');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const currency = state.storeSettings.currency || '$';
    const activeSearch = searchVal || globalSearch || '';

    // Collect list of categories
    const categoriesList = ['all', ...new Set(state.products.map(p => p.category))];

    // Filter products
    let filteredList = [];
    state.products.forEach(prod => {
        if (categoryFilter !== 'all' && prod.category !== categoryFilter) return;

        const query = activeSearch.toLowerCase();
        const nameMatches = prod.name.toLowerCase().includes(query);
        const descMatches = prod.description.toLowerCase().includes(query);

        let matchedVariants = prod.variants.filter(vr => {
            const skuMatches = vr.sku.toLowerCase().includes(query);
            const barcodeMatches = vr.barcode && vr.barcode.includes(query);
            const varNameMatches = vr.name.toLowerCase().includes(query);

            if (warehouseFilter === 'Sulur' && (vr.stock.Sulur || 0) <= 0) return false;
            if (warehouseFilter === 'Singanallur' && (vr.stock.Singanallur || 0) <= 0) return false;

            return skuMatches || barcodeMatches || varNameMatches || nameMatches || descMatches;
        });

        if (matchedVariants.length > 0 || nameMatches || descMatches) {
            filteredList.push({
                ...prod,
                activeVariants: matchedVariants.length > 0 ? matchedVariants : prod.variants
            });
        }
    });

    // Pagination calculations
    const totalEntries = filteredList.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const activePage = currentPage > totalPages ? totalPages : currentPage;
    
    const startIdx = (activePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalEntries);
    const paginatedList = filteredList.slice(startIdx, endIdx);

    // --- Metrics Summaries for Inventory Dashboard Block ---
    const categoriesCount = categoriesList.filter(c => c !== 'all').length;
    const totalProductsCount = state.products.reduce((acc, p) => acc + p.variants.length, 0);
    
    let totalInvValue = 0;
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const qty = (v.stock.Sulur || 0) + (v.stock.Singanallur || 0);
            totalInvValue += qty * v.retailPrice;
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
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const sold = variantSales[v.sku] || 0;
            topSellingCost += sold * v.wholesalePrice;
        });
    });

    let lowStocksCount = 0;
    let outOfStockCount = 0;
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const qty = (v.stock.Sulur || 0) + (v.stock.Singanallur || 0);
            if (qty === 0) {
                outOfStockCount++;
            } else if (qty <= v.reorderLimit) {
                lowStocksCount++;
            }
        });
    });

    const handleExportCSV = () => {
        let csvContent = "data:text/csv;charset=utf-8,";
        csvContent += "Product Name,Category,Variant SKU,Barcode,Wholesale Price,Retail Price,Sulur Stock,Singanallur Stock,Total Stock\r\n";
        
        state.products.forEach(p => {
            p.variants.forEach(vr => {
                const row = [
                    `"${p.name}"`,
                    `"${p.category}"`,
                    `"${vr.sku}"`,
                    `"${vr.barcode || ""}"`,
                    vr.wholesalePrice,
                    vr.retailPrice,
                    vr.stock.Sulur,
                    vr.stock.Singanallur,
                    (vr.stock.Sulur + vr.stock.Singanallur)
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
                                {currency}{totalInvValue.toFixed(0)} <span style={{ color: 'var(--text-muted)' }}>{t('revenue')}</span>
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
                                {currency}{topSellingCost.toFixed(0)} <span style={{ color: 'var(--text-muted)' }}>{t('cost')}</span>
                            </div>
                        </div>
                        <div className="metric-change" style={{ color: 'var(--text-muted)' }}>Last 7 days</div>
                    </div>
                </div>

                {/* Low Stocks */}
                <div className="glass-card metric-card">
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

            {/* 2. Products table section card header */}
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
                                    value={searchVal}
                                    onChange={(e) => { setSearchVal(e.target.value); setCurrentPage(1); }}
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

                            <select 
                                className="form-select" 
                                style={{ width: '160px', padding: '8px 12px' }}
                                value={warehouseFilter}
                                onChange={(e) => { setWarehouseFilter(e.target.value); setCurrentPage(1); }}
                            >
                                <option value="all">All Warehouses</option>
                                <option value="Sulur">In Sulur</option>
                                <option value="Singanallur">In Singanallur</option>
                            </select>
                        </div>
                    </div>
                )}

                {/* Table */}
                <div className="table-wrapper">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>{t('products')}</th>
                                <th>{t('buyingPrice')}</th>
                                <th>{t('quantity')}</th>
                                <th>{t('thresholdValue')}</th>
                                <th>{t('expiryDate')}</th>
                                <th>{t('availability')}</th>
                                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedList.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                        No products found.
                                    </td>
                                </tr>
                            ) : (
                                paginatedList.map(prod => {
                                    // Average Wholesale / Buying price
                                    let totalQty = 0;
                                    let totalWholesale = 0;
                                    prod.variants.forEach(vr => {
                                        const qty = (vr.stock.Sulur || 0) + (vr.stock.Singanallur || 0);
                                        totalQty += qty;
                                        totalWholesale += qty * vr.wholesalePrice;
                                    });
                                    const buyingPrice = totalQty > 0 ? (totalWholesale / totalQty) : (prod.variants[0]?.wholesalePrice || 0);

                                    // Threshold / Reorder limit average
                                    const threshold = prod.variants[0]?.reorderLimit || 10;

                                    // Earliest Expiry batch
                                    let earliestExpiry = '-';
                                    if (prod.batches && prod.batches.length > 0) {
                                        const sortedBatches = [...prod.batches].sort((a,b) => new Date(a.expiryDate) - new Date(b.expiryDate));
                                        earliestExpiry = sortedBatches[0].expiryDate;
                                    }

                                    // Availability status
                                    let statusText = t('inStock');
                                    let badgeClass = "badge-success";
                                    if (totalQty === 0) {
                                        statusText = t('outOfStock');
                                        badgeClass = "badge-danger";
                                    } else if (totalQty <= threshold) {
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
                                            <td style={{ fontWeight: 600 }}>{currency}{buyingPrice.toFixed(2)}</td>
                                            <td>{totalQty} {t('packets')}</td>
                                            <td>{threshold} {t('packets')}</td>
                                            <td>{earliestExpiry}</td>
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
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Restructured Pagination Footer */}
                <div style={{ padding: '24px 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', marginTop: '16px' }}>
                    <button 
                        className="btn btn-secondary" 
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                        {t('previous')}
                    </button>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
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
        </div>
    );
}
