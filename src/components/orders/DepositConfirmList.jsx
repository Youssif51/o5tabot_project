import React, { useContext, useState, useRef } from 'react';
import { AppContext } from '../../context/AppContext';

export default function DepositConfirmList() {
    const { state, updateDepositStatus, settleAdminsCustody, confirmDepositRefund, confirmDepositAndRefund } = useContext(AppContext);
    const [expandedAdminId, setExpandedAdminId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');
    const [historyAdminFilter, setHistoryAdminFilter] = useState('');
    const [historyPage, setHistoryPage] = useState(1);
    const [proofsPage, setProofsPage] = useState(1);
    // Refund confirmation state: { orderId, file, uploading }
    const [refundConfirm, setRefundConfirm] = useState({});
    const [previewProofUrl, setPreviewProofUrl] = useState(null);
    const fileInputRefs = useRef({});

    const currency = state.storeSettings?.currency || 'EGP';

    // 1. Filter pending deposits assigned to current admin
    const myPendingDeposits = (state.orders || []).filter(o => 
        o.depositReceiverId === state.currentUser?.id && 
        o.depositStatus === 'pending' &&
        (parseFloat(o.deposit) || 0) > 0
    );

    // Orders that were cancelled but this admin still needs to return the deposit
    const myPendingRefunds = (state.orders || []).filter(o =>
        o.depositReceiverId === state.currentUser?.id &&
        o.status === 'Cancelled' &&
        (parseFloat(o.deposit) || 0) > 0 &&
        o.depositRefundStatus === 'awaiting_return'
    );

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

            {/* ⚠️ Section 0: Deposit Refund Required — cancelled orders needing return */}
            {myPendingRefunds.length > 0 && (
                <div className="glass-card" style={{
                    padding: '24px',
                    marginBottom: '24px',
                    border: '1px solid rgba(239,68,68,0.45)',
                    background: 'rgba(239,68,68,0.07)',
                    borderRadius: '12px'
                }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid rgba(239,68,68,0.25)', paddingBottom: '12px' }}>
                        <h3 style={{ margin: 0, color: '#ef4444', fontSize: '16px', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <i className="fa-solid fa-triangle-exclamation"></i>
                            طلبات ملغية — عليك إعادة العربون للعميل
                        </h3>
                        <span style={{ background: 'rgba(239,68,68,0.2)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                            {myPendingRefunds.length} طلب
                        </span>
                    </div>

                    <p style={{ fontSize: '13px', color: '#fca5a5', marginBottom: '20px', lineHeight: 1.6 }}>
                        الطلبات التالية تم إلغاؤها وأنت الأدمن الذي استلم العربون من العميل.
                        يجب عليك إعادة المبلغ وتأكيد ذلك بسكرين شوت كدليل.
                    </p>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        {myPendingRefunds.map(ord => {
                            const rc = refundConfirm[ord.id] || {};
                            const phone = (() => {
                                try {
                                    const parsed = JSON.parse(ord.address || '{}');
                                    return parsed.phone || '';
                                } catch { return ''; }
                            })();
                            return (
                                <div key={ord.id} style={{
                                    background: 'rgba(0,0,0,0.25)',
                                    border: '1px solid rgba(239,68,68,0.3)',
                                    borderRadius: '10px',
                                    padding: '18px 20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '14px'
                                }}>
                                    {/* Order info row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '20px', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رقم الطلب</span>
                                            <span style={{ fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold-primary)', fontSize: '15px' }}>#{ord.id}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>اسم العميل</span>
                                            <span style={{ fontWeight: 600, fontSize: '14px' }}>{ord.client}</span>
                                        </div>
                                        {phone && (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>رقم الهاتف</span>
                                                <span style={{ fontWeight: 600, fontSize: '14px', direction: 'ltr' }}>{phone}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>مبلغ العربون</span>
                                            <span style={{ fontWeight: 800, fontSize: '18px', color: '#ef4444' }}>{ord.deposit} {currency}</span>
                                        </div>
                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>تاريخ الطلب</span>
                                            <span style={{ fontSize: '13px' }}>{ord.date}</span>
                                        </div>
                                    </div>

                                    {/* Alert message */}
                                    <div style={{
                                        background: 'rgba(239,68,68,0.12)',
                                        border: '1px solid rgba(239,68,68,0.3)',
                                        borderRadius: '8px',
                                        padding: '12px 16px',
                                        fontSize: '13px',
                                        color: '#fca5a5',
                                        lineHeight: 1.7
                                    }}>
                                        ⚠️ الطلب رقم <strong style={{ color: '#ef4444' }}>#{ord.id}</strong> الخاص بالعميل{' '}
                                        <strong>{ord.client}</strong>
                                        {phone ? <> صاحب الرقم <strong style={{ direction: 'ltr', display: 'inline-block' }}>{phone}</strong></> : ''}
                                        {' '} — أنت استلمت منه عربون بمبلغ{' '}
                                        <strong style={{ color: '#ef4444', fontSize: '15px' }}>{ord.deposit} {currency}</strong>.
                                        {' '}أكّد أنك أعدته إليه وأرفق سكرين شوت كدليل.
                                    </div>

                                    {/* Upload + Confirm row */}
                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                                        {/* Hidden file input */}
                                        <input
                                            type="file"
                                            accept="image/*"
                                            style={{ display: 'none' }}
                                            ref={el => fileInputRefs.current[ord.id] = el}
                                            onChange={e => handleRefundFileChange(ord.id, e.target.files?.[0] || null)}
                                        />
                                        <button
                                            onClick={() => fileInputRefs.current[ord.id]?.click()}
                                            style={{
                                                padding: '8px 16px',
                                                background: rc.file ? 'rgba(46,204,113,0.15)' : 'rgba(255,255,255,0.07)',
                                                color: rc.file ? '#2ecc71' : 'var(--text-secondary)',
                                                border: `1px solid ${rc.file ? 'rgba(46,204,113,0.4)' : 'var(--glass-border)'}`,
                                                borderRadius: '8px',
                                                cursor: 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 500,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <i className={rc.file ? 'fa-solid fa-circle-check' : 'fa-solid fa-image'}></i>
                                            {rc.file ? `✓ ${rc.file.name}` : 'ارفع سكرين شوت'}
                                        </button>

                                        <button
                                            onClick={() => handleConfirmRefund(ord.id)}
                                            disabled={rc.uploading}
                                            style={{
                                                padding: '8px 22px',
                                                background: rc.uploading ? 'rgba(239,68,68,0.3)' : '#ef4444',
                                                color: '#fff',
                                                border: 'none',
                                                borderRadius: '8px',
                                                cursor: rc.uploading ? 'not-allowed' : 'pointer',
                                                fontSize: '13px',
                                                fontWeight: 700,
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            {rc.uploading ? (
                                                <><i className="fa-solid fa-spinner fa-spin"></i> جاري التأكيد...</>
                                            ) : (
                                                <><i className="fa-solid fa-check-double"></i> نعم، أعدت العربون</>  
                                            )}
                                        </button>

                                        <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                                            {rc.file ? '' : '(يمكن التأكيد بدون سكرين شوت أيضاً)'}
                                        </span>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

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
                                            {paginatedHistory.map(ord => (
                                                <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                                    <td style={{ padding: '12px 8px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>#{ord.id}</td>
                                                    <td style={{ padding: '12px 8px' }}>{ord.client}</td>
                                                    <td style={{ padding: '12px 8px' }}>{getAdminName(ord.depositReceiverId)}</td>
                                                    <td style={{ padding: '12px 8px', fontWeight: 'bold', color: ord.depositStatus === 'settled' ? '#3498db' : '#ef4444' }}>{ord.deposit} {currency}</td>
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
                                            ))}
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

            {/* Section 4: SuperAdmin Archive of Returned Deposit Proof Screenshots */}
            {(() => {
                const returnedRefundsList = (state.orders || []).filter(o => 
                    o.depositRefundStatus === 'returned' || 
                    !!(o.depositRefundScreenshot || o.depositRefundProofUrl)
                );
                const proofsTotalPages = Math.ceil(returnedRefundsList.length / 10) || 1;
                const safeProofsPage = Math.min(proofsPage, proofsTotalPages);
                const startIndex = (safeProofsPage - 1) * 10;
                const paginatedProofs = returnedRefundsList.slice(startIndex, startIndex + 10);
                const proofsStartItem = returnedRefundsList.length > 0 ? startIndex + 1 : 0;
                const proofsEndItem = Math.min(startIndex + 10, returnedRefundsList.length);

                return (
                    <div className="glass-card" style={{ padding: '24px', marginTop: '24px', border: '1px solid rgba(46,204,113,0.3)', background: 'var(--glass-bg)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid rgba(46,204,113,0.2)', paddingBottom: '10px' }}>
                            <h3 style={{ margin: 0, color: '#2ecc71', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <i className="fa-solid fa-receipt"></i>
                                أرشيف إثباتات وسكرينات إرجاع العرابين للعملاء
                            </h3>
                            <span style={{ background: 'rgba(46,204,113,0.15)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.3)', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>
                                {returnedRefundsList.length} إثبات مُسجّل
                            </span>
                        </div>

                        {returnedRefundsList.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                                <p>لا توجد سكرينات إثبات إرجاع عرابين مؤرشفة حالياً.</p>
                            </div>
                        ) : (
                            <>
                                <div className="table-wrapper" style={{ overflowX: 'auto' }}>
                                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>رقم الطلب</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>العميل</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>الأدمن المسؤول</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>مبلغ العربون المسترد</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>حالة الطلب</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>تاريخ الطلب</th>
                                                <th style={{ padding: '10px 8px', textAlign: 'center' }}>معاينة إثبات الإعادة</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {paginatedProofs.map(ord => {
                                                const proof = ord.depositRefundScreenshot || ord.depositRefundProofUrl;
                                                return (
                                                    <tr key={ord.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', textAlign: 'center' }}>
                                                        <td style={{ padding: '10px 8px', fontFamily: 'monospace', fontWeight: 'bold', color: 'var(--gold-primary)' }}>#{ord.id}</td>
                                                        <td style={{ padding: '10px 8px' }}>{ord.client}</td>
                                                        <td style={{ padding: '10px 8px' }}>{getAdminName(ord.depositReceiverId)}</td>
                                                        <td style={{ padding: '10px 8px', fontWeight: 'bold', color: '#2ecc71' }}>{ord.deposit} {currency}</td>
                                                        <td style={{ padding: '10px 8px' }}>
                                                            <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>
                                                                {ord.status === 'Cancelled' ? 'ملغي' : ord.status}
                                                            </span>
                                                        </td>
                                                        <td style={{ padding: '10px 8px' }}>{formatOrderDateWithTime(ord)}</td>
                                                        <td style={{ padding: '10px 8px' }}>
                                                            {proof ? (
                                                                <button
                                                                    onClick={() => setPreviewProofUrl({ url: proof, orderId: ord.id, client: ord.client, amount: ord.deposit, admin: getAdminName(ord.depositReceiverId) })}
                                                                    style={{
                                                                        padding: '6px 14px',
                                                                        fontSize: '12px',
                                                                        background: 'rgba(46,204,113,0.15)',
                                                                        color: '#2ecc71',
                                                                        border: '1px solid rgba(46,204,113,0.4)',
                                                                        borderRadius: '6px',
                                                                        cursor: 'pointer',
                                                                        fontWeight: 600,
                                                                        display: 'inline-flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-eye"></i>
                                                                    عرض سكرين شوت الإثبات
                                                                </button>
                                                            ) : (
                                                                <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>تم التأكيد بدون مرفق</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>

                                {/* Pagination controls */}
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '12px', borderTop: '1px solid rgba(46,204,113,0.2)', fontSize: '13px' }}>
                                    <span style={{ color: 'var(--text-muted)' }}>
                                        عرض {proofsStartItem} - {proofsEndItem} من إجمالي {returnedRefundsList.length} إثبات
                                    </span>
                                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                                        <button
                                            onClick={() => setProofsPage(p => Math.max(1, p - 1))}
                                            disabled={safeProofsPage === 1}
                                            style={{
                                                padding: '6px 14px',
                                                background: safeProofsPage === 1 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                color: safeProofsPage === 1 ? 'var(--text-muted)' : '#fff',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '6px',
                                                cursor: safeProofsPage === 1 ? 'not-allowed' : 'pointer',
                                                fontSize: '12px',
                                                fontWeight: 500
                                            }}
                                        >
                                            السابق
                                        </button>
                                        <span style={{ padding: '0 8px', fontWeight: 600, color: '#2ecc71' }}>
                                            صفحة {safeProofsPage} من {proofsTotalPages}
                                        </span>
                                        <button
                                            onClick={() => setProofsPage(p => Math.min(proofsTotalPages, p + 1))}
                                            disabled={safeProofsPage === proofsTotalPages}
                                            style={{
                                                padding: '6px 14px',
                                                background: safeProofsPage === proofsTotalPages ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.08)',
                                                color: safeProofsPage === proofsTotalPages ? 'var(--text-muted)' : '#fff',
                                                border: '1px solid var(--glass-border)',
                                                borderRadius: '6px',
                                                cursor: safeProofsPage === proofsTotalPages ? 'not-allowed' : 'pointer',
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
