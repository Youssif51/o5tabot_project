import React, { useState, useContext } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
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


export default function ChartsSection({ timeFilter = 'all' }) {
    const { state, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    // Calculate last 6 days with activity, or fallback to calendar days
    const getDays = () => {
        const dates = new Set();
        (state.orders || []).forEach(o => {
            if (o.date && isDateInPeriod(o.date, timeFilter)) dates.add(o.date);
        });
        (state.purchaseOrders || []).forEach(po => {
            if (po.date && isDateInPeriod(po.date, timeFilter)) dates.add(po.date);
        });

        let sortedActiveDates = Array.from(dates).sort((a, b) => new Date(a) - new Date(b));

        if (timeFilter === 'today') {
            return [getLocalDateString()];
        }

        const today = new Date();
        const limitDays = timeFilter === 'week' ? 7 : (timeFilter === 'month' ? 30 : 365);
        for (let i = 0; i < limitDays; i++) {
            if (sortedActiveDates.length >= 6) break;
            const dStr = getLocalDateString(today);
            if (!sortedActiveDates.includes(dStr)) {
                sortedActiveDates.unshift(dStr);
            }
            today.setDate(today.getDate() - 1);
        }

        return sortedActiveDates.sort((a, b) => new Date(a) - new Date(b)).slice(-6);
    };
    const last6Days = getDays();
    
    // Labels for display format (MM-DD)
    const labels = last6Days.map(dStr => {
        const parts = dStr.split('-');
        return `${parts[1]}-${parts[2]}`;
    });

    // 1. Dynamic Sales & Purchase Chart Data
    const salesData = last6Days.map(dateStr => {
        let sum = 0;
        (state.orders || []).forEach(ord => {
            if (ord.date === dateStr && ord.status !== 'Cancelled' && ord.status !== 'Draft') {
                sum += ord.totalValue;
            }
        });
        return sum;
    });

    const purchaseData = last6Days.map(dateStr => {
        let sum = 0;
        (state.purchaseOrders || []).forEach(po => {
            if (po.date === dateStr) {
                sum += po.totalCost;
            }
        });
        return sum;
    });
    
    const svgWidth = 500;
    const svgHeight = 220;
    const paddingX = 40;
    const paddingY = 20;
    
    const graphWidth = svgWidth - paddingX * 2;
    const graphHeight = svgHeight - paddingY * 2;
    
    // Sales & Purchase Bar calculations
    const maxSales = Math.max(...salesData);
    const maxPurchases = Math.max(...purchaseData);
    const maxBar = Math.max(100, maxSales, maxPurchases);
    const maxValBar = Math.ceil(maxBar / 100) * 100;

    const barWidth = 12;
    const gap = 4;
    const groupWidth = barWidth * 2 + gap;
    const groupGap = labels.length > 1 ? (graphWidth - groupWidth * labels.length) / (labels.length - 1) : 0;

    const [hoveredBarIdx, setHoveredBarIdx] = useState(null);

    // 2. Order Summary Line Chart Data
    const orderedData = last6Days.map(dateStr => {
        return (state.orders || []).filter(ord => ord.date === dateStr && ord.status !== 'Cancelled').length;
    });

    const deliveredData = last6Days.map(dateStr => {
        return (state.orders || []).filter(ord => ord.date === dateStr && (ord.status === 'Completed' || ord.status === 'Partially Delivered')).length;
    });
    
    const maxOrdered = Math.max(...orderedData);
    const maxDelivered = Math.max(...deliveredData);
    const maxLine = Math.max(5, maxOrdered, maxDelivered);
    const maxValLine = Math.ceil(maxLine / 5) * 5;

    const spacingX = labels.length > 1 ? graphWidth / (labels.length - 1) : graphWidth;

    // Coordinate conversion
    const orderedCoords = labels.map((_, idx) => ({
        x: paddingX + idx * spacingX,
        y: paddingY + graphHeight - (orderedData[idx] / maxValLine) * graphHeight
    }));

    const deliveredCoords = labels.map((_, idx) => ({
        x: paddingX + idx * spacingX,
        y: paddingY + graphHeight - (deliveredData[idx] / maxValLine) * graphHeight
    }));

    const [hoveredLineIdx, setHoveredLineIdx] = useState(null);

    return (
        <div className="dashboard-row-grid grid-2-1" style={{ marginTop: '24px' }}>
            
            {/* Sales & Purchase Bar Chart */}
            <div className="glass-card dashboard-widget" style={{ position: 'relative' }}>
                <div className="widget-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3>{t('salesAndPurchase')}</h3>
                    <span className="badge badge-info" style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px' }}>
                        <i className="fa-regular fa-calendar"></i> {t('weekly')}
                    </span>
                </div>
                <div className="chart-container" style={{ minHeight: '240px', marginTop: '16px' }}>
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ direction: 'ltr' }}>
                        <defs>
                            <linearGradient id="sales-gradient-svg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#6FCF97" />
                                <stop offset="100%" stopColor="#27AE60" />
                            </linearGradient>
                            <linearGradient id="purchase-gradient-svg" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="0%" stopColor="#56CCF2" />
                                <stop offset="100%" stopColor="#2F80ED" />
                            </linearGradient>
                        </defs>
                        
                        {/* Grid lines */}
                        {[0, 1, 2, 3, 4].map((i) => {
                            const y = paddingY + (graphHeight / 4) * i;
                            const val = maxValBar - (maxValBar / 4) * i;
                            return (
                                <g key={`grid-bar-${i}`}>
                                    <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} className="grid-line" strokeDasharray="3" />
                                    <text x={paddingX - 8} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{val.toLocaleString()}</text>
                                </g>
                            );
                        })}
                        
                        {/* Bars & Labels */}
                        {labels.map((lbl, idx) => {
                            const groupX = paddingX + idx * (groupWidth + groupGap);
                            const sHeight = (salesData[idx] / maxValBar) * graphHeight;
                            const sY = paddingY + graphHeight - sHeight;
                            const pHeight = (purchaseData[idx] / maxValBar) * graphHeight;
                            const pY = paddingY + graphHeight - pHeight;

                            const isHovered = hoveredBarIdx === idx;
                            const hasActiveHover = hoveredBarIdx !== null;

                            return (
                                <g key={`bars-lbl-${idx}`}>
                                    {/* Sales Bar (Green) */}
                                    <rect 
                                        x={groupX} 
                                        y={sY} 
                                        width={barWidth} 
                                        height={sHeight} 
                                        fill="url(#sales-gradient-svg)" 
                                        rx="3" 
                                        opacity={hasActiveHover ? (isHovered ? 1 : 0.4) : 1}
                                        style={{ transition: 'opacity 0.2s ease, fill 0.2s ease' }}
                                    />
                                    {/* Purchase Bar (Blue) */}
                                    <rect 
                                        x={groupX + barWidth + gap} 
                                        y={pY} 
                                        width={barWidth} 
                                        height={pHeight} 
                                        fill="url(#purchase-gradient-svg)" 
                                        rx="3" 
                                        opacity={hasActiveHover ? (isHovered ? 1 : 0.4) : 1}
                                        style={{ transition: 'opacity 0.2s ease' }}
                                    />
                                    {/* Label */}
                                    <text 
                                        x={groupX + groupWidth / 2} 
                                        y={svgHeight - 4} 
                                        fill={isHovered ? "var(--gold-primary)" : "var(--text-secondary)"} 
                                        fontSize="10" 
                                        fontWeight={isHovered ? "600" : "400"}
                                        textAnchor="middle"
                                    >
                                        {lbl}
                                    </text>

                                    {/* Invisible Hover Rect overlay */}
                                    <rect 
                                        x={groupX - groupGap / 2} 
                                        y={paddingY} 
                                        width={groupWidth + groupGap} 
                                        height={graphHeight} 
                                        fill="transparent" 
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredBarIdx(idx)}
                                        onMouseLeave={() => setHoveredBarIdx(null)}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Legend keys */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', paddingBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(180deg, #56CCF2 0%, #2F80ED 100%)', display: 'inline-block' }}></span>
                        {t('purchase')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'linear-gradient(180deg, #6FCF97 0%, #27AE60 100%)', display: 'inline-block' }}></span>
                        {t('sales')}
                    </div>
                </div>

                {/* Floating Interactive Tooltip */}
                {hoveredBarIdx !== null && (
                    <div style={{
                        position: 'absolute',
                        left: `${(paddingX + hoveredBarIdx * (groupWidth + groupGap) + groupWidth/2) / svgWidth * 100}%`,
                        top: '60px',
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
                        backdropFilter: 'var(--blur)'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{labels[hoveredBarIdx]} {t('details')}</div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                            <span style={{ color: '#27AE60' }}>{t('sales')}:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{currency}{salesData[hoveredBarIdx].toLocaleString()}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                            <span style={{ color: '#2F80ED' }}>{t('purchase')}:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{currency}{purchaseData[hoveredBarIdx].toLocaleString()}</strong>
                        </div>
                    </div>
                )}
            </div>

            {/* Order Summary Line Chart */}
            <div className="glass-card dashboard-widget" style={{ position: 'relative' }}>
                <div className="widget-header">
                    <h3>{t('orderSummary')}</h3>
                </div>
                <div className="chart-container" style={{ minHeight: '240px', marginTop: '16px' }}>
                    <svg viewBox={`0 0 ${svgWidth} ${svgHeight}`} width="100%" height="100%" style={{ direction: 'ltr' }}>
                        {/* Grid lines */}
                        {[0, 1, 2, 3].map((i) => {
                            const y = paddingY + (graphHeight / 3) * i;
                            const val = maxValLine - (maxValLine / 3) * i;
                            return (
                                <g key={`grid-line-${i}`}>
                                    <line x1={paddingX} y1={y} x2={svgWidth - paddingX} y2={y} className="grid-line" strokeDasharray="3" />
                                    <text x={paddingX - 8} y={y + 4} fill="var(--text-muted)" fontSize="9" textAnchor="end">{Math.round(val)}</text>
                                </g>
                            );
                        })}

                        {/* Interactive vertical guide line */}
                        {hoveredLineIdx !== null && (
                            <line 
                                x1={orderedCoords[hoveredLineIdx].x} 
                                y1={paddingY} 
                                x2={orderedCoords[hoveredLineIdx].x} 
                                y2={paddingY + graphHeight} 
                                stroke="rgba(46, 122, 243, 0.4)" 
                                strokeWidth="1.5" 
                                strokeDasharray="4 4"
                            />
                        )}

                        {/* Line 1: Ordered (Orange/Brown) */}
                        <path 
                            d={`M ${orderedCoords.map(c => `${c.x} ${c.y}`).join(' L ')}`}
                            fill="none"
                            stroke="#D48C46"
                            strokeWidth="3"
                        />

                        {/* Line 2: Delivered (Blue) */}
                        <path 
                            d={`M ${deliveredCoords.map(c => `${c.x} ${c.y}`).join(' L ')}`}
                            fill="none"
                            stroke="#2F80ED"
                            strokeWidth="3"
                        />

                        {/* Interactive nodes */}
                        {labels.map((lbl, idx) => {
                            const isHovered = hoveredLineIdx === idx;
                            return (
                                <g key={`nodes-lbl-${idx}`}>
                                    {/* Ordered node */}
                                    <circle 
                                        cx={orderedCoords[idx].x} 
                                        cy={orderedCoords[idx].y} 
                                        r={isHovered ? 6 : 4} 
                                        fill="#D48C46" 
                                        stroke="#fff" 
                                        strokeWidth={isHovered ? 2 : 1}
                                        style={{ transition: 'r 0.15s ease' }}
                                    />
                                    {/* Delivered node */}
                                    <circle 
                                        cx={deliveredCoords[idx].x} 
                                        cy={deliveredCoords[idx].y} 
                                        r={isHovered ? 6 : 4} 
                                        fill="#2F80ED" 
                                        stroke="#fff" 
                                        strokeWidth={isHovered ? 2 : 1}
                                        style={{ transition: 'r 0.15s ease' }}
                                    />
                                    
                                    {/* X-Axis label */}
                                    <text 
                                        x={orderedCoords[idx].x} 
                                        y={svgHeight - 4} 
                                        fill={isHovered ? "var(--gold-primary)" : "var(--text-secondary)"} 
                                        fontSize="10" 
                                        fontWeight={isHovered ? "600" : "400"}
                                        textAnchor="middle"
                                    >
                                        {lbl}
                                    </text>

                                    {/* Invisible Hover column rect */}
                                    <rect 
                                        x={orderedCoords[idx].x - spacingX / 2} 
                                        y={paddingY} 
                                        width={spacingX} 
                                        height={graphHeight} 
                                        fill="transparent" 
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredLineIdx(idx)}
                                        onMouseLeave={() => setHoveredLineIdx(null)}
                                    />
                                </g>
                            );
                        })}
                    </svg>
                </div>

                {/* Legend keys */}
                <div style={{ display: 'flex', justifyContent: 'center', gap: '24px', marginTop: '12px', paddingBottom: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#D48C46', display: 'inline-block' }}></span>
                        {t('ordered')}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: '#2F80ED', display: 'inline-block' }}></span>
                        {t('completed')}
                    </div>
                </div>

                {/* Line Tooltip box */}
                {hoveredLineIdx !== null && (
                    <div style={{
                        position: 'absolute',
                        left: `${orderedCoords[hoveredLineIdx].x / svgWidth * 100}%`,
                        top: '60px',
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
                        backdropFilter: 'var(--blur)'
                    }}>
                        <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>{labels[hoveredLineIdx]} {t('details')}</div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--gold-primary)' }}>{t('ordered')}:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{orderedData[hoveredLineIdx]}</strong>
                        </div>
                        <div style={{ display: 'flex', gap: '12px', justifyContent: 'space-between' }}>
                            <span style={{ color: 'var(--color-success)' }}>{t('completed')}:</span>
                            <strong style={{ color: 'var(--text-primary)' }}>{deliveredData[hoveredLineIdx]}</strong>
                        </div>
                    </div>
                )}
            </div>

        </div>
    );
}
