import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';

export default function DepositConfirmList() {
    const { state, updateDepositStatus, settleAdminsCustody } = useContext(AppContext);
    const [expandedAdminId, setExpandedAdminId] = useState(null);
    const [historySearch, setHistorySearch] = useState('');
    const [historyAdminFilter, setHistoryAdminFilter] = useState('');

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
            {state.currentUser?.role === 'SuperAdmin' && (
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
                                onChange={(e) => setHistorySearch(e.target.value)}
                                style={{ width: '200px', padding: '6px 12px', fontSize: '12px', height: '32px' }}
                            />
                            <select
                                className="form-input"
                                value={historyAdminFilter}
                                onChange={(e) => setHistoryAdminFilter(e.target.value)}
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
                                    {filteredHistory.map(ord => (
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
                    )}
                </div>
            )}
        </div>
    );
}
