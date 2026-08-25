import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { formatProductDisplayName, isDigitalProduct } from '../../utils/productUtils';
import { isDateMatchingFilter } from '../../utils/smartDateMatcher';
import Modal from '../common/Modal';

export default function TopSelling({ timeFilter = 'all' }) {
    const { state, isDeductedStatus, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || 'EGP';
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [sortBy, setSortBy] = useState('qty'); // 'qty' or 'value'
    const [filterScope, setFilterScope] = useState('sold'); // 'sold' or 'all'
    const [searchTerm, setSearchTerm] = useState('');
    const [modalPage, setModalPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    let variantSales = {};
    let variantRevenue = {};

    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord)) {
            if (!isDateMatchingFilter(ord.date, timeFilter)) return;
            (ord.items || []).forEach(item => {
                const sku = item.variantSku || item.variant_sku || item.sku;
                if (sku) {
                    const qty = parseInt(item.quantity) || 1;
                    const price = parseFloat(item.price) || 0;
                    variantSales[sku] = (variantSales[sku] || 0) + qty;
                    variantRevenue[sku] = (variantRevenue[sku] || 0) + (qty * price);
                }
            });
        }
    });

    let topSelling = [];
    (state.products || []).forEach(prod => {
        if (isDigitalProduct(prod) || prod.category === 'Uncategorized' || prod.category === 'غير مصنف' || !prod.category) return;
        (prod.variants || []).forEach(vr => {
            let sold = variantSales[vr.sku] || 0;
            let rev = variantRevenue[vr.sku] || 0;
            
            let remQty = 0;
            if (vr.stock && typeof vr.stock === 'object' && vr.stock.Sulur !== undefined) {
                remQty = parseInt(vr.stock.Sulur) || 0;
            } else if (vr.stock_sulur !== undefined) {
                remQty = parseInt(vr.stock_sulur) || 0;
            } else if (typeof vr.stock === 'number') {
                remQty = vr.stock;
            }

            topSelling.push({
                name: formatProductDisplayName(prod.name, vr.name),
                sku: vr.sku || '',
                soldQty: sold,
                revenue: rev,
                remainingQty: remQty,
                price: vr.retailPrice || (sold > 0 ? rev / sold : 0)
            });
        });
    });

    // Summary calculations for Quick Brief
    const soldItems = topSelling.filter(i => i.soldQty > 0);
    const totalSoldVolume = soldItems.reduce((acc, curr) => acc + curr.soldQty, 0);
    const totalRevenueSum = soldItems.reduce((acc, curr) => acc + curr.revenue, 0);
    
    // Top product by quantity
    const topByQty = [...soldItems].sort((a, b) => b.soldQty - a.soldQty)[0] || null;

    const scopeFiltered = topSelling.filter(item => {
        if (filterScope === 'sold') return item.soldQty > 0;
        return true;
    });

    scopeFiltered.sort((a, b) => {
        if (sortBy === 'value') return b.revenue - a.revenue;
        return b.soldQty - a.soldQty;
    });

    // Show top 5 items in the widget list
    const displayList = scopeFiltered.slice(0, 5);

    const filteredModalList = scopeFiltered.filter(item => 
        !searchTerm || 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.sku.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const effItemsPerPage = itemsPerPage === 'all' ? (filteredModalList.length || 1) : parseInt(itemsPerPage);
    const totalPages = Math.ceil(filteredModalList.length / effItemsPerPage) || 1;
    const paginatedModalList = itemsPerPage === 'all' 
        ? filteredModalList 
        : filteredModalList.slice((modalPage - 1) * effItemsPerPage, modalPage * effItemsPerPage);

    const renderRankBadge = (rankIdx) => {
        if (rankIdx === 0) {
            return (
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'linear-gradient(135deg, rgba(212,175,55,0.2), rgba(212,175,55,0.06))', border: '1px solid rgba(212,175,55,0.35)', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                    <i className="fa-solid fa-trophy"></i>
                </div>
            );
        }
        if (rankIdx === 1) {
            return (
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)', color: '#d1d5db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                    <i className="fa-solid fa-medal"></i>
                </div>
            );
        }
        if (rankIdx === 2) {
            return (
                <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(205,127,50,0.12)', border: '1px solid rgba(205,127,50,0.25)', color: '#cd7f32', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                    <i className="fa-solid fa-award"></i>
                </div>
            );
        }
        return (
            <div style={{ width: '28px', height: '28px', borderRadius: '6px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: '700', flexShrink: 0 }}>
                #{rankIdx + 1}
            </div>
        );
    };

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
            
            {/* Widget Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.015)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(212,175,55,0.08)', border: '1px solid rgba(212,175,55,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--gold-primary)' }}>
                        <i className="fa-solid fa-fire-flame-curved" style={{ fontSize: '13px' }}></i>
                    </div>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--text-primary)' }}>{t('topSellingStock')}</span>
                </div>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ padding: '4px 12px', fontSize: '12px', borderRadius: '6px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    <span>عرض التفاصيل ({soldItems.length})</span>
                    <i className="fa-solid fa-arrow-left" style={{ fontSize: '10px' }}></i>
                </button>
            </div>

            {/* Quick Brief Bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '10px 16px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0, 0, 0, 0.12)' }}>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0 }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fa-solid fa-crown" style={{ color: 'var(--gold-primary)', fontSize: '10px' }}></i> الأعلى مبيعاً
                    </span>
                    <span style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topByQty ? topByQty.name : 'لا يوجد مبيعات'}
                    </span>
                </div>

                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fa-solid fa-boxes-packing" style={{ color: '#2ed573', fontSize: '10px' }}></i> إجمالي المباع
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: '#2ed573' }}>
                        {totalSoldVolume.toLocaleString('en-US')} <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 'normal' }}>قطعة</span>
                    </span>
                </div>

                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <i className="fa-solid fa-coins" style={{ color: 'var(--gold-primary)', fontSize: '10px' }}></i> الإيرادات
                    </span>
                    <span style={{ fontSize: '14px', fontWeight: '700', color: 'var(--gold-primary)' }}>
                        {currency} {totalRevenueSum.toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </span>
                </div>
            </div>

            {/* Widget Main List */}
            <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {displayList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '13px' }}>
                        <i className="fa-solid fa-box-open" style={{ fontSize: '20px', opacity: 0.3, marginBottom: '8px', display: 'block' }}></i>
                        {t('noItemsSold')}
                    </div>
                ) : (
                    displayList.map((item, idx) => (
                        <div key={`top-sell-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '8px', transition: 'var(--transition)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0 }}>
                                {renderRankBadge(idx)}
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </div>
                                    {item.sku && (
                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '1px' }}>
                                            {item.sku}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px', flexShrink: 0, marginRight: '10px' }}>
                                <span style={{ background: 'rgba(46, 213, 115, 0.1)', border: '1px solid rgba(46, 213, 115, 0.25)', color: '#2ed573', padding: '2px 8px', borderRadius: '4px', fontWeight: '700', fontSize: '11px' }}>
                                    {item.soldQty} مبيعة
                                </span>
                                <span style={{ fontSize: '12px', color: 'var(--gold-primary)', fontWeight: '700' }}>
                                    {currency} {item.revenue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                </span>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for All Top Selling Products - 100% Fully Responsive for Mobile and Tablets */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="المنتجات والأصناف الأكثر مبيعاً في المتجر" width="950px">
                
                {/* Modal Brief Header - Responsive Auto Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(212,175,55,0.15)', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                            <i className="fa-solid fa-crown"></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>الأكثر مبيعاً</div>
                            <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{topByQty ? topByQty.name : '-'}</div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(46, 213, 115, 0.06)', border: '1px solid rgba(46, 213, 115, 0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(46, 213, 115, 0.15)', color: '#2ed573', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                            <i className="fa-solid fa-boxes-packing"></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي القطع المباعة</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: '#2ed573' }}>{totalSoldVolume.toLocaleString('en-US')} قطعة</div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(30, 144, 255, 0.06)', border: '1px solid rgba(30, 144, 255, 0.2)', padding: '10px 14px', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div style={{ width: '34px', height: '34px', borderRadius: '8px', background: 'rgba(30, 144, 255, 0.15)', color: '#1e90ff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '15px', flexShrink: 0 }}>
                            <i className="fa-solid fa-coins"></i>
                        </div>
                        <div style={{ minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات بالجنيه</div>
                            <div style={{ fontSize: '14px', fontWeight: '800', color: 'var(--gold-primary)' }}>{currency} {totalRevenueSum.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                        </div>
                    </div>
                </div>

                {/* Filter and Search Toolbar */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '16px', background: 'rgba(255,255,255,0.02)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative', width: '100%' }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}></i>
                        <input
                            type="text"
                            placeholder="بحث باسم المنتج أو SKU..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setModalPage(1); }}
                            style={{ width: '100%', padding: '8px 34px 8px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', fontSize: '12px', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <button
                                className={`btn ${filterScope === 'sold' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setFilterScope('sold'); setModalPage(1); }}
                                style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                            >
                                الأصناف المباعة ({topSelling.filter(i => i.soldQty > 0).length})
                            </button>
                            <button
                                className={`btn ${filterScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setFilterScope('all'); setModalPage(1); }}
                                style={{ padding: '5px 12px', fontSize: '12px', borderRadius: '6px' }}
                            >
                                جميع الأصناف ({topSelling.length})
                            </button>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '6px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>الترتيب:</span>
                            <button 
                                className={`btn ${sortBy === 'qty' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setSortBy('qty'); setModalPage(1); }}
                                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px' }}
                            >
                                الكمية المباعة
                            </button>
                            <button 
                                className={`btn ${sortBy === 'value' ? 'btn-primary' : 'btn-secondary'}`}
                                onClick={() => { setSortBy('value'); setModalPage(1); }}
                                style={{ padding: '5px 10px', fontSize: '12px', borderRadius: '6px' }}
                            >
                                قيمة المبيعات
                            </button>
                        </div>
                    </div>
                </div>

                {/* 1. Desktop & Tablet Landscape View (Table) */}
                <div className="inspect-desktop-only" style={{ maxHeight: '48vh', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table className="custom-table" style={{ fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'right', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '50px', textAlign: 'center' }}>الترتيب</th>
                                <th>اسم المنتج والصنف</th>
                                <th style={{ textAlign: 'center' }}>الكمية المباعة</th>
                                <th style={{ textAlign: 'center' }}>المخزون المتبقي</th>
                                <th style={{ textAlign: 'left' }}>إجمالي الإيراد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedModalList.length === 0 ? (
                                <tr>
                                    <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                        لا توجد نتائج مطابقة للبحث
                                    </td>
                                </tr>
                            ) : (
                                paginatedModalList.map((item, idx) => {
                                    const globalIdx = itemsPerPage === 'all' ? idx : (modalPage - 1) * parseInt(itemsPerPage) + idx;
                                    return (
                                        <tr key={`modal-top-sell-desk-${idx}`}>
                                            <td style={{ textAlign: 'center' }}>
                                                {renderRankBadge(globalIdx)}
                                            </td>
                                            <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>
                                                <div>{item.name}</div>
                                                {item.sku && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sku}</div>}
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '700', color: item.soldQty > 0 ? '#2ed573' : 'var(--text-muted)' }}>
                                                {item.soldQty} قطعة
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '600', color: item.remainingQty < 5 ? '#ff4757' : 'var(--text-secondary)' }}>
                                                {item.remainingQty} قطعة
                                            </td>
                                            <td style={{ textAlign: 'left', fontWeight: '700', color: item.revenue > 0 ? 'var(--gold-primary)' : 'var(--text-muted)' }}>
                                                {currency} {item.revenue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* 2. Mobile & Tablet Portrait View (Responsive Cards) */}
                <div className="inspect-mobile-cards" style={{ maxHeight: '48vh', overflowY: 'auto' }}>
                    {paginatedModalList.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)', fontSize: '13px' }}>
                            لا توجد نتائج مطابقة للبحث
                        </div>
                    ) : (
                        paginatedModalList.map((item, idx) => {
                            const globalIdx = itemsPerPage === 'all' ? idx : (modalPage - 1) * parseInt(itemsPerPage) + idx;
                            return (
                                <div key={`modal-top-sell-mob-${idx}`} style={{ padding: '12px 14px', borderRadius: '8px', background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.06)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                        {renderRankBadge(globalIdx)}
                                        <div style={{ minWidth: 0, flex: 1 }}>
                                            <div style={{ fontWeight: '600', fontSize: '13px', color: 'var(--text-primary)' }}>{item.name}</div>
                                            {item.sku && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{item.sku}</div>}
                                        </div>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', paddingTop: '8px', borderTop: '1px solid rgba(255,255,255,0.04)', fontSize: '11.5px' }}>
                                        <div style={{ textAlign: 'center', background: 'rgba(46, 213, 115, 0.08)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(46, 213, 115, 0.2)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>المبيعات</div>
                                            <div style={{ color: '#2ed573', fontWeight: '700', marginTop: '2px' }}>{item.soldQty} قطعة</div>
                                        </div>
                                        <div style={{ textAlign: 'center', background: 'rgba(255,255,255,0.02)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>المخزون</div>
                                            <div style={{ color: item.remainingQty < 5 ? '#ff4757' : 'var(--text-primary)', fontWeight: '700', marginTop: '2px' }}>{item.remainingQty} قطعة</div>
                                        </div>
                                        <div style={{ textAlign: 'center', background: 'rgba(212,175,55,0.08)', padding: '6px 4px', borderRadius: '6px', border: '1px solid rgba(212,175,55,0.2)' }}>
                                            <div style={{ color: 'var(--text-muted)', fontSize: '10px' }}>الإيراد</div>
                                            <div style={{ color: 'var(--gold-primary)', fontWeight: '700', marginTop: '2px' }}>{currency} {item.revenue.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                                        </div>
                                    </div>
                                </div>
                            );
                        })
                    )}
                </div>

                {/* Pagination Controls */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>
                            عرض <strong>{itemsPerPage === 'all' ? 1 : (modalPage - 1) * parseInt(itemsPerPage) + 1} - {itemsPerPage === 'all' ? filteredModalList.length : Math.min(modalPage * parseInt(itemsPerPage), filteredModalList.length)}</strong> من أصل <strong>{filteredModalList.length}</strong> صنفاً
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>صفوف بالصفحة:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(e.target.value); setModalPage(1); }}
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', padding: '3px 8px', fontSize: '12px', outline: 'none' }}
                            >
                                <option value="10">10</option>
                                <option value="25">25</option>
                                <option value="50">50</option>
                                <option value="all">عرض الكل ({filteredModalList.length})</option>
                            </select>
                        </div>
                    </div>

                    {itemsPerPage !== 'all' && filteredModalList.length > parseInt(itemsPerPage) && (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setModalPage(prev => Math.max(1, prev - 1))}
                                disabled={modalPage === 1}
                                style={{ padding: '4px 10px', fontSize: '12px', opacity: modalPage === 1 ? 0.4 : 1 }}
                            >
                                <i className="fa-solid fa-chevron-right"></i> السابق
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: '700', color: 'var(--gold-primary)', padding: '0 6px' }}>
                                {modalPage} / {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setModalPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={modalPage >= totalPages}
                                style={{ padding: '4px 10px', fontSize: '12px', opacity: modalPage >= totalPages ? 0.4 : 1 }}
                            >
                                التالي <i className="fa-solid fa-chevron-left"></i>
                            </button>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
