import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatProductDisplayName } from '../../utils/productUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function ReportsView() {
    const { state, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || 'EGP';

    // Time filter state: 'today', 'week', 'month', 'all'
    const [timeFilter, setTimeFilter] = useState('month');
    const [prodPage, setProdPage] = useState(1);
    const [hoveredDayIdx, setHoveredDayIdx] = useState(6);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [isProdModalOpen, setIsProdModalOpen] = useState(false);

    // Helper date matcher
    const isDateInPeriod = (dateStr, period) => {
        if (!dateStr) return false;
        if (period === 'all') return true;

        try {
            const orderDate = new Date(dateStr);
            orderDate.setHours(0, 0, 0, 0);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffDays = (today - orderDate) / (1000 * 60 * 60 * 24);

            if (period === 'today') return diffDays === 0;
            if (period === 'week') return diffDays >= 0 && diffDays < 7;
            if (period === 'month') return diffDays >= 0 && diffDays < 30;
        } catch (e) {
            return false;
        }
        return true;
    };

    // Calculate last 7 days for the interactive trend chart
    const getDaysList = () => {
        const list = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            list.push(getLocalDateString(d));
        }
        return list;
    };
    const last7Days = getDaysList();

    // Calculate order profit with pro-rata discount consideration
    const getOrderProfitDetails = (ord) => {
        let grossValue = 0;
        let cogs = 0;

        (ord.items || []).forEach(item => {
            const rawPrice = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 1;
            grossValue += rawPrice * qty;

            let itemCost = item.costAtTimeOfSale || 0;
            if (!itemCost) {
                state.products.forEach(p => {
                    let vr = (p.variants || []).find(v => v.sku === item.variantSku);
                    if (vr) itemCost = vr.averageCost || vr.wholesalePrice || 0;
                });
            }
            cogs += qty * itemCost;
        });

        const discount = parseFloat(ord.discount_value) || 0;
        const netRevenue = Math.max(0, ord.totalValue || (grossValue - discount));
        const netProfit = netRevenue - cogs;

        return { grossValue, discount, cogs, netRevenue, netProfit };
    };

    // 1. Overall Metrics Calculation according to timeFilter
    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalNetRevenue = 0;
    let totalCOGS = 0;
    let totalOrdersCount = 0;

    (state.orders || []).forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            totalOrdersCount++;
            const details = getOrderProfitDetails(ord);
            totalGrossSales += details.grossValue;
            totalDiscounts += details.discount;
            totalNetRevenue += details.netRevenue;
            totalCOGS += details.cogs;
        }
    });

    // Calculate Waste Cost for the period
    let totalWasteCost = 0;
    (state.wastes || []).forEach(w => {
        if (!isDateInPeriod(w.date, timeFilter)) return;
        totalWasteCost += (w.totalCost || w.cost || ((w.quantity || 1) * (w.unitCost || w.costPrice || 0)) || 0);
    });

    const netRealizedProfit = totalNetRevenue - totalCOGS - totalWasteCost;
    const profitMarginPercent = totalNetRevenue > 0 ? ((netRealizedProfit / totalNetRevenue) * 100).toFixed(1) : '0.0';

    // 2. Chart Data (Last 7 Days)
    const chartRawData = last7Days.map(dateStr => {
        let dayRevenue = 0;
        let dayProfit = 0;
        let dayOrders = 0;

        (state.orders || []).forEach(ord => {
            if (ord.date === dateStr && ord.status !== 'Cancelled' && ord.status !== 'Draft') {
                dayOrders++;
                const details = getOrderProfitDetails(ord);
                dayRevenue += details.netRevenue;
                dayProfit += details.netProfit;
            }
        });
        return { dateStr, dayRevenue, dayProfit, dayOrders };
    });

    const graphWidth = 920;
    const graphHeight = 160;
    const paddingX = 40;
    const paddingY = 30;
    const spacingX = graphWidth / (last7Days.length - 1);

    const maxRev = Math.max(...chartRawData.map(d => d.dayRevenue));
    const maxProf = Math.max(...chartRawData.map(d => d.dayProfit));
    const maxVal = Math.max(100, maxRev, maxProf);
    const scaleMax = Math.ceil(maxVal / 100) * 100;

    const chartNodes = chartRawData.map((d, idx) => {
        const x = paddingX + idx * spacingX;
        const revY = paddingY + graphHeight - (d.dayRevenue / scaleMax) * graphHeight;
        const profY = paddingY + graphHeight - (Math.max(0, d.dayProfit) / scaleMax) * graphHeight;
        const parts = d.dateStr.split('-');
        const name = `${parts[1]}/${parts[2]}`;

        return {
            name,
            x,
            revY,
            profY,
            revenue: d.dayRevenue,
            profit: d.dayProfit,
            orders: d.dayOrders
        };
    });

    const hoveredData = chartNodes[hoveredDayIdx] || chartNodes[chartNodes.length - 1];

    // SVG Line paths
    const revLinePath = chartNodes.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.revY}`).join(' ');
    const profLinePath = chartNodes.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.profY}`).join(' ');

    const revAreaPath = `${revLinePath} L ${chartNodes[chartNodes.length - 1].x} ${paddingY + graphHeight} L ${chartNodes[0].x} ${paddingY + graphHeight} Z`;
    const profAreaPath = `${profLinePath} L ${chartNodes[chartNodes.length - 1].x} ${paddingY + graphHeight} L ${chartNodes[0].x} ${paddingY + graphHeight} Z`;

    // 3. Category Breakdown (Real Data)
    const categoryStats = {};
    (state.orders || []).forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            const ordDetails = getOrderProfitDetails(ord);
            const ordSubtotal = ordDetails.grossValue || 1;
            const ordDiscount = ordDetails.discount || 0;

            (ord.items || []).forEach(item => {
                const prod = (state.products || []).find(p => (p.variants || []).some(v => v.sku === item.variantSku));
                const catName = prod ? prod.category : 'عام';
                const itemRawTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                const itemNetShare = Math.max(0, itemRawTotal - ((itemRawTotal / ordSubtotal) * ordDiscount));

                if (!categoryStats[catName]) {
                    categoryStats[catName] = { name: catName, revenue: 0, itemsSold: 0 };
                }
                categoryStats[catName].revenue += itemNetShare;
                categoryStats[catName].itemsSold += parseInt(item.quantity) || 1;
            });
        }
    });

    const sortedCategories = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);

    // 4. Product Profitability Breakdown (Real Data)
    const productStats = {};
    (state.orders || []).forEach(ord => {
        if (ord.status !== 'Cancelled' && ord.status !== 'Draft') {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            const ordDetails = getOrderProfitDetails(ord);
            const ordSubtotal = ordDetails.grossValue || 1;
            const ordDiscount = ordDetails.discount || 0;

            (ord.items || []).forEach(item => {
                const sku = item.variantSku;
                let prodName = sku;
                let catName = 'عام';
                let unitCost = item.costAtTimeOfSale || 0;

                state.products.forEach(p => {
                    const vr = (p.variants || []).find(v => v.sku === sku);
                    if (vr) {
                        prodName = formatProductDisplayName(p.name, vr.name);
                        catName = p.category;
                        if (!unitCost) unitCost = vr.averageCost || vr.wholesalePrice || 0;
                    }
                });

                const qty = parseInt(item.quantity) || 1;
                const itemRawTotal = (parseFloat(item.price) || 0) * qty;
                const itemNetRevenue = Math.max(0, itemRawTotal - ((itemRawTotal / ordSubtotal) * ordDiscount));
                const itemCOGS = qty * unitCost;
                const itemProfit = itemNetRevenue - itemCOGS;

                if (!productStats[sku]) {
                    productStats[sku] = {
                        sku,
                        name: prodName,
                        category: catName,
                        qtySold: 0,
                        netRevenue: 0,
                        cogs: 0,
                        netProfit: 0
                    };
                }
                productStats[sku].qtySold += qty;
                productStats[sku].netRevenue += itemNetRevenue;
                productStats[sku].cogs += itemCOGS;
                productStats[sku].netProfit += itemProfit;
            });
        }
    });

    const sortedProducts = Object.values(productStats).map(p => {
        const marginPct = p.netRevenue > 0 ? ((p.netProfit / p.netRevenue) * 100).toFixed(1) : '0.0';
        return { ...p, marginPct: parseFloat(marginPct) };
    }).sort((a, b) => b.netProfit - a.netProfit);

    return (
        <div id="reports-view" className="view-pane active">
            
            {/* View Header Bar */}
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div className="page-title-group">
                    <h2>{t('reports')} والتحليلات المالية المستهدفة</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        تحليل صافي أرباح المتجر بعد خصم التكلفة، الهالك، وتوزيع الخصومات نسبياً
                    </p>
                </div>

                {/* Time Range Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', background: 'var(--glass-bg)', padding: '4px 6px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--glass-border)' }}>
                    {[
                        { id: 'today', label: 'اليوم' },
                        { id: 'week', label: 'هذا الأسبوع' },
                        { id: 'month', label: 'هذا الشهر' },
                        { id: 'all', label: 'كل الأوقات' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => { setTimeFilter(btn.id); setProdPage(1); }}
                            className={`btn ${timeFilter === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                                padding: '6px 14px',
                                fontSize: '0.82rem',
                                borderRadius: 'var(--radius-lg)'
                            }}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Financial Metrics Cards Grid - Executive Ambient Glow (Theme Compatible) */}
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                
                {/* Net Realized Profit */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(46, 213, 115, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(46, 213, 115, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(46, 213, 115, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        صافي الأرباح الحقيقية
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-success)', letterSpacing: '-0.5px' }}>
                        {currency} {netRealizedProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>هامش الربح</span>
                        <span className={`badge ${parseFloat(profitMarginPercent) >= 20 ? 'badge-success' : 'badge-warning'}`}>
                            {profitMarginPercent}%
                        </span>
                    </div>
                </div>

                {/* Gross Sales */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(212, 175, 55, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(212, 175, 55, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        إجمالي المبيعات قبل الخصم
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gold-primary)', letterSpacing: '-0.5px' }}>
                        {currency} {totalGrossSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>الأوردرات الناجحة</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{totalOrdersCount} أوردر</span>
                    </div>
                </div>

                {/* Total Discounts */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(30, 144, 255, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(30, 144, 255, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(30, 144, 255, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        إجمالي الخصومات المطبقة
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-info)', letterSpacing: '-0.5px' }}>
                        {currency} {totalDiscounts.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>التوزيع</span>
                        <span style={{ color: 'var(--text-secondary)' }}>موزعة نسبياً</span>
                    </div>
                </div>

                {/* COGS */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(160, 132, 220, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(160, 132, 220, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(160, 132, 220, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        تكلفة المباع (COGS)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a084dc', letterSpacing: '-0.5px' }}>
                        {currency} {totalCOGS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>المخزون</span>
                        <span style={{ color: 'var(--text-secondary)' }}>التكلفة الفعلية</span>
                    </div>
                </div>

                {/* Waste Loss */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 71, 87, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(255, 71, 87, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(255, 71, 87, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        خسائر الهالك والتالف
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-danger)', letterSpacing: '-0.5px' }}>
                        {currency} {totalWasteCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>الربحية</span>
                        <span style={{ color: 'var(--color-danger)' }}>مخصومة بالكامل</span>
                    </div>
                </div>

            </div>

            {/* Middle Section: Chart & Categories */}
            <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '20px', marginBottom: '24px' }}>
                
                {/* Interactive Dual-Curve SVG Chart */}
                <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                حركة المبيعات وصافي الأرباح اليومية (آخر 7 أيام)
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>مرر المؤشر فوق النودز لعرض التفاصيل اليومية</span>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                        <svg viewBox="0 0 1000 220" width="100%" height="100%" style={{ overflow: 'visible' }}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1e90ff" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#1e90ff" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2ed573" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#2ed573" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Grid lines */}
                            <line x1="40" y1="30" x2="960" y2="30" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="85" x2="960" y2="85" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="140" x2="960" y2="140" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="195" x2="960" y2="195" stroke="var(--glass-border-hover)" strokeWidth="1.5" />

                            {/* Area Gradient Fills */}
                            <path d={revAreaPath} fill="url(#revGrad)" />
                            <path d={profAreaPath} fill="url(#profGrad)" />

                            {/* Revenue Line */}
                            <path d={revLinePath} fill="none" stroke="var(--color-info)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Profit Line */}
                            <path d={profLinePath} fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Active Hover Guide Line & Circles */}
                            {hoveredDayIdx !== null && chartNodes[hoveredDayIdx] && (
                                <>
                                    <line
                                        x1={chartNodes[hoveredDayIdx].x}
                                        y1={30}
                                        x2={chartNodes[hoveredDayIdx].x}
                                        y2={195}
                                        stroke="var(--gold-primary)"
                                        strokeWidth="1.5"
                                        strokeDasharray="4 4"
                                    />
                                    <circle cx={chartNodes[hoveredDayIdx].x} cy={chartNodes[hoveredDayIdx].revY} r="6" fill="var(--color-info)" stroke="#fff" strokeWidth="2.5" />
                                    <circle cx={chartNodes[hoveredDayIdx].x} cy={chartNodes[hoveredDayIdx].profY} r="6" fill="var(--color-success)" stroke="#fff" strokeWidth="2.5" />
                                </>
                            )}

                            {/* X-Axis Day Labels & Hover Hotspots */}
                            {chartNodes.map((m, idx) => (
                                <g key={`chart-col-${idx}`}>
                                    <text
                                        x={m.x}
                                        y="215"
                                        fill={hoveredDayIdx === idx ? "var(--gold-primary)" : "var(--text-muted)"}
                                        fontSize="11"
                                        fontWeight={hoveredDayIdx === idx ? "700" : "400"}
                                        textAnchor="middle"
                                    >
                                        {m.name}
                                    </text>
                                    <rect
                                        x={m.x - 65}
                                        y="30"
                                        width="130"
                                        height="165"
                                        fill="transparent"
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredDayIdx(idx)}
                                    />
                                </g>
                            ))}
                        </svg>

                        {/* Glassmorphism Dynamic Floating Tooltip */}
                        {hoveredData && (
                            <div style={{
                                position: 'absolute',
                                left: `${(hoveredData.x / 1000) * 100}%`,
                                top: '12px',
                                transform: 'translateX(-50%)',
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--gold-border-focus)',
                                borderRadius: 'var(--radius-xl)',
                                padding: '10px 14px',
                                fontSize: '12px',
                                pointerEvents: 'none',
                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                                zIndex: 10,
                                backdropFilter: 'var(--blur)',
                                transition: 'left 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
                            }}>
                                <div style={{ color: 'var(--gold-primary)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    تاريخ: {hoveredData.name} ({hoveredData.orders} أوردر)
                                </div>
                                <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                                    <span style={{ color: 'var(--color-info)' }}>صافي الإيراد:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{currency} {hoveredData.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--color-success)' }}>صافي الربح:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{currency} {hoveredData.profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chart Color Legends */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '16px', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-info)' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-info)' }}></span>
                            صافي الإيرادات
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                            صافي الربح
                        </div>
                    </div>
                </div>

                {/* Category Performance Breakdown */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            مبيعات الأقسام
                        </h3>
                        {sortedCategories.length > 4 && (
                            <button onClick={() => setIsCatModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
                                عرض الكل
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sortedCategories.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                لا توجد مبيعات مسجلة في هذه الفترة
                            </div>
                        ) : (
                            sortedCategories.slice(0, 5).map((cat, idx) => {
                                const catPct = totalNetRevenue > 0 ? ((cat.revenue / totalNetRevenue) * 100).toFixed(1) : 0;
                                return (
                                    <div key={`cat-row-${idx}`} style={{ background: 'var(--glass-bg)', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{cat.name}</span>
                                            <span style={{ fontWeight: '700', color: 'var(--gold-primary)' }}>{currency} {cat.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>الكمية المباعة: {cat.itemsSold} قطعة</span>
                                            <span>الحصة: {catPct}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Bottom Table: Real Product Profitability Breakdown */}
            {(() => {
                const top50Products = sortedProducts.slice(0, 50);
                const itemsPerPage = 5;
                const totalProdPages = Math.ceil(top50Products.length / itemsPerPage) || 1;
                const currentPageProducts = top50Products.slice((prodPage - 1) * itemsPerPage, prodPage * itemsPerPage);

                return (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                    أعلى الأصناف والمنتجات ربحية (Product Profitability)
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    محسوبة بالصافي الفعلي لكل قطعة (عرض أعلى 50 صنفاً ربحية - 5 منتجات لكل صفحة)
                                </p>
                            </div>

                            {sortedProducts.length > 5 && (
                                <button onClick={() => setIsProdModalOpen(true)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
                                    عرض جميع المنتجات ({sortedProducts.length})
                                </button>
                            )}
                        </div>

                        <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                            <table className="custom-table" style={{ fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'right' }}>المنتج والصنف</th>
                                        <th style={{ textAlign: 'right' }}>رمز SKU</th>
                                        <th style={{ textAlign: 'right' }}>القسم</th>
                                        <th style={{ textAlign: 'center' }}>الكمية المباعة</th>
                                        <th style={{ textAlign: 'center' }}>صافي الإيراد</th>
                                        <th style={{ textAlign: 'center' }}>تكلفة المباع (COGS)</th>
                                        <th style={{ textAlign: 'center' }}>صافي الربح</th>
                                        <th style={{ textAlign: 'center' }}>نسبة الهامش</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentPageProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                                                لا توجد بيانات مبيعات مطابقة للفترة المحددة
                                            </td>
                                        </tr>
                                    ) : (
                                        currentPageProducts.map((prod, idx) => (
                                            <tr key={`prod-profit-${idx}`}>
                                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prod.name}</td>
                                                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{prod.sku}</td>
                                                <td>{prod.category}</td>
                                                <td style={{ textAlign: 'center', fontWeight: '700' }}>{prod.qtySold}</td>
                                                <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-info)' }}>
                                                    {currency} {prod.netRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center', color: '#a084dc' }}>
                                                    {currency} {prod.cogs.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: '700', color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {currency} {prod.netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`}>
                                                        {prod.marginPct}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination Controls */}
                        {top50Products.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    عرض <strong>{((prodPage - 1) * itemsPerPage) + 1} - {Math.min(prodPage * itemsPerPage, top50Products.length)}</strong> من أصل <strong>{top50Products.length}</strong> منتج أعلى ربحية
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setProdPage(prev => Math.max(1, prev - 1))}
                                        disabled={prodPage === 1}
                                        style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: prodPage === 1 ? 0.4 : 1, cursor: prodPage === 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        <i className="fa-solid fa-chevron-right"></i> السابق
                                    </button>

                                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--gold-primary)', padding: '0 8px' }}>
                                        {prodPage} / {totalProdPages}
                                    </span>

                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setProdPage(prev => Math.min(totalProdPages, prev + 1))}
                                        disabled={prodPage >= totalProdPages}
                                        style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: prodPage >= totalProdPages ? 0.4 : 1, cursor: prodPage >= totalProdPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        التالي <i className="fa-solid fa-chevron-left"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Modals for All Categories & All Products */}
            <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title="تقرير مبيعات الأقسام التفصيلي" width="600px">
                <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th>اسم القسم</th>
                                <th>الكمية المباعة</th>
                                <th style={{ textAlign: 'right' }}>صافي الإيراد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCategories.map((cat, idx) => (
                                <tr key={`mod-cat-${idx}`}>
                                    <td style={{ fontWeight: '600' }}>{cat.name}</td>
                                    <td>{cat.itemsSold} قطعة</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-primary)' }}>
                                        {currency} {cat.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

            <Modal isOpen={isProdModalOpen} onClose={() => setIsProdModalOpen(false)} title="ربحية جميع المنتجات والأصناف" width="1000px">
                <div className="table-wrapper" style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'right' }}>المنتج والصنف</th>
                                <th style={{ textAlign: 'right' }}>SKU</th>
                                <th style={{ textAlign: 'right' }}>القسم</th>
                                <th style={{ textAlign: 'center' }}>الكمية المباعة</th>
                                <th style={{ textAlign: 'center' }}>صافي الإيراد</th>
                                <th style={{ textAlign: 'center' }}>تكلفة المباع (COGS)</th>
                                <th style={{ textAlign: 'center' }}>صافي الربح</th>
                                <th style={{ textAlign: 'center' }}>نسبة الهامش</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map((prod, idx) => (
                                <tr key={`mod-prod-${idx}`}>
                                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prod.name}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{prod.sku}</td>
                                    <td>{prod.category}</td>
                                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{prod.qtySold}</td>
                                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-info)' }}>
                                        {currency} {prod.netRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#a084dc' }}>
                                        {currency} {prod.cogs.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '700', color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {currency} {prod.netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`}>
                                            {prod.marginPct}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

        </div>
    );
}
