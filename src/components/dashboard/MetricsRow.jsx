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
            const totalQty = (vr.stock.Sulur || 0) + (vr.stock.Singanallur || 0);
            invQty += totalQty;
            if (totalQty <= vr.reorderLimit) {
                invReceived += (vr.reorderLimit - totalQty + 10);
            }
        });
    });

    // 3. Purchase Overview calculations
    let purCount = state.suppliers.length * 2;
    let purCost = 0;
    state.suppliers.forEach(s => {
        purCost += (s.paid || 0) + (s.debt || 0);
    });
    let purCancelled = state.orders.filter(o => o.status === "Cancelled").length || 1;
    let purReturns = state.wastes.length || 0;

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
                            <div className="sub-metric-icon" style={{ color: 'var(--gold-primary)', background: 'rgba(212, 175, 55, 0.08)' }}><i className="fa-solid fa-cart-shopping"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-count">{salesCount}</h4>
                                <span>{t('sales')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-success)', background: 'var(--color-success-bg)' }}><i className="fa-solid fa-sack-dollar"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-revenue">{currency}{salesRevenue.toFixed(0)}</h4>
                                <span>{t('revenue')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--gold-light)', background: 'rgba(243, 229, 171, 0.08)' }}><i className="fa-solid fa-hand-holding-dollar"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-sales-profit">{currency}{salesProfit.toFixed(0)}</h4>
                                <span>{t('profit')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-info)', background: 'var(--color-info-bg)' }}><i className="fa-solid fa-file-invoice-dollar"></i></div>
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
                            <div className="sub-metric-icon" style={{ color: 'var(--gold-primary)', background: 'rgba(212, 175, 55, 0.08)' }}><i className="fa-solid fa-boxes-stacked"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-inv-qty">{invQty}</h4>
                                <span>{t('quantityInHand')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}><i className="fa-solid fa-truck-ramp-box"></i></div>
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
                            <div className="sub-metric-icon" style={{ color: 'var(--gold-primary)', background: 'rgba(212, 175, 55, 0.08)' }}><i className="fa-solid fa-basket-shopping"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-count">{purCount}</h4>
                                <span>{t('purchase')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-info)', background: 'var(--color-info-bg)' }}><i className="fa-solid fa-wallet"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cost">{currency}{purCost.toFixed(0)}</h4>
                                <span>{t('cost')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-danger)', background: 'var(--color-danger-bg)' }}><i className="fa-solid fa-rectangle-xmark"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-pur-cancelled">{purCancelled}</h4>
                                <span>{t('cancel')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--color-warning)', background: 'var(--color-warning-bg)' }}><i className="fa-solid fa-rotate-left"></i></div>
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
                            <div className="sub-metric-icon" style={{ color: 'var(--color-info)', background: 'var(--color-info-bg)' }}><i className="fa-solid fa-handshake"></i></div>
                            <div className="sub-metric-info">
                                <h4 id="dash-prod-suppliers">{state.suppliers.length}</h4>
                                <span>{t('numberOfSuppliers')}</span>
                            </div>
                        </div>
                        <div className="sub-metric-item">
                            <div className="sub-metric-icon" style={{ color: 'var(--gold-primary)', background: 'rgba(212, 175, 55, 0.08)' }}><i className="fa-solid fa-folder-tree"></i></div>
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
