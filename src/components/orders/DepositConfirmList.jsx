import React, { useContext, useState, useRef } from 'react';
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
    return { detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode, bostaStateName, bostaStateCode, bostaTrackingNumber, bostaExceptionReason };
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
    const { state, updateDepositStatus, settleAdminsCustody } = useContext(AppContext);
    const [expandedAdminId, setExpandedAdminId] = useState(null);
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

    const getWhatsAppLink = (phoneStr, ord) => {
        if (!phoneStr) return '';
        let clean = phoneStr.replace(/\D/g, '');
        if (clean.startsWith('01') && clean.length === 11) {
            clean = '2' + clean;
        } else if (clean.startsWith('1') && clean.length === 10) {
            clean = '20' + clean;
        }
        
        let textParam = '';
        if (ord) {
            const itemsText = (ord.items || []).map(item => `- ${getProductNameBySku(item.variantSku)} (الكمية: ${item.quantity})`).join('\n');
            const clientName = ord.client || '';
            const msg = `أهلاً يا ${clientName}، يارب تكون بخير.\n\nبخصوص طلبك من متجر اخطبوط:\n${itemsText}\n\nحابب أأكد مع حضرتك الاوردر ودفع عربون بسيط عشان نبدأ نشحن لحضرتك الاوردر.`;
            textParam = `?text=${encodeURIComponent(msg)}`;
        }
        return `https://wa.me/${clean}${textParam}`;
    };

    const currency = state.storeSettings?.currency || 'EGP';

    // 1. Filter pending deposits assigned to current admin
    const myPendingDeposits = (state.orders || []).filter(o => 
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

        (state.orders || []).forEach(o => {
            if (o.deposit > 0 && o.depositReceiverId) {
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
    const historicalDeposits = (state.orders || []).filter(o => 
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
                    <div className="table-wrapper" style={{ overflowX: 'auto' }}>
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
                                    <tr key={ord.id} style={{ borderBottom: '1px solid var(--glass-bg)', textAlign: 'center' }}>
                                        <td style={{ padding: '12px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold-primary)' }}>#{ord.id}</td>
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
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
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
                                        <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto' }}>
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
                                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
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
                                                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '24px', direction: 'rtl' }}>
                                                                        
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
                                                                                <div><strong>العنوان بالتفصيل:</strong> {detailAddress || 'غير مسجل'}</div>
                                                                                <div><strong>سجل الطلب بواسطة:</strong> <span style={{ color: 'var(--gold-primary)' }}>{ord.createdBy || 'غير معروف'}</span></div>
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
                const cancelledOrReturnedDeposits = (state.orders || []).filter(o => 
                    o.status === 'Cancelled' && 
                    (parseFloat(o.deposit) || 0) > 0
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
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>الحالة</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>تاريخ الإلغاء/الطلب</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>إجراءات الاتصال</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedSA.map(ord => {
                                                const { phone } = parseAddressData(ord.address);
                                                const orderClass = getOrderClass(ord);
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
                                                    <div style={{ display: 'flex', gap: '10px' }}>
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
        </div>
    );
}
