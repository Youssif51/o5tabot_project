import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { formatProductDisplayName } from '../../utils/productUtils';
import Modal from '../common/Modal';

export default function LowQuantity() {
    const { state, t } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [statusFilter, setStatusFilter] = useState('all'); // 'all', 'out', 'critical', 'low'
    const [maxThresholdFilter, setMaxThresholdFilter] = useState('limit'); // 'limit', '5', '10', '20', 'all'
    const [searchTerm, setSearchTerm] = useState('');
    const [modalPage, setModalPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    let lowStock = [];
    (state.products || []).forEach(prod => {
        (prod.variants || []).forEach(vr => {
            let totalQty = 0;
            if (vr.stock && typeof vr.stock === 'object' && vr.stock.Sulur !== undefined) {
                totalQty = parseInt(vr.stock.Sulur) || 0;
            } else if (vr.stock_sulur !== undefined) {
                totalQty = parseInt(vr.stock_sulur) || 0;
            } else if (typeof vr.stock === 'number') {
                totalQty = vr.stock;
            }

            const limit = vr.reorderLimit || 5;
            
            let isIncluded = false;
            if (maxThresholdFilter === 'limit') {
                isIncluded = totalQty <= limit;
            } else if (maxThresholdFilter === '5') {
                isIncluded = totalQty <= 5;
            } else if (maxThresholdFilter === '10') {
                isIncluded = totalQty <= 10;
            } else if (maxThresholdFilter === '20') {
                isIncluded = totalQty <= 20;
            } else if (maxThresholdFilter === 'all') {
                isIncluded = true;
            }

            if (isIncluded) {
                const statusType = totalQty === 0 ? 'out' : totalQty <= 2 ? 'critical' : 'low';
                lowStock.push({
                    name: formatProductDisplayName(prod.name, vr.name),
                    sku: vr.sku || 'N/A',
                    remainingQty: totalQty,
                    limit: limit,
                    statusType: statusType,
                    statusText: totalQty === 0 ? 'مخزون منتهي' : totalQty <= 2 ? 'مخزون حرج' : 'مخزون منخفض'
                });
            }
        });
    });

    lowStock.sort((a, b) => a.remainingQty - b.remainingQty);
    
    // Show top 5 items in the main widget to fill the card nicely
    const displayList = lowStock.slice(0, 5);

    // Summary counts for Quick Brief Bar
    const outOfStockCount = lowStock.filter(i => i.statusType === 'out').length;
    const criticalCount = lowStock.filter(i => i.statusType === 'critical').length;
    const totalLowCount = lowStock.length;

    const filteredModalList = lowStock.filter(item => {
        if (statusFilter !== 'all' && item.statusType !== statusFilter) return false;
        if (searchTerm && !item.name.toLowerCase().includes(searchTerm.toLowerCase())) return false;
        return true;
    });

    const effItemsPerPage = itemsPerPage === 'all' ? (filteredModalList.length || 1) : parseInt(itemsPerPage);
    const totalPages = Math.ceil(filteredModalList.length / effItemsPerPage) || 1;
    const paginatedModalList = itemsPerPage === 'all' 
        ? filteredModalList 
        : filteredModalList.slice((modalPage - 1) * effItemsPerPage, modalPage * effItemsPerPage);

    const getStatusBadge = (item) => {
        if (item.remainingQty === 0) {
            return (
                <span className="badge badge-danger" style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: '1px solid rgba(239, 68, 68, 0.3)', borderRadius: '6px', fontWeight: '700' }}>
                    <i className="fa-solid fa-circle-xmark" style={{ marginLeft: '5px' }}></i> مخزون منتهي
                </span>
            );
        }
        if (item.remainingQty <= 2) {
            return (
                <span className="badge" style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: '1px solid rgba(245, 158, 11, 0.3)', borderRadius: '6px', fontWeight: '700' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ marginLeft: '5px' }}></i> مخزون حرج ({item.remainingQty})
                </span>
            );
        }
        return (
            <span className="badge badge-warning" style={{ fontSize: '0.72rem', padding: '4px 10px', background: 'rgba(234, 179, 8, 0.1)', color: '#eab308', border: '1px solid rgba(234, 179, 8, 0.25)', borderRadius: '6px', fontWeight: '600' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginLeft: '5px' }}></i> مخزون منخفض ({item.remainingQty})
            </span>
        );
    };

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 8px 32px rgba(0,0,0,0.12)' }}>
            
            {/* Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(255,255,255,0.015)' }}>
                <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: '700', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'rgba(212,175,55,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid rgba(212,175,55,0.2)', color: 'var(--gold-primary)' }}>
                        <i className="fa-solid fa-boxes-stacked" style={{ fontSize: '13px' }}></i>
                    </div>
                    <span>{t('lowQuantityStock')}</span>
                </h3>
                <button 
                    onClick={() => setIsModalOpen(true)}
                    className="btn btn-secondary"
                    style={{ padding: '5px 12px', fontSize: '0.78rem', borderRadius: '8px', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                >
                    عرض الكل ({totalLowCount}) <i className="fa-solid fa-arrow-left" style={{ fontSize: '10px' }}></i>
                </button>
            </div>

            {/* Quick Brief Bar - Simple, Sleek & Uniform Neutral Glass Pills */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px', padding: '12px 18px', borderBottom: '1px solid var(--glass-border)', background: 'rgba(0, 0, 0, 0.12)' }}>
                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#ef4444' }}></span> منتهي بالكامل
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {outOfStockCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>صنف</span>
                    </span>
                </div>

                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f59e0b' }}></span> مخزون حرج
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--text-primary)' }}>
                        {criticalCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>صنف</span>
                    </span>
                </div>

                <div style={{ padding: '8px 12px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--gold-primary)' }}></span> إجمالي للتوريد
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: '700', color: 'var(--gold-primary)' }}>
                        {totalLowCount} <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 'normal' }}>صنف</span>
                    </span>
                </div>
            </div>

            {/* Widget Main List (5 products to fill the card) */}
            <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {displayList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px 0', fontSize: '0.85rem' }}>
                        <i className="fa-solid fa-circle-check" style={{ color: '#2ecc71', fontSize: '1.4rem', marginBottom: '8px', display: 'block' }}></i>
                        {t('stockHealthy')}
                    </div>
                ) : (
                    displayList.map((item, idx) => (
                        <div key={`low-stock-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 12px', background: 'rgba(255,255,255,0.015)', border: '1px solid rgba(255,255,255,0.04)', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: item.remainingQty === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: item.remainingQty === 0 ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '13px', border: item.remainingQty === 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid rgba(245,158,11,0.3)' }}>
                                    {item.remainingQty}
                                </div>
                                <div style={{ minWidth: 0 }}>
                                    <div style={{ fontWeight: '600', fontSize: '0.84rem', color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                        {item.name}
                                    </div>
                                </div>
                            </div>
                            <div>
                                {getStatusBadge(item)}
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Modal for All Low Quantity Products */}
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title="منتجات وأصناف منخفضة الكمية / متابعة التوريد" width="850px">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px', background: 'rgba(255,255,255,0.02)', padding: '12px 16px', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ position: 'relative', flex: '1', minWidth: '180px' }}>
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
                        <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>حد النفاذ:</span>
                        <select
                            value={maxThresholdFilter}
                            onChange={(e) => { setMaxThresholdFilter(e.target.value); setModalPage(1); }}
                            style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: '#fff', padding: '4px 8px', fontSize: '0.78rem', outline: 'none' }}
                        >
                            <option value="limit">حسب حد التوريد الخاص بالصنف</option>
                            <option value="5">أقل من 5 قطع</option>
                            <option value="10">أقل من 10 قطع</option>
                            <option value="20">أقل من 20 قطعة</option>
                            <option value="all">عرض جميع أصناف المتجر</option>
                        </select>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <button
                            className={`btn ${statusFilter === 'all' ? 'btn-primary' : 'btn-secondary'}`}
                            onClick={() => { setStatusFilter('all'); setModalPage(1); }}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '6px' }}
                        >
                            الكل ({lowStock.length})
                        </button>
                        <button
                            className={`btn ${statusFilter === 'out' ? 'btn-danger' : 'btn-secondary'}`}
                            onClick={() => { setStatusFilter('out'); setModalPage(1); }}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '6px' }}
                        >
                            منتهي ({outOfStockCount})
                        </button>
                        <button
                            className={`btn ${statusFilter === 'critical' ? 'btn-warning' : 'btn-secondary'}`}
                            onClick={() => { setStatusFilter('critical'); setModalPage(1); }}
                            style={{ padding: '4px 10px', fontSize: '0.76rem', borderRadius: '6px' }}
                        >
                            حرج ({criticalCount})
                        </button>
                    </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxHeight: '52vh', overflowY: 'auto' }}>
                    {paginatedModalList.length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '32px 0' }}>
                            <i className="fa-solid fa-circle-check" style={{ color: '#2ecc71', fontSize: '1.8rem', marginBottom: '8px', display: 'block' }}></i>
                            لا توجد أصناف مطابقة للبحث أو المعايير المحددة
                        </div>
                    ) : (
                        paginatedModalList.map((item, idx) => (
                            <div key={`modal-low-stock-${idx}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', background: 'rgba(255,255,255,0.02)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.05)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
                                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', background: item.remainingQty === 0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: item.remainingQty === 0 ? '#ef4444' : '#f59e0b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '14px', border: item.remainingQty === 0 ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(245, 158, 11, 0.3)' }}>
                                        {item.remainingQty}
                                    </div>
                                    <div style={{ minWidth: 0 }}>
                                        <h4 style={{ margin: 0, fontSize: '0.88rem', color: 'var(--text-primary)', fontWeight: '600' }}>{item.name}</h4>
                                        <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                            الحد الأدنى للتوريد: <strong>{item.limit} قطع</strong>
                                        </p>
                                    </div>
                                </div>
                                <div>
                                    {getStatusBadge(item)}
                                </div>
                            </div>
                        ))
                    )}
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
                            <span style={{ fontSize: '0.8rem', fontWeight: '700', color: '#ef4444', padding: '0 6px' }}>
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
