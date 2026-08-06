import React, { useContext, useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { AppContext } from '../../context/AppContext';
import { formatProductDisplayName } from '../../utils/productUtils';

// Helper to parse address JSON structure safely (handles Object or String)
const parseAddressData = (addressData) => {
    let detailAddress = '';
    let phone = '';
    let vatEnabled = false;
    let orderDiscountPercent = 0;
    let customerCode = 'CUS-0000';
    let bostaStateName = '';
    let bostaStateCode = null;
    let bostaTrackingNumber = '';
    let bostaExceptionReason = '';
    
    if (addressData) {
        let parsed = addressData;
        if (typeof addressData === 'string') {
            if (addressData.startsWith('{')) {
                try {
                    parsed = JSON.parse(addressData);
                } catch(e) {
                    parsed = { detailAddress: addressData };
                }
            } else {
                parsed = { detailAddress: addressData };
            }
        }
        
        if (parsed && typeof parsed === 'object') {
            detailAddress = parsed.detailAddress || '';
            phone = parsed.phone || '';
            vatEnabled = parsed.vatEnabled || false;
            orderDiscountPercent = parseFloat(parsed.orderDiscountPercent) || 0;
            customerCode = parsed.customerCode || 'CUS-0000';
            bostaStateName = parsed.bostaStateName || '';
            bostaStateCode = (parsed.bostaStateCode !== undefined && parsed.bostaStateCode !== null) ? parsed.bostaStateCode : null;
            bostaTrackingNumber = parsed.bostaTrackingNumber || '';
            bostaExceptionReason = parsed.bostaExceptionReason || '';
        }
    }
    const isDeleted = addressData && typeof addressData === 'object' 
        ? !!(addressData.isDeleted || addressData.is_deleted)
        : (addressData && typeof addressData === 'string' && addressData.startsWith('{') ? (() => { try { const p = JSON.parse(addressData); return !!(p.isDeleted || p.is_deleted); } catch(e) { return false; } })() : false);
    return { detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode, bostaStateName, bostaStateCode, bostaTrackingNumber, bostaExceptionReason, isDeleted };
};

const normalizePhoneNumber = (phoneStr) => {
    if (!phoneStr) return '';
    const trimmed = phoneStr.trim();
    let clean = trimmed.replace(/\D/g, '');
    if (trimmed.startsWith('+') && !clean.startsWith('20')) {
        return '+' + clean;
    }
    if (clean.startsWith('201') && clean.length === 12) {
        return '0' + clean.substring(2);
    } else if (clean.startsWith('20') && clean.length > 10) {
        clean = clean.substring(2);
    } else if (clean.startsWith('2') && clean.length > 10 && (clean.startsWith('210') || clean.startsWith('211') || clean.startsWith('212') || clean.startsWith('215'))) {
        clean = clean.substring(1);
    }
    if (clean.length === 10 && (clean.startsWith('10') || clean.startsWith('11') || clean.startsWith('12') || clean.startsWith('15'))) {
        clean = '0' + clean;
    }
    if (!clean.startsWith('0') && clean.length === 10) {
        clean = '0' + clean;
    }
    return clean || trimmed;
};

const getRemainingToCollect = (ord) => {
    if (ord.status === 'Cancelled') return 0;
    const { bostaStateCode } = parseAddressData(ord.address);
    const isDelivered = ord.status === 'Completed' || Number(bostaStateCode) === 45 || Number(bostaStateCode) === 25;
    const tot = parseFloat(ord.totalValue) || 0;
    const dep = parseFloat(ord.deposit) || 0;
    
    if (isDelivered || dep >= tot) {
        return 0;
    }
    
    return Math.max(0, tot - dep);
};

export default function DepositConfirmList() {
    const { state, updateDepositStatus, settleAdminsCustody, confirmDepositRefund, confirmDepositAndRefund, showToast, showConfirm } = useContext(AppContext);
    const allOrdersForDeposits = [
        ...(state.orders || []),
        ...(state.deletedOrdersWithDeposits || [])
    ];
    const [expandedAdminId, setExpandedAdminId] = useState(null);
    const location = useLocation();

    useEffect(() => {
        if (location.state?.highlightOrderId) {
            const orderId = location.state.highlightOrderId;
            setTimeout(() => {
                const element = document.getElementById(`pending-deposit-row-${orderId}`) || 
                                document.getElementById(`pending-deposit-card-${orderId}`);
                if (element) {
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    element.style.boxShadow = '0 0 20px rgba(229, 169, 59, 0.45)';
                    element.style.borderColor = 'var(--gold-primary)';
                    element.style.background = 'rgba(229, 169, 59, 0.08)';
                    setTimeout(() => {
                        element.style.boxShadow = '';
                        element.style.borderColor = '';
                        element.style.background = '';
                    }, 4000);
                }
            }, 300);
        }
    }, [location.state]);
    const [proofsPage, setProofsPage] = useState(1);
    // Refund confirmation state: { orderId, file, uploading }
    const [refundConfirm, setRefundConfirm] = useState({});
    const [previewProofUrl, setPreviewProofUrl] = useState(null);
    const fileInputRefs = useRef({});

    // Handler: set selected file for a specific order
    const handleRefundFileChange = (orderId, file) => {
        setRefundConfirm(prev => ({ ...prev, [orderId]: { ...prev[orderId], file } }));
    };

    // Handler: confirm refund submission
    const handleConfirmRefund = async (orderId) => {
        const file = refundConfirm[orderId]?.file || null;
        setRefundConfirm(prev => ({ ...prev, [orderId]: { ...prev[orderId], uploading: true } }));
        await confirmDepositRefund(orderId, file);
        setRefundConfirm(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    };

    // Handler: shortcut confirm deposit and refund at the same time
    const handleConfirmDepositAndRefund = async (orderId) => {
        const file = refundConfirm[orderId]?.file || null;
        setRefundConfirm(prev => ({ ...prev, [orderId]: { ...prev[orderId], uploading: true } }));
        await confirmDepositAndRefund(orderId, file);
        setRefundConfirm(prev => { const n = { ...prev }; delete n[orderId]; return n; });
    };

    // Handler: SuperAdmin settle deposit for cancelled/returned orders directly without file proof
    const handleSettleDeposit = (orderId, depositAmount) => {
        showConfirm(
            `هل أنت متأكد من أنه تم تسوية وإعادة عربون هذا الطلب بقيمة ${depositAmount} ج.م؟ سيتم تمييز العربون كـ "تم التعامل" وإخفاء الطلب من قائمة المتابعة.`,
            async () => {
                await confirmDepositRefund(orderId, null, depositAmount, 'SuperAdmin Manual Settle');
            }
        );
    };

    // Orders that were cancelled but this admin still needs to return the deposit
    const myPendingRefunds = (allOrdersForDeposits || []).filter(o =>
        o.depositReceiverId === state.currentUser?.id &&
        o.status === 'Cancelled' &&
        (parseFloat(o.deposit) || 0) > 0 &&
        o.depositRefundStatus === 'awaiting_return'
    );
    const [historySearch, setHistorySearch] = useState('');
    const [historyAdminFilter, setHistoryAdminFilter] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [superAdminPage, setSuperAdminPage] = useState(1);
    const [expandedHistoryOrderIds, setExpandedHistoryOrderIds] = useState({});
    
    const toggleHistoryOrder = (orderId) => {
        setExpandedHistoryOrderIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };
    const getProductNameBySku = (sku) => {
        let name = sku;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) name = formatProductDisplayName(p.name, v.name);
        });
        return name;
    };

    const getCustomerCode = (clientName) => {
        const cust = (state.customers || []).find(c => c.name === clientName);
        if (cust) {
            return cust.code || `CUS-${cust.id.toString().substring(0, 4)}`;
        }
        let hash = 0;
        for (let i = 0; i < clientName.length; i++) {
            hash = clientName.charCodeAt(i) + ((hash << 5) - hash);
        }
        const code = Math.abs(hash).toString().substring(0, 4).padStart(4, '0');
        return `CUS-${code}`;
    };

    const getWhatsAppLink = (phoneStr) => {
        if (!phoneStr) return '';
        let clean = phoneStr.replace(/\D/g, '');
        if (clean.startsWith('01') && clean.length === 11) {
            clean = '2' + clean;
        } else if (clean.startsWith('1') && clean.length === 10) {
            clean = '20' + clean;
        }
        return `https://wa.me/${clean}`;
    };

    const currency = state.storeSettings?.currency || 'EGP';

    // 1. Filter pending deposits assigned to current admin
    const myPendingDeposits = (allOrdersForDeposits || []).filter(o => 
        o.depositReceiverId === state.currentUser?.id && 
        o.depositStatus === 'pending' &&
        (parseFloat(o.deposit) || 0) > 0
    );



    // 2. SuperAdmin admin custody data
    const getAdminCustodyData = () => {
        const custodyMap = {};
        (state.users || []).forEach(u => {
            custodyMap[u.id] = { name: u.name, role: u.role, confirmed: 0, pending: 0, orderIds: [], ordersList: [] };
        });

        (allOrdersForDeposits || []).forEach(o => {
            if (o.deposit > 0 && o.depositReceiverId && o.depositRefundStatus !== 'returned' && o.depositStatus !== 'settled') {
                if (!custodyMap[o.depositReceiverId]) {
                    custodyMap[o.depositReceiverId] = { name: 'أدمن غير معروف', role: '', confirmed: 0, pending: 0, orderIds: [], ordersList: [] };
                }
                const depVal = parseFloat(o.deposit) || 0;
                if (o.depositStatus === 'confirmed') {
                    custodyMap[o.depositReceiverId].confirmed += depVal;
                    custodyMap[o.depositReceiverId].orderIds.push(o.id);
                    custodyMap[o.depositReceiverId].ordersList.push(o);
                } else if (o.depositStatus === 'pending') {
                    custodyMap[o.depositReceiverId].pending += depVal;
                    custodyMap[o.depositReceiverId].ordersList.push(o);
                }
            }
        });

        return Object.entries(custodyMap)
            .map(([id, data]) => ({ id, ...data }))
            .filter(item => item.confirmed > 0 || item.pending > 0);
    };

    const adminCustodies = getAdminCustodyData();

    // 3. Historical settlements/audit log
    const historicalDeposits = (allOrdersForDeposits || []).filter(o => 
        o.deposit > 0 && 
        (o.depositStatus === 'settled' || o.depositStatus === 'rejected')
    );

    // Apply filters to history
    const filteredHistory = historicalDeposits.filter(o => {
        const matchSearch = o.id.toLowerCase().includes(historySearch.toLowerCase()) || 
                            o.client.toLowerCase().includes(historySearch.toLowerCase());
        const matchAdmin = historyAdminFilter ? o.depositReceiverId === historyAdminFilter : true;
        return matchSearch && matchAdmin;
    });

    const getAdminName = (id) => {
        const usr = (state.users || []).find(u => u.id === id);
        return usr ? usr.name : 'أدمن غير معروف';
    };

    const formatOrderDateWithTime = (ord) => {
        if (!ord.createdAt) return ord.date || '';
        try {
            const dateObj = new Date(ord.createdAt);
            if (isNaN(dateObj.getTime())) return ord.date || '';
            
            // Format time
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            const timeStr = `${hours}:${minutes} ${ampm}`;
            
            return (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                    <div style={{ fontWeight: 500 }}>{ord.date}</div>
                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i>
                        {timeStr}
                    </div>
                </div>
            );
        } catch (e) {
            return ord.date || '';
        }
    };

    return (
        <div id="deposit-confirm-view" className="view-pane active" dir="rtl" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div className="page-title-group">
                    <h2 style={{ fontSize: '22px', fontWeight: 'bold' }}>مراجعة وتأكيد العرابين</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                        مراجعة المبالغ المحولة من العملاء وتأكيد استلام عهدة المحافظ الإلكترونية الخاصة بك.
                    </p>
                </div>
            </div>


            {/* Section 1: My Pending Deposits */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                    <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '16px', fontWeight: 600 }}>
                        <i className="fa-solid fa-wallet" style={{ marginLeft: '8px' }}></i> عُربونات مرسلة لمحفظتك وبانتظار تأكيدك
                    </h3>
                    <span className="badge badge-in" style={{ fontSize: '11px', background: 'rgba(212,175,55,0.15)', color: 'var(--gold-primary)' }}>
                        {myPendingDeposits.length} معلق
                    </span>
                </div>

                {myPendingDeposits.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                        <i className="fa-solid fa-circle-check" style={{ fontSize: '36px', marginBottom: '12px', color: '#2ecc71' }}></i>
                        <p>لا توجد عرابين معلقة بانتظار تأكيد استلامك حالياً.</p>
                    </div>
                ) : (
                    <>
                        <div className="table-wrapper dc-desktop-only" style={{ overflowX: 'auto' }}>
                        <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>رقم الطلب</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>العميل</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>مبلغ العربون</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>تاريخ الطلب</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>الآدمن المسجل للطلب</th>
                                    <th style={{ textAlign: 'center', padding: '12px 8px' }}>الإجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {myPendingDeposits.map(ord => (
                                    <tr key={ord.id} id={`pending-deposit-row-${ord.id}`} style={{ borderBottom: '1px solid var(--glass-bg)', textAlign: 'center', transition: 'all 0.5s ease' }}>
                                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold-primary)' }}>#{ord.id}<i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ord.id); showToast('تم نسخ رقم الطلب', 'success'); }} title="نسخ رقم الطلب"></i></td>
                                        <td style={{ padding: '12px 8px' }}>{ord.client}</td>
                                        <td style={{ padding: '12px 8px', fontWeight: 'bold', color: '#2ecc71' }}>{ord.deposit} {currency}</td>
                                        <td style={{ padding: '12px 8px' }}>
                                            {formatOrderDateWithTime(ord)}
                                        </td>
                                        <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{ord.createdBy || 'الآدمن'}</td>
                                        <td style={{ padding: '12px 8px' }}>
                                            {ord.status === 'Cancelled' ? (
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                                    <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ الطلب ملغى</span>
                                                    <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
                                                        <button 
                                                            className="btn"
                                                            onClick={() => updateDepositStatus(ord.id, 'confirmed')}
                                                            style={{ padding: '6px 10px', fontSize: '11px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                        >
                                                            نعم، استلمت
                                                        </button>
                                                        <button 
                                                            className="btn"
                                                            onClick={() => updateDepositStatus(ord.id, 'rejected')}
                                                            style={{ padding: '6px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
                                                        >
                                                            لم تصلني الفلوس أصلاً
                                                        </button>

                                                        <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                                                            <input
                                                                type="file"
                                                                accept="image/*"
                                                                style={{ display: 'none' }}
                                                                ref={el => fileInputRefs.current[`shortcut-${ord.id}`] = el}
                                                                onChange={e => handleRefundFileChange(ord.id, e.target.files?.[0] || null)}
                                                            />
                                                            <button
                                                                onClick={() => fileInputRefs.current[`shortcut-${ord.id}`]?.click()}
                                                                title="إرفاق إثبات الاسترداد"
                                                                style={{ padding: '6px 10px', fontSize: '12px', background: (refundConfirm[ord.id]?.file ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.1)'), color: (refundConfirm[ord.id]?.file ? '#2ecc71' : '#fff'), border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                            >
                                                                <i className={refundConfirm[ord.id]?.file ? 'fa-solid fa-check' : 'fa-solid fa-image'}></i>
                                                            </button>
                                                            <button 
                                                                className="btn"
                                                                onClick={() => handleConfirmDepositAndRefund(ord.id)}
                                                                disabled={refundConfirm[ord.id]?.uploading}
                                                                style={{ padding: '6px 14px', fontSize: '11px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: (refundConfirm[ord.id]?.uploading ? 'not-allowed' : 'pointer'), fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
                                                            >
                                                                {refundConfirm[ord.id]?.uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                                                                استلمتها وأرجعتها
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ) : (
                                                <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                    <button 
                                                        className="btn"
                                                        onClick={() => updateDepositStatus(ord.id, 'confirmed')}
                                                        style={{ padding: '6px 14px', fontSize: '12px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                                    >
                                                        نعم، استلمت
                                                    </button>
                                                    <button 
                                                        className="btn"
                                                        onClick={() => updateDepositStatus(ord.id, 'rejected')}
                                                        style={{ padding: '6px 14px', fontSize: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                                    >
                                                        لا، لم أستلم
                                                    </button>
                                                </div>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    {/* Mobile view cards for Section 1 */}
                    <div className="dc-mobile-cards">
                        {myPendingDeposits.map(ord => (
                            <div 
                                key={ord.id} 
                                id={`pending-deposit-card-${ord.id}`}
                                className="sa-mobile-card"
                                style={{
                                    background: 'rgba(255, 255, 255, 0.02)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    padding: '16px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '10px',
                                    transition: 'all 0.5s ease'
                                }}
                            >
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                    <strong style={{ color: 'var(--gold-primary)', fontSize: '15px', fontFamily: 'monospace' }}>#{ord.id}</strong><i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ord.id); showToast('تم نسخ رقم الطلب', 'success'); }} title="نسخ رقم الطلب"></i>
                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatOrderDateWithTime(ord)}</span>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>العميل:</span>
                                        <strong style={{ color: '#fff', marginRight: '6px' }}>{ord.client}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-muted)' }}>العربون:</span>
                                        <strong style={{ color: '#2ecc71', marginRight: '6px' }}>{ord.deposit} {currency}</strong>
                                    </div>
                                </div>
                                <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                    <span>مسجل الطلب: </span>
                                    <strong style={{ color: 'var(--text-secondary)' }}>{ord.createdBy || 'الآدمن'}</strong>
                                </div>

                                <div style={{ borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px' }}>
                                    {ord.status === 'Cancelled' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'center' }}>
                                            <span style={{ fontSize: '11px', color: '#ef4444', fontWeight: 'bold' }}>⚠️ الطلب ملغى</span>
                                            <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center', width: '100%' }}>
                                                <button 
                                                    className="btn"
                                                    onClick={() => updateDepositStatus(ord.id, 'confirmed')}
                                                    style={{ padding: '6px 10px', fontSize: '11px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', flex: '1 1 auto' }}
                                                >
                                                    نعم، استلمت
                                                </button>
                                                <button 
                                                    className="btn"
                                                    onClick={() => updateDepositStatus(ord.id, 'rejected')}
                                                    style={{ padding: '6px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-secondary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer', flex: '1 1 auto' }}
                                                >
                                                    لم تصلني الفلوس
                                                </button>

                                                <div style={{ display: 'flex', gap: '4px', alignItems: 'center', width: '100%', marginTop: '4px', justifyContent: 'center' }}>
                                                    <input
                                                        type="file"
                                                        accept="image/*"
                                                        style={{ display: 'none' }}
                                                        ref={el => fileInputRefs.current[`shortcut-mobile-${ord.id}`] = el}
                                                        onChange={e => handleRefundFileChange(ord.id, e.target.files?.[0] || null)}
                                                    />
                                                    <button
                                                        onClick={() => fileInputRefs.current[`shortcut-mobile-${ord.id}`]?.click()}
                                                        title="إرفاق إثبات الاسترداد"
                                                        style={{ padding: '6px 10px', fontSize: '12px', background: (refundConfirm[ord.id]?.file ? 'rgba(46,204,113,0.2)' : 'rgba(255,255,255,0.1)'), color: (refundConfirm[ord.id]?.file ? '#2ecc71' : '#fff'), border: 'none', borderRadius: '4px', cursor: 'pointer' }}
                                                    >
                                                        <i className={refundConfirm[ord.id]?.file ? 'fa-solid fa-check' : 'fa-solid fa-image'}></i> إثبات
                                                    </button>
                                                    <button 
                                                        className="btn"
                                                        onClick={() => handleConfirmDepositAndRefund(ord.id)}
                                                        disabled={refundConfirm[ord.id]?.uploading}
                                                        style={{ padding: '6px 14px', fontSize: '11px', background: '#eab308', color: '#000', border: 'none', borderRadius: '4px', cursor: (refundConfirm[ord.id]?.uploading ? 'not-allowed' : 'pointer'), fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px', flex: '1 1 auto' }}
                                                    >
                                                        {refundConfirm[ord.id]?.uploading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-solid fa-bolt"></i>}
                                                        استلمتها وأرجعتها
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                            <button 
                                                className="btn"
                                                onClick={() => updateDepositStatus(ord.id, 'confirmed')}
                                                style={{ padding: '6px 14px', fontSize: '12px', background: '#2ecc71', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                                            >
                                                نعم، استلمت
                                            </button>
                                            <button 
                                                className="btn"
                                                onClick={() => updateDepositStatus(ord.id, 'rejected')}
                                                style={{ padding: '6px 14px', fontSize: '12px', background: '#ef4444', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600, flex: 1 }}
                                            >
                                                لا، لم أستلم
                                            </button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    </>
                )}
            </div>

            {/* Section 2: SuperAdmin active custody dashboard */}
            {state.currentUser?.role === 'SuperAdmin' && (
                <div className="glass-card" style={{ padding: '24px', marginBottom: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '16px', fontWeight: 600 }}>
                            <i className="fa-solid fa-users-gear" style={{ marginLeft: '8px' }}></i> إجمالي عُهد ومحافظ الأدمنز النشطة
                        </h3>
                    </div>

                    {adminCustodies.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <p>لا توجد مبالغ عهد نشطة حالياً لدى أي من الأدمنز.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                            <div className="grid-responsive-fit-320">
                                {adminCustodies.map(cust => (
                                    <div key={cust.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '18px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ fontSize: '15px', color: '#fff' }}>{cust.name} ({cust.role === 'SuperAdmin' ? 'سوبر أدمن' : 'أدمن'})</strong>
                                            <span className="badge badge-success" style={{ fontSize: '13px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', border: '1px solid rgba(46, 204, 113, 0.2)', padding: '4px 8px', borderRadius: '4px' }}>
                                                {cust.confirmed} {currency} عُهدة مؤكدة
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12.5px' }}>
                                            <span style={{ color: 'var(--text-muted)' }}>معلق في المحفظة: {cust.pending} {currency}</span>
                                            <div style={{ display: 'flex', gap: '8px' }}>
                                                <button 
                                                    className="btn"
                                                    onClick={() => setExpandedAdminId(expandedAdminId === cust.id ? null : cust.id)}
                                                    style={{ padding: '4px 10px', fontSize: '11px', background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '4px', cursor: 'pointer' }}
                                                >
                                                    {expandedAdminId === cust.id ? 'إخفاء التفاصيل' : 'عرض كشف العهدة'}
                                                </button>
                                                {cust.confirmed > 0 && (
                                                    <button 
                                                        className="btn"
                                                        onClick={() => settleAdminsCustody(cust.id, cust.orderIds)}
                                                        style={{ padding: '4px 12px', fontSize: '11px', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                                    >
                                                        تسوية وتصفير العهدة
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Active Custody Order Details Breakdown */}
                            {expandedAdminId && (() => {
                                const activeAdminData = adminCustodies.find(c => c.id === expandedAdminId);
                                if (!activeAdminData) return null;
                                return (
                                    <div className="glass-card" style={{ padding: '16px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(212,175,55,0.2)', borderRadius: '8px', marginTop: '10px' }}>
                                        <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '12px' }}>
                                            كشف الحساب التفصيلي لعهدة الأدمن: <strong>{activeAdminData.name}</strong>
                                        </h4>
                                        <div className="table-wrapper dc-desktop-only" style={{ maxHeight: '300px', overflowY: 'auto' }}>
                                            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
                                                <thead>
                                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>رقم الطلب</th>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>العميل</th>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>مبلغ العربون</th>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>حالة استلام العربون</th>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>تاريخ الطلب</th>
                                                        <th style={{ padding: '8px', textAlign: 'center' }}>مسجل الطلب</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {activeAdminData.ordersList.map(ord => (
                                                        <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                                            <td style={{ padding: '8px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{ord.id}</td>
                                                            <td style={{ padding: '8px' }}>{ord.client}</td>
                                                            <td style={{ padding: '8px', fontWeight: 'bold' }}>{ord.deposit} {currency}</td>
                                                            <td style={{ padding: '8px' }}>
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    padding: '2px 6px', 
                                                                    borderRadius: '4px',
                                                                    background: ord.depositStatus === 'confirmed' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                                                                    color: ord.depositStatus === 'confirmed' ? '#2ecc71' : '#f1c40f'
                                                                }}>
                                                                    {ord.depositStatus === 'confirmed' ? 'مؤكد الاستلام' : 'بانتظار التأكيد'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '8px' }}>
                                                                {formatOrderDateWithTime(ord)}
                                                            </td>
                                                            <td style={{ padding: '8px', color: 'var(--text-muted)' }}>{ord.createdBy}</td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* Mobile view cards for Admin Custody Details */}
                                        <div className="dc-mobile-cards" style={{ maxHeight: '400px', overflowY: 'auto', gap: '10px' }}>
                                            {activeAdminData.ordersList.map(ord => (
                                                <div 
                                                    key={ord.id} 
                                                    className="sa-mobile-card"
                                                    style={{
                                                        background: 'rgba(255, 255, 255, 0.01)',
                                                        border: '1px solid var(--glass-border)',
                                                        borderRadius: '8px',
                                                        padding: '12px',
                                                        display: 'flex',
                                                        flexDirection: 'column',
                                                        gap: '8px'
                                                    }}
                                                >
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                                         <div style={{ display: 'flex', alignItems: 'center' }}>
                                                             <strong style={{ color: 'var(--gold-primary)', fontFamily: 'monospace' }}>#{ord.id}</strong>
                                                             <i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ord.id); showToast('تم نسخ رقم الطلب', 'success'); }} title="نسخ رقم الطلب"></i>
                                                         </div>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatOrderDateWithTime(ord)}</span>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                                        <div>
                                                            <span style={{ color: 'var(--text-muted)' }}>العميل:</span>
                                                            <strong style={{ color: '#fff', marginRight: '4px' }}>{ord.client}</strong>
                                                        </div>
                                                        <div>
                                                            <span style={{ color: 'var(--text-muted)' }}>العربون:</span>
                                                            <strong style={{ color: '#2ecc71', marginRight: '4px' }}>{ord.deposit} {currency}</strong>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', borderTop: '1px dashed var(--glass-border)', paddingTop: '6px', marginTop: '2px' }}>
                                                        <span style={{ 
                                                            padding: '2px 6px', 
                                                            borderRadius: '4px',
                                                            background: ord.depositStatus === 'confirmed' ? 'rgba(46, 204, 113, 0.15)' : 'rgba(241, 196, 15, 0.15)',
                                                            color: ord.depositStatus === 'confirmed' ? '#2ecc71' : '#f1c40f'
                                                        }}>
                                                            {ord.depositStatus === 'confirmed' ? 'مؤكد الاستلام' : 'بانتظار التأكيد'}
                                                        </span>
                                                        <span style={{ color: 'var(--text-muted)' }}>سجل بواسطة: {ord.createdBy}</span>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })()}
                        </div>
                    )}
                </div>
            )}

            {/* Section 3: Audit trail/Historical log */}
            {state.currentUser?.role === 'SuperAdmin' && (() => {
                const historyTotalPages = Math.ceil(filteredHistory.length / 10) || 1;
                const safeHistoryPage = Math.min(historyPage, historyTotalPages);
                const startIndex = (safeHistoryPage - 1) * 10;
                const paginatedHistory = filteredHistory.slice(startIndex, startIndex + 10);
                const historyStartItem = filteredHistory.length > 0 ? startIndex + 1 : 0;
                const historyEndItem = Math.min(startIndex + 10, filteredHistory.length);

                return (
                    <div className="glass-card" style={{ padding: '24px', border: '1px solid var(--glass-border)', background: 'var(--glass-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px', flexWrap: 'wrap', gap: '12px' }}>
                            <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '16px', fontWeight: 600 }}>
                                <i className="fa-solid fa-clock-rotate-left" style={{ marginLeft: '8px' }}></i> سجل التسويات والأرشيف التاريخي للعرابين
                            </h3>
                            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
                                <input 
                                    type="text"
                                    className="form-input"
                                    placeholder="بحث برقم الطلب أو العميل..."
                                    value={historySearch}
                                    onChange={(e) => {
                                        setHistorySearch(e.target.value);
                                        setHistoryPage(1);
                                    }}
                                    style={{ width: '200px', padding: '6px 12px', fontSize: '12px', height: '32px' }}
                                />
                                <select
                                    className="form-input"
                                    value={historyAdminFilter}
                                    onChange={(e) => {
                                        setHistoryAdminFilter(e.target.value);
                                        setHistoryPage(1);
                                    }}
                                    style={{ width: '150px', padding: '0 8px', fontSize: '12px', height: '32px', background: 'var(--bg-primary)' }}
                                >
                                    <option value="">-- تصفية بالأدمن --</option>
                                    {(state.users || []).map(u => (
                                        <option key={u.id} value={u.id}>{u.name}</option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        {filteredHistory.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                                <p>لا توجد تسويات أو حركات مؤرشفة مطابقة للبحث.</p>
                            </div>
                        ) : (
                            <>
                                <div className="table-wrapper dc-desktop-only" style={{ overflowX: 'auto' }}>
                                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>رقم الطلب</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>العميل</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>الأدمن المستلم</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>مبلغ العربون</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>الحالة</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>تاريخ الطلب</th>
                                                <th style={{ padding: '12px 8px', textAlign: 'center' }}>مسجل الطلب</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedHistory.map(ord => {
                                                const isExpanded = !!expandedHistoryOrderIds[ord.id];
                                                const parsedAddress = (() => {
                                                    try {
                                                        return JSON.parse(ord.address || '{}');
                                                    } catch {
                                                        return {};
                                                    }
                                                })();
                                                const phone = parsedAddress.phone || '';
                                                const detailAddress = parsedAddress.detailAddress || '';
                                                const remaining = getRemainingToCollect(ord);
                                                const productsSubtotal = (ord.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                                const receiverAdmin = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                                const depositLabel = receiverAdmin ? `العربون المدفوع (${receiverAdmin.name})` : 'العربون المدفوع (Deposit)';

                                                return (
                                                    <React.Fragment key={ord.id}>
                                                        <tr 
                                                            style={{ 
                                                                borderBottom: '1px solid rgba(255,255,255,0.05)', 
                                                                textAlign: 'center',
                                                                background: isExpanded ? 'rgba(212, 175, 55, 0.03)' : 'transparent',
                                                                transition: 'background 0.2s ease'
                                                            }}
                                                        >
                                                            <td 
                                                                style={{ padding: '12px 8px', color: 'var(--gold-primary)', fontWeight: 'bold', cursor: 'pointer' }}
                                                                onClick={() => toggleHistoryOrder(ord.id)}
                                                                title="اضغط لعرض تفاصيل الطلب"
                                                            >
                                                                #{ord.id}
                                                            </td>
                                                            <td 
                                                                style={{ padding: '12px 8px', cursor: 'pointer' }}
                                                                onClick={() => toggleHistoryOrder(ord.id)}
                                                                title="اضغط لعرض تفاصيل الطلب"
                                                            >
                                                                {ord.client}
                                                            </td>
                                                            <td style={{ padding: '12px 8px' }}>{getAdminName(ord.depositReceiverId)}</td>
                                                            <td 
                                                                style={{ 
                                                                    padding: '12px 8px', 
                                                                    fontWeight: 'bold', 
                                                                    color: ord.depositStatus === 'settled' ? '#3498db' : '#ef4444',
                                                                    cursor: 'pointer',
                                                                    textDecoration: 'underline dashed rgba(255,255,255,0.2)'
                                                                }}
                                                                onClick={() => toggleHistoryOrder(ord.id)}
                                                                title="اضغط لعرض تفاصيل الطلب"
                                                            >
                                                                {ord.deposit} {currency}
                                                            </td>
                                                            <td style={{ padding: '12px 8px' }}>
                                                                <span style={{ 
                                                                    fontSize: '11px', 
                                                                    padding: '3px 8px', 
                                                                    borderRadius: '4px',
                                                                    background: ord.depositStatus === 'settled' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                                    color: ord.depositStatus === 'settled' ? '#3498db' : '#ef4444',
                                                                    fontWeight: 600
                                                                }}>
                                                                    {ord.depositStatus === 'settled' ? 'مسواة بالكامل' : 'تم الرفض'}
                                                                </span>
                                                            </td>
                                                            <td style={{ padding: '12px 8px' }}>
                                                                {formatOrderDateWithTime(ord)}
                                                            </td>
                                                            <td style={{ padding: '12px 8px', color: 'var(--text-muted)' }}>{ord.createdBy}</td>
                                                        </tr>
                                                        {isExpanded && (
                                                            <tr style={{ background: 'var(--glass-bg)' }}>
                                                                <td colSpan="7" style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)', textAlign: 'right' }}>
                                                                    <div className="grid-responsive-1-1_3-1" style={{ gap: '24px', direction: 'rtl' }}>
                                                                        
                                                                        {/* Customer details */}
                                                                        <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                            <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                                <i className="fa-solid fa-user-tag" style={{ marginLeft: '6px' }}></i> تفاصيل العميل والشحن
                                                                            </h4>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
                                                                                <div><strong>كود العميل:</strong> {getCustomerCode(ord.client)}</div>
                                                                                <div>
                                                                                    <strong>اسم العميل:</strong> {ord.client}
                                                                                </div>
                                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                                    <strong>رقم الهاتف:</strong> {phone || 'غير مسجل'}
                                                                                    {phone && (
                                                                                        <a 
                                                                                            href={getWhatsAppLink(phone, ord)} 
                                                                                            target="_blank" 
                                                                                            rel="noopener noreferrer"
                                                                                            style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                                                                                            title="مراسلة عبر واتساب"
                                                                                        >
                                                                                            <i className="fa-brands fa-whatsapp" style={{ fontSize: '14px', fontWeight: 'bold' }}></i>
                                                                                        </a>
                                                                                    )}
                                                                                </div>
                                                                                <div><strong>المحافظة:</strong> {ord.governorate || 'غير مسجل'}</div>
                                                                                <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}><strong>العنوان بالتفصيل:</strong> {detailAddress || 'غير مسجل'}</div>
                                                                                {ord.source === 'shopify' && ord.createdBy && ord.createdBy !== 'Shopify Webhook' && (
                                                                                    <div><strong>تمت الموافقة بواسطة:</strong> <span style={{ color: 'var(--gold-primary)' }}>{ord.createdBy}</span></div>
                                                                                )}
                                                                                <div><strong>سجل الطلب بواسطة:</strong> <span style={{ color: ord.source === 'shopify' ? 'var(--text-secondary)' : 'var(--gold-primary)' }}>{ord.source === 'shopify' ? 'Shopify Webhook' : (ord.createdBy || 'الآدمن')}</span></div>
                                                                                {ord.updatedBy && ord.updatedBy !== ord.createdBy && (ord.source !== 'shopify' || ord.updatedBy !== 'Shopify Webhook') && (
                                                                                    <div><strong>تم التعديل بواسطة:</strong> <span style={{ color: 'var(--gold-primary)' }}>{ord.updatedBy}</span></div>
                                                                                )}
                                                                                {ord.discount_reason && (
                                                                                    <div style={{ marginTop: '4px', borderTop: '1px dashed var(--glass-border)', paddingTop: '4px' }}>
                                                                                        <strong>سبب الخصم:</strong> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{ord.discount_reason}</span>
                                                                                    </div>
                                                                                )}
                                                                                {ord.discount_reason_details && (
                                                                                    <div>
                                                                                        <strong>تفاصيل الخصم:</strong> <span style={{ color: 'var(--text-secondary)' }}>{ord.discount_reason_details}</span>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        {/* Products Table */}
                                                                        <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                            <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                                <i className="fa-solid fa-box-open" style={{ marginLeft: '6px' }}></i> المنتجات المطلوبة ({(ord.items || []).length} أصناف)
                                                                            </h4>
                                                                            <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse', color: 'var(--text-primary)' }}>
                                                                                <thead>
                                                                                    <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                                                        <th style={{ textAlign: 'right', padding: '6px 4px' }}>اسم الصنف / SKU</th>
                                                                                        <th style={{ textAlign: 'center', padding: '6px 4px' }}>الكمية</th>
                                                                                        <th style={{ textAlign: 'center', padding: '6px 4px' }}>سعر الوحدة</th>
                                                                                        <th style={{ textAlign: 'left', padding: '6px 4px' }}>الإجمالي</th>
                                                                                    </tr>
                                                                                </thead>
                                                                                <tbody>
                                                                                    {(ord.items || []).map((item, idx) => (
                                                                                        <tr key={idx} style={{ borderBottom: '1px solid var(--glass-bg)' }}>
                                                                                            <td style={{ padding: '8px 4px', textAlign: 'right' }}>{getProductNameBySku(item.variantSku)}</td>
                                                                                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>{item.quantity}</td>
                                                                                            <td style={{ textAlign: 'center', padding: '8px 4px' }}>{currency} {item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                                                            <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 'bold' }}>{currency} {(item.quantity * item.price).toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                                                        </tr>
                                                                                    ))}
                                                                                </tbody>
                                                                            </table>
                                                                        </div>

                                                                        {/* Financial breakdown */}
                                                                        <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                            <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                                <i className="fa-solid fa-file-invoice-dollar" style={{ marginLeft: '6px' }}></i> تفصيل التكلفة
                                                                            </h4>
                                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px', color: 'var(--text-primary)' }}>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                    <span>إجمالي المنتجات:</span>
                                                                                    <span>{currency} {productsSubtotal.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                                    <span>مصاريف الشحن:</span>
                                                                                    <span>+{currency} {(ord.shipping_fee || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71' }}>
                                                                                    <span>{depositLabel}:</span>
                                                                                    <span>-{currency} {(ord.deposit || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                                </div>
                                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: ord.status === 'Cancelled' ? 'var(--text-muted)' : 'var(--gold-primary)', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '8px', marginTop: '4px', fontSize: '13px' }}>
                                                                                    <span>المتبقي للتحصيل:</span>
                                                                                    <span>{ord.status === 'Cancelled' ? 'ملغي' : `${currency} ${remaining > 0 ? remaining.toLocaleString('en-US', {maximumFractionDigits: 2}) : '0.00'}`}</span>
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        )}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile view cards for Section 3 (Historical Log) */}
                                <div className="dc-mobile-cards">
                                    {paginatedHistory.map(ord => {
                                        const isExpanded = !!expandedHistoryOrderIds[ord.id];
                                        const parsedAddress = (() => {
                                            try {
                                                return JSON.parse(ord.address || '{}');
                                            } catch {
                                                return {};
                                            }
                                        })();
                                        const phone = parsedAddress.phone || '';
                                        const detailAddress = parsedAddress.detailAddress || '';
                                        const remaining = getRemainingToCollect(ord);
                                        const productsSubtotal = (ord.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                        const receiverAdmin = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                        const depositLabel = receiverAdmin ? `العربون المدفوع (${receiverAdmin.name})` : 'العربون المدفوع';

                                        return (
                                            <div 
                                                key={ord.id} 
                                                className="sa-mobile-card"
                                                style={{
                                                    background: isExpanded ? 'rgba(212, 175, 55, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '12px',
                                                    padding: '16px',
                                                    display: 'flex',
                                                    flexDirection: 'column',
                                                    gap: '10px',
                                                    transition: 'background 0.2s ease'
                                                }}
                                            >
                                                {/* Header row clickable to expand */}
                                                <div 
                                                    onClick={() => toggleHistoryOrder(ord.id)}
                                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}
                                                >
                                                    <strong style={{ color: 'var(--gold-primary)', fontSize: '15px', fontFamily: 'monospace' }}>#{ord.id}</strong><i className="fa-regular fa-copy" style={{ cursor: 'pointer', opacity: 0.6, fontSize: '11px', color: 'var(--text-secondary)', marginLeft: '6px' }} onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ord.id); showToast('تم نسخ رقم الطلب', 'success'); }} title="نسخ رقم الطلب"></i>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{formatOrderDateWithTime(ord)}</span>
                                                        <i className={`fa-solid ${isExpanded ? 'fa-chevron-up' : 'fa-chevron-down'}`} style={{ fontSize: '11px', color: 'var(--text-muted)' }}></i>
                                                    </div>
                                                </div>

                                                {/* Client & Deposit Amount */}
                                                <div 
                                                    onClick={() => toggleHistoryOrder(ord.id)}
                                                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', cursor: 'pointer' }}
                                                >
                                                    <div>
                                                        <span style={{ color: 'var(--text-muted)' }}>العميل:</span>
                                                        <strong style={{ color: '#fff', marginRight: '6px' }}>{ord.client}</strong>
                                                    </div>
                                                    <div>
                                                        <span style={{ color: 'var(--text-muted)' }}>العربون:</span>
                                                        <strong style={{ 
                                                            color: ord.depositStatus === 'settled' ? '#3498db' : '#ef4444', 
                                                            marginRight: '6px' 
                                                        }}>
                                                            {ord.deposit} {currency}
                                                        </strong>
                                                    </div>
                                                </div>

                                                {/* Status Badges & Admin Info */}
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px' }}>
                                                    <div>
                                                        <span style={{ 
                                                            fontSize: '11px', 
                                                            padding: '3px 8px', 
                                                            borderRadius: '4px',
                                                            background: ord.depositStatus === 'settled' ? 'rgba(52, 152, 219, 0.15)' : 'rgba(239, 68, 68, 0.15)',
                                                            color: ord.depositStatus === 'settled' ? '#3498db' : '#ef4444',
                                                            fontWeight: 600
                                                        }}>
                                                            {ord.depositStatus === 'settled' ? 'مسواة بالكامل' : 'تم الرفض'}
                                                        </span>
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                        <span>الأدمن المستلم: </span>
                                                        <strong style={{ color: 'var(--text-secondary)' }}>{getAdminName(ord.depositReceiverId)}</strong>
                                                    </div>
                                                </div>

                                                {/* Collapsible Details */}
                                                {isExpanded && (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', borderTop: '1px dashed var(--glass-border)', paddingTop: '12px', marginTop: '4px' }}>
                                                        
                                                        {/* Client Details Card */}
                                                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '12px' }}>
                                                            <h4 style={{ fontSize: '12px', color: 'var(--gold-primary)', marginBottom: '8px', fontWeight: 600 }}>
                                                                <i className="fa-solid fa-user-tag" style={{ marginLeft: '6px' }}></i> تفاصيل العميل والشحن
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                                                                <div><strong>كود العميل:</strong> {getCustomerCode(ord.client)}</div>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <strong>رقم الهاتف:</strong> {phone || 'غير مسجل'}
                                                                    {phone && (
                                                                        <a 
                                                                            href={getWhatsAppLink(phone, ord)} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer"
                                                                            style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', textDecoration: 'none' }}
                                                                        >
                                                                            <i className="fa-brands fa-whatsapp" style={{ fontSize: '14px' }}></i>
                                                                        </a>
                                                                    )}
                                                                </div>
                                                                <div><strong>المحافظة:</strong> {ord.governorate || 'غير مسجل'}</div>
                                                                <div style={{ wordBreak: 'break-word', overflowWrap: 'anywhere' }}><strong>العنوان:</strong> {detailAddress || 'غير مسجل'}</div>
                                                                <div><strong>سجل بواسطة:</strong> {ord.createdBy || 'غير معروف'}</div>
                                                                {ord.discount_reason && (
                                                                    <div style={{ marginTop: '4px', borderTop: '1px dashed var(--glass-border)', paddingTop: '4px' }}>
                                                                        <strong>سبب الخصم:</strong> <span style={{ color: '#ef4444', fontWeight: 'bold' }}>{ord.discount_reason}</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {/* Products Card */}
                                                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '12px' }}>
                                                            <h4 style={{ fontSize: '12px', color: 'var(--gold-primary)', marginBottom: '8px', fontWeight: 600 }}>
                                                                <i className="fa-solid fa-box-open" style={{ marginLeft: '6px' }}></i> المنتجات المطلوب ({ (ord.items || []).length } أصناف)
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                                                {(ord.items || []).map((item, idx) => (
                                                                    <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.03)', paddingBottom: '6px', fontSize: '11.5px' }}>
                                                                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                                                                            <span style={{ fontWeight: '500', color: '#fff' }}>{getProductNameBySku(item.variantSku)}</span>
                                                                            <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{item.quantity} قطعة × {currency} {item.price}</span>
                                                                        </div>
                                                                        <span style={{ fontWeight: 'bold', color: 'var(--text-primary)' }}>{currency} {(item.quantity * item.price).toLocaleString()}</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                        {/* Cost Card */}
                                                        <div style={{ background: 'rgba(0,0,0,0.15)', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', fontSize: '12px' }}>
                                                            <h4 style={{ fontSize: '12px', color: 'var(--gold-primary)', marginBottom: '8px', fontWeight: 600 }}>
                                                                <i className="fa-solid fa-file-invoice-dollar" style={{ marginLeft: '6px' }}></i> تفصيل التكلفة
                                                            </h4>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', color: 'var(--text-secondary)' }}>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span>إجمالي المنتجات:</span>
                                                                    <span>{currency} {productsSubtotal.toLocaleString()}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                    <span>مصاريف الشحن:</span>
                                                                    <span>+{currency} {(ord.shipping_fee || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71' }}>
                                                                    <span>{depositLabel}:</span>
                                                                    <span>-{currency} {(ord.deposit || 0).toLocaleString()}</span>
                                                                </div>
                                                                <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: ord.status === 'Cancelled' ? 'var(--text-muted)' : 'var(--gold-primary)', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '6px', marginTop: '4px' }}>
                                                                    <span>المتبقي للتحصيل:</span>
                                                                    <span>{ord.status === 'Cancelled' ? 'ملغي' : `${currency} ${remaining > 0 ? remaining.toLocaleString() : '0.00'}`}</span>
                                                                </div>
                                                            </div>
                                                        </div>

                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        عرض {historyStartItem} - {historyEndItem} من إجمالي {filteredHistory.length} سجل
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button
                                            onClick={() => setHistoryPage(p => Math.max(1, p - 1))}
                                            disabled={safeHistoryPage === 1}
                                            style={{
                                                padding: '6px 14px',
                                                background: safeHistoryPage === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                color: safeHistoryPage === 1 ? 'var(--text-muted)' : '#fff',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '6px',
                                                cursor: safeHistoryPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}
                                        >
                                            السابق
                                        </button>
                                        <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--gold-primary)' }}>
                                            صفحة {safeHistoryPage} من {historyTotalPages}
                                        </span>
                                        <button
                                            onClick={() => setHistoryPage(p => Math.min(historyTotalPages, p + 1))}
                                            disabled={safeHistoryPage === historyTotalPages}
                                            style={{
                                                padding: '6px 14px',
                                                background: safeHistoryPage === historyTotalPages ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                color: safeHistoryPage === historyTotalPages ? 'var(--text-muted)' : '#fff',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '6px',
                                                cursor: safeHistoryPage === historyTotalPages ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}
                                        >
                                            التالي
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                );
            })()}


            {/* Section 4: SuperAdmin Panel for Cancelled and Returned Deposits (Follow-up List) */}
            {state.currentUser?.role === 'SuperAdmin' && (() => {
                const cancelledOrReturnedDeposits = (allOrdersForDeposits || []).filter(o => 
                    o.status === 'Cancelled' && 
                    (parseFloat(o.deposit) || 0) > 0 &&
                    o.depositRefundStatus !== 'returned'
                );

                const getOrderClass = (ord) => {
                    const address = parseAddressData(ord.address);
                    if (address.bostaStateName && (
                        address.bostaStateName.includes('Returned') || 
                        address.bostaStateName.includes('ارجاع') || 
                        address.bostaStateName.includes('مرتجع') || 
                        address.bostaStateCode === 48
                    )) {
                        return 'مرتجع';
                    }
                    return 'ملغي';
                };

                const saTotalPages = Math.ceil(cancelledOrReturnedDeposits.length / 10) || 1;
                const safeSaPage = Math.min(superAdminPage, saTotalPages);
                const startIndex = (safeSaPage - 1) * 10;
                const paginatedSA = cancelledOrReturnedDeposits.slice(startIndex, startIndex + 10);
                const saStartItem = cancelledOrReturnedDeposits.length > 0 ? startIndex + 1 : 0;
                const saEndItem = Math.min(startIndex + 10, cancelledOrReturnedDeposits.length);

                return (
                    <div className="glass-card" style={{ padding: '24px', marginTop: '24px', border: '1px solid rgba(235, 104, 76, 0.3)', background: 'var(--glass-bg)' }}>
                        <style>{`
                            @media (max-width: 768px) {
                                .sa-desktop-only {
                                    display: none !important;
                                }
                                .sa-mobile-cards {
                                    display: flex !important;
                                    flex-direction: column;
                                    gap: 16px;
                                }
                                .sa-mobile-card {
                                    background: rgba(255, 255, 255, 0.02);
                                    border: 1px solid var(--glass-border);
                                    border-radius: 12px;
                                    padding: 16px;
                                    display: flex;
                                    flex-direction: column;
                                    gap: 10px;
                                    position: relative;
                                    transition: transform 0.2s ease, border-color 0.2s ease;
                                }
                                .sa-mobile-card:hover {
                                    border-color: rgba(235, 104, 76, 0.4);
                                }
                            }
                            @media (min-width: 769px) {
                                .sa-desktop-only {
                                    display: block !important;
                                }
                                .sa-mobile-cards {
                                    display: none !important;
                                }
                            }
                            .sa-btn-circle-phone {
                                width: 36px;
                                height: 36px;
                                border-radius: 50% !important;
                                display: inline-flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                font-size: 14px !important;
                                cursor: pointer !important;
                                color: #fff !important;
                                transition: all 0.2s ease !important;
                                text-decoration: none !important;
                                background: linear-gradient(135deg, #e5a93b, #c08418) !important;
                                border: 1px solid rgba(229, 169, 59, 0.3) !important;
                                box-shadow: 0 4px 10px rgba(229, 169, 59, 0.2) !important;
                            }
                            .sa-btn-circle-phone:hover {
                                background: linear-gradient(135deg, #f0be5a, #d49826) !important;
                                transform: translateY(-2px) !important;
                                box-shadow: 0 6px 15px rgba(229, 169, 59, 0.4) !important;
                            }
                            .sa-btn-circle-whatsapp {
                                width: 36px;
                                height: 36px;
                                border-radius: 50% !important;
                                display: inline-flex !important;
                                align-items: center !important;
                                justify-content: center !important;
                                font-size: 16px !important;
                                cursor: pointer !important;
                                color: #fff !important;
                                transition: all 0.2s ease !important;
                                text-decoration: none !important;
                                background: linear-gradient(135deg, #25D366, #128C7E) !important;
                                border: 1px solid rgba(37, 211, 102, 0.3) !important;
                                box-shadow: 0 4px 10px rgba(37, 211, 102, 0.2) !important;
                            }
                            .sa-btn-circle-whatsapp:hover {
                                background: linear-gradient(135deg, #30e374, #149c8c) !important;
                                transform: translateY(-2px) !important;
                                box-shadow: 0 6px 15px rgba(37, 211, 102, 0.4) !important;
                            }
                        `}</style>

                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(235, 104, 76, 0.2)', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0, color: 'var(--gold-primary)', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-rectangle-list"></i>
                                متابعة العرابين للطلبات الملغية والمرتجعة (للسوبر أدمن فقط)
                            </h3>
                            <span style={{ background: 'rgba(212,175,55,0.15)', color: 'var(--gold-primary)', border: '1px solid rgba(212,175,55,0.3)', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                                {cancelledOrReturnedDeposits.length} طلب ملغي/مرتجع بعربون
                            </span>
                        </div>

                        {cancelledOrReturnedDeposits.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                <p>لا توجد طلبات ملغية أو مرتجعة تحتوي على عربون حالياً.</p>
                            </div>
                        ) : (
                            <>
                                {/* Desktop Layout */}
                                <div className="table-wrapper sa-desktop-only" style={{ overflowX: 'auto', display: 'none' }}>
                                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '10px 8px', textAlign: 'right' }}>اسم العميل</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>رقم الهاتف</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'right' }}>المنتجات المطلوبة</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>مبلغ العربون</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>مستلم العربون</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>الحالة</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>تاريخ الإلغاء/الطلب</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>إجراءات الاتصال</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedSA.map(ord => {
                                                const { phone } = parseAddressData(ord.address);
                                                const orderClass = getOrderClass(ord);
                                                const receiverUser = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                                const receiverName = receiverUser ? receiverUser.name : 'أدمن غير معروف';
                                                return (
                                                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{ord.client}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center', direction: 'ltr' }}>{phone || 'غير مسجل'}</td>
                                                        <td style={{ padding: '12px 8px' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', fontSize: '12px' }}>
                                                                {(ord.items || []).map((item, idx) => (
                                                                    <span key={idx}>- {getProductNameBySku(item.variantSku)} (الكمية: {item.quantity})</span>
                                                                ))}
                                                            </div>
                                                        </td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center', fontWeight: 'bold', color: 'var(--gold-primary)' }}>{ord.deposit} {currency}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{receiverName}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <span style={{ 
                                                                padding: '4px 10px', 
                                                                borderRadius: '6px', 
                                                                fontSize: '11px', 
                                                                fontWeight: 'bold',
                                                                background: orderClass === 'مرتجع' ? 'rgba(235, 104, 76, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                                                                color: orderClass === 'مرتجع' ? '#e27474' : '#ff4757',
                                                                border: orderClass === 'مرتجع' ? '1px solid rgba(235, 104, 76, 0.2)' : '1px solid rgba(255, 71, 87, 0.2)'
                                                            }}>
                                                                {orderClass}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center', color: 'var(--text-secondary)' }}>{ord.date}</td>
                                                        <td style={{ padding: '12px 8px', textAlign: 'center' }}>
                                                            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', alignItems: 'center' }}>
                                                                {phone && (
                                                                    <>
                                                                        <a 
                                                                            href={`tel:${phone}`} 
                                                                            className="sa-btn-circle-phone"
                                                                            title="اتصال هاتفياً"
                                                                        >
                                                                            <i className="fa-solid fa-phone"></i>
                                                                        </a>
                                                                        <a 
                                                                            href={getWhatsAppLink(phone, ord)} 
                                                                            target="_blank" 
                                                                            rel="noopener noreferrer" 
                                                                            className="sa-btn-circle-whatsapp"
                                                                            title="مراسلة واتساب"
                                                                        >
                                                                            <i className="fa-brands fa-whatsapp"></i>
                                                                        </a>
                                                                    </>
                                                                )}
                                                                <button
                                                                    onClick={() => handleSettleDeposit(ord.id, ord.deposit)}
                                                                    title="خالص / تم التعامل"
                                                                    style={{
                                                                        background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                                                        border: '1px solid rgba(52, 152, 219, 0.3)',
                                                                        boxShadow: '0 4px 10px rgba(52, 152, 219, 0.2)',
                                                                        color: '#fff',
                                                                        width: '32px',
                                                                        height: '32px',
                                                                        borderRadius: '50%',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        transition: 'all 0.2s ease',
                                                                        padding: 0
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        e.currentTarget.style.transform = 'translateY(-2px)';
                                                                        e.currentTarget.style.boxShadow = '0 6px 15px rgba(52, 152, 219, 0.4)';
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        e.currentTarget.style.transform = 'translateY(0)';
                                                                        e.currentTarget.style.boxShadow = '0 4px 10px rgba(52, 152, 219, 0.2)';
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-check"></i>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Mobile Layout (Card Based) */}
                                <div className="sa-mobile-cards" style={{ display: 'none' }}>
                                    {paginatedSA.map(ord => {
                                         const receiverUser = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                         const receiverName = receiverUser ? receiverUser.name : 'أدمن غير معروف';
                                        const { phone } = parseAddressData(ord.address);
                                        const orderClass = getOrderClass(ord);
                                        return (
                                            <div key={ord.id} className="sa-mobile-card">
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                                    <strong style={{ color: '#fff', fontSize: '14px' }}>{ord.client}</strong>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ord.date}</span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ color: 'var(--text-muted)' }}>العربون:</span>
                                                        <strong style={{ color: 'var(--gold-primary)' }}>{ord.deposit} {currency}</strong>
                                                    </div>
                                                    <span style={{ 
                                                        padding: '3px 8px', 
                                                        borderRadius: '6px', 
                                                        fontSize: '11px', 
                                                        fontWeight: 'bold',
                                                        background: orderClass === 'مرتجع' ? 'rgba(235, 104, 76, 0.1)' : 'rgba(255, 71, 87, 0.1)',
                                                        color: orderClass === 'مرتجع' ? '#e27474' : '#ff4757',
                                                        border: orderClass === 'مرتجع' ? '1px solid rgba(235, 104, 76, 0.2)' : '1px solid rgba(255, 71, 87, 0.2)'
                                                    }}>
                                                        {orderClass}
                                                    </span>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '13px', marginTop: '4px' }}>
                                                     <span style={{ color: 'var(--text-muted)' }}>مستلم العربون:</span>
                                                     <span style={{ color: 'var(--text-primary)', fontWeight: 'bold' }}>{receiverName}</span>
                                                 </div>
                                                <div style={{ fontSize: '12.5px', margin: '4px 0' }}>
                                                    <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>المنتجات المطلوبة:</div>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', paddingRight: '8px' }}>
                                                        {(ord.items || []).map((item, idx) => (
                                                            <span key={idx} style={{ color: 'var(--text-primary)' }}>- {getProductNameBySku(item.variantSku)} (الكمية: {item.quantity})</span>
                                                        ))}
                                                    </div>
                                                </div>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', borderTop: '1px dashed var(--glass-border)', paddingTop: '10px' }}>
                                                    <span style={{ fontSize: '12px', color: 'var(--text-muted)', direction: 'ltr' }}>{phone || 'غير مسجل'}</span>
                                                    <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                                                        {phone && (
                                                            <>
                                                                <a 
                                                                    href={`tel:${phone}`} 
                                                                    className="sa-btn-circle-phone" 
                                                                    title="اتصال هاتفياً"
                                                                >
                                                                    <i className="fa-solid fa-phone"></i>
                                                                </a>
                                                                <a 
                                                                    href={getWhatsAppLink(phone, ord)} 
                                                                    target="_blank" 
                                                                    rel="noopener noreferrer" 
                                                                    className="sa-btn-circle-whatsapp" 
                                                                    title="مراسلة واتساب"
                                                                >
                                                                    <i className="fa-brands fa-whatsapp"></i>
                                                                </a>
                                                            </>
                                                        )}
                                                        <button
                                                            onClick={() => handleSettleDeposit(ord.id, ord.deposit)}
                                                            title="خالص / تم التعامل"
                                                            style={{
                                                                background: 'linear-gradient(135deg, #3498db, #2980b9)',
                                                                border: '1px solid rgba(52, 152, 219, 0.3)',
                                                                boxShadow: '0 4px 10px rgba(52, 152, 219, 0.2)',
                                                                color: '#fff',
                                                                width: '32px',
                                                                height: '32px',
                                                                borderRadius: '50%',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'all 0.2s ease',
                                                                padding: 0
                                                            }}
                                                            onMouseEnter={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(-2px)';
                                                                e.currentTarget.style.boxShadow = '0 6px 15px rgba(52, 152, 219, 0.4)';
                                                            }}
                                                            onMouseLeave={(e) => {
                                                                e.currentTarget.style.transform = 'translateY(0)';
                                                                e.currentTarget.style.boxShadow = '0 4px 10px rgba(52, 152, 219, 0.2)';
                                                            }}
                                                        >
                                                            <i className="fa-solid fa-check"></i>
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>

                                {/* Pagination for Super Admin Follow-up */}
                                {saTotalPages > 1 && (
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', paddingTop: '12px', borderTop: '1px solid rgba(235, 104, 76, 0.2)', fontSize: '13px', flexWrap: 'wrap', gap: '10px' }}>
                                        <span style={{ color: 'var(--text-muted)' }}>
                                            عرض {saStartItem} - {saEndItem} من إجمالي {cancelledOrReturnedDeposits.length} طلب ملغي/مرتجع بعربون
                                        </span>
                                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                            <button
                                                onClick={() => setSuperAdminPage(p => Math.max(1, p - 1))}
                                                disabled={safeSaPage === 1}
                                                style={{
                                                    padding: '6px 14px',
                                                    background: safeSaPage === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                    color: safeSaPage === 1 ? 'var(--text-muted)' : '#fff',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '6px',
                                                    cursor: safeSaPage === 1 ? 'not-allowed' : 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}
                                            >
                                                السابق
                                            </button>
                                            <span style={{ padding: '0 8px', fontWeight: 600, color: 'var(--gold-primary)' }}>
                                                صفحة {safeSaPage} من {saTotalPages}
                                            </span>
                                            <button
                                                onClick={() => setSuperAdminPage(p => Math.min(saTotalPages, p + 1))}
                                                disabled={safeSaPage === saTotalPages}
                                                style={{
                                                    padding: '6px 14px',
                                                    background: safeSaPage === saTotalPages ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                    color: safeSaPage === saTotalPages ? 'var(--text-muted)' : '#fff',
                                                    border: '1px solid var(--glass-border)',
                                                    borderRadius: '6px',
                                                    cursor: safeSaPage === saTotalPages ? 'not-allowed' : 'pointer',
                                                    fontSize: '12px',
                                                    fontWeight: 500
                                                }}
                                            >
                                                التالي
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                );
            })()}

            {/* Modal Preview for Deposit Refund Screenshot */}
            {previewProofUrl && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.85)',
                    backdropFilter: 'blur(8px)',
                    zIndex: 99999,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '20px'
                }} onClick={() => setPreviewProofUrl(null)}>
                    <div style={{
                        background: 'var(--bg-secondary, #1a1d24)',
                        border: '1px solid var(--gold-primary)',
                        borderRadius: '14px',
                        maxWidth: '650px',
                        width: '100%',
                        maxHeight: '90vh',
                        display: 'flex',
                        flexDirection: 'column',
                        overflow: 'hidden',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.7)'
                    }} onClick={e => e.stopPropagation()}>
                        <div style={{
                            padding: '16px 20px',
                            borderBottom: '1px solid var(--glass-border)',
                            display: 'flex',
                            justify: 'space-between',
                            alignItems: 'center',
                            background: 'rgba(0,0,0,0.2)'
                        }}>
                            <h3 style={{ margin: 0, fontSize: '15px', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-image"></i>
                                إثبات إرجاع العربون للطلب #{previewProofUrl.orderId}
                            </h3>
                            <button
                                onClick={() => setPreviewProofUrl(null)}
                                style={{ background: 'none', border: 'none', color: '#fff', fontSize: '18px', cursor: 'pointer' }}
                            >
                                ✕
                            </button>
                        </div>

                        <div style={{ padding: '20px', overflowY: 'auto', textAlign: 'center' }}>
                            <div style={{ marginBottom: '14px', fontSize: '13px', color: 'var(--text-secondary)' }}>
                                العميل: <strong style={{ color: '#fff' }}>{previewProofUrl.client}</strong> | 
                                المبلغ: <strong style={{ color: '#2ecc71' }}>{previewProofUrl.amount} {currency}</strong> | 
                                الأدمن: <strong style={{ color: 'var(--gold-primary)' }}>{previewProofUrl.admin}</strong>
                            </div>

                            <div style={{ background: '#000', padding: '10px', borderRadius: '10px', display: 'inline-block', maxWidth: '100%' }}>
                                <img
                                    src={previewProofUrl.url}
                                    alt="إثبات الإرجاع"
                                    style={{ maxWidth: '100%', maxHeight: '60vh', borderRadius: '6px', objectFit: 'contain' }}
                                />
                            </div>
                        </div>

                        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)' }}>
                            <a
                                href={previewProofUrl.url}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: '#3498db', fontSize: '13px', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '6px' }}
                            >
                                <i className="fa-solid fa-up-right-from-square"></i> فتح الصورة في نافذة جديدة
                            </a>
                            <button
                                onClick={() => setPreviewProofUrl(null)}
                                style={{ padding: '6px 18px', background: 'var(--glass-border)', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontSize: '13px' }}
                            >
                                إغلاق
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
