import React, { useContext, useState, useMemo } from 'react';
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
            if (order.applied_coupon_code && stats[order.applied_coupon_code]) {
                stats[order.applied_coupon_code].usageCount += 1;
                stats[order.applied_coupon_code].totalRevenue += (order.total_value || 0);
                stats[order.applied_coupon_code].orders.push(order);
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
            
            showToast("تم إضافة المؤثر وربط الكود بنجاح مع شوبيفاي!", "success");

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
            showToast(`خطأ: ${err.message}`, "error");
        } finally {
            setLoading(false);
        }
    };

    const sortedAnalytics = [...analytics].sort((a, b) => b.totalRevenue - a.totalRevenue);

    return (
        <div className="view-pane active" dir="rtl">
            <div className="page-header" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', gap: '12px', justifyContent: 'flex-start' }}>
                <img src="/icons/promo-code.png" alt="Marketing" style={{ width: '32px', height: '32px', filter: 'brightness(0) invert(1)' }} />
                <div className="page-title-group" style={{ display: 'flex', flexDirection: 'column' }}>
                    <h2 style={{ fontSize: '22px', margin: 0, color: 'var(--text-primary)', fontWeight: 'bold' }}>التسويق والمؤثرين</h2>
                    <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>إدارة أكواد الخصم والعمولات الخاصة بشركاء التسويق</p>
                </div>
            </div>

            <div className="dashboard-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', marginBottom: '24px', gap: '24px' }}>
                {/* Form Card */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 24px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-user-plus" style={{ color: 'var(--gold-primary)' }}></i> إضافة مؤثر جديد
                    </h3>
                    
                    <form onSubmit={handleCreateDiscount} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">اسم المؤثر</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="مثال: أحمد الدسوقي" 
                                value={formData.name}
                                onChange={e => setFormData({...formData, name: e.target.value})}
                                required
                            />
                        </div>
                        
                        <div className="form-group" style={{ margin: 0 }}>
                            <label className="form-label">كود الخصم (لشوبيفاي)</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="مثال: AHMED10" 
                                value={formData.code}
                                onChange={e => setFormData({...formData, code: e.target.value.toUpperCase()})}
                                required
                                style={{ textTransform: 'uppercase', letterSpacing: '1px' }}
                            />
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">نوع الخصم</label>
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
                                        cursor: 'pointer'
                                    }}
                                >
                                    <option value="percentage" style={{ background: '#1e2128', color: '#ffffff', padding: '12px' }}>نسبة مئوية (%)</option>
                                    <option value="fixed_amount" style={{ background: '#1e2128', color: '#ffffff', padding: '12px' }}>مبلغ ثابت</option>
                                </select>
                            </div>
                            <div className="form-group" style={{ margin: 0 }}>
                                <label className="form-label">قيمة الخصم</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder="15" 
                                    value={formData.value}
                                    onChange={e => setFormData({...formData, value: e.target.value})}
                                    required
                                    min="1"
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
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginTop: '16px', padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                                    <div className="form-group" style={{ margin: 0 }}>
                                        <label className="form-label">تاريخ الانتهاء (اختياري)</label>
                                        <input 
                                            type="date" 
                                            className="form-input" 
                                            value={formData.endDate}
                                            onChange={e => setFormData({...formData, endDate: e.target.value})}
                                            min={new Date().toISOString().split('T')[0]}
                                            onClick={(e) => { try { e.target.showPicker(); } catch(err) {} }}
                                            style={{ colorScheme: 'dark', cursor: 'pointer' }}
                                        />
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        <div className="form-group" style={{ margin: 0 }}>
                                            <label className="form-label">حد الاستخدام</label>
                                            <input 
                                                type="number" 
                                                className="form-input" 
                                                placeholder="مثال: 100" 
                                                value={formData.usageLimit}
                                                onChange={e => setFormData({...formData, usageLimit: e.target.value})}
                                                min="1"
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
                            style={{ padding: '14px', marginTop: '12px', fontSize: '15px', background: 'var(--gold-primary)', color: '#000', border: 'none', fontWeight: 600, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
                            disabled={loading}
                        >
                            {loading ? <i className="fa-solid fa-spinner fa-spin"></i> : <i className="fa-brands fa-shopify"></i>}
                            <span>{loading ? 'جاري الربط مع شوبيفاي...' : 'إضافة وإنشاء كود في شوبيفاي'}</span>
                        </button>
                    </form>
                </div>

                {/* Analytics Card */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '18px', margin: '0 0 24px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <i className="fa-solid fa-chart-pie" style={{ color: 'var(--success-color)' }}></i> ملخص الأداء
                    </h3>
                    
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                        <div className="glass-card" style={{ padding: '20px', background: 'var(--glass-bg)', textAlign: 'center', borderRight: '4px solid var(--gold-primary)' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>{state.influencers?.length || 0}</div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>عدد المؤثرين</div>
                        </div>
                        <div className="glass-card" style={{ padding: '20px', background: 'var(--glass-bg)', textAlign: 'center', borderRight: '4px solid #2ecc71' }}>
                            <div style={{ fontSize: '24px', fontWeight: 'bold', color: 'var(--text-primary)', marginBottom: '4px' }}>
                                {analytics.reduce((sum, inf) => sum + inf.usageCount, 0)}
                            </div>
                            <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>إجمالي الطلبات المباعة</div>
                        </div>
                    </div>
                    
                    <div className="glass-card" style={{ padding: '24px', background: 'var(--glass-bg)', textAlign: 'center', borderRight: '4px solid #e74c3c' }}>
                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>إجمالي المبيعات من المؤثرين</div>
                        <div style={{ fontSize: '28px', fontWeight: 'bold', color: '#e74c3c' }}>
                            {analytics.reduce((sum, inf) => sum + inf.totalRevenue, 0).toLocaleString()} {state.storeSettings.currency}
                        </div>
                    </div>
                </div>
            </div>

            <div className="table-card glass-card" style={{ marginTop: '24px' }}>
                <div className="card-header-bar" style={{ padding: '20px 24px', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <h3 style={{ fontSize: '18px', margin: 0 }}>لوحة المتصدرين (Leaderboard)</h3>
                </div>
                
                {analytics.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '60px 20px', color: 'var(--text-muted)' }}>
                        <img src="/icons/Discount-2.svg" alt="Empty" style={{ width: '48px', height: '48px', marginBottom: '16px', opacity: 0.2, filter: 'invert(0.5)' }} />
                        <p style={{ margin: 0 }}>لا توجد بيانات لعرضها. قم بإضافة مؤثرين أولاً!</p>
                    </div>
                ) : (
                    <div className="table-wrapper">
                        <table className="custom-table" style={{ width: '100%', minWidth: '900px' }}>
                            <thead>
                                <tr>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>الترتيب</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>اسم المؤثر</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>كود الخصم</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>قيمة الخصم</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>عدد الطلبات</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>إجمالي المبيعات</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>متوسط قيمة الطلب</th>
                                    <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>إجراءات</th>
                                </tr>
                            </thead>
                            <tbody>
                                {sortedAnalytics.map((inf, index) => (
                                    <tr key={inf.id} style={{ borderBottom: '1px solid var(--glass-border)', transition: 'background 0.2s ease' }} className="hover-row">
                                        <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 'bold', color: index === 0 ? '#f1c40f' : index === 1 ? '#bdc3c7' : index === 2 ? '#cd7f32' : 'var(--text-secondary)' }}>
                                            #{index + 1}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 'bold' }}>
                                            {inf.name}
                                            {(inf.endDate || inf.usageLimit) && (
                                                <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px', fontWeight: 'normal' }}>
                                                    {inf.endDate && <span style={{ marginLeft: '8px' }}><i className="fa-regular fa-clock"></i> ينتهي: {new Date(inf.endDate).toLocaleDateString('ar-EG')}</span>}
                                                    {inf.usageLimit && <span><i className="fa-solid fa-users"></i> حد: {inf.usageLimit}</span>}
                                                </div>
                                            )}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                            <span style={{ background: 'var(--glass-bg-hover)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)', fontFamily: 'monospace', letterSpacing: '1px' }}>
                                                {inf.code}
                                            </span>
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                            {inf.type === 'percentage' ? `${inf.value}%` : `${inf.value} ${state.storeSettings.currency}`}
                                            {inf.minOrderValue && <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>فوق {inf.minOrderValue}</div>}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 'bold' }}>
                                            {inf.usageCount}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px', fontWeight: 'bold', color: '#2ecc71' }}>
                                            {inf.totalRevenue.toLocaleString()} {state.storeSettings.currency}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px', color: 'var(--text-secondary)' }}>
                                            {inf.usageCount > 0 ? Math.round(inf.totalRevenue / inf.usageCount).toLocaleString() : 0} {state.storeSettings.currency}
                                        </td>
                                        <td style={{ textAlign: 'center', padding: '12px 16px' }}>
                                            <button 
                                                className="btn-icon" 
                                                style={{ color: 'var(--color-danger)', border: 'none', background: 'transparent', cursor: 'pointer' }}
                                                onClick={() => {
                                                    if(window.confirm('هل أنت متأكد من حذف هذا المؤثر؟')) {
                                                        deleteInfluencer(inf.id);
                                                    }
                                                }}
                                                title="حذف المؤثر"
                                            >
                                                <i className="fa-regular fa-trash-can"></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
