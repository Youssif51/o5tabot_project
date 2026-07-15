import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';


const isDateInPeriod = (dateStr, period) => {
    if (!dateStr) return false;
    if (period === 'all') return true;

    try {
        const orderDate = new Date(dateStr);
        orderDate.setHours(0, 0, 0, 0);

        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const diffTime = today - orderDate;
        const diffDays = diffTime / (1000 * 60 * 60 * 24);

        if (period === 'today') {
            return diffDays === 0;
        }
        if (period === 'week') {
            return diffDays >= 0 && diffDays < 7;
        }
        if (period === 'month') {
            return diffDays >= 0 && diffDays < 30;
        }
        if (period === 'year') {
            return diffDays >= 0 && diffDays < 365;
        }
    } catch (e) {
        return false;
    }
    return true;
};


export default function MetricsRow({ timeFilter = 'all' }) {
    const { state, t, theme } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    // 1. Sales Overview calculations
    let salesCount = 0;
    let salesRevenue = 0;
    let salesCost = 0;
    
    state.orders.forEach(ord => {
        if (ord.status !== "Cancelled" && ord.status !== "Draft") {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            salesCount++;
            salesRevenue += ord.totalValue;
            ord.items.forEach(item => {
                let cost = item.costAtTimeOfSale || 0;
                if (!cost) {
                    state.products.forEach(p => {
                        let vr = p.variants.find(v => v.sku === item.variantSku);
                        if (vr) cost = vr.wholesalePrice || 0;
                    });
                }
                salesCost += item.quantity * cost;
            });
        }
    });
    
    let salesProfit = salesRevenue - salesCost;

    // 2. Inventory Summary calculations
    let invQty = 0;
    let invReceived = 0;
    state.products.forEach(prod => {
        prod.variants.forEach(vr => {
            const totalQty = (vr.stock.Sulur || 0);
            invQty += totalQty;
            if (totalQty <= vr.reorderLimit) {
                invReceived += (vr.reorderLimit - totalQty + 10);
            }
        });
    });

    // 3. Purchase Overview calculations
    let purCount = 0;
    let purCost = 0;
    (state.purchaseOrders || []).forEach(po => {
        if (!isDateInPeriod(po.date, timeFilter)) return;
        purCount++;
        purCost += po.totalCost || 0;
    });
    let purCancelled = state.orders.filter(o => o.status === "Cancelled").length;
    let purReturns = state.wastes.length;

    // 4. Product Summary calculations
    let categories = [...new Set(state.products.map(p => p.category))];

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
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/On the way.png" alt="To be received" style={{ width: '34px', height: '34px', objectFit: 'contain', imageRendering: '-webkit-optimize-contrast', filter: 'contrast(1.15) brightness(1.05)' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-inv-received">{invReceived}</h4>
                                <span>{t('toBeReceived')}</span>
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
