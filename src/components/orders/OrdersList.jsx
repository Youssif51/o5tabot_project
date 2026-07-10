import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';

export default function OrdersList({ globalSearch, setGlobalSearch, onOpenAddOrder, onOpenEditOrder }) {
    const { state, updateOrderStatus, deleteOrder, showToast, logActivity, setCurrentView, t } = useContext(AppContext);
    
    // Expanded rows state (keeps track of order IDs that are expanded)
    const [expandedOrderIds, setExpandedOrderIds] = useState({});
    
    // Filters & Search
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Status inline dropdown open state
    const [activeDropdownOrderId, setActiveDropdownOrderId] = useState(null);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const currency = state.storeSettings.currency || 'EGP';
    const activeSearch = globalSearch || '';

    // Deterministic Customer Code Generator
    const getCustomerCode = (name) => {
        if (!name) return 'CUS-0000';
        let hash = 0;
        for (let i = 0; i < name.length; i++) {
            hash = name.charCodeAt(i) + ((hash << 5) - hash);
        }
        const code = Math.abs(hash % 10000).toString().padStart(4, '0');
        return `CUS-${code}`;
    };

    // Helper to parse address JSON structure safely
    const parseAddressData = (addressStr) => {
        let detailAddress = addressStr || '';
        let phone = '';
        let vatEnabled = false;
        let orderDiscountPercent = 0;
        let customerCode = 'CUS-0000';
        
        if (addressStr && addressStr.startsWith('{')) {
            try {
                const parsed = JSON.parse(addressStr);
                detailAddress = parsed.detailAddress || '';
                phone = parsed.phone || '';
                vatEnabled = parsed.vatEnabled || false;
                orderDiscountPercent = parseFloat(parsed.orderDiscountPercent) || 0;
                customerCode = parsed.customerCode || 'CUS-0000';
            } catch(e) {}
        }
        return { detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode };
    };

    // Delivery Status translations
    const getDeliveryStatusLabel = (status) => {
        switch (status) {
            case 'Draft': return 'مسودة';
            case 'Pending': return 'في الانتظار';
            case 'Partially Delivered': return 'تسليم جاري';
            case 'Completed': return 'تم التسليم';
            case 'Cancelled': return 'ملغي';
            default: return status;
        }
    };

    const getDeliveryStatusBadgeClass = (status) => {
        switch (status) {
            case 'Draft': return 'bg-yellow-500/10 text-yellow-500 border border-yellow-500/20';
            case 'Pending': return 'bg-blue-500/10 text-blue-500 border border-blue-500/20';
            case 'Partially Delivered': return 'bg-orange-500/10 text-orange-500 border border-orange-500/20';
            case 'Completed': return 'bg-green-500/10 text-green-500 border border-green-500/20';
            case 'Cancelled': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
        }
    };

    // Payment Status helpers
    const getPaymentStatus = (ord) => {
        if (ord.status === 'Cancelled') return 'غير مدفوع';
        const dep = parseFloat(ord.deposit) || 0;
        const tot = parseFloat(ord.totalValue) || 0;
        if (dep <= 0) return 'غير مدفوع';
        if (dep < tot) return 'مدفوع جزئي';
        return 'مدفوع';
    };

    const getPaymentStatusBadgeClass = (paymentStatus) => {
        switch (paymentStatus) {
            case 'غير مدفوع': return 'bg-red-500/10 text-red-500 border border-red-500/20';
            case 'مدفوع جزئي': return 'bg-amber-500/10 text-amber-500 border border-amber-500/20';
            case 'مدفوع': return 'bg-green-500/10 text-green-500 border border-green-500/20';
            default: return 'bg-gray-500/10 text-gray-500 border border-gray-500/20';
        }
    };

    // Date range helper
    const isWithinDays = (dateStr, days) => {
        try {
            const date = new Date(dateStr);
            const diffTime = Math.abs(new Date() - date);
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            return diffDays <= days;
        } catch(e) {
            return false;
        }
    };

    // Filter Logic
    const filteredOrders = (state.orders || []).filter(ord => {
        // 1. Search
        const clientMatches = (ord.client || '').toLowerCase().includes(activeSearch.toLowerCase());
        const idMatches = (ord.id || '').toLowerCase().includes(activeSearch.toLowerCase());
        if (!clientMatches && !idMatches) return false;

        // 2. Delivery Status
        if (deliveryStatusFilter !== 'all' && ord.status !== deliveryStatusFilter) return false;

        // 3. Payment Status
        const paymentStatus = getPaymentStatus(ord);
        if (paymentStatusFilter !== 'all' && paymentStatus !== paymentStatusFilter) return false;

        // 4. Warehouse
        const wh = ord.warehouse || 'Sulur';
        if (warehouseFilter !== 'all' && wh !== warehouseFilter) return false;

        // 5. Date Range (from startDate to endDate)
        if (startDate && ord.date < startDate) return false;
        if (endDate && ord.date > endDate) return false;

        return true;
    });

    // Pagination calculations
    const totalEntries = filteredOrders.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const activePage = currentPage > totalPages ? totalPages : currentPage;
    const startIdx = (activePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalEntries);
    const paginatedOrders = filteredOrders.slice(startIdx, endIdx);

    // Summary Metric calculations (calculated from filtered/visible data)
    const totalOrdersCount = filteredOrders.length;
    
    const salesValue = filteredOrders
        .filter(o => o.status !== 'Cancelled')
        .reduce((sum, o) => sum + (parseFloat(o.totalValue) || 0), 0);

    const remainingToCollectTotal = filteredOrders
        .filter(o => o.status !== 'Cancelled')
        .reduce((sum, o) => {
            const remaining = (parseFloat(o.totalValue) || 0) - (parseFloat(o.deposit) || 0);
            return sum + (remaining > 0 ? remaining : 0);
        }, 0);

    const todayStr = getLocalDateString();
    const todayOrdersCount = filteredOrders.filter(o => o.date === todayStr).length;
    const pendingShopifyOrders = (state.orders || []).filter(o => o.status === 'Pending' && o.source === 'shopify');

    // Toggle Row Expansion
    const toggleRow = (orderId) => {
        setExpandedOrderIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    // Row Delete confirmation
    const handleDeleteOrder = (e, id) => {
        e.stopPropagation(); // prevent expanding row on delete click
        if (window.confirm(`هل أنت متأكد من حذف السجل الخاص بالطلب ${id} نهائياً؟`)) {
            deleteOrder(id);
            showToast(`تم حذف الطلب ${id} بنجاح`, "success");
        }
    };

    // CSV Excel Exporter
    const handleExportCSV = () => {
        const headers = ["رقم الطلب", "العميل", "الهاتف", "التاريخ", "المنتجات", "الإجمالي", "المتبقي للتحصيل", "المستودع", "حالة التوصيل", "حالة الدفع"];
        const rows = filteredOrders.map(ord => {
            const { phone, customerCode } = parseAddressData(ord.address);
            const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
            const remaining = ord.totalValue - (parseFloat(ord.deposit) || 0);
            const paymentStatus = getPaymentStatus(ord);
            const deliveryStatus = getDeliveryStatusLabel(ord.status);
            
            return [
                ord.id,
                `${ord.client} (${customerCode})`,
                phone,
                ord.date,
                `${totalQty} قطع`,
                ord.totalValue,
                remaining > 0 ? remaining : 0,
                ord.warehouse || 'Sulur',
                deliveryStatus,
                paymentStatus
            ];
        });

        // Add BOM header for Excel compatibility with Arabic
        const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.map(val => `"${val}"`).join(","))].join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `تقرير_المبيعات_${getLocalDateString()}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        showToast("تم تصدير ملف الإكسل بنجاح", "success");
    };

    // Helper to fetch product name for item sub-table
    const getProductNameBySku = (sku) => {
        let name = sku;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) name = v.name === 'Standard Option' ? p.name : `${p.name} (${v.name})`;
        });
        return name;
    };

    return (
        <div id="orders-view" className="view-pane active" dir="rtl" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div className="page-title-group">
                    <h2 style={{ fontSize: '22px', fontWeight: 'bold' }}>إدارة طلبات المبيعات</h2>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={onOpenAddOrder} style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--gold-primary)', color: '#000', border: 'none', fontWeight: 600 }}>
                        <i className="fa-solid fa-plus"></i> تسجيل طلب جديد
                    </button>
                </div>
            </div>

            {/* 5. SUMMARY BAR METRIC CARDS */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-card" style={{ padding: '16px', borderRight: '4px solid var(--gold-primary)', background: 'var(--glass-bg)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>إجمالي الطلبات</span>
                    <strong style={{ fontSize: '20px', color: 'var(--text-primary)' }}>{totalOrdersCount} طلب</strong>
                </div>
                <div className="glass-card" style={{ padding: '16px', borderRight: '4px solid #2ecc71', background: 'var(--glass-bg)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>قيمة المبيعات (المؤكدة)</span>
                    <strong style={{ fontSize: '20px', color: '#2ecc71' }}>{currency} {salesValue.toFixed(2)}</strong>
                </div>
                <div className="glass-card" style={{ padding: '16px', borderRight: '4px solid #e74c3c', background: 'var(--glass-bg)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>المتبقي للتحصيل</span>
                    <strong style={{ fontSize: '20px', color: '#e74c3c' }}>{currency} {remainingToCollectTotal.toFixed(2)}</strong>
                </div>
                <div className="glass-card" style={{ padding: '16px', borderRight: '4px solid #3498db', background: 'var(--glass-bg)' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>طلبات اليوم</span>
                    <strong style={{ fontSize: '20px', color: '#3498db' }}>{todayOrdersCount} طلب</strong>
                </div>
            </div>

            {/* Shopify Pending Orders Queue Alert */}
            {pendingShopifyOrders.length > 0 && (
                <div className="glass-card" style={{
                    background: 'linear-gradient(135deg, rgba(212,175,55,0.06), rgba(150,191,72,0.12))',
                    border: '1px solid rgba(150,191,72,0.25)',
                    borderRadius: '12px',
                    padding: '16px 20px',
                    marginBottom: '24px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    flexWrap: 'wrap',
                    gap: '16px',
                    boxShadow: '0 8px 32px 0 rgba(0,0,0,0.15)',
                    backdropFilter: 'blur(4px)'
                }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                        <div style={{
                            width: '40px',
                            height: '40px',
                            borderRadius: '50%',
                            background: '#96bf48',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            color: 'white',
                            fontSize: '18px'
                        }}>
                            <i className="fa-brands fa-shopify"></i>
                        </div>
                        <div>
                            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 'bold', color: 'var(--text-primary)' }}>
                                طلبات شوبيفاي معلقة للمراجعة
                            </h4>
                            <p style={{ margin: '4px 0 0 0', fontSize: '12px', color: 'var(--text-muted)' }}>
                                هناك <strong>{pendingShopifyOrders.length}</strong> طلبات جديدة من متجر شوبيفاي معلّقة بانتظار مراجعتك وتأكيد الشحن.
                            </p>
                        </div>
                    </div>
                    <button 
                        className="btn" 
                        onClick={() => {
                            setCurrentView('shopifyPending');
                        }}
                        style={{
                            background: 'var(--gold-primary)',
                            color: '#000',
                            fontWeight: 'bold',
                            padding: '8px 16px',
                            borderRadius: '6px',
                            border: 'none',
                            fontSize: '12px',
                            cursor: 'pointer',
                            transition: 'all 0.2s ease',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <i className="fa-solid fa-filter"></i>
                        عرض الطلبات المعلقة
                    </button>
                </div>
            )}

            {/* 6. FILTER BAR */}
            <div className="glass-card filter-bar" style={{ padding: '16px', marginBottom: '24px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div className="filter-controls" style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', flex: 1 }}>
                        
                        {/* Search Input */}
                        <div className="search-input-wrapper" style={{ minWidth: '220px' }}>
                            <i className="fa-solid fa-magnifying-glass search-icon"></i>
                            <input 
                                type="text" 
                                placeholder="ابحث برقم الطلب أو العميل..."
                                value={globalSearch || ''}
                                onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                                style={{ width: '100%', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '8px 12px 8px 36px', borderRadius: '6px' }}
                            />
                        </div>
                        
                        {/* Delivery Status Filter */}
                        <select 
                            className="form-select" 
                            style={{ width: '175px', backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px' }}
                            value={deliveryStatusFilter}
                            onChange={(e) => { setDeliveryStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات التوصيل</option>
                            <option value="Draft" style={{ background: 'var(--bg-secondary)' }}>مسودة</option>
                            <option value="Pending" style={{ background: 'var(--bg-secondary)' }}>في الانتظار</option>
                            <option value="Partially Delivered" style={{ background: 'var(--bg-secondary)' }}>تسليم جاري</option>
                            <option value="Completed" style={{ background: 'var(--bg-secondary)' }}>تم التسليم</option>
                            <option value="Cancelled" style={{ background: 'var(--bg-secondary)' }}>ملغي</option>
                        </select>

                        {/* Payment Status Filter */}
                        <select 
                            className="form-select" 
                            style={{ width: '155px', backgroundColor: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '6px', padding: '8px' }}
                            value={paymentStatusFilter}
                            onChange={(e) => { setPaymentStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات الدفع</option>
                            <option value="غير مدفوع" style={{ background: 'var(--bg-secondary)' }}>غير مدفوع</option>
                            <option value="مدفوع جزئي" style={{ background: 'var(--bg-secondary)' }}>مدفوع جزئي</option>
                            <option value="مدفوع" style={{ background: 'var(--bg-secondary)' }}>مدفوع</option>
                        </select>



                        {/* Date Range Calendar Pickers */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>من:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                                style={{
                                    background: 'var(--glass-bg)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    fontSize: '13px',
                                    colorScheme: 'dark'
                                }}
                            />
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>إلى:</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                                style={{
                                    background: 'var(--glass-bg)',
                                    color: 'var(--text-primary)',
                                    border: '1px solid var(--glass-border)',
                                    borderRadius: '6px',
                                    padding: '6px 10px',
                                    fontSize: '13px',
                                    colorScheme: 'dark'
                                }}
                            />
                        </div>
                        {(startDate || endDate) && (
                            <button 
                                className="btn btn-secondary" 
                                onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }}
                                style={{ padding: '6px 12px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '4px', borderColor: 'rgba(231,76,60,0.2)', background: 'rgba(231,76,60,0.05)', color: '#e74c3c' }}
                            >
                                <i className="fa-solid fa-xmark"></i> مسح التصفية
                            </button>
                        )}
                    </div>

                    {/* Export button */}
                    <button 
                        onClick={handleExportCSV} 
                        className="btn btn-secondary" 
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', borderColor: 'var(--glass-border-hover)', background: 'var(--glass-bg)', color: 'var(--text-primary)', padding: '8px 16px' }}
                    >
                        <i className="fa-solid fa-file-excel" style={{ color: '#27AE60' }}></i> تصدير Excel
                    </button>
                </div>
            </div>

            {/* 3. TABLE / CARD VIEW COMPONENT */}
            <div className="glass-card" style={{ overflow: 'visible', border: '1px solid var(--glass-border)' }}>
                
                {/* Desktop view table */}
                <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border-hover)' }}>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>رقم الطلب</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>العميل + الهاتف</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>التاريخ</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>المنتجات</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>الإجمالي</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>المتبقي للتحصيل</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>الآدمن (المسجل)</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>حالة التوصيل</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>حالة الدفع</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>الإجراءات</th>
                            </tr>
                        </thead>
                        <tbody style={{ overflow: 'visible' }}>
                            {paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="10" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                                        لا توجد طلبات مبيعات مطابقة للفلاتر النشطة.
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map(ord => {
                                    const isExpanded = expandedOrderIds[ord.id];
                                    const { phone, detailAddress } = parseAddressData(ord.address);
                                    const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
                                    const remaining = ord.totalValue - (parseFloat(ord.deposit) || 0);
                                    const paymentStatus = getPaymentStatus(ord);
                                    const isDropdownOpen = activeDropdownOrderId === ord.id;

                                    return (
                                        <React.Fragment key={ord.id}>
                                            <tr 
                                                onClick={() => toggleRow(ord.id)} 
                                                style={{ 
                                                    borderBottom: '1px solid var(--glass-border)', 
                                                    cursor: 'pointer', 
                                                    background: isExpanded ? 'rgba(212, 175, 55, 0.03)' : 'transparent',
                                                    transition: 'background 0.2s ease'
                                                }}
                                                className="table-row-hover"
                                            >
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '14px 16px', color: 'var(--gold-primary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        {ord.id}
                                                        {ord.source === 'shopify' && (
                                                            <span style={{
                                                                background: 'linear-gradient(135deg, #96bf48, #5a8a1e)',
                                                                color: 'white',
                                                                padding: '2px 6px',
                                                                borderRadius: '10px',
                                                                fontSize: '0.65rem',
                                                                fontWeight: 'bold',
                                                                display: 'inline-flex',
                                                                alignItems: 'center',
                                                                gap: '3px'
                                                            }}>
                                                                <i className="fa-brands fa-shopify" style={{ fontSize: '0.75rem' }}></i>
                                                                متجر
                                                            </span>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div>{ord.client}</div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{phone || 'بدون هاتف'}</div>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px' }}>{ord.date}</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px' }}>{totalQty} قطع</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 600 }}>{currency} {ord.totalValue.toFixed(2)}</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 600, color: remaining > 0 ? '#e74c3c' : '#2ecc71' }}>
                                                    {remaining > 0 ? `${currency} ${remaining.toFixed(2)}` : 'خالص'}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)' }}>{ord.createdBy || 'الآدمن'}</td>
                                                
                                                {/* Delivery Status Badge */}
                                                <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                                                    <span className={`badge ${getDeliveryStatusBadgeClass(ord.status)}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                                        {getDeliveryStatusLabel(ord.status)}
                                                    </span>
                                                </td>

                                                {/* Payment Status Badge */}
                                                <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                                                    <span className={`badge ${getPaymentStatusBadgeClass(paymentStatus)}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                                                        {paymentStatus}
                                                    </span>
                                                </td>

                                                {/* Action Buttons with Labels */}
                                                <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center', overflow: 'visible' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'visible' }}>
                                                        
                                                        {/* Details Toggle Button */}
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                            onClick={() => toggleRow(ord.id)}
                                                        >
                                                            <i className={`fa-solid ${isExpanded ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                            {isExpanded ? 'إخفاء' : 'عرض'}
                                                        </button>

                                                        {/* Status transition dropdown toggle */}
                                                        {ord.status !== 'Cancelled' && (
                                                            <div style={{ position: 'relative', overflow: 'visible' }}>
                                                                <button 
                                                                    className="btn btn-secondary" 
                                                                    style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                                    onClick={() => setActiveDropdownOrderId(isDropdownOpen ? null : ord.id)}
                                                                >
                                                                    <i className="fa-solid fa-arrow-rotate-left"></i>
                                                                    الحالة
                                                                </button>
                                                                
                                                                {isDropdownOpen && (
                                                                    <div className="glass-card" style={{
                                                                        position: 'absolute',
                                                                        top: '100%',
                                                                        left: 0,
                                                                        width: '140px',
                                                                        background: 'var(--bg-secondary)',
                                                                        border: '1px solid var(--glass-border)',
                                                                        borderRadius: '6px',
                                                                        boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                                        zIndex: 1000,
                                                                        padding: '4px',
                                                                        marginTop: '4px'
                                                                    }}>
                                                                        {['Draft', 'Pending', 'Partially Delivered', 'Completed', 'Cancelled'].map(st => (
                                                                            <div 
                                                                                key={st}
                                                                                onClick={() => {
                                                                                    updateOrderStatus(ord.id, st);
                                                                                    setActiveDropdownOrderId(null);
                                                                                    showToast("تم تحديث حالة الطلب بنجاح", "success");
                                                                                }}
                                                                                style={{
                                                                                    padding: '8px 10px',
                                                                                    fontSize: '11px',
                                                                                    cursor: 'pointer',
                                                                                    color: 'var(--text-primary)',
                                                                                    borderRadius: '4px',
                                                                                    textAlign: 'right',
                                                                                    background: ord.status === st ? 'rgba(212,175,55,0.15)' : 'transparent'
                                                                                }}
                                                                                className="autocomplete-option"
                                                                            >
                                                                                {getDeliveryStatusLabel(st)}
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                )}
                                                            </div>
                                                        )}

                                                        {/* Edit order */}
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                            onClick={() => onOpenEditOrder(ord.id)}
                                                        >
                                                            <i className="fa-solid fa-pen-to-square"></i>
                                                            تعديل
                                                        </button>

                                                        {/* Delete button */}
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            style={{ padding: '4px 8px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', borderColor: 'rgba(231,76,60,0.2)' }}
                                                            onClick={(e) => handleDeleteOrder(e, ord.id)}
                                                        >
                                                            <i className="fa-solid fa-trash-can"></i>
                                                            حذف
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* 1. EXPANDABLE ROW DRAWER */}
                                            {isExpanded && (
                                                <tr style={{ background: 'var(--glass-bg)' }}>
                                                    <td colSpan="10" style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.3fr 1fr', gap: '24px' }}>
                                                            
                                                            {/* Customer details */}
                                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                    <i className="fa-solid fa-user-tag" style={{ marginLeft: '6px' }}></i> تفاصيل العميل والشحن
                                                                </h4>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                                    <div><strong>كود العميل:</strong> {getCustomerCode(ord.client)}</div>
                                                                    <div><strong>اسم العميل:</strong> {ord.client}</div>
                                                                    <div><strong>رقم الهاتف:</strong> {phone || 'غير مسجل'}</div>
                                                                    {ord.source === 'shopify' && (
                                                                        <>
                                                                            <div><strong>البريد الإلكتروني:</strong> {(state.customers || []).find(c => c.id === ord.customer_id)?.email || 'غير مسجل'}</div>
                                                                            <div><strong>طريقة الدفع:</strong> {ord.paymentMethod || 'الدفع عند الاستلام'}</div>
                                                                            {ord.shopifyOrderId && <div><strong>رقم طلب شوبيفاي:</strong> #{ord.shopifyOrderId}</div>}
                                                                        </>
                                                                    )}
                                                                    <div><strong>المحافظة:</strong> {ord.governorate || 'غير مسجل'}</div>
                                                                    <div><strong>العنوان بالتفصيل:</strong> {detailAddress || 'غير مسجل'}</div>
                                                                    <div><strong>سجل الطلب بواسطة:</strong> <span style={{ color: 'var(--gold-primary)' }}>{ord.createdBy || 'sfsf'}</span></div>
                                                                </div>
                                                            </div>

                                                            {/* Products Table */}
                                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                    <i className="fa-solid fa-box-open" style={{ marginLeft: '6px' }}></i> المنتجات المطلوبة ({ord.items?.length || 0} أصناف)
                                                                </h4>
                                                                <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
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
                                                                                <td style={{ padding: '8px 4px' }}>{getProductNameBySku(item.variantSku)}</td>
                                                                                <td style={{ textAlign: 'center', padding: '8px 4px' }}>{item.quantity}</td>
                                                                                <td style={{ textAlign: 'center', padding: '8px 4px' }}>{currency} {item.price.toFixed(2)}</td>
                                                                                <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 'bold' }}>{currency} {(item.quantity * item.price).toFixed(2)}</td>
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
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>إجمالي المنتجات:</span>
                                                                        <span>{currency} {ord.totalValue.toFixed(2)}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                        <span>مصاريف الشحن:</span>
                                                                        <span>+{currency} {(ord.shipping_fee || 0).toFixed(2)}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71' }}>
                                                                        <span>العربون المدفوع (Deposit):</span>
                                                                        <span>-{currency} {(ord.deposit || 0).toFixed(2)}</span>
                                                                    </div>
                                                                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--gold-primary)', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '8px', marginTop: '4px', fontSize: '13px' }}>
                                                                        <span>المتبقي للتحصيل:</span>
                                                                        <span>{currency} {remaining > 0 ? remaining.toFixed(2) : '0.00'}</span>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </div>

                                                        {/* Shopify Pending Approval Action Banner */}
                                                        {ord.status === 'Pending' && ord.source === 'shopify' && (
                                                            <div style={{
                                                                marginTop: '20px',
                                                                padding: '16px 20px',
                                                                background: 'linear-gradient(135deg, rgba(212,175,55,0.04), rgba(46,204,113,0.06))',
                                                                border: '1px solid rgba(212,175,55,0.2)',
                                                                borderRadius: '8px',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                gap: '16px',
                                                                flexWrap: 'wrap'
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <i className="fa-solid fa-circle-exclamation" style={{ color: 'var(--gold-primary)', fontSize: '18px' }}></i>
                                                                    <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                        هذا الطلب قادم من شوبيفاي ومعلق بانتظار موافقتك. الموافقة ستقوم بخصم المخزون وتأكيد الطلب.
                                                                    </span>
                                                                </div>
                                                                <div style={{ display: 'flex', gap: '10px' }}>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm('هل أنت متأكد من الموافقة على هذا الطلب وتأكيده للخصم من المخزون؟')) {
                                                                                updateOrderStatus(ord.id, 'Completed');
                                                                                showToast('تمت الموافقة على الطلب وتأكيده وخصم الكميات بنجاح!', 'success');
                                                                            }
                                                                        }}
                                                                        className="btn"
                                                                        style={{
                                                                            background: '#2ecc71',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            padding: '8px 16px',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            transition: 'transform 0.1s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                    >
                                                                        <i className="fa-solid fa-circle-check"></i>
                                                                        موافقة وتأكيد الطلب
                                                                    </button>
                                                                    <button
                                                                        onClick={(e) => {
                                                                            e.stopPropagation();
                                                                            if (window.confirm('هل أنت متأكد من رفض وإلغاء هذا الطلب؟')) {
                                                                                updateOrderStatus(ord.id, 'Cancelled');
                                                                                showToast('تم إلغاء الطلب بنجاح', 'warning');
                                                                            }
                                                                        }}
                                                                        className="btn"
                                                                        style={{
                                                                            background: '#e74c3c',
                                                                            color: 'white',
                                                                            border: 'none',
                                                                            padding: '8px 16px',
                                                                            borderRadius: '6px',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '12px',
                                                                            cursor: 'pointer',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            gap: '6px',
                                                                            transition: 'transform 0.1s ease'
                                                                        }}
                                                                        onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.02)'}
                                                                        onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                    >
                                                                        <i className="fa-solid fa-circle-xmark"></i>
                                                                        رفض وإلغاء الطلب
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}

                                                        {/* Horizontal order pipeline timeline */}
                                                        <div style={{ marginTop: '24px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                                                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', maxWidth: '700px', margin: '0 auto', position: 'relative' }}>
                                                                <div style={{ position: 'absolute', top: '15px', right: '40px', left: '40px', height: '2px', background: 'var(--glass-border-hover)', zIndex: 1 }} />
                                                                
                                                                {/* Timeline fill matching status */}
                                                                <div style={{
                                                                    position: 'absolute',
                                                                    top: '15px',
                                                                    right: '40px',
                                                                    width: ord.status === 'Draft' ? '0%' : (ord.status === 'Pending' ? '33%' : (ord.status === 'Partially Delivered' ? '66%' : '100%')),
                                                                    height: '2px',
                                                                    background: 'var(--gold-primary)',
                                                                    zIndex: 2,
                                                                    transition: 'width 0.3s ease'
                                                                }} />

                                                                {[
                                                                    { label: 'تم الإنشاء', active: true },
                                                                    { label: 'تم التأكيد', active: ord.status !== 'Draft' },
                                                                    { label: 'جاري التوصيل', active: ord.status !== 'Draft' && ord.status !== 'Pending' },
                                                                    { label: 'تم التسليم', active: ord.status === 'Completed' }
                                                                ].map((step, idx) => (
                                                                    <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3 }}>
                                                                        <div style={{
                                                                            width: '30px',
                                                                            height: '30px',
                                                                            borderRadius: '50%',
                                                                            background: step.active ? 'var(--gold-primary)' : '#26262b',
                                                                            color: step.active ? '#000' : 'rgba(255,255,255,0.3)',
                                                                            display: 'flex',
                                                                            alignItems: 'center',
                                                                            justifyContent: 'center',
                                                                            fontWeight: 'bold',
                                                                            fontSize: '11px',
                                                                            border: '2px solid',
                                                                            borderColor: step.active ? 'var(--gold-primary)' : 'var(--glass-border-hover)'
                                                                        }}>
                                                                            {step.active ? <i className="fa-solid fa-check" style={{ fontSize: '10px' }}></i> : idx + 1}
                                                                        </div>
                                                                        <span style={{ fontSize: '11px', marginTop: '6px', color: step.active ? 'var(--gold-primary)' : 'rgba(255,255,255,0.4)', fontWeight: step.active ? 'bold' : 'normal' }}>
                                                                            {step.label}
                                                                        </span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>

                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>



            </div>

            {/* Pagination footer */}
            <div style={{ padding: '24px 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', marginTop: '24px' }}>
                <button 
                    className="btn btn-secondary" 
                    disabled={activePage === 1}
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                    السابق
                </button>
                <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                    صفحة <strong style={{ color: 'var(--text-primary)' }}>{activePage}</strong> من <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
                </span>
                <button 
                    className="btn btn-secondary" 
                    disabled={activePage === totalPages}
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                >
                    التالي
                </button>
            </div>

        </div>
    );
}
