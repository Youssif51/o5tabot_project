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
                        <strong className="stat-value text-success">{currency} {totalPurchases.toLocaleString(undefined, {minimumFractionDigits: 2})}</strong>
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
                                            
                                            <div className="order-items-preview">
                                                <strong>المنتجات: </strong>
                                                <span className="text-muted">
                                                    {ord.items && ord.items.map(i => i.quantity + 'x ' + i.variantSku).join(', ')}
                                                </span>
                                            </div>

                                            <div className="financial-breakdown">
                                                <div className="fin-row">
                                                    <span>قيمة الطلب:</span>
                                                    <strong>{currency} {total.toFixed(2)}</strong>
                                                </div>
                                                <div className="fin-row text-success">
                                                    <span>العربون (المدفوع):</span>
                                                    <strong>{currency} {deposit.toFixed(2)}</strong>
                                                </div>
                                                <div className="fin-row text-warning">
                                                    <span>المتبقي للتحصيل:</span>
                                                    <strong>{currency} {remaining > 0 ? remaining.toFixed(2) : '0.00'}</strong>
                                                </div>
                                            </div>

                                            <div className="shipping-status-banner">
                                                {isCompleted ? (
                                                    <span className="badge badge-success"><i className="fa-solid fa-check"></i> تم التسليم</span>
                                                ) : (
                                                    <span className="badge badge-warning"><i className="fa-solid fa-truck-fast"></i> قيد التوصيل (سيتم الربط مع Bosta لاحقاً)</span>
                                                )}
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
