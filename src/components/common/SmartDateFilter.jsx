import React from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { getArabicDateDisplay } from '../../utils/smartDateMatcher';

export default function SmartDateFilter({ filterConfig, setFilterConfig }) {
    const todayStr = getLocalDateString(new Date());

    // Normalize filterConfig object
    const currentConfig = typeof filterConfig === 'string' 
        ? { type: 'preset', preset: filterConfig, date: todayStr, startDate: '', endDate: '' } 
        : (filterConfig || { type: 'preset', preset: 'all', date: todayStr, startDate: '', endDate: '' });

    const activeType = currentConfig.type || 'preset';
    const activePreset = currentConfig.preset || 'all';
    const activeDate = currentConfig.date || todayStr;
    const startDate = currentConfig.startDate || '';
    const endDate = currentConfig.endDate || '';

    // Step Date Handler for Time Travel using UTC date math
    const stepSingleDate = (days) => {
        try {
            const baseStr = activeDate || todayStr;
            const [y, m, d] = baseStr.split('-').map(Number);
            const utcDate = new Date(Date.UTC(y, m - 1, d + days));
            const newY = utcDate.getUTCFullYear();
            const newM = String(utcDate.getUTCMonth() + 1).padStart(2, '0');
            const newD = String(utcDate.getUTCDate()).padStart(2, '0');
            const newDateStr = `${newY}-${newM}-${newD}`;

            setFilterConfig({
                type: 'single',
                date: newDateStr
            });
        } catch (e) {
            console.error('Error stepping single date:', e);
        }
    };

    return (
        <div style={{ 
            display: 'inline-flex', 
            flexDirection: 'column', 
            gap: '6px', 
            background: 'rgba(15, 18, 24, 0.7)', 
            border: '1px solid rgba(212, 175, 55, 0.25)', 
            borderRadius: '12px', 
            padding: '6px 12px',
            backdropFilter: 'blur(10px)',
            boxShadow: '0 4px 16px rgba(0,0,0,0.2)'
        }}>
            
            {/* Inline Mode Bar */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.74rem', fontWeight: '700', color: 'var(--gold-primary)' }}>
                    <i className="fa-solid fa-calendar-check" style={{ fontSize: '11px' }}></i>
                    <span>الفترة:</span>
                </div>

                {/* Mode Selector Buttons */}
                <div style={{ display: 'flex', alignItems: 'center', background: 'rgba(0,0,0,0.4)', padding: '2px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
                    <button
                        type="button"
                        onClick={() => setFilterConfig({ ...currentConfig, type: 'preset' })}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '6px', border: 'none', background: activeType === 'preset' ? 'var(--gold-primary)' : 'transparent', color: activeType === 'preset' ? '#000' : 'var(--text-secondary)', cursor: 'pointer' }}
                    >
                        جاهزة
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterConfig({ ...currentConfig, type: 'single', date: activeDate || todayStr })}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '6px', border: 'none', background: activeType === 'single' ? '#1e90ff' : 'transparent', color: activeType === 'single' ? '#fff' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                        <i className="fa-solid fa-clock-rotate-left" style={{ fontSize: '9px' }}></i> يوم محدد
                    </button>
                    <button
                        type="button"
                        onClick={() => setFilterConfig({ ...currentConfig, type: 'range', startDate: startDate || todayStr, endDate: endDate || todayStr })}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '6px', border: 'none', background: activeType === 'range' ? '#2ecc71' : 'transparent', color: activeType === 'range' ? '#000' : 'var(--text-secondary)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px' }}
                    >
                        <i className="fa-solid fa-calendar-days" style={{ fontSize: '9px' }}></i> نطاق
                    </button>
                </div>
            </div>

            {/* Mode 1: Quick Presets */}
            {activeType === 'preset' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    {[
                        { id: 'today', label: 'اليوم' },
                        { id: 'yesterday', label: 'أمس' },
                        { id: 'week', label: '7 أيام' },
                        { id: 'month', label: 'الشهر' },
                        { id: 'all', label: 'الكل' }
                    ].map(p => (
                        <button
                            key={p.id}
                            type="button"
                            onClick={() => setFilterConfig({ type: 'preset', preset: p.id })}
                            style={{
                                padding: '3px 9px',
                                fontSize: '0.72rem',
                                fontWeight: '700',
                                borderRadius: '6px',
                                border: activePreset === p.id ? '1px solid var(--gold-primary)' : '1px solid rgba(255,255,255,0.06)',
                                background: activePreset === p.id ? 'rgba(212, 175, 55, 0.18)' : 'rgba(255,255,255,0.02)',
                                color: activePreset === p.id ? 'var(--gold-primary)' : 'var(--text-secondary)',
                                cursor: 'pointer'
                            }}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Mode 2: Single Date Time-Travel Inspector */}
            {activeType === 'single' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                    <button
                        type="button"
                        onClick={() => stepSingleDate(-1)}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(30,144,255,0.4)', background: 'rgba(30,144,255,0.2)', color: '#1e90ff', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}
                        title="اليوم السابق"
                    >
                        <i className="fa-solid fa-chevron-right"></i> السابق
                    </button>

                    <span style={{ fontSize: '0.74rem', fontWeight: '800', color: '#1e90ff', background: 'rgba(30, 144, 255, 0.15)', padding: '2px 8px', borderRadius: '6px', border: '1px solid rgba(30,144,255,0.3)', whiteSpace: 'nowrap' }}>
                        {getArabicDateDisplay(activeDate)}
                    </span>

                    <input
                        type="date"
                        value={activeDate}
                        onChange={(e) => setFilterConfig({ type: 'single', date: e.target.value })}
                        style={{ background: 'rgba(0,0,0,0.6)', border: '1px solid rgba(30,144,255,0.5)', color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '0.74rem', outline: 'none' }}
                    />

                    <button
                        type="button"
                        onClick={() => stepSingleDate(1)}
                        style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: '700', borderRadius: '6px', border: '1px solid rgba(30,144,255,0.4)', background: 'rgba(30,144,255,0.2)', color: '#1e90ff', cursor: activeDate >= todayStr ? 'not-allowed' : 'pointer', opacity: activeDate >= todayStr ? 0.4 : 1, display: 'flex', alignItems: 'center', gap: '4px' }}
                        disabled={activeDate >= todayStr}
                        title="اليوم التالي"
                    >
                        التالي <i className="fa-solid fa-chevron-left"></i>
                    </button>

                    {activeDate !== todayStr && (
                        <button
                            type="button"
                            onClick={() => setFilterConfig({ type: 'single', date: todayStr })}
                            style={{ background: 'rgba(46, 204, 113, 0.2)', border: '1px solid rgba(46, 204, 113, 0.4)', color: '#2ecc71', padding: '2px 8px', borderRadius: '6px', fontSize: '0.7rem', fontWeight: '800', cursor: 'pointer' }}
                        >
                            اليوم 📍
                        </button>
                    )}
                </div>
            )}

            {/* Mode 3: Custom Range */}
            {activeType === 'range' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>من:</span>
                        <input
                            type="date"
                            value={startDate}
                            onChange={(e) => setFilterConfig({ ...currentConfig, type: 'range', startDate: e.target.value })}
                            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(46, 204, 113, 0.4)', color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '0.74rem', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                        <span>إلى:</span>
                        <input
                            type="date"
                            value={endDate}
                            onChange={(e) => setFilterConfig({ ...currentConfig, type: 'range', endDate: e.target.value })}
                            style={{ background: 'rgba(0,0,0,0.5)', border: '1px solid rgba(46, 204, 113, 0.4)', color: '#fff', padding: '2px 6px', borderRadius: '6px', fontSize: '0.74rem', outline: 'none' }}
                        />
                    </div>
                </div>
            )}

        </div>
    );
}
