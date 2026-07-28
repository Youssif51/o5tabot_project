import React, { useContext, useState, useMemo, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';

export default function MarketingView() {
    const { state, addInfluencer, deleteInfluencer, showToast } = useContext(AppContext);
    
    const [formData, setFormData] = useState({
        name: '',
        code: '',
        type: 'percentage',
        value: '',
        endDate: '',
        usageLimit: '',
        minOrderValue: '',
        oncePerCustomer: true
    });
    const [loading, setLoading] = useState(false);
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [expandedInfluencer, setExpandedInfluencer] = useState(null);

    // Dynamic responsive styles injection
    useEffect(() => {
        const styleId = 'marketing-view-styles';
        if (!document.getElementById(styleId)) {
            const style = document.createElement('style');
            style.id = styleId;
            style.innerHTML = `
                /* Mobile Card Styles */
                .mobile-marketing-cards {
                    display: none;
                    flex-direction: column;
                    gap: 16px;
                    margin-top: 16px;
                }
                .marketing-mobile-card {
                    background: var(--glass-bg);
                    border: 1px solid var(--glass-border);
                    border-radius: 16px;
                    padding: 20px;
                    transition: transform 0.2s ease, box-shadow 0.2s ease;
                }
                .marketing-mobile-card:active {
                    transform: scale(0.98);
                }
                
                @media (max-width: 768px) {
                    .desktop-marketing-table {
                        display: none !important;
                    }
                    .mobile-marketing-cards {
                        display: flex !important;
                    }
                    .dashboard-grid {
                        grid-template-columns: 1fr !important;
                    }
                }

                /* General Enhancements */
                .glass-card {
                    transition: box-shadow 0.3s ease, border-color 0.3s ease;
                }
                .glass-card:hover {
                    border-color: rgba(212, 175, 55, 0.3);
                    box-shadow: 0 8px 32px rgba(212, 175, 55, 0.04);
                }
                .hover-row {
                    cursor: pointer;
                }
                .hover-row:hover {
                    background: rgba(255, 255, 255, 0.03) !important;
                }
                
                /* Custom animations for expandable details */
                .details-drawer {
                    animation: slideDown 0.3s ease-out forwards;
                }
                @keyframes slideDown {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
            `;
            document.head.appendChild(style);
        }
        return () => {
            const existing = document.getElementById(styleId);
            if (existing) existing.remove();
        };
    }, []);

    // Calculate Analytics
    const analytics = useMemo(() => {
        const stats = {};
        
        // Initialize stats for each influencer
        (state.influencers || []).forEach(inf => {
            stats[inf.code] = {
                ...inf,
                usageCount: 0,
                totalRevenue: 0,
                orders: []
            };
        });

        // Loop through all orders to find usage
        (state.orders || []).forEach(order => {
            if (order.applied_coupon_code) {
                const normCode = String(order.applied_coupon_code).trim().toUpperCase();
                if (stats[normCode]) {
                    stats[normCode].usageCount += 1;
                    stats[normCode].totalRevenue += (order.totalValue || order.total_value || 0);
                    stats[normCode].orders.push(order);
                }
            }
        });

        // Convert to array and sort by revenue descending
        return Object.values(stats).sort((a, b) => b.totalRevenue - a.totalRevenue);
    }, [state.influencers, state.orders]);

    const handleCreateDiscount = async (e) => {
        e.preventDefault();
        
        if (!formData.name || !formData.code || !formData.value) {
            showToast("الرجاء تعبئة جميع الحقول المطلوبة", "error");
            return;
        }

        if ((state.influencers || []).some(i => i.code.toLowerCase() === formData.code.toLowerCase())) {
            showToast("هذا الكود مستخدم بالفعل", "error");
            return;
        }

        setLoading(true);
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/swift-processor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    action: 'create_discount',
                    code: formData.code,
                    type: formData.type,
                    value: formData.value,
                    endDate: formData.endDate || undefined,
                    usageLimit: formData.usageLimit || undefined,
                    minOrderValue: formData.minOrderValue || undefined,
                    oncePerCustomer: formData.oncePerCustomer
                })
            });
            
            const data = await response.json();
            
            if (!response.ok || data?.error) {
                console.error("Shopify Sync Error Details:", data);
                throw new Error(data?.details || data?.error || "فشل في إنشاء الكود في شوبيفاي");
            }

            const newInfluencer = {
                id: crypto.randomUUID(),
                name: formData.name,
                code: formData.code.toUpperCase(),
                type: formData.type,
                value: parseFloat(formData.value),
                endDate: formData.endDate || null,
                usageLimit: formData.usageLimit || null,
                minOrderValue: formData.minOrderValue || null,
                createdAt: new Date().toISOString()
            };

            await addInfluencer(newInfluencer);
            setFormData({ name: '', code: '', type: 'percentage', value: '', endDate: '', usageLimit: '', minOrderValue: '', oncePerCustomer: true });
            setShowAdvanced(false);
        } catch (err) {
            console.error(err);
            const errStr = String(err.message || "");
            if (errStr.includes("must be unique") || errStr.includes("already exists") || errStr.includes("unique")) {
                showToast("هذا الكود موجود بالفعل على شوبيفاي، تم ربط المؤثر بالخصم بنجاح محلياً!", "success");
                
                const newInfluencer = {
                    id: crypto.randomUUID(),
                    name: formData.name,
                    code: formData.code.toUpperCase(),
                    type: formData.type,
                    value: parseFloat(formData.value),
                    endDate: formData.endDate || null,
                    usageLimit: formData.usageLimit || null,
                    minOrderValue: formData.minOrderValue || null,
                    createdAt: new Date().toISOString()
                };

                await addInfluencer(newInfluencer);
                setFormData({ name: '', code: '', type: 'percentage', value: '', endDate: '', usageLimit: '', minOrderValue: '', oncePerCustomer: true });
                setShowAdvanced(false);
            } else {
                showToast(`خطأ: ${err.message}`, "error");
            }
        } finally {
            setLoading(false);
        }
    };

    const sortedAnalytics = [...analytics].sort((a, b) => b.totalRevenue - a.totalRevenue);
    const currency = state.storeSettings?.currency || "ج.م";

    return (
        <div className="view-pane active" dir="rtl">
            <div className="page-header" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
                <div style={{
                    width: '45px',
                    height: '45px',
                    background: 'linear-gradient(135deg, var(--gold-primary), #c08418)',
                    borderRadius: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 4px 15px rgba(212, 175, 55, 0.2)'
                }}>
                    <i className="fa-solid fa-bullhorn" style={{ color: '#000', fontSize: '20px' }}></i>
                </div>
                <div className="page-title-group" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '22px', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>التسويق والمؤثرين</h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>إدارة أكواد الخصم والعمولات الخاصة بشركاء التسويق</p>
                </div>
            </div>

            <div className="grid-responsive-fit-400" style={{ marginBottom: '24px' }}>
                {/* Form Card */}
                <div className="glass-card" style={{ padding: '24px', borderRadius: '16px' }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 24px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-user-plus" style={{ color: 'var(--gold-primary)' }}></i> إضافة مؤثر جديد
                    </h3>
                    
                    <form onSubmit={handleCreateDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>اسم المؤثر / الاستريمر</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="مثال: أخطبوط" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                required
                                style={{ borderRadius: '8px', border: '1px solid var(--glass-border)', padding: '12px' }}
                            />
                        </div>
                        
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>كود الخصم (لشوبيفاي والسيستم)</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="مثال: A5-10" 
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                required
                                style={{ textTransform: 'uppercase', letterSpacing: '1px', borderRadius: '8px', border: '1px solid var(--glass-border)', padding: '12px' }}
                            />
                        </div>

                        <div className="grid-responsive-2col">
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>نوع الخصم</label>
                                <select 
                                    className="form-input form-select" 
                                    value={formData.type}
                                    onChange={e => setFormData({...formData, type: e.target.value})}
                                    style={{ 
                                        appearance: 'none', 
                                        backgroundImage: 'url("data:image/svg+xml;charset=US-ASCII,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%22292.4%22%20height%3D%22292.4%22%3E%3Cpath%20fill%3D%22%23FFFFFF%22%20d%3D%22M287%2069.4a17.6%2017.6%200%200%200-13-5.4H18.4c-5%200-9.3%201.8-12.9%205.4A17.6%2017.6%200%200%200%200%2082.2c0%205%201.8%209.3%205.4%2012.9l128%20127.9c3.6%203.6%207.8%205.4%2012.8%205.4s9.2-1.8%2012.8-5.4L287%2095c3.5-3.5%205.4-7.8%205.4-12.8%200-5-1.9-9.2-5.5-12.8z%22%2F%3E%3C%2Fsvg%3E")',
                                        backgroundRepeat: 'no-repeat',
                                        backgroundPosition: 'left 16px center',
                                        backgroundSize: '10px auto',
                                        paddingLeft: '40px',
                                        cursor: 'pointer',
                                        borderRadius: '8px',
                                        border: '1px solid var(--glass-border)'
                                    }}
                                >
                                    <option value="percentage" style={{ background: '#1e2128', color: '#ffffff', padding: '12px' }}>نسبة مئوية (%)</option>
                                    <option value="fixed_amount" style={{ background: '#1e2128', color: '#ffffff', padding: '12px' }}>مبلغ ثابت</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label" style={{ fontWeight: '600', color: 'var(--text-secondary)' }}>قيمة الخصم</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder="15" 
                                    value={formData.value}
                                    onChange={e => setFormData({...formData, value: e.target.value})}
                                    required
                                    min="1"
                                    style={{ borderRadius: '8px', border: '1px solid var(--glass-border)', padding: '12px' }}
                                />
                            </div>
                        </div>

                        <div style={{ marginTop: '8px' }}>
                            <button 
                                type="button"
                                className="btn"
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                style={{ background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', width: '100%', padding: '12px', borderRadius: '8px', border: '1px solid var(--glass-border)', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            >
                                <i className="fa-solid fa-sliders"></i> إعدادات شوبيفاي المتقدمة {showAdvanced ? <i className="fa-solid fa-chevron-up" style={{ fontSize: '10px' }}></i> : <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>}
                            </button>

                            {showAdvanced && (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">تاريخ الانتهاء (اختياري)</label>
                                        <input 
                                            type="date" 
                                            className="form-input" 
                                            value={formData.endDate}
                                            onChange={e => setFormData({...formData, endDate: e.target.value})}
                                            min={new Date().toISOString().split('T')[0]}
                                            onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                                            style={{ colorScheme: 'dark', cursor: 'pointer', borderRadius: '8px' }}
                                        />
                                    </div>
                                    <div className="grid-responsive-2col">
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">حد الاستخدام</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="مثال: 100" 
                                                value={formData.usageLimit}
                                                onChange={e => setFormData({...formData, usageLimit: e.target.value})}
                                                min="1"
                                                style={{ borderRadius: '8px' }}
                                            />
                                        </div>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">الحد الأدنى للطلب</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="مثال: 500" 
                                                value={formData.minOrderValue}
                                                onChange={e => setFormData({...formData, minOrderValue: e.target.value})}
                                                min="1"
                                                style={{ borderRadius: '8px' }}
                                            />
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}>
                                        <input 
                                            type="checkbox" 
                                            id="oncePerCustomer"
                                            checked={formData.oncePerCustomer}
                                            onChange={e => setFormData({...formData, oncePerCustomer: e.target.checked})}
                                        />
                                        <label htmlFor="oncePerCustomer" style={{ margin: 0, cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)' }}>الاستخدام مرة واحدة فقط لكل عميل</label>
                                    </div>
                                </div>
                            )}
                        </div>

                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            style={{ 
                                padding: '14px', 
                                marginTop: '12px', 
                                fontSize: '15px', 
                                background: 'linear-gradient(135deg, var(--gold-primary), #c08418)', 
                                color: '#000', 
                                border: 'none', 
                                fontWeight: 600, 
                                borderRadius: '8px',
                                display: 'flex', 
                                justifyContent: 'center', 
                                alignItems: 'center', 
                                gap: '8px',
                                boxShadow: '0 4px 15px rgba(212, 175, 55, 0.15)'
                            }}
                            disabled={loading}
                        >
                            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-brands fa-shopify"></i>}
                            <span>{loading ? 'جاري الربط مع شوبيفاي...' : 'إضافة وإنشاء كود في شوبيفاي'}</span>
                        </button>
                    </form>
                </div>

                {/* Analytics Card */}
                <div className="glass-card" style={{ padding: '24px', borderRadius: '16px', display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                    <div>
                        <h3 style={{ fontSize: '18px', margin: '0 0 24px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-chart-pie" style={{ color: 'var(--gold-primary)' }}></i> ملخص الأداء
                        </h3>
                        
                        <div className="grid-responsive-2col" style={{ marginBottom: '16px' }}>
                            <div className="glass-card" style={{ 
                                padding: '20px', 
                                borderRadius: '16px',
                                border: '1px solid rgba(212, 175, 55, 0.25)', 
                                background: 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.12) 0%, var(--glass-bg) 80%)',
                                boxShadow: '0 8px 24px rgba(212, 175, 55, 0.05)',
                                textAlign: 'center' 
                            }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--gold-primary)', marginBottom: '4px' }}>{state.influencers?.length || 0}</div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>عدد المؤثرين</div>
                            </div>
                            <div className="glass-card" style={{ 
                                padding: '20px', 
                                borderRadius: '16px',
                                border: '1px solid rgba(46, 213, 115, 0.25)', 
                                background: 'radial-gradient(circle at top right, rgba(46, 213, 115, 0.12) 0%, var(--glass-bg) 80%)',
                                boxShadow: '0 8px 24px rgba(46, 213, 115, 0.05)',
                                textAlign: 'center' 
                            }}>
                                <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#2ecc71', marginBottom: '4px' }}>
                                    {analytics.reduce((sum, inf) => sum + inf.usageCount, 0)}
                                </div>
                                <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600' }}>إجمالي الطلبات المباعة</div>
                            </div>
                        </div>
                    </div>
                    
                    <div className="glass-card" style={{ 
                        padding: '24px', 
                        borderRadius: '16px',
                        border: '1px solid rgba(229, 169, 59, 0.3)', 
                        background: 'radial-gradient(circle at top right, rgba(229, 169, 59, 0.15) 0%, var(--glass-bg) 80%)',
                        boxShadow: '0 8px 24px rgba(229, 169, 59, 0.08)',
                        textAlign: 'center' 
                    }}>
                        <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '6px' }}>إجمالي مبيعات شركاء التسويق</div>
                        <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
                            {analytics.reduce((sum, inf) => sum + inf.totalRevenue, 0).toLocaleString()} {currency}
                        </div>
                    </div>
                </div>
            </div>

            {/* Leaderboard Table / Cards */}
            <div className="table-card glass-card" style={{ marginTop: '24px', borderRadius: '16px', overflow: 'hidden' }}>
                <div className="card-header-bar" style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '18px', margin: 0, fontWeight: 'bold', color: 'var(--text-primary)' }}>لوحة متصدري المبيعات (Leaderboard)</h3>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>انقر على أي مؤثر لعرض تفاصيل طلباته</span>
                </div>
                
                {analytics.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <img src="/icons/Discount-2.svg" alt="Empty" style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.2, filter: 'invert(0.5)' }} />
                        <p style={{ margin: 0 }}>لا توجد بيانات لعرضها. قم بإضافة مؤثرين أولاً!</p>
                    </div>
                ) : (
                    <>
                        {/* Desktop Table */}
                        <div className="table-wrapper desktop-marketing-table" style={{ width: '100%' }}>
                            <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>الترتيب</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>اسم المؤثر</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>كود الخصم</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>قيمة الخصم</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>عدد الطلبات</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>إجمالي المبيعات</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>متوسط الطلب</th>
                                        <th style={{ textAlign: 'center', padding: '16px' }}>إجراءات</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAnalytics.map((inf, index) => {
                                        const isExpanded = expandedInfluencer === inf.code;
                                        return (
                                            <React.Fragment key={inf.id}>
                                                <tr 
                                                    className="hover-row" 
                                                    style={{ borderBottom: '1px solid var(--glass-border)', background: isExpanded ? 'rgba(212, 175, 55, 0.03)' : 'transparent' }}
                                                    onClick={() => setExpandedInfluencer(isExpanded ? null : inf.code)}
                                                >
                                                    <td style={{ textAlign: 'center', padding: '16px', fontWeight: 'bold', color: index === 0 ? '#f1c40f' : index === 1 ? '#bdc3c7' : index === 2 ? '#cd7f32' : 'var(--text-secondary)' }}>
                                                        {index === 0 ? '👑 #1' : `#${index + 1}`}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px', fontWeight: 'bold' }}>
                                                        {inf.name}
                                                        {(inf.endDate || inf.usageLimit) && (
                                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 'normal' }}>
                                                                {inf.endDate && <span style={{ marginLeft: '8px' }}><i className="fa-regular fa-clock"></i> ينتهي: {new Date(inf.endDate).toLocaleDateString('ar-EG')}</span>}
                                                                {inf.usageLimit && <span><i className="fa-solid fa-users"></i> حد: {inf.usageLimit}</span>}
                                                            </div>
                                                        )}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px' }}>
                                                        <span style={{ 
                                                            background: 'linear-gradient(135deg, rgba(212, 175, 55, 0.15), rgba(192, 132, 24, 0.05))', 
                                                            color: 'var(--gold-primary)', 
                                                            padding: '6px 12px', 
                                                            borderRadius: '6px', 
                                                            border: '1px solid rgba(212, 175, 55, 0.3)', 
                                                            fontFamily: 'monospace', 
                                                            fontWeight: 'bold',
                                                            letterSpacing: '1px' 
                                                        }}>
                                                            {inf.code}
                                                        </span>
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px' }}>
                                                        {inf.type === 'percentage' ? `${inf.value}%` : `${inf.value} ${currency}`}
                                                        {inf.minOrderValue && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>فوق {inf.minOrderValue}</div>}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px', fontWeight: 'bold' }}>
                                                        {inf.usageCount}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px', fontWeight: 'bold', color: '#2ecc71' }}>
                                                        {inf.totalRevenue.toLocaleString()} {currency}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px', color: 'var(--text-secondary)' }}>
                                                        {inf.usageCount > 0 ? Math.round(inf.totalRevenue / inf.usageCount).toLocaleString() : 0} {currency}
                                                    </td>
                                                    <td style={{ textAlign: 'center', padding: '16px' }} onClick={e => e.stopPropagation()}>
                                                        <button 
                                                            className="btn-icon" 
                                                            style={{ 
                                                                color: '#e74c3c', 
                                                                border: 'none', 
                                                                background: 'rgba(231, 76, 60, 0.1)', 
                                                                width: '32px', 
                                                                height: '32px', 
                                                                borderRadius: '50%',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                cursor: 'pointer',
                                                                transition: 'background 0.2s'
                                                            }}
                                                            onClick={() => {
                                                                if(window.confirm('هل أنت متأكد من حذف هذا المؤثر نهائياً من شوبيفاي والسيستم؟')) {
                                                                    deleteInfluencer(inf.id);
                                                                }
                                                            }}
                                                            title="حذف المؤثر"
                                                        >
                                                            <i className="fa-regular fa-trash-can"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                                
                                                {/* Expanded Details Drawer */}
                                                {isExpanded && (
                                                    <tr className="details-drawer">
                                                        <td colSpan={8} style={{ padding: '24px', background: 'rgba(0, 0, 0, 0.2)', borderBottom: '1px solid var(--glass-border)' }}>
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                <h4 style={{ margin: 0, fontSize: '15px', color: 'var(--gold-primary)', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold' }}>
                                                                    <i className="fa-solid fa-list-check"></i> قائمة المبيعات المحققة لكود ({inf.code})
                                                                </h4>
                                                                {inf.orders.length === 0 ? (
                                                                    <div style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: '8px' }}>
                                                                        لا توجد طلبات مسجلة لهذا الكود بعد.
                                                                    </div>
                                                                ) : (
                                                                    <div className="table-wrapper" style={{ maxHeight: '300px', overflowY: 'auto', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                                                                        <table className="custom-table" style={{ width: '100%', fontSize: '13px' }}>
                                                                            <thead>
                                                                                <tr style={{ background: 'rgba(0,0,0,0.1)' }}>
                                                                                    <th style={{ padding: '12px' }}>رقم الطلب</th>
                                                                                    <th style={{ padding: '12px' }}>تاريخ الطلب</th>
                                                                                    <th style={{ padding: '12px' }}>العميل</th>
                                                                                    <th style={{ padding: '12px' }}>المصدر</th>
                                                                                    <th style={{ padding: '12px' }}>حالة الشحن</th>
                                                                                    <th style={{ padding: '12px' }}>إجمالي القيمة</th>
                                                                                </tr>
                                                                            </thead>
                                                                            <tbody>
                                                                                {inf.orders.map(order => (
                                                                                    <tr key={order.id} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                                                                        <td style={{ padding: '12px', fontWeight: 'bold' }}>{order.id}</td>
                                                                                        <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>{order.date}</td>
                                                                                        <td style={{ padding: '12px', fontWeight: '500' }}>{order.client}</td>
                                                                                        <td style={{ padding: '12px' }}>
                                                                                            <span className={`source-badge ${order.source}`} style={{
                                                                                                padding: '2px 8px',
                                                                                                borderRadius: '4px',
                                                                                                fontSize: '11px',
                                                                                                background: order.source === 'shopify' ? '#95a5a6' : '#27ae60',
                                                                                                color: '#fff'
                                                                                            }}>
                                                                                                {order.source === 'shopify' ? 'شوبيفاي' : 'يدوي'}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td style={{ padding: '12px' }}>
                                                                                            <span className={`status-badge ${order.status?.toLowerCase()}`}>
                                                                                                {order.status}
                                                                                            </span>
                                                                                        </td>
                                                                                        <td style={{ padding: '12px', fontWeight: 'bold', color: '#2ecc71' }}>
                                                                                            {order.totalValue?.toLocaleString()} {currency}
                                                                                        </td>
                                                                                    </tr>
                                                                                ))}
                                                                            </tbody>
                                                                        </table>
                                                                    </div>
                                                                )}
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

                        {/* Mobile Cards (Visible only < 768px) */}
                        <div className="mobile-marketing-cards" style={{ padding: '16px' }}>
                            {sortedAnalytics.map((inf, index) => {
                                const isExpanded = expandedInfluencer === inf.code;
                                return (
                                    <div key={inf.id} className="marketing-mobile-card">
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                                            <span style={{ fontWeight: 'bold', color: 'var(--gold-primary)', fontSize: '15px' }}>
                                                {index === 0 ? '👑 #1 المتصدر' : `#${index + 1}`}
                                            </span>
                                            <button 
                                                style={{ border: 'none', background: 'transparent', color: '#e74c3c', padding: '4px', cursor: 'pointer' }}
                                                onClick={() => {
                                                    if(window.confirm('هل أنت متأكد من حذف هذا المؤثر نهائياً من شوبيفاي والسيستم؟')) {
                                                        deleteInfluencer(inf.id);
                                                    }
                                                }}
                                            >
                                                <i className="fa-regular fa-trash-can" style={{ fontSize: '16px' }}></i>
                                            </button>
                                        </div>

                                        <h4 style={{ margin: '0 0 8px 0', fontSize: '16px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{inf.name}</h4>
                                        
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                                            <span style={{ background: 'rgba(212,175,55,0.1)', color: 'var(--gold-primary)', border: '1px solid rgba(212,175,55,0.3)', padding: '2px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '13px' }}>
                                                {inf.code}
                                            </span>
                                            <span style={{ background: 'rgba(255,255,255,0.05)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                                                الخصم: {inf.type === 'percentage' ? `${inf.value}%` : `${inf.value} ${currency}`}
                                            </span>
                                        </div>

                                        <div className="grid-responsive-2col" style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginBottom: '12px', gap: '12px' }}>
                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>عدد الطلبات</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>{inf.usageCount} أوردر</div>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>إجمالي المبيعات</div>
                                                <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#2ecc71' }}>{inf.totalRevenue.toLocaleString()} {currency}</div>
                                            </div>
                                        </div>

                                        <button 
                                            className="btn"
                                            style={{ width: '100%', background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '8px', fontSize: '12px', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '6px' }}
                                            onClick={() => setExpandedInfluencer(isExpanded ? null : inf.code)}
                                        >
                                            <i className="fa-solid fa-list-ul"></i> {isExpanded ? 'إخفاء التفاصيل' : 'عرض الطلبات التفصيلية'}
                                        </button>

                                        {/* Mobile Expanded Details */}
                                        {isExpanded && (
                                            <div className="details-drawer" style={{ marginTop: '16px', background: 'rgba(0,0,0,0.15)', borderRadius: '12px', padding: '12px', border: '1px solid var(--glass-border)' }}>
                                                <h5 style={{ margin: '0 0 10px 0', fontSize: '13px', fontWeight: 'bold', color: 'var(--gold-primary)' }}>أوردرات المؤثر:</h5>
                                                {inf.orders.length === 0 ? (
                                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>لا توجد مبيعات بعد</div>
                                                ) : (
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                                                        {inf.orders.map(order => (
                                                            <div key={order.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '8px' }}>
                                                                <div>
                                                                    <div style={{ fontSize: '12px', fontWeight: 'bold' }}>{order.id}</div>
                                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{order.client} | {order.date}</div>
                                                                </div>
                                                                <div style={{ textAlign: 'left' }}>
                                                                    <div style={{ fontSize: '12px', fontWeight: 'bold', color: '#2ecc71' }}>{order.totalValue} {currency}</div>
                                                                    <span className={`status-badge ${order.status?.toLowerCase()}`} style={{ fontSize: '10px', padding: '0 4px' }}>{order.status}</span>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}
