import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { formatProductDisplayName } from '../../utils/productUtils';
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
                sku: vr.sku || 'N/A',
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
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const effItemsPerPage = itemsPerPage === 'all' ? (filteredModalList.length || 1) : parseInt(itemsPerPage);
    const totalPages = Math.ceil(filteredModalList.length / effItemsPerPage) || 1;
    const paginatedModalList = itemsPerPage === 'all' 
        ? filteredModalList 
        : filteredModalList.slice((modalPage - 1) * effItemsPerPage, modalPage * effItemsPerPage);

    const getRankIcon = (rankIdx) => {
        if (rankIdx === 0) return <i className="fa-solid fa-trophy" style={{ color: '#d4af37', fontSize: '13px' }} title="المركز الأول"></i>;
        if (rankIdx === 1) return <i className="fa-solid fa-medal" style={{ color: '#bdc3c7', fontSize: '13px' }} title="المركز الثاني"></i>;
        if (rankIdx === 2) return <i className="fa-solid fa-award" style={{ color: '#e67e22', fontSize: '13px' }} title="المركز الثالث"></i>;
        return <span style={{ fontSize: '11px', fontWeight: '800', opacity: 0.6 }}>#{rankIdx + 1}</span>;
    };

    const getRankBadgeBg = (rankIdx) => {
        if (rankIdx === 0) return 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(243,156,18,0.15))';
        if (rankIdx === 1) return 'linear-gradient(135deg, rgba(189,195,199,0.25), rgba(127,140,141,0.15))';
        if (rankIdx === 2) return 'linear-gradient(135deg, rgba(230,126,34,0.25), rgba(211,84,0,0.15))';
        return 'rgba(255,255,255,0.04)';
    };

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column', background: 'linear-gradient(135deg, rgba(255,255,255,0.03) 0%, rgba(255,255,255,0.008) 100%)', border: '1px solid var(--glass-border)', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.15)' }}>
            
            {/* Widget Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(0,0,0,0.12)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '10px', background: 'linear-gradient(135deg, rgba(212,175,55,0.25), rgba(243,156,18,0.1))', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.35)', color: '#d4af37' }}>
                        <i className="fa-solid fa-fire-flame-curved" style={{ fontSize: '14px' }}></i>
                    </div>
                    <span>{t('topSellingStock')}</span>
                </h3>
                <button 
                    className="see-all-link" 
                    onClick={() => setIsModalOpen(true)}
                    style={{ background: 'rgba(212,175,55,0.1)', border: '1px solid rgba(212,175,55,0.25)', padding: '6px 14px', borderRadius: '20px', fontSize: '0.78rem', color: '#d4af37', fontWeight: '700', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px', transition: 'all 0.2s' }}
                >
                    عرض التفاصيل ({soldItems.length}) <i className="fa-solid fa-arrow-left" style={{ fontSize: '10px' }}></i>
                </button>
            </div>

            {/* Quick Brief Bar (ملخص المبيعات السريع بأيقونات FontAwesome) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px', padding: '12px 18px', background: 'rgba(0, 0, 0, 0.18)', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-crown" style={{ color: '#d4af37' }}></i> الأعلى مبيعاً
                    </span>
                    <span style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {topByQty ? topByQty.name : 'لا يوجد مبيعات'}
                    </span>
                </div>

                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-box-archive" style={{ color: '#2ecc71' }}></i> إجمالي المباع
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#2ecc71' }}>
                        {totalSoldVolume.toLocaleString('en-US')} <span style={{ fontSize: '0.68rem', fontWeight: '500' }}>قطعة</span>
                    </span>
                </div>

                <div style={{ padding: '8px 10px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.04)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-solid fa-sack-dollar" style={{ color: '#d4af37' }}></i> الإيرادات
                    </span>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#d4af37', fontFamily: 'monospace' }}>
                        {currency} {totalRevenueSum.toLocaleString('en-US', {maximumFractionDigits: 0})}
                    </span>
                </div>
            </div>

            {/* Main Products List */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '28px 0', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-box-open" style={{ fontSize: '1.6rem', opacity: 0.3, marginBottom: '8px', display: 'block' }}></i>
                        {t('noItemsSold')}
                    </div>
                ) : (
                    displayList.map((item, idx) => (
                        <div key={`top-sell-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: getRankBadgeBg(idx), border: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                    {getRankIcon(idx)}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: '600', fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </div>
                                </div>
                            </div>
                            <div style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                <div style={{ background: 'rgba(46, 204, 113, 0.12)', border: '1px solid rgba(46, 204, 113, 0.25)', color: '#2ecc71', padding: '3px 10px', borderRadius: '10px', fontWeight: '800', fontSize: '0.8rem' }}>
                                    {item.soldQty} <span style={{ fontSize: '0.68rem', fontWeight: '600' }}>مبيعة</span>
                                </div>
                                <div style={{ fontSize: '0.76rem', color: '#d4af37', fontFamily: 'monospace', fontWeight: '700', marginTop: '1px' }}>
                                    {currency} {item.revenue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for All Top Selling Products */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="المنتجات والأصناف الأكثر مبيعاً في المتجر" width="950px">
                
                {/* Modal Brief Header */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px', marginBottom: '16px' }}>
                    <div style={{ background: 'rgba(212,175,55,0.06)', border: '1px solid rgba(212,175,55,0.2)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(212,175,55,0.15)', color: '#d4af37', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fa-solid fa-crown"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>المنتج الأكثر مبيعاً</div>
                            <div style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>{topByQty ? topByQty.name : '-'}</div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(46, 204, 113, 0.06)', border: '1px solid rgba(46, 204, 113, 0.2)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(46, 204, 113, 0.15)', color: '#2ecc71', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fa-solid fa-box-archive"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>إجمالي القطع المباعة</div>
                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#2ecc71' }}>{totalSoldVolume.toLocaleString('en-US')} قطعة</div>
                        </div>
                    </div>

                    <div style={{ background: 'rgba(52, 152, 219, 0.06)', border: '1px solid rgba(52, 152, 219, 0.2)', padding: '12px 16px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', background: 'rgba(52, 152, 219, 0.15)', color: '#3498db', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>
                            <i className="fa-solid fa-sack-dollar"></i>
                        </div>
                        <div>
                            <div style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>إجمالي المبيعات بالجنيه</div>
                            <div style={{ fontSize: '1rem', fontWeight: '800', color: '#d4af37', fontFamily: 'monospace' }}>{currency} {totalRevenueSum.toLocaleString('en-US', {maximumFractionDigits: 0})}</div>
                        </div>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '200px' }}>
                        <i className="fa-solid fa-magnifying-glass" style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)', fontSize: '12px' }}></i>
                        <input
                            type="text"
                            placeholder="بحث باسم المنتج..."
                            value={searchTerm}
                            onChange={(e) => { setSearchTerm(e.target.value); setModalPage(1); }}
                            style={{ width: '100%', padding: '7px 32px 7px 12px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: '#fff', fontSize: '0.8rem', outline: 'none' }}
                        />
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            className={`btn ${filterScope === 'sold' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setFilterScope('sold'); setModalPage(1); }}
                            style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                        >
                            الأصناف المباعة ({topSelling.filter(i => i.soldQty > 0).length})
                        </button>
                        <button
                            className={`btn ${filterScope === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setFilterScope('all'); setModalPage(1); }}
                            style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '6px' }}
                        >
                            جميع أصناف المتجر ({topSelling.length})
                        </button>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>الترتيب:</span>
                        <button 
                            className={`btn ${sortBy === 'qty' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setSortBy('qty'); setModalPage(1); }}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '6px' }}
                        >
                            الكمية المباعة
                        </button>
                        <button 
                            className={`btn ${sortBy === 'value' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setSortBy('value'); setModalPage(1); }}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '6px' }}
                        >
                            قيمة المبيعات
                        </button>
                    </div>
                </div>

                <div className="table-wrapper" style={{ maxHeight: '52vh', overflowY: 'auto', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <table className="custom-table" style={{ fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'right', width: '100%' }}>
                        <thead>
                            <tr>
                                <th style={{ width: '45px', textAlign: 'center' }}>الترتيب</th>
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
                                        <tr key={`modal-top-sell-${idx}`}>
                                            <td style={{ textAlign: 'center' }}>
                                                {getRankIcon(globalIdx)}
                                            </td>
                                            <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{item.name}</td>
                                            <td style={{ textAlign: 'center', fontWeight: '700', color: item.soldQty > 0 ? '#2ecc71' : 'var(--text-muted)' }}>
                                                {item.soldQty} قطعة
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '600', color: item.remainingQty < 5 ? 'var(--color-danger)' : 'var(--text-secondary)' }}>
                                                {item.remainingQty} قطعة
                                            </td>
                                            <td style={{ textAlign: 'left', fontWeight: '700', color: item.revenue > 0 ? '#d4af37' : 'var(--text-muted)', fontFamily: 'monospace' }}>
                                                {currency} {item.revenue.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '12px' }}>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <span>
                            عرض <strong>{itemsPerPage === 'all' ? 1 : (modalPage - 1) * parseInt(itemsPerPage) + 1} - {itemsPerPage === 'all' ? filteredModalList.length : Math.min(modalPage * parseInt(itemsPerPage), filteredModalList.length)}</strong> من أصل <strong>{filteredModalList.length}</strong> صنفاً
                        </span>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>صفوف بالصفحة:</span>
                            <select
                                value={itemsPerPage}
                                onChange={(e) => { setItemsPerPage(e.target.value); setModalPage(1); }}
                                style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', padding: '3px 8px', fontSize: '0.78rem', outline: 'none' }}
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
                                style={{ padding: '5px 12px', fontSize: '0.78rem', opacity: modalPage === 1 ? 0.4 : 1 }}
                            >
                                <i className="fa-solid fa-chevron-right"></i> السابق
                            </button>
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#d4af37', padding: '0 6px' }}>
                                {modalPage} / {totalPages}
                            </span>
                            <button
                                className="btn btn-secondary"
                                onClick={() => setModalPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={modalPage >= totalPages}
                                style={{ padding: '5px 12px', fontSize: '0.78rem', opacity: modalPage >= totalPages ? 0.4 : 1 }}
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
