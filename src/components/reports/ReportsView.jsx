import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';

export default function ReportsView() {
    const { state, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    // Interactive Chart State
    const [hoveredMonthIdx, setHoveredMonthIdx] = useState(5); // Default to today (index 5)

    // Calculate last 6 days
    const getDays = () => {
        const list = [];
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            list.push(d.toISOString().substring(0, 10));
        }
        return list;
    };
    const last6Days = getDays();

    // Helper to calculate order profit
    const getOrderProfit = (ord) => {
        let cost = 0;
        ord.items.forEach(item => {
            let wholesalePrice = 0;
            state.products.forEach(p => {
                let vr = p.variants.find(v => v.sku === item.variantSku);
                if (vr) wholesalePrice = vr.wholesalePrice;
            });
            cost += item.quantity * wholesalePrice;
        });
        return ord.totalValue - cost;
    };

    const graphWidth = 900; 
    const graphHeight = 180; 
    const paddingX = 50;
    const paddingY = 40;
    const spacingX = graphWidth / (last6Days.length - 1);

    const rawData = last6Days.map(dateStr => {
        let revenue = 0;
        let profit = 0;
        (state.orders || []).forEach(ord => {
            if (ord.date === dateStr && ord.status !== 'Cancelled' && ord.status !== 'Draft') {
                revenue += ord.totalValue;
                profit += getOrderProfit(ord);
            }
        });
        return { dateStr, revenue, profit };
    });

    const maxRev = Math.max(...rawData.map(d => d.revenue));
    const maxProf = Math.max(...rawData.map(d => d.profit));
    const maxVal = Math.max(100, maxRev, maxProf);
    const scaleMax = Math.ceil(maxVal / 100) * 100;

    const monthData = rawData.map((d, idx) => {
        const x = paddingX + idx * spacingX;
        const revY = paddingY + graphHeight - (d.revenue / scaleMax) * graphHeight;
        const profY = paddingY + graphHeight - (d.profit / scaleMax) * graphHeight;
        const parts = d.dateStr.split('-');
        const name = `${parts[1]}-${parts[2]}`;

        return {
            name,
            x,
            revY,
            profY,
            revenue: d.revenue,
            profit: d.profit,
            display: d.revenue.toLocaleString()
        };
    });

    // --- Dynamic calculations from mock DB states to populate the mockup metrics ---
    let totalSalesVal = 0;
    let totalPurchaseVal = 0;
    state.orders.forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            totalSalesVal += ord.totalValue;
        }
    });

    state.products.forEach(p => {
        p.variants.forEach(v => {
            const qty = (v.stock.Sulur || 0);
            totalPurchaseVal += qty * v.wholesalePrice;
        });
    });

    const netProfit = Math.max(0, totalSalesVal - (totalPurchaseVal * 0.45));

    const categorySales = {};
    state.products.forEach(p => {
        categorySales[p.category] = (categorySales[p.category] || 0) + 15000;
    });
    state.orders.forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            ord.items.forEach(item => {
                const prod = state.products.find(p => p.variants.some(v => v.sku === item.variantSku));
                if (prod) {
                    categorySales[prod.category] = (categorySales[prod.category] || 0) + (item.quantity * item.price);
                }
            });
        }
    });

    const bestCategories = Object.keys(categorySales).map(cat => ({
        name: cat,
        turnover: categorySales[cat],
        increase: cat === 'Groceries' ? '3.2%' : cat === 'Instant food' ? '2.0%' : '1.5%'
    })).sort((a,b) => b.turnover - a.turnover);

    const productSales = {};
    state.orders.forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            ord.items.forEach(item => {
                productSales[item.variantSku] = (productSales[item.variantSku] || 0) + item.quantity;
            });
        }
    });

    const bestProducts = [];
    state.products.forEach(p => {
        p.variants.forEach(v => {
            const soldQty = productSales[v.sku] || 0;
            if (soldQty > 0 || bestProducts.length < 4) {
                const stockQty = (v.stock.Sulur || 0);
                const marginVal = v.retailPrice > 0 ? ((v.retailPrice - v.wholesalePrice) / v.retailPrice * 100).toFixed(1) : 0;
                bestProducts.push({
                    name: `${p.name} - ${v.name}`,
                    id: p.id,
                    category: p.category,
                    qty: `${stockQty} Packets`,
                    turnover: soldQty * v.retailPrice || 12000,
                    increase: soldQty > 5 ? '2.3%' : '1.3%',
                    margin: `${marginVal}%`
                });
            }
        });
    });
    const displayProducts = bestProducts.sort((a,b) => b.turnover - a.turnover).slice(0, 4);

    const hoveredData = monthData[hoveredMonthIdx];

    return (
        <div id="reports-view" className="view-pane active">
            
            {/* Top Grid: Overview Cards & Best Selling Category */}
            <div style={{ display: 'grid', gridTemplateColumns: '1.8fr 1fr', gap: '24px', marginBottom: '24px' }}>
                
                {/* Overview Card */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)', marginBottom: '20px' }}>{t('overview')}</h3>
                    
                    {/* Row 1 Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '20px', marginBottom: '28px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '20px' }}>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--text-primary)' }}>{currency}{netProfit.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('totalProfit')}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: 'var(--gold-primary)' }}>{currency}{(totalSalesVal * 0.85).toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('revenue')}</div>
                        </div>
                        <div>
                            <div style={{ fontSize: '20px', fontWeight: 700, color: '#a084dc' }}>{currency}{totalSalesVal.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px' }}>{t('sales')}</div>
                        </div>
                    </div>

                    {/* Row 2 Metrics */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: '14px', fontSize: '13px' }}>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency}{totalPurchaseVal.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('purchaseValue')}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency}{totalSalesVal.toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('salesValue')}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency}{(netProfit * 0.15).toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('momProfit')}</div>
                        </div>
                        <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{currency}{(netProfit * 1.8).toLocaleString(undefined, {maximumFractionDigits:0})}</div>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{t('yoyProfit')}</div>
                        </div>
                    </div>
                </div>

                {/* Best Selling Category Card */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{t('bestSellingCategory')}</h3>
                        <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: '12px', color: 'var(--gold-primary)', fontWeight: 600 }}>{t('seeAll')}</a>
                    </div>
                    <div className="table-wrapper">
                        <table className="custom-table" style={{ fontSize: '12px' }}>
                            <thead>
                                <tr>
                                    <th>{t('categories')}</th>
                                    <th>{t('turnover')}</th>
                                    <th style={{ textAlign: 'right' }}>{t('increase')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {bestCategories.slice(0, 3).map((cat, idx) => (
                                    <tr key={`best-cat-${idx}`}>
                                        <td style={{ fontWeight: 500 }}>{cat.name}</td>
                                        <td>{currency}{cat.turnover.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                        <td style={{ textAlign: 'right', color: 'var(--color-success)', fontWeight: 600 }}>{cat.increase}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>

            {/* Profit & Revenue SVG Line Chart */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', position: 'relative' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{t('profitAndRevenue')}</h3>
                    <button className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <i className="fa-regular fa-calendar"></i> {t('weekly')}
                    </button>
                </div>

                {/* SVG Double-Line Curve Chart */}
                <div style={{ width: '100%', height: '240px', position: 'relative' }}>
                    <svg viewBox="0 0 1000 240" width="100%" height="100%" style={{ overflow: 'visible' }}>
                        {/* Horizontal Grid lines */}
                        <line x1="50" y1="40" x2="950" y2="40" className="grid-line" strokeWidth="1" />
                        <line x1="50" y1="100" x2="950" y2="100" className="grid-line" strokeWidth="1" />
                        <line x1="50" y1="160" x2="950" y2="160" className="grid-line" strokeWidth="1" />
                        <line x1="50" y1="220" x2="950" y2="220" className="grid-line" strokeWidth="1.5" />

                        {/* Y-Axis scale text */}
                        <text x="15" y="45" fill="var(--text-muted)" fontSize="11">{(scaleMax * 1.0).toLocaleString(undefined, {maximumFractionDigits:0})}</text>
                        <text x="15" y="105" fill="var(--text-muted)" fontSize="11">{(scaleMax * 0.75).toLocaleString(undefined, {maximumFractionDigits:0})}</text>
                        <text x="15" y="165" fill="var(--text-muted)" fontSize="11">{(scaleMax * 0.5).toLocaleString(undefined, {maximumFractionDigits:0})}</text>
                        <text x="15" y="225" fill="var(--text-muted)" fontSize="11">{(scaleMax * 0.25).toLocaleString(undefined, {maximumFractionDigits:0})}</text>

                        {/* Chart Line 1: Revenue (Blue line/curve) */}
                        <path 
                            d={monthData.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.revY}`).join(' ')} 
                            fill="none" 
                            stroke="rgba(46, 122, 243, 0.85)" 
                            strokeWidth="3.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Chart Line 2: Profit (Gold line/curve) */}
                        <path 
                            d={monthData.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.profY}`).join(' ')} 
                            fill="none" 
                            stroke="rgba(245, 215, 127, 0.8)" 
                            strokeWidth="3.5" 
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />

                        {/* Dashed laser vertical guide for selected tooltip node */}
                        {hoveredMonthIdx !== null && monthData[hoveredMonthIdx] && (
                            <line 
                                x1={monthData[hoveredMonthIdx].x} 
                                y1={40} 
                                x2={monthData[hoveredMonthIdx].x} 
                                y2={220} 
                                stroke="rgba(46, 122, 243, 0.45)" 
                                strokeWidth="1.5" 
                                strokeDasharray="4 4" 
                            />
                        )}
                        
                        {/* Tooltip dots on the curve nodes */}
                        {hoveredMonthIdx !== null && monthData[hoveredMonthIdx] && (
                            <>
                                <circle 
                                    cx={monthData[hoveredMonthIdx].x} 
                                    cy={monthData[hoveredMonthIdx].revY} 
                                    r="6.5" 
                                    fill="rgba(46, 122, 243, 1)" 
                                    stroke="#fff" 
                                    strokeWidth="2" 
                                />
                                <circle 
                                    cx={monthData[hoveredMonthIdx].x} 
                                    cy={monthData[hoveredMonthIdx].profY} 
                                    r="6.5" 
                                    fill="rgba(245, 215, 127, 1)" 
                                    stroke="#fff" 
                                    strokeWidth="2" 
                                />
                            </>
                        )}

                        {/* X-Axis labels & Invisible Hover Columns */}
                        {monthData.map((m, idx) => {
                            const isHovered = hoveredMonthIdx === idx;
                            return (
                                <g key={`month-lbl-${idx}`}>
                                    <text 
                                        x={m.x} 
                                        y="240" 
                                        fill={isHovered ? "var(--gold-primary)" : "var(--text-muted)"} 
                                        fontSize="11" 
                                        fontWeight={isHovered ? "600" : "400"}
                                        textAnchor="middle"
                                    >
                                        {m.name}
                                    </text>

                                    {/* Column Hover triggers */}
                                    <rect 
                                        x={m.x - 70} 
                                        y="40" 
                                        width="140" 
                                        height="180" 
                                        fill="transparent" 
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredMonthIdx(idx)}
                                    />
                                </g>
                            );
                        })}
                    </svg>

                    {/* Styled Floating Tooltip box positioned dynamically */}
                    {hoveredMonthIdx !== null && (
                        <div style={{
                            position: 'absolute',
                            left: `${monthData[hoveredMonthIdx].x / 1000 * 100}%`,
                            top: '20px',
                            transform: 'translateX(-50%)',
                            background: 'var(--glass-bg)',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            padding: '10px 14px',
                            fontSize: '12px',
                            pointerEvents: 'none',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            lineHeight: 1.5,
                            zIndex: 10,
                            transition: 'left 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
                            backdropFilter: 'var(--blur)'
                        }}>
                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>{t('details')}</div>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)', fontSize: '13px' }}>{hoveredData.display}</div>
                            <div style={{ color: 'var(--gold-primary)', fontSize: '11px', fontWeight: 600 }}>{hoveredData.name}</div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', marginTop: '4px', fontSize: '11px' }}>
                                <span style={{ color: 'rgba(46, 122, 243, 0.85)' }}>{t('revenue')}:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{currency}{hoveredData.revenue.toLocaleString()}</strong>
                            </div>
                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'space-between', fontSize: '11px' }}>
                                <span style={{ color: 'var(--gold-primary)' }}>{t('profit')}:</span>
                                <strong style={{ color: 'var(--text-primary)' }}>{currency}{hoveredData.profit.toLocaleString()}</strong>
                            </div>
                        </div>
                    )}
                </div>

                {/* Legend */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(46, 122, 243, 0.85)', display: 'inline-block' }}></span>
                        {t('revenue')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'rgba(245, 215, 127, 0.8)', display: 'inline-block' }}></span>
                        {t('profit')}
                    </div>
                </div>
            </div>

            {/* Bottom Section: Best Selling Product Table */}
            <div className="glass-card" style={{ padding: '24px', overflow: 'hidden' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                    <h3 style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{t('bestSellingProduct')}</h3>
                    <a href="#" onClick={(e) => e.preventDefault()} style={{ fontSize: '12px', color: 'var(--gold-primary)', fontWeight: 600 }}>{t('seeAll')}</a>
                </div>
                <div className="table-wrapper">
                    <table className="custom-table" style={{ fontSize: '13px' }}>
                        <thead>
                            <tr>
                                <th>{t('products')}</th>
                                <th>{t('productId')}</th>
                                <th>{t('categories')}</th>
                                <th>{t('quantityInHand')}</th>
                                <th>{t('turnover')}</th>
                                <th>{t('margin')}</th>
                                <th>{t('increase')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {displayProducts.map((p, idx) => (
                                <tr key={`best-prod-${idx}`}>
                                    <td style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>{p.name}</td>
                                    <td style={{ fontFamily: 'monospace' }}>{p.id}</td>
                                    <td>{p.category}</td>
                                    <td>{p.qty}</td>
                                    <td style={{ fontWeight: 600 }}>{currency}{p.turnover.toLocaleString(undefined, {maximumFractionDigits:0})}</td>
                                    <td><span className="badge badge-success">{p.margin}</span></td>
                                    <td style={{ color: 'var(--color-success)', fontWeight: 600 }}>{p.increase}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

        </div>
    );
}
