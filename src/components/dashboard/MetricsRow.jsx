import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function MetricsRow() {
    const { state, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    // 1. Sales Overview calculations
    let salesCount = 0;
    let salesRevenue = 0;
    let salesCost = 0;
    
    state.orders.forEach(ord => {
        if (ord.status !== "Cancelled" && ord.status !== "Draft") {
            salesCount++;
            salesRevenue += ord.totalValue;
            ord.items.forEach(item => {
                let wholesalePrice = 0;
                state.products.forEach(p => {
                    let vr = p.variants.find(v => v.sku === item.variantSku);
                    if (vr) wholesalePrice = vr.wholesalePrice;
                });
                salesCost += item.quantity * wholesalePrice;
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
    let purCount = (state.purchaseOrders || []).length;
    let purCost = 0;
    (state.purchaseOrders || []).forEach(po => {
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
                                <img src="/icons/Sales.png" alt="Sales" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-count">{salesCount}</h4>
                                <span>{t('sales')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Revenue.png" alt="Revenue" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-revenue">{currency}{salesRevenue.toFixed(0)}</h4>
                                <span>{t('revenue')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(242, 153, 74, 0.1)' }}>
                                <img src="/icons/Profit.png" alt="Profit" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-profit">{currency}{salesProfit.toFixed(0)}</h4>
                                <span>{t('profit')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(39, 174, 96, 0.1)' }}>
                                <img src="/icons/Cost (1).png" alt="Cost" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-cost">{currency}{salesCost.toFixed(0)}</h4>
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
                            <div className="sub-metric-icon" style={{ background: 'rgba(242, 153, 74, 0.1)' }}>
                                <img src="/icons/Group 20.png" alt="Qty in Hand" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-inv-qty">{invQty}</h4>
                                <span>{t('quantityInHand')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/On the way.png" alt="To be received" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
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
                                <img src="/icons/Purchase bag.png" alt="Purchase" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-count">{purCount}</h4>
                                <span>{t('purchase')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(39, 174, 96, 0.1)' }}>
                                <img src="/icons/Cost (1).png" alt="Cost" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cost">{currency}{purCost.toFixed(0)}</h4>
                                <span>{t('cost')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Group 33.png" alt="Cancel" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cancelled">{purCancelled}</h4>
                                <span>{t('cancel')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(242, 153, 74, 0.1)' }}>
                                <img src="/icons/Group 34.png" alt="Return" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
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
                                <img src="/icons/Vector.png" alt="Suppliers" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
                            </div>
                            <div className="sub-metric-info">
                                <h4 id="dash-prod-suppliers">{state.suppliers.length}</h4>
                                <span>{t('numberOfSuppliers')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ background: 'rgba(160, 132, 220, 0.1)' }}>
                                <img src="/icons/Categories.png" alt="Categories" style={{ width: '22px', height: '22px', objectFit: 'contain' }} />
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
