import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';
import { isDateMatchingFilter } from '../../utils/smartDateMatcher';

export default function MetricsRow({ timeFilter = 'all' }) {
    const { state, isDeductedStatus, t, theme, language } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    // 1. Sales Overview calculations
    let salesCount = 0;
    let salesRevenue = 0;
    let salesCost = 0;
    
    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord)) {
            if (!isDateMatchingFilter(ord.date, timeFilter)) return;
            salesCount++;
            salesRevenue += parseFloat(ord.totalValue || ord.total_value) || 0;
            (ord.items || []).forEach(item => {
                const itemSku = item.variantSku || item.variant_sku || item.sku;
                let cost = parseFloat(item.costAtTimeOfSale || item.cost_at_time_of_sale) || 0;
                if (!cost) {
                    (state.products || []).forEach(p => {
                        let vr = (p.variants || []).find(v => v.sku === itemSku);
                        if (vr) cost = parseFloat(vr.averageCost || vr.average_cost || vr.wholesalePrice || vr.wholesale_price) || 0;
                    });
                }
                salesCost += (parseInt(item.quantity) || 1) * cost;
            });
        }
    });

    let wasteCost = 0;
    (state.wastes || []).forEach(w => {
        if (!isDateMatchingFilter(w.date, timeFilter)) return;
        wasteCost += (w.totalCost || w.cost || (w.quantity * (w.unitCost || w.costPrice || 0)) || 0);
    });

    let salesProfit = salesRevenue - salesCost - wasteCost;

    // 2. Inventory Summary calculations
    let invQty = 0;
    let lowStockCount = 0;
    (state.products || []).forEach(prod => {
        (prod.variants || []).forEach(vr => {
            let totalQty = 0;
            if (vr.stock && typeof vr.stock === 'object') {
                if (vr.stock.Sulur !== undefined) {
                    totalQty = parseInt(vr.stock.Sulur) || 0;
                } else {
                    totalQty = Object.values(vr.stock).reduce((acc, val) => acc + (parseInt(val) || 0), 0);
                }
            } else if (vr.stock_sulur !== undefined) {
                totalQty = parseInt(vr.stock_sulur) || 0;
            } else if (typeof vr.stock === 'number') {
                totalQty = vr.stock;
            } else if (typeof vr.stock === 'string') {
                totalQty = parseInt(vr.stock) || 0;
            }

            invQty += totalQty;
            const limit = vr.reorderLimit || 5;
            if (totalQty <= limit) {
                lowStockCount++;
            }
        });
    });

    let periodItemsSold = 0;
    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord) && isDateMatchingFilter(ord.date, timeFilter)) {
            (ord.items || []).forEach(i => {
                periodItemsSold += (parseInt(i.quantity) || 1);
            });
        }
    });

    // 3. Purchase Overview calculations
    let purCount = 0;
    let purCost = 0;
    (state.purchaseOrders || []).forEach(po => {
        if (!isDateMatchingFilter(po.date, timeFilter)) return;
        purCount++;
        purCost += po.totalCost || 0;
    });

    let purCancelled = (state.orders || []).filter(o => o.status === "Cancelled" && isDateMatchingFilter(o.date, timeFilter)).length;
    let purReturns = (state.wastes || []).filter(w => isDateMatchingFilter(w.date, timeFilter)).length;

    // 4. Product Summary calculations
    let categories = [...new Set(state.products.map(p => p.category).filter(Boolean))];

    return (
        <>
            {/* ROW 1: Sales Overview & Inventory Summary */}
            <div className="dashboard-row-grid grid-2-1">
                {/* Sales Overview */}
                <div className="glass-card dashboard-widget">
                    <div className="widget-header">
                        <h3>{t('salesOverview')}</h3>
                    </div>
                    <div className="widget-metrics-horizontal">
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(46, 122, 243, 0.1)' }}>
                                <img src="/icons/Sales.png" alt="Sales" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-count">{salesCount}</h4>
                                <span>{t('sales')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Revenue.png" alt="Revenue" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-revenue">{currency} {salesRevenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</h4>
                                <span>{t('revenue')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(242, 153, 74, 0.1)' }}>
                                <img src="/icons/Profit.png" alt="Profit" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-profit">{currency} {salesProfit.toLocaleString('en-US', {maximumFractionDigits: 0})}</h4>
                                <span>{t('profit')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(39, 174, 96, 0.1)' }}>
                                <img src="/icons/Cost (1).png" alt="Cost" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-cost">{currency} {salesCost.toLocaleString('en-US', {maximumFractionDigits: 0})}</h4>
                                <span>{t('cost')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Inventory Summary */}
                <div className="glass-card dashboard-widget">
                    <div className="widget-header">
                        <h3>{t('inventorySummary')}</h3>
                    </div>
                    <div className="widget-metrics-horizontal columns-2">
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: theme === 'dark' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <img src="/icons/icons8-goods-64.png" alt="Qty in Hand" style={{ width: '38px', height: '38px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'brightness(0) invert(40%) sepia(100%) saturate(5000%) hue-rotate(345deg) brightness(1.1)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-inv-qty">{invQty}</h4>
                                <span>{t('quantityInHand')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(235, 104, 76, 0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '20px', color: 'rgba(235, 104, 76, 0.9)' }}></i>
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-inv-received" style={{ color: 'rgba(235, 104, 76, 0.95)' }}>{lowStockCount}</h4>
                                <span>{language === 'en' ? 'Low Stock Items' : 'أصناف منخفضة المخزون'}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* ROW 2: Purchase Overview & Product Summary */}
            <div className="dashboard-row-grid grid-2-1" style={{ marginTop: '24px' }}>
                {/* Purchase Overview */}
                <div className="glass-card dashboard-widget">
                    <div className="widget-header">
                        <h3>{t('purchaseOverview')}</h3>
                    </div>
                    <div className="widget-metrics-horizontal">
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(46, 122, 243, 0.1)' }}>
                                <img src="/icons/Purchase bag.png" alt="Purchase" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-count">{purCount}</h4>
                                <span>{t('purchase')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(39, 174, 96, 0.1)' }}>
                                <img src="/icons/Cost (1).png" alt="Cost" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cost">{currency} {purCost.toLocaleString('en-US', {maximumFractionDigits: 0})}</h4>
                                <span>{t('cost')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Group 33.png" alt="Cancel" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cancelled">{purCancelled}</h4>
                                <span>{t('cancel')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(242, 153, 74, 0.1)' }}>
                                <img src="/icons/Group 34.png" alt="Return" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-returns">{purReturns}</h4>
                                <span>{t('return')}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Product Summary */}
                <div className="glass-card dashboard-widget">
                    <div className="widget-header">
                        <h3>{t('productSummary')}</h3>
                    </div>
                    <div className="widget-metrics-horizontal columns-2">
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(46, 122, 243, 0.1)' }}>
                                <img src="/icons/Vector.png" alt="Suppliers" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-prod-suppliers">{state.suppliers.length}</h4>
                                <span>{t('numberOfSuppliers')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Categories.png" alt="Categories" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-prod-categories">{categories.length}</h4>
                                <span>{t('numberOfCategories')}</span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
