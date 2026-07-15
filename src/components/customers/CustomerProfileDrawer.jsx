import React, { useContext, useEffect, useState } from 'react';
import { AppContext } from '../../context/AppContext';

export default function CustomerProfileDrawer({ customer, onClose }) {
    const { state, t } = useContext(AppContext);
    const [isVisible, setIsVisible] = useState(false);

    // Filter orders specific to this customer
    const customerOrders = (state.orders || []).filter(ord => 
        ord.customer_id === customer?.id || ord.client === customer?.name
    ).sort((a, b) => new Date(b.date) - new Date(a.date));

    const currency = state.storeSettings.currency || 'EGP';

    // Handle slide-in animation
    useEffect(() => {
        if (customer) {
            // Slight delay to allow DOM to render before adding visible class
            requestAnimationFrame(() => {
                setIsVisible(true);
            });
        }
    }, [customer]);

    const handleClose = () => {
        setIsVisible(false);
        // Wait for animation to finish before actually unmounting
        setTimeout(() => {
            onClose();
        }, 300); // 300ms matches transition duration
    };

    const parseAddressData = (addressStr) => {
        let bostaStateName = '';
        let bostaStateCode = null;
        if (addressStr && addressStr.startsWith('{')) {
            try {
                const parsed = JSON.parse(addressStr);
                bostaStateName = parsed.bostaStateName || '';
                bostaStateCode = parsed.bostaStateCode || null;
            } catch(e) {}
        }
        return { bostaStateName, bostaStateCode };
    };

    const getOrderStatusBadge = (ord) => {
        const { bostaStateCode, bostaStateName } = parseAddressData(ord.address);
        if (bostaStateCode !== null) {
            switch (Number(bostaStateCode)) {
                case 10: return { label: 'طلب استلام جديد', className: 'badge badge-warning' };
                case 11: return { label: 'بانتظار خط السير', className: 'badge badge-warning' };
                case 20: return { label: 'اتحدد مندوب', className: 'badge badge-info' };
                case 21: return { label: 'المندوب استلم الشحنة', className: 'badge badge-info' };
                case 22: return { label: 'جاري الاستلام من العميل', className: 'badge badge-info' };
                case 23: return { label: 'تم الاستلام من المشتري', className: 'badge badge-info' };
                case 24: return { label: 'وصلت مخزن بوسطة', className: 'badge badge-info' };
                case 25: return { label: 'مكتمل في بوسطة', className: 'badge badge-success' };
                case 30: return { label: 'في الطريق بين الفروع', className: 'badge badge-info' };
                case 40: return { label: 'جاري الاستلام', className: 'badge badge-info' };
                case 41: return { label: 'خرجت للتوصيل للعميل', className: 'badge badge-gold' };
                case 45: return { label: 'تم التسليم بنجاح', className: 'badge badge-success' };
                case 46: return { label: 'مرتجع للتاجر', className: 'badge badge-danger' };
                case 47: return { label: 'تعذر التوصيل (مشكلة)', className: 'badge badge-danger' };
                case 48: return { label: 'فشل التوصيل نهائياً', className: 'badge badge-danger' };
                case 49: return { label: 'ملغي في بوسطة', className: 'badge badge-danger' };
                case 60: return { label: 'تمت إعادتها للمخزن', className: 'badge badge-danger' };
                case 100: return { label: 'شحنة مفقودة', className: 'badge badge-danger' };
                case 101: return { label: 'شحنة تالفة', className: 'badge badge-danger' };
                case 102: return { label: 'شحنة تحت التحقيق', className: 'badge badge-warning' };
                case 103: return { label: 'بانتظار إجراء التاجر', className: 'badge badge-warning' };
                default: return { label: bostaStateName || `حالة ${bostaStateCode}`, className: 'badge badge-info' };
            }
        }
        
        switch (ord.status) {
            case 'Draft': return { label: 'مسودة', className: 'badge badge-grey' };
            case 'Pending': return { label: 'قيد الانتظار', className: 'badge badge-warning' };
            case 'Shipped': return { label: 'تم الشحن', className: 'badge badge-info' };
            case 'Partially Delivered': return { label: 'تسليم جزئي', className: 'badge badge-gold' };
            case 'Completed': return { label: 'تم التسليم', className: 'badge badge-success' };
            case 'Cancelled': return { label: 'ملغي', className: 'badge badge-danger' };
            default: return { label: ord.status, className: 'badge badge-grey' };
        }
    };

    const getProductNameAndVariantBySku = (sku) => {
        const product = (state.products || []).find(p => 
            p.variants && p.variants.some(v => v.sku === sku)
        );
        if (!product) return sku;
        
        const variant = product.variants.find(v => v.sku === sku);
        const variantName = variant && variant.name !== 'Standard Option' ? ` - ${variant.name}` : '';
        return `${product.name}${variantName}`;
    };

    if (!customer) return null;

    const isVip = customer.customer_type === 'VIP';
    const totalPurchases = parseFloat(customer.total_purchases) || 0;

    return (
        <>
            {/* Backdrop */}
            <div 
                className={`drawer-backdrop ${isVisible ? 'visible' : ''}`} 
                onClick={handleClose}
            ></div>

            {/* Sliding Drawer */}
            <div className={`profile-drawer ${isVisible ? 'open' : ''}`} dir="rtl">
                
                {/* Header */}
                <div className="drawer-header">
                    <button className="close-btn" onClick={handleClose}>
                        <i className="fa-solid fa-xmark"></i>
                    </button>
                    <div className="customer-header-info">
                        <div className="customer-avatar">
                            <i className="fa-solid fa-user-astronaut"></i>
                        </div>
                        <div className="customer-details-head">
                            <h2>
                                {customer.name}
                                {isVip && <i className="fa-solid fa-crown vip-icon" title="VIP"></i>}
                            </h2>
                            <p className="phone-line">
                                <i className="fa-solid fa-phone"></i> {customer.phone}
                            </p>
                        </div>
                    </div>
                </div>

                {/* Quick Stats */}
                <div className="drawer-stats">
                    <div className="stat-box">
                        <span className="stat-label">إجمالي المشتريات</span>
                        <strong className="stat-value text-success">{currency} {totalPurchases.toLocaleString('en-US', {minimumFractionDigits: 2})}</strong>
                    </div>
                    <div className="stat-box">
                        <span className="stat-label">عدد الطلبات</span>
                        <strong className="stat-value text-info">{customer.orders_count || 0} طلب</strong>
                    </div>
                </div>

                {/* Timeline History */}
                <div className="drawer-body">
                    <h3 className="section-title">
                        <i className="fa-solid fa-clock-rotate-left"></i> السجل الشرائي
                    </h3>

                    <div className="order-timeline">
                        {customerOrders.length === 0 ? (
                            <div className="empty-history">
                                <i className="fa-solid fa-box-open"></i>
                                <p>لا توجد طلبات مسجلة لهذا العميل حتى الآن.</p>
                            </div>
                        ) : (
                            customerOrders.map((ord, idx) => {
                                const total = parseFloat(ord.totalValue) || 0;
                                const deposit = parseFloat(ord.deposit) || 0;
                                const remaining = total - deposit;
                                const isCompleted = ord.status === 'Completed';

                                return (
                                    <div key={ord.id} className="timeline-item">
                                        <div className="timeline-dot"></div>
                                        <div className="timeline-content glass-card">
                                            <div className="timeline-header">
                                                <span className="order-id">#{ord.id}</span>
                                                <span className="order-date">{ord.date}</span>
                                            </div>
                                            
                                            <div className="order-items-preview" style={{ marginTop: '8px', marginBottom: '8px', fontSize: '12px' }}>
                                                <strong style={{ color: 'var(--text-secondary)' }}>المنتجات المطلوبة: </strong>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px', paddingRight: '8px' }}>
                                                    {ord.items && ord.items.map((i, idx) => {
                                                        const nameAndVariant = getProductNameAndVariantBySku(i.variantSku);
                                                        return (
                                                            <div key={idx} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                <span className="badge badge-info" style={{ padding: '2px 6px', fontSize: '10px', minWidth: '24px', textAlign: 'center' }}>{i.quantity}x</span>
                                                                <span style={{ color: 'var(--text-color)' }}>{nameAndVariant}</span>
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                            </div>

                                            <div className="financial-breakdown">
                                                <div className="fin-row">
                                                    <span>قيمة الطلب:</span>
                                                    <strong>{currency} {total.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                                </div>
                                                <div className="fin-row text-success">
                                                    <span>العربون (المدفوع):</span>
                                                    <strong>{currency} {deposit.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                                </div>
                                                <div className="fin-row text-warning">
                                                    <span>المتبقي للتحصيل:</span>
                                                    <strong>{currency} {remaining > 0 ? remaining.toLocaleString('en-US', {maximumFractionDigits: 2}) : '0.00'}</strong>
                                                </div>
                                            </div>

                                            <div className="shipping-status-banner" style={{ marginTop: '8px' }}>
                                                {(() => {
                                                    const badge = getOrderStatusBadge(ord);
                                                    const iconClass = badge.className.includes('success') 
                                                        ? 'fa-solid fa-circle-check' 
                                                        : (badge.className.includes('danger') ? 'fa-solid fa-circle-xmark' : 'fa-solid fa-truck-fast');
                                                    return (
                                                        <span className={badge.className}>
                                                            <i className={iconClass} style={{ marginLeft: '4px' }}></i> {badge.label}
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>
            </div>
        </>
    );
}
