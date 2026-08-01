import { formatProductDisplayName } from '../../utils/productUtils';
import React, { useContext, useState, useEffect } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';

export default function OrdersList({ globalSearch, setGlobalSearch, onOpenAddOrder, onOpenEditOrder }) {
    const { state, updateOrderStatus, deleteOrder, showToast, logActivity, setCurrentView, t, showConfirm, addCustomer, setCustomerSpam, syncBostaStatus, updateDepositStatus, updateOrderProperties, settleAdminsCustody, fetchMissingOrderItems } = useContext(AppContext);
    
    // Expanded rows state (keeps track of order IDs that are expanded)
    const [expandedOrderIds, setExpandedOrderIds] = useState({});

    // Auto-fetch missing items for orders
    React.useEffect(() => {
        (state.orders || []).forEach(ord => {
            if ((!ord.items || ord.items.length === 0) && ord.id) {
                fetchMissingOrderItems(ord.id);
            }
        });
    }, [state.orders]);
    
    // Filters & Search
    const [deliveryStatusFilter, setDeliveryStatusFilter] = useState('all');
    const [paymentStatusFilter, setPaymentStatusFilter] = useState('all');
    const [sourceFilter, setSourceFilter] = useState('all');
    const [warehouseFilter, setWarehouseFilter] = useState('all');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');

    // Status inline dropdown open state
    const [activeDropdownOrderId, setActiveDropdownOrderId] = useState(null);
    const [updatingOrdersMap, setUpdatingOrdersMap] = useState({});

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

    const handleStatusChange = async (orderId, newStatus, bostaTrackingNumber) => {
        if (updatingOrdersMap[orderId]) return;

        if (newStatus === 'Cancelled') {
            showConfirm(
                "هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع الكميات المباعة إلى المخزون تلقائياً وإلغاء الأوردر في شوبيفاي.",
                async () => {
                    setUpdatingOrdersMap(prev => ({ ...prev, [orderId]: true }));
                    try {
                        await updateOrderStatus(orderId, newStatus);
                        showToast("تم إلغاء الطلب وإعادة الكميات للمخزون بنجاح", "warning");
                        if (bostaTrackingNumber) {
                            setTimeout(() => {
                                syncBostaStatus(orderId, bostaTrackingNumber);
                            }, 2000);
                        }
                    } finally {
                        setUpdatingOrdersMap(prev => {
                            const next = { ...prev };
                            delete next[orderId];
                            return next;
                        });
                    }
                }
            );
            return;
        }

        setUpdatingOrdersMap(prev => ({ ...prev, [orderId]: true }));
        try {
            await updateOrderStatus(orderId, newStatus);
            showToast("تم تحديث حالة الطلب بنجاح", "success");
            if (bostaTrackingNumber) {
                setTimeout(() => {
                    syncBostaStatus(orderId, bostaTrackingNumber);
                }, 2000);
            }
        } finally {
            setUpdatingOrdersMap(prev => {
                const next = { ...prev };
                delete next[orderId];
                return next;
            });
        }
    };

    // Automatic background sync for active Bosta orders so admin never needs to manually refresh
    useEffect(() => {
        const syncActiveBostaOrders = () => {
            (state.orders || []).forEach(ord => {
                const { bostaTrackingNumber, bostaStateCode } = parseAddressData(ord.address);
                if (bostaTrackingNumber && ord.status !== 'Completed' && ord.status !== 'Cancelled' && Number(bostaStateCode) !== 45 && Number(bostaStateCode) !== 49) {
                    syncBostaStatus(ord.id, bostaTrackingNumber, true); // silent background sync
                }
            });
        };

        syncActiveBostaOrders();
        const interval = setInterval(syncActiveBostaOrders, 45000);
        return () => clearInterval(interval);
    }, [state.orders?.length]);

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    const currency = state.storeSettings.currency || 'EGP';
    const activeSearch = globalSearch || '';

    const formatOrderTime = (createdAt) => {
        if (!createdAt) return '';
        try {
            const dateObj = new Date(createdAt);
            if (isNaN(dateObj.getTime())) return '';
            let hours = dateObj.getHours();
            const minutes = dateObj.getMinutes().toString().padStart(2, '0');
            const ampm = hours >= 12 ? 'PM' : 'AM';
            hours = hours % 12;
            hours = hours ? hours : 12;
            return `${hours}:${minutes} ${ampm}`;
        } catch (e) {
            return '';
        }
    };


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

    const normalizePhoneNumber = (phoneStr) => {
        if (!phoneStr) return '';
        const trimmed = phoneStr.trim();
        let clean = trimmed.replace(/\D/g, '');
        // If international number starting with non-Egyptian prefix (+ or 966/971 etc and not 20), preserve format
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

    // Helper to get the display badge text and class for an order
    const getOrderStatusBadge = (ord) => {
        const { bostaStateCode, bostaStateName } = parseAddressData(ord.address);
        
        // If it's a Bosta shipment (has a Bosta state code)
        if (bostaStateCode !== null) {
            switch (Number(bostaStateCode)) {
                case 10: return { label: 'طلب بيك اب جديد', className: 'badge-warning' };
                case 11: return { label: 'في انتظار الاستلام', className: 'badge-warning' };
                case 20: return { label: 'تم استلام الأوردر', className: 'badge-info' };
                case 21: return { label: 'تم استلام الأوردر', className: 'badge-info' };
                case 22: return { label: 'قيد التنفيذ', className: 'badge-info' };
                case 23: return { label: 'تم استلام الأوردر', className: 'badge-info' };
                case 24: return { label: 'تم تخزينه', className: 'badge-info' };
                case 25: return { label: 'تم بنجاح', className: 'badge-success' };
                case 30: return { label: 'قيد التنفيذ', className: 'badge-info' };
                case 40: return { label: 'قيد التنفيذ', className: 'badge-info' };
                case 41: return { label: 'متجه للعميل', className: 'badge-gold' };
                case 45: return { label: 'تم بنجاح', className: 'badge-success' };
                case 46: return { label: 'مرتجعاتك العائدة', className: 'badge-danger' };
                case 47: return { label: 'في انتظار متابعتك', className: 'badge-warning' };
                case 48: return { label: 'لم يتم بنجاح', className: 'badge-danger' };
                case 49: return { label: 'لم يتم بنجاح', className: 'badge-danger' };
                case 60: return { label: 'تم الاسترجاع', className: 'badge-danger' };
                case 100: return { label: 'غير ناجح', className: 'badge-danger' };
                case 101: return { label: 'غير ناجح', className: 'badge-danger' };
                case 102: return { label: 'متوقف مؤقتاً', className: 'badge-warning' };
                case 103: return { label: 'في انتظار متابعتك', className: 'badge-warning' };
                default: return { label: bostaStateName || `حالة ${bostaStateCode}`, className: 'badge-info' };
            }
        }
        
        switch (ord.status) {
            case 'Draft': return { label: 'مسودة', className: 'badge-grey' };
            case 'Pending': return { label: 'قيد الانتظار', className: 'badge-warning' };
            case 'Shipped': return { label: 'تم الشحن', className: 'badge-info' };
            case 'Partially Delivered': return { label: 'تسليم جزئي', className: 'badge-gold' };
            case 'Completed': return { label: 'تم التسليم', className: 'badge-success' };
            case 'Cancelled': return { label: 'ملغي', className: 'badge-danger' };
            default: return { label: ord.status, className: 'badge-grey' };
        }
    };

    // Delivery Status translations
    const getDeliveryStatusLabel = (status) => {
        switch (status) {
            case 'Draft': return 'مسودة';
            case 'Pending': return 'قيد الانتظار';
            case 'Shipped': return 'تم الشحن';
            case 'Partially Delivered': return 'تسليم جزئي';
            case 'Completed': return 'تم التسليم';
            case 'Cancelled': return 'ملغي / مرتجع';
            default: return status;
        }
    };

    // Helper to calculate accurate remaining amount to collect
    const getRemainingToCollect = (ord) => {
        if (ord.status === 'Cancelled') return 0;
        const { bostaStateCode } = parseAddressData(ord.address);
        const isDelivered = ord.status === 'Completed' || Number(bostaStateCode) === 45 || Number(bostaStateCode) === 25;
        const tot = parseFloat(ord.totalValue) || 0;
        const dep = parseFloat(ord.deposit) || 0;
        
        if (isDelivered || dep >= tot) {
            return 0; // خالص - Delivered to customer (money collected) or full deposit received
        }
        
        return Math.max(0, tot - dep);
    };

    // Payment Status helpers
    const getPaymentStatus = (ord) => {
        const { bostaStateCode } = parseAddressData(ord.address);
        const isDelivered = ord.status === 'Completed' || Number(bostaStateCode) === 45 || Number(bostaStateCode) === 25;
        const dep = parseFloat(ord.deposit) || 0;
        const tot = parseFloat(ord.totalValue) || 0;
        
        if (isDelivered || dep >= tot) return 'مدفوع';
        if (dep > 0) return 'مدفوع جزئي';
        return 'غير مدفوع';
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
        const { phone, bostaTrackingNumber } = parseAddressData(ord.address);
        const phoneMatches = (phone || '').includes(activeSearch);
        const trackingMatches = (bostaTrackingNumber || '').toLowerCase().includes(activeSearch.toLowerCase());
        
        if (!clientMatches && !idMatches && !phoneMatches && !trackingMatches) return false;

        // 2. Delivery Status
        if (deliveryStatusFilter !== 'all') {
            if (!isNaN(deliveryStatusFilter)) {
                const { bostaStateCode } = parseAddressData(ord.address);
                if (bostaStateCode === null || String(bostaStateCode) !== deliveryStatusFilter) {
                    return false;
                }
            } else {
                if (ord.status !== deliveryStatusFilter) {
                    return false;
                }
            }
        }

        // 3. Payment Status
        const paymentStatus = getPaymentStatus(ord);
        if (paymentStatusFilter !== 'all' && paymentStatus !== paymentStatusFilter) return false;

        // 4. Source Filter
        const source = ord.source || 'manual';
        if (sourceFilter !== 'all' && source !== sourceFilter) return false;

        // 5. Warehouse
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
        .reduce((sum, o) => sum + getRemainingToCollect(o), 0);

    const todayStr = getLocalDateString();
    const todayOrdersCount = filteredOrders.filter(o => o.date === todayStr).length;
    const isOrderReviewed = (o) => {
        if (!o) return false;
        if (o.is_reviewed || o.isReviewed) return true;
        if (o.address) {
            if (typeof o.address === 'object') return !!(o.address.isReviewed || o.address.is_reviewed || o.address.bostaDeliveryId || o.address.trackingNumber || o.address.bostaTrackingNumber);
            if (typeof o.address === 'string') {
                try {
                    const p = JSON.parse(o.address);
                    return !!(p?.isReviewed || p?.is_reviewed || p?.bostaDeliveryId || p?.trackingNumber || p?.bostaTrackingNumber);
                } catch(e) {}
            }
        }
        return false;
    };

    const pendingShopifyOrders = (state.orders || []).filter(o => 
        o.status === 'Pending' && o.source === 'shopify' && !isOrderReviewed(o)
    );

    // Toggle Row Expansion
    const toggleRow = (orderId) => {
        const isWillExpand = !expandedOrderIds[orderId];
        setExpandedOrderIds(prev => ({
            ...prev,
            [orderId]: isWillExpand
        }));
        if (isWillExpand) {
            const target = (state.orders || []).find(o => o.id === orderId);
            if (!target || !target.items || target.items.length === 0) {
                fetchMissingOrderItems(orderId);
            }
        }
    };

    // Row Delete confirmation
    const handleDeleteOrder = (e, id) => {
        e.stopPropagation(); // prevent expanding row on delete click
        showConfirm(`هل أنت متأكد من حذف السجل الخاص بالطلب ${id} نهائياً؟`, () => {
            deleteOrder(id);
            showToast(`تم حذف الطلب ${id} بنجاح`, "success");
        });
    };

    // CSV Excel Exporter
    const handleExportCSV = () => {
        const headers = ["رقم الطلب", "العميل", "الهاتف", "التاريخ", "المنتجات", "الإجمالي", "المتبقي للتحصيل", "المستودع", "حالة التوصيل", "حالة الدفع"];
        const rows = filteredOrders.map(ord => {
            const { phone, customerCode } = parseAddressData(ord.address);
            const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
            const remaining = getRemainingToCollect(ord);
            const paymentStatus = getPaymentStatus(ord);
            const deliveryStatus = getOrderStatusBadge(ord).label;
            
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
            if (v) name = formatProductDisplayName(p.name, v.name);
        });
        return name;
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
            const clientName = ord.client || '';
            const systemId = ord.id;
            const shopifyId = ord.shopifyOrderId || 'غير متوفر';
            const shopifyIdDisplay = ord.shopifyOrderId ? ` (شوبيفاي: #${ord.shopifyOrderId})` : '';
            
            const itemsList = (ord.items || []).map(item => {
                const name = getProductNameBySku(item.variantSku);
                const qtyText = item.quantity > 1 ? ` (الكمية: ${item.quantity})` : '';
                return `\u200F\t•\t${name} – ${item.price} جنيه${qtyText}`;
            }).join('\n');

            const total = parseFloat(ord.totalValue || ord.total_value) || 0;
            const status = ord.status || '';

            const emojiFlower = "🌸";
            const emojiBox = "📦";
            const emojiMoney = "💰";
            const emojiTruck = "🚚";
            const emojiSparkles = "✨";
            const emojiPray = "🙏";
            const emojiSmile = "😊";
            const emojiWind = "🌬️";
            const emojiHeartFace = "💖";
            const emojiGift = "🎁";
            const emojiCard = "💳";
            const emojiKeycap1 = "1️⃣";
            const emojiKeycap2 = "2️⃣";

            let messageText = '';

            if (status === 'Pending') {
                messageText = `بتواصل معاك بخصوص طلبك رقم ${systemId} (رقمه على شوبيفاي: ${shopifyId})

${emojiBox} تفاصيل الطلب:

${itemsList}

${emojiMoney} إجمالي الطلب: ${total} جنيه

عشان نأكد الطلب ونبدأ نجهزه للشحن، محتاجين نحصل على عربون لتأكيد الحجز، وليك اختيار من اتنين:

${emojiKeycap1} عربون 50 جنيه فقط، والباقي بيتحصل عند الاستلام
${emojiKeycap2} أو تحويل قيمة الطلب كاملة، وفي الحالة دي هيتم شحن الطلب مجانًا وتستلمه من غير أي مبلغ إضافي ${emojiGift}

${emojiCard} وسائل الدفع المتاحة:

	•	إنستاباي (InstaPay)
	•	فودافون كاش

في انتظار تأكيدك عشان نبدأ فورًا في تجهيز وشحن طلبك ${emojiTruck}${emojiSparkles}
ولو عندك أي استفسار، إحنا في الخدمة ${emojiPray}`;
            } else {
                let statusAr = 'قيد المراجعة';
                let followUpReason = '';

                if (status === 'Confirmed' || status === 'Processing') {
                    statusAr = 'مؤكد وجاري التجهيز';
                    followUpReason = `حبينا نطمن حضرتك إن الطلب مؤكد وجاري تجهيزه حالياً للتحضير للشحن. لو حابب تعدل أي حاجة أو تضيف منتج تاني إحنا في الخدمة! ${emojiSmile}${emojiTruck}`;
                } else if (status === 'Shipped') {
                    statusAr = 'تم الشحن';
                    followUpReason = `الطلب خرج مع شركة الشحن وحالياً في طريقه إليك. حابين نطمن لو واجهت أي مشكلة أو للتنسيق مع مندوب التوصيل. ${emojiTruck}${emojiWind}`;
                } else if (status === 'Completed' || status === 'Delivered') {
                    statusAr = 'تم التوصيل بنجاح';
                    followUpReason = `الطلب وصل لحضرتك، وحابين نتطمن لو كل حاجة تمام وعجبتك المنتجات! رأيك يهمنا جداً. ${emojiHeartFace}${emojiFlower}`;
                } else if (status === 'Draft') {
                    statusAr = 'مسودة';
                    followUpReason = `بخصوص المسودة المسجلة عندنا. حابين نعرف لو تحب نأكد الطلب ونكمله لحضرتك؟ ${emojiSmile}`;
                } else {
                    statusAr = status;
                    followUpReason = `حابين نتابع مع حضرتك بخصوص حالة الطلب.`;
                }

                messageText = `السلام عليكم يا فندم، مع حضرتك من متجر أخطبوط ${emojiFlower}
يُسعدنا التواصل مع حضرتك لمتابعة طلبك رقم ${systemId}${shopifyIdDisplay}

${emojiBox} تفاصيل المنتجات:
${itemsList}

${emojiMoney} إجمالي المطلوب: ${total} جنيه
حالة الطلب الحالية: ${statusAr}

${followUpReason}

ولو عندك أي استفسار، إحنا دايماً في الخدمة ${emojiPray}${emojiSparkles}`;
            }

            textParam = `?text=${encodeURIComponent(messageText)}`;
        }
        return `https://wa.me/${clean}${textParam}`;
    };

    return (
        <div id="orders-view" className="view-pane active" dir="rtl" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            

            {/* SuperAdmin active custody dashboard */}
            {state.currentUser?.role === 'SuperAdmin' && (() => {
                const adminCustodies = (() => {
                    const custodyMap = {};
                    (state.users || []).forEach(u => {
                        custodyMap[u.id] = { name: u.name, role: u.role, confirmed: 0, pending: 0, orderIds: [] };
                    });

                    (state.orders || []).forEach(o => {
                        if (o.deposit > 0 && o.depositReceiverId) {
                            if (!custodyMap[o.depositReceiverId]) {
                                custodyMap[o.depositReceiverId] = { name: 'أدمن غير معروف', role: '', confirmed: 0, pending: 0, orderIds: [] };
                            }
                            if (o.depositStatus === 'confirmed') {
                                custodyMap[o.depositReceiverId].confirmed += parseFloat(o.deposit) || 0;
                                custodyMap[o.depositReceiverId].orderIds.push(o.id);
                            } else if (o.depositStatus === 'pending') {
                                custodyMap[o.depositReceiverId].pending += parseFloat(o.deposit) || 0;
                            }
                        }
                    });

                    return Object.entries(custodyMap).map(([id, data]) => ({ id, ...data })).filter(item => item.confirmed > 0 || item.pending > 0);
                })();

                if (adminCustodies.length === 0) return null;

                return (
                    <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', marginBottom: '24px' }}>
                        <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-users-gear"></i> عُهد الأدمنز النشطة (من العرابين المستلمة)
                        </h4>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                            {adminCustodies.map(cust => (
                                <div key={cust.id} style={{ background: 'rgba(0,0,0,0.2)', padding: '12px', borderRadius: '6px', border: '1px solid var(--glass-border)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <strong style={{ fontSize: '13px' }}>{cust.name} ({cust.role === 'SuperAdmin' ? 'سوبر أدمن' : 'أدمن'})</strong>
                                        <span className="badge badge-success" style={{ fontSize: '12px', background: 'rgba(46, 204, 113, 0.1)', color: '#2ecc71', border: '1px solid rgba(46, 204, 113, 0.2)' }}>
                                            {cust.confirmed} {currency}
                                        </span>
                                    </div>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '11px', color: 'var(--text-muted)' }}>
                                        <span>عرابين بانتظار التأكيد: {cust.pending} {currency}</span>
                                        <button 
                                            className="btn btn-primary"
                                            onClick={(e) => { e.stopPropagation(); settleAdminsCustody(cust.id, cust.orderIds); }}
                                            style={{ padding: '2px 8px', fontSize: '10.5px', background: 'var(--gold-primary)', color: '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 600 }}
                                        >
                                            تسوية العهدة
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                );
            })()}
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
                <div className="glass-card" style={{ 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(212, 175, 55, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(212, 175, 55, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>إجمالي الطلبات</span>
                    <strong style={{ fontSize: '1.45rem', color: 'var(--gold-primary)', fontWeight: '800' }}>{totalOrdersCount} طلب</strong>
                </div>
                <div className="glass-card" style={{ 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(46, 213, 115, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(46, 213, 115, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(46, 213, 115, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>قيمة المبيعات (المؤكدة)</span>
                    <strong style={{ fontSize: '1.45rem', color: 'var(--color-success)', fontWeight: '800' }}>{currency} {salesValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                </div>
                <div className="glass-card" style={{ 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 71, 87, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(255, 71, 87, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(255, 71, 87, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>المتبقي للتحصيل</span>
                    <strong style={{ fontSize: '1.45rem', color: 'var(--color-danger)', fontWeight: '800' }}>{currency} {remainingToCollectTotal.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                </div>
                <div className="glass-card" style={{ 
                    padding: '18px 20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(30, 144, 255, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(30, 144, 255, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(30, 144, 255, 0.05)'
                }}>
                    <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', display: 'block', marginBottom: '6px' }}>طلبات اليوم</span>
                    <strong style={{ fontSize: '1.45rem', color: 'var(--color-info)', fontWeight: '800' }}>{todayOrdersCount} طلب</strong>
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
            <div className="glass-card filter-bar" style={{ padding: '16px', marginBottom: '24px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Top Row: Search & Export */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-input-wrapper" style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
                            <i className="fa-solid fa-magnifying-glass search-icon" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                            <input 
                                type="text" 
                                placeholder="ابحث برقم الطلب أو العميل..."
                                value={globalSearch || ''}
                                onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                                style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px 14px 10px 40px', borderRadius: '8px', fontSize: '14px' }}
                            />
                        </div>
                        <button 
                            onClick={handleExportCSV} 
                            className="btn btn-success" 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}
                        >
                            <i className="fa-solid fa-file-excel"></i> تصدير Excel
                        </button>
                    </div>

                    {/* Bottom Row: Filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        
                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '180px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={deliveryStatusFilter} 
                            onChange={(e) => { setDeliveryStatusFilter(e.target.value); setCurrentPage(1); }}>
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات التوصيل</option>
                            <option value="Draft" style={{ background: 'var(--bg-secondary)' }}>مسودة</option>
                            <option value="Pending" style={{ background: 'var(--bg-secondary)' }}>قيد الانتظار</option>
                            <option value="10" style={{ background: 'var(--bg-secondary)' }}>جديد</option>
                            <option value="11" style={{ background: 'var(--bg-secondary)' }}>في انتظار الاستلام</option>
                            <option value="21" style={{ background: 'var(--bg-secondary)' }}>تم استلام الأوردر</option>
                            <option value="24" style={{ background: 'var(--bg-secondary)' }}>تم تخزينه</option>
                            <option value="30" style={{ background: 'var(--bg-secondary)' }}>قيد التنفيذ</option>
                            <option value="41" style={{ background: 'var(--bg-secondary)' }}>متجه للعميل</option>
                            <option value="46" style={{ background: 'var(--bg-secondary)' }}>مرتجعاتك العائدة</option>
                            <option value="102" style={{ background: 'var(--bg-secondary)' }}>متوقف مؤقتاً</option>
                            <option value="103" style={{ background: 'var(--bg-secondary)' }}>في انتظار متابعتك</option>
                            <option value="45" style={{ background: 'var(--bg-secondary)' }}>تم بنجاح</option>
                            <option value="100" style={{ background: 'var(--bg-secondary)' }}>غير ناجح</option>
                            <option value="60" style={{ background: 'var(--bg-secondary)' }}>تم الاسترجاع</option>
                            <option value="48" style={{ background: 'var(--bg-secondary)' }}>لم يتم بنجاح</option>
                        </select>

                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={sourceFilter} 
                            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل المصادر</option>
                            <option value="shopify" style={{ background: 'var(--bg-secondary)' }}>طلبات شوبيفاي</option>
                            <option value="manual" style={{ background: 'var(--bg-secondary)' }}>طلبات يدوية</option>
                        </select>

                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={paymentStatusFilter} 
                            onChange={(e) => { setPaymentStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات الدفع</option>
                            <option value="غير مدفوع" style={{ background: 'var(--bg-secondary)' }}>غير مدفوع</option>
                            <option value="مدفوع جزئي" style={{ background: 'var(--bg-secondary)' }}>مدفوع جزئي</option>
                            <option value="مدفوع" style={{ background: 'var(--bg-secondary)' }}>مدفوع</option>
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>من:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }} 
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>إلى:</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }} 
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button 
                                className="btn" 
                                onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }} 
                                style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                <i className="fa-solid fa-xmark"></i> مسح التواريخ
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* 3. TABLE / CARD VIEW COMPONENT */}
            <div className="glass-card" style={{ overflow: 'visible', border: '1px solid var(--glass-border)' }}>
                
                {/* Desktop view table */}
                <div className="table-wrapper orders-desktop-only" style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border-hover)' }}>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>رقم الطلب</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>العميل + الهاتف</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>التاريخ</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>المنتجات</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>الإجمالي</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>المتبقي للتحصيل</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>الآدمن (المسجل)</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>حالة التوصيل</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>حالة الدفع</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px', whiteSpace: 'nowrap' }}>الإجراءات</th>
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
                                    const { phone, detailAddress, bostaStateName, bostaTrackingNumber } = parseAddressData(ord.address);
                                    const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
                                    const remaining = getRemainingToCollect(ord);
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
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '14px 16px', color: 'var(--gold-primary)', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
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
                                                <td style={{ padding: '14px 16px', textAlign: 'center', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        <div style={{ fontWeight: 500 }}>{ord.client}</div>
                                                        {(() => {
                                                             const cust = (state.customers || []).find(c => c.id === ord.customer_id || (phone && normalizePhoneNumber(c.phone) === normalizePhoneNumber(phone)));
                                                            if (cust && cust.is_spam) {
                                                                return (
                                                                    <span className="badge badge-danger animate-pulse" style={{ fontSize: '10px', padding: '2px 6px', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }} title="عميل مزعج">
                                                                        <i className="fa-solid fa-triangle-exclamation"></i>
                                                                    </span>
                                                                );
                                                            }
                                                            return null;
                                                        })()}
                                                    </div>
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', fontFamily: 'monospace', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                                        {phone || 'بدون هاتف'}
                                                        {phone && (
                                                            <a 
                                                                href={getWhatsAppLink(phone, ord)} 
                                                                target="_blank" 
                                                                rel="noopener noreferrer"
                                                                onClick={(e) => e.stopPropagation()}
                                                                style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s', textDecoration: 'none' }}
                                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                title="مراسلة عبر واتساب"
                                                            >
                                                                <i className="fa-brands fa-whatsapp" style={{ fontSize: '13px', fontWeight: 'bold' }}></i>
                                                            </a>
                                                        )}
                                                    </div>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    <div style={{ fontWeight: 500 }}>{ord.date}</div>
                                                    {ord.createdAt && (
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                            <i className="fa-regular fa-clock" style={{ fontSize: '10px' }}></i>
                                                            {formatOrderTime(ord.createdAt)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{totalQty} قطع</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 600, verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{currency} {ord.totalValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 600, color: remaining > 0 ? '#e74c3c' : '#2ecc71', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    {ord.depositStatus === 'pending' ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ color: '#ef4444', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <i className="fa-solid fa-clock-rotate-left"></i> عربون معلق
                                                            </span>
                                                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                                                بانتظار تأكيد الأدمن
                                                            </span>
                                                        </div>
                                                    ) : ord.depositStatus === 'rejected' ? (
                                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                                                            <span style={{ color: '#ef4444', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                                                <i className="fa-solid fa-circle-xmark"></i> تم رفض العربون
                                                            </span>
                                                        </div>
                                                    ) : (
                                                        ord.status === 'Cancelled' ? (
                                                            <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>ملغي</span>
                                                        ) : (
                                                            remaining > 0 ? `${currency} ${remaining.toLocaleString('en-US', {maximumFractionDigits: 2})}` : 'خالص'
                                                        )
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px', color: 'var(--text-primary)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>{ord.createdBy || 'الآدمن'}</td>
                                                
                                                {/* Delivery Status Badge */}
                                                <td style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    {(() => {
                                                        const badge = getOrderStatusBadge(ord);
                                                        return (
                                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                                                                <span className={`badge ${badge.className}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                                    {badge.label}
                                                                </span>
                                                                {bostaTrackingNumber && (
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginTop: '2px' }}>
                                                                        <span style={{ fontSize: '10px', opacity: 0.8, fontFamily: 'monospace', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                                                                            بوليصة: {bostaTrackingNumber}
                                                                        </span>
                                                                        <button
                                                                            type="button"
                                                                            title="تحديث حالة التوصيل من بوسطة"
                                                                            onClick={(e) => { e.stopPropagation(); syncBostaStatus(ord.id, bostaTrackingNumber); }}
                                                                            style={{
                                                                                background: 'none',
                                                                                border: 'none',
                                                                                cursor: 'pointer',
                                                                                color: '#E3000F',
                                                                                fontSize: '11px',
                                                                                padding: '2px 4px',
                                                                                borderRadius: '4px',
                                                                                transition: '0.2s',
                                                                                opacity: 0.7
                                                                            }}
                                                                            onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
                                                                            onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
                                                                        >
                                                                            <i className="fa-solid fa-arrows-rotate"></i>
                                                                        </button>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        );
                                                    })()}
                                                </td>

                                                {/* Payment Status Badge */}
                                                <td style={{ textAlign: 'center', padding: '14px 16px', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
                                                    <span className={`badge ${getPaymentStatusBadgeClass(paymentStatus)}`} style={{ fontSize: '11px', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, whiteSpace: 'nowrap' }}>
                                                        {paymentStatus}
                                                    </span>
                                                </td>

                                                {/* Action Buttons with Labels */}
                                                <td style={{ padding: '14px 16px', verticalAlign: 'middle', textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', alignItems: 'center', position: 'relative', overflow: 'visible' }}>
                                                        
                                                        {/* Details Toggle Button */}
                                                        <button 
                                                            className="action-btn-circle" 
                                                            style={{ background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                            onClick={() => toggleRow(ord.id)}
                                                            title={isExpanded ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                                                        >
                                                            <i className={`fa-solid ${isExpanded ? 'fa-eye-slash' : 'fa-eye'}`}></i>
                                                        </button>

                                                        {/* Status transition dropdown toggle */}
                                                        {ord.status !== 'Cancelled' && (
                                                            <div style={{ position: 'relative', overflow: 'visible' }}>
                                                                <button 
                                                                    className="action-btn-circle" 
                                                                    style={{ background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                                    onClick={() => setActiveDropdownOrderId(isDropdownOpen ? null : ord.id)}
                                                                    title="تغيير حالة الطلب"
                                                                >
                                                                    <i className="fa-solid fa-arrows-rotate"></i>
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
                                                                        {['Draft', 'Pending', 'Shipped', 'Partially Delivered', 'Completed', 'Cancelled'].map(st => (
                                                                            <div 
                                                                                key={st}
                                                                                onClick={() => {
                                                                                    if (st === 'Shipped' && ord.depositStatus === 'pending') {
                                                                                        showToast("لا يمكن شحن الطلب قبل تأكيد استلام العربون من الأدمن المستلم", "warning");
                                                                                        return;
                                                                                    }
                                                                                    setActiveDropdownOrderId(null);
                                                                                    handleStatusChange(ord.id, st, bostaTrackingNumber);
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
                                                             className="action-btn-circle" 
                                                             style={{ 
                                                                 background: 'var(--glass-bg-hover)', 
                                                                 color: 'var(--text-primary)', 
                                                                 borderColor: 'var(--glass-border-hover)',
                                                                 cursor: 'pointer',
                                                                 opacity: 1
                                                             }}
                                                             onClick={() => {
                                                                 onOpenEditOrder(ord.id);
                                                             }}
                                                             title="تعديل الطلب"
                                                         >
                                                             <i className="fa-solid fa-pen-to-square"></i>
                                                         </button>

                                                        {/* Delete button */}
                                                        <button 
                                                             className="action-btn-circle" 
                                                             style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', borderColor: 'rgba(231,76,60,0.2)' }}
                                                             onClick={(e) => handleDeleteOrder(e, ord.id)}
                                                             title="حذف الطلب"
                                                         >
                                                             <i className="fa-solid fa-trash-can"></i>
                                                         </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* 1. EXPANDABLE ROW DRAWER */}
                                            {isExpanded && (
                                                <tr style={{ background: 'var(--glass-bg)' }}>
                                                    <td colSpan="10" style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                                                        <div className="grid-responsive-1-1_3-1" style={{ gap: '24px' }}>
                                                            
                                                            {/* Customer details */}
                                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                                    <i className="fa-solid fa-user-tag" style={{ marginLeft: '6px' }}></i> تفاصيل العميل والشحن
                                                                </h4>
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                                    <div><strong>كود العميل:</strong> {getCustomerCode(ord.client)}</div>
                                                                    <div>
                                                                        <strong>اسم العميل:</strong> {ord.client}
                                                                        {(() => {
                                                                            const cust = (state.customers || []).find(c => c.id === ord.customer_id || (phone && normalizePhoneNumber(c.phone) === normalizePhoneNumber(phone)));
                                                                            if (cust && cust.is_spam) {
                                                                                return (
                                                                                    <span className="badge badge-danger animate-pulse" style={{ fontSize: '10px', padding: '2px 6px', marginRight: '8px', display: 'inline-flex', alignItems: 'center', gap: '4px', boxShadow: '0 0 8px rgba(239, 68, 68, 0.4)' }}>
                                                                                        <i className="fa-solid fa-triangle-exclamation"></i> عميل مزعج (سبام)
                                                                                    </span>
                                                                                );
                                                                            }
                                                                            return null;
                                                                        })()}
                                                                    </div>
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', justifyContent: 'center' }}>
                                                                        <strong>رقم الهاتف:</strong> {phone || 'غير مسجل'}
                                                                        {phone && (
                                                                            <a 
                                                                                href={getWhatsAppLink(phone, ord)} 
                                                                                target="_blank" 
                                                                                rel="noopener noreferrer"
                                                                                onClick={(e) => e.stopPropagation()}
                                                                                style={{ color: '#25D366', display: 'inline-flex', alignItems: 'center', transition: 'transform 0.2s', textDecoration: 'none' }}
                                                                                onMouseEnter={(e) => e.currentTarget.style.transform = 'scale(1.2)'}
                                                                                onMouseLeave={(e) => e.currentTarget.style.transform = 'scale(1)'}
                                                                                title="مراسلة عبر واتساب"
                                                                            >
                                                                                <i className="fa-brands fa-whatsapp" style={{ fontSize: '14px', fontWeight: 'bold' }}></i>
                                                                            </a>
                                                                        )}
                                                                    </div>
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
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                                    {(() => {
                                                                        const productsSubtotal = (ord.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                                                        const receiverAdmin = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                                                        const depositLabel = receiverAdmin ? `العربون المدفوع (${receiverAdmin.name})` : 'العربون المدفوع (Deposit)';
                                                                        return (
                                                                            <>
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
                                                                            </>
                                                                        );
                                                                    })()}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        {/* Shopify Pending Notice - Directs admin to Shopify Pending section */}
                                                        {ord.status === 'Pending' && ord.source === 'shopify' && !isOrderReviewed(ord) && (
                                                            <div style={{
                                                                marginTop: '20px',
                                                                padding: '14px 20px',
                                                                background: 'linear-gradient(135deg, rgba(212,175,55,0.08), rgba(212,175,55,0.02))',
                                                                border: '1px solid rgba(212,175,55,0.3)',
                                                                borderRadius: '8px',
                                                                display: 'flex',
                                                                justifyContent: 'space-between',
                                                                alignItems: 'center',
                                                                gap: '16px',
                                                                flexWrap: 'wrap'
                                                            }}>
                                                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                    <i className="fa-solid fa-store" style={{ color: 'var(--gold-primary)', fontSize: '18px' }}></i>
                                                                    <span style={{ fontSize: '13px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                        هذا الطلب قادم من شوبيفاي ومعلق بانتظار المراجعة والموافقة من قسم <strong>طلبات شوبيفاي</strong>.
                                                                    </span>
                                                                </div>
                                                                <button
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setCurrentView('shopify_pending');
                                                                    }}
                                                                    className="btn btn-gold"
                                                                    style={{
                                                                        padding: '8px 16px',
                                                                        fontSize: '12px',
                                                                        fontWeight: 'bold',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '6px'
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-arrow-left"></i>
                                                                    الانتقال إلى طلبات شوبيفاي للمراجعة
                                                                </button>
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

                {/* Mobile view cards */}
                <div className="orders-mobile-cards">
                    {paginatedOrders.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', background: 'var(--glass-bg)', borderRadius: '12px', border: '1px solid var(--glass-border)' }}>
                            لا توجد طلبات تطابق معايير البحث
                        </div>
                    ) : (
                        paginatedOrders.map(ord => {
                            const isExpanded = expandedOrderIds[ord.id];
                            const { phone, detailAddress, bostaStateName, bostaTrackingNumber } = parseAddressData(ord.address);
                            const paymentStatus = getPaymentStatus(ord);
                            const remaining = getRemainingToCollect(ord);
                            const deliveryBadge = getOrderStatusBadge(ord);
                            const paymentBadgeClass = getPaymentStatusBadgeClass(paymentStatus);
                            const isDropdownOpen = activeDropdownOrderId === ord.id;

                            return (
                                <div 
                                    key={ord.id} 
                                    className={`order-mobile-card ${isExpanded ? 'expanded' : ''}`}
                                    onClick={() => toggleRow(ord.id)}
                                    style={{
                                        background: isExpanded ? 'rgba(212, 175, 55, 0.03)' : 'rgba(255, 255, 255, 0.02)',
                                        border: isExpanded ? '1px solid var(--gold-primary)' : '1px solid var(--glass-border)',
                                        borderRadius: '12px',
                                        padding: '16px',
                                        display: 'flex',
                                        flexDirection: 'column',
                                        gap: '10px',
                                        transition: 'all 0.2s ease',
                                        cursor: 'pointer'
                                    }}
                                >
                                    {/* Header: ID, Date, Source */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '8px' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <strong style={{ color: 'var(--gold-primary)', fontSize: '15px', fontFamily: 'monospace' }}>#{ord.id}</strong>
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
                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{ord.date}</span>
                                    </div>

                                    {/* Customer name and phone */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                            <strong style={{ color: '#fff', fontSize: '14px' }}>{ord.client}</strong>
                                            {(() => {
                                                const cust = (state.customers || []).find(c => c.id === ord.customer_id || (phone && normalizePhoneNumber(c.phone) === normalizePhoneNumber(phone)));
                                                if (cust && cust.is_spam) {
                                                    return (
                                                        <span className="badge badge-danger animate-pulse" style={{ fontSize: '9px', padding: '2px 4px', display: 'inline-flex', alignItems: 'center', gap: '2px' }} title="عميل مزعج">
                                                            <i className="fa-solid fa-triangle-exclamation"></i>
                                                        </span>
                                                    );
                                                }
                                                return null;
                                            })()}
                                        </div>
                                        <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{phone || 'بدون هاتف'}</span>
                                    </div>

                                    {/* Status Badges & Financial summary */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
                                        <div style={{ display: 'flex', gap: '6px' }}>
                                            <span className={`badge ${deliveryBadge.className}`} style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                {deliveryBadge.label}
                                            </span>
                                            <span className={`badge ${paymentBadgeClass}`} style={{ fontSize: '10px', padding: '3px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                                {paymentStatus}
                                            </span>
                                        </div>
                                        <div style={{ fontSize: '13px' }}>
                                            <span style={{ color: 'var(--text-muted)', marginLeft: '4px' }}>المتبقي:</span>
                                            <strong style={{ color: remaining > 0 ? '#e74c3c' : '#2ecc71' }}>
                                                {ord.depositStatus === 'pending' ? (
                                                    'عربون معلق'
                                                ) : ord.depositStatus === 'rejected' ? (
                                                    'عربون مرفوض'
                                                ) : ord.status === 'Cancelled' ? (
                                                    'ملغي'
                                                ) : (
                                                    remaining > 0 ? `${currency} ${remaining.toLocaleString('en-US', {maximumFractionDigits: 2})}` : 'خالص'
                                                )}
                                            </strong>
                                        </div>
                                    </div>

                                    {/* Action Shortcuts for phone / whatsapp */}
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px dashed var(--glass-border)', paddingTop: '10px', marginTop: '4px' }}>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                            <span>بواسطة: </span>
                                            <strong style={{ color: 'var(--gold-primary)' }}>{ord.createdBy || 'الآدمن'}</strong>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }} onClick={(e) => e.stopPropagation()}>
                                            {phone && (
                                                <>
                                                    <a 
                                                        href={`tel:${phone}`} 
                                                        className="sa-btn-circle-phone" 
                                                        title="اتصال هاتفياً"
                                                        style={{ width: '32px', height: '32px', fontSize: '12px' }}
                                                    >
                                                        <i className="fa-solid fa-phone"></i>
                                                    </a>
                                                    <a 
                                                        href={getWhatsAppLink(phone, ord)} 
                                                        target="_blank" 
                                                        rel="noopener noreferrer" 
                                                        className="sa-btn-circle-whatsapp" 
                                                        title="مراسلة واتساب"
                                                        style={{ width: '32px', height: '32px', fontSize: '14px' }}
                                                    >
                                                        <i className="fa-brands fa-whatsapp"></i>
                                                    </a>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Expanded Details section */}
                                    {isExpanded && (
                                        <div style={{ borderTop: '1px solid var(--glass-border)', paddingTop: '12px', marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '16px' }} onClick={(e) => e.stopPropagation()}>
                                            {/* 1. Address mapping */}
                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                    <i className="fa-solid fa-user-tag" style={{ marginLeft: '6px' }}></i> تفاصيل العميل والشحن
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                    <div><strong>كود العميل:</strong> {getCustomerCode(ord.client)}</div>
                                                    <div><strong>الاسم:</strong> {ord.client}</div>
                                                    <div><strong>رقم الهاتف:</strong> {phone || 'بدون هاتف'}</div>
                                                    {ord.source === 'shopify' && (
                                                        <>
                                                            <div><strong>البريد الإلكتروني:</strong> {(state.customers || []).find(c => c.id === ord.customer_id)?.email || 'غير مسجل'}</div>
                                                            <div><strong>طريقة الدفع:</strong> {ord.paymentMethod || 'الدفع عند الاستلام'}</div>
                                                            {ord.shopifyOrderId && <div><strong>رقم طلب شوبيفاي:</strong> #{ord.shopifyOrderId}</div>}
                                                        </>
                                                    )}
                                                    <div><strong>المحافظة:</strong> {ord.governorate || 'غير مسجل'}</div>
                                                    <div><strong>العنوان بالتفصيل:</strong> {detailAddress || 'غير مسجل'}</div>
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
                                                    {bostaTrackingNumber && (
                                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                            <strong>بوليصة بوسطة:</strong>
                                                            <span style={{ fontFamily: 'monospace' }}>{bostaTrackingNumber}</span>
                                                            <button
                                                                type="button"
                                                                className="btn btn-secondary"
                                                                style={{ padding: '2px 6px', fontSize: '10px' }}
                                                                onClick={() => syncBostaStatus(ord.id, bostaTrackingNumber)}
                                                            >
                                                                تحديث الحالة
                                                            </button>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 2. Products table */}
                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                    <i className="fa-solid fa-box-open" style={{ marginLeft: '6px' }}></i> المنتجات المطلوبة ({(ord.items || []).reduce((sum, item) => sum + item.quantity, 0)})
                                                </h4>
                                                <div style={{ overflowX: 'auto' }}>
                                                    <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
                                                        <thead>
                                                            <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                                                <th style={{ textAlign: 'right', padding: '6px 4px' }}>اسم الصنف / SKU</th>
                                                                <th style={{ textAlign: 'center', padding: '6px 4px' }}>الكمية</th>
                                                                <th style={{ textAlign: 'left', padding: '6px 4px' }}>السعر</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {(ord.items || []).map((item, idx) => (
                                                                <tr key={idx} style={{ borderBottom: '1px solid var(--glass-bg)' }}>
                                                                    <td style={{ padding: '8px 4px' }}>{getProductNameBySku(item.variantSku)}</td>
                                                                    <td style={{ textAlign: 'center', padding: '8px 4px' }}>{item.quantity}</td>
                                                                    <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 'bold' }}>{currency} {item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>

                                            {/* 3. Detailed Cost breakdown */}
                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>
                                                    <i className="fa-solid fa-file-invoice-dollar" style={{ marginLeft: '6px' }}></i> تفصيل التكلفة
                                                </h4>
                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                                    {(() => {
                                                        const productsSubtotal = (ord.items || []).reduce((sum, item) => sum + (item.quantity * item.price), 0);
                                                        const receiverAdmin = (state.users || []).find(u => u.id === ord.depositReceiverId);
                                                        const depositLabel = receiverAdmin ? `العربون المدفوع (${receiverAdmin.name})` : 'العربون المدفوع (Deposit)';
                                                        return (
                                                            <>
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
                                                            </>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            {/* 4. Delivery Tracker Timeline */}
                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                <h4 style={{ fontSize: '13px', color: 'var(--gold-primary)', marginBottom: '16px', fontWeight: 600 }}>
                                                    <i className="fa-solid fa-truck-ramp-box" style={{ marginLeft: '6px' }}></i> حالة الشحن
                                                </h4>
                                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'relative', padding: '0 10px', marginTop: '10px' }}>
                                                    <div style={{ position: 'absolute', top: '12px', right: '20px', left: '20px', height: '2px', background: 'var(--glass-border-hover)', zIndex: 1 }} />
                                                    <div style={{
                                                        position: 'absolute',
                                                        top: '12px',
                                                        right: '20px',
                                                        width: ord.status === 'Draft' ? '0%' : (ord.status === 'Pending' ? '33%' : (ord.status === 'Shipped' || ord.status === 'Partially Delivered' ? '66%' : '100%')),
                                                        height: '2px',
                                                        background: 'var(--gold-primary)',
                                                        zIndex: 2,
                                                        transition: 'width 0.3s ease'
                                                    }} />
                                                    {[
                                                        { label: 'إنشاء', active: true },
                                                        { label: 'تأكيد', active: ord.status !== 'Draft' },
                                                        { label: 'شحن', active: ord.status !== 'Draft' && ord.status !== 'Pending' },
                                                        { label: 'تسليم', active: ord.status === 'Completed' }
                                                    ].map((step, idx) => (
                                                        <div key={idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3 }}>
                                                            <div style={{
                                                                width: '24px',
                                                                height: '24px',
                                                                borderRadius: '50%',
                                                                background: step.active ? 'var(--gold-primary)' : '#26262b',
                                                                color: step.active ? '#000' : 'rgba(255,255,255,0.3)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 'bold',
                                                                fontSize: '9px',
                                                                border: '2px solid',
                                                                borderColor: step.active ? 'var(--gold-primary)' : 'var(--glass-border-hover)'
                                                            }}>
                                                                {step.active ? <i className="fa-solid fa-check" style={{ fontSize: '8px' }}></i> : idx + 1}
                                                            </div>
                                                            <span style={{ fontSize: '9px', marginTop: '4px', color: step.active ? 'var(--gold-primary)' : 'rgba(255,255,255,0.4)', fontWeight: step.active ? 'bold' : 'normal' }}>
                                                                {step.label}
                                                            </span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* 5. Action buttons */}
                                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', justifyContent: 'center', marginTop: '8px' }}>
                                                {ord.status !== 'Cancelled' && (
                                                    <div style={{ position: 'relative' }}>
                                                        <button 
                                                            className="btn btn-secondary" 
                                                            onClick={(e) => { e.stopPropagation(); setActiveDropdownOrderId(isDropdownOpen ? null : ord.id); }}
                                                            style={{ fontSize: '11px', padding: '6px 10px' }}
                                                        >
                                                            <i className="fa-solid fa-arrows-rotate" style={{ marginLeft: '4px' }}></i> حالة التوصيل
                                                        </button>
                                                        
                                                        {isDropdownOpen && (
                                                            <div className="glass-card" style={{
                                                                position: 'absolute',
                                                                bottom: '100%',
                                                                left: 0,
                                                                width: '140px',
                                                                background: 'var(--bg-secondary)',
                                                                border: '1px solid var(--glass-border)',
                                                                borderRadius: '6px',
                                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                                zIndex: 1000,
                                                                padding: '4px',
                                                                marginBottom: '4px'
                                                            }}>
                                                                {['Draft', 'Pending', 'Shipped', 'Partially Delivered', 'Completed', 'Cancelled'].map(st => (
                                                                    <div 
                                                                        key={st}
                                                                        onClick={() => {
                                                                            if (st === 'Shipped' && ord.depositStatus === 'pending') {
                                                                                showToast("لا يمكن شحن الطلب قبل تأكيد استلام العربون", "warning");
                                                                                return;
                                                                            }
                                                                            setActiveDropdownOrderId(null);
                                                                            handleStatusChange(ord.id, st, bostaTrackingNumber);
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

                                                <button 
                                                    className="btn btn-secondary" 
                                                    onClick={(e) => { e.stopPropagation(); onOpenEditOrder(ord.id); }}
                                                    style={{ fontSize: '11px', padding: '6px 10px' }}
                                                >
                                                    <i className="fa-solid fa-pen-to-square" style={{ marginLeft: '4px' }}></i> تعديل
                                                </button>

                                                <button 
                                                    className="btn btn-secondary" 
                                                    onClick={(e) => { e.stopPropagation(); handlePrintInvoice(ord); }}
                                                    style={{ fontSize: '11px', padding: '6px 10px' }}
                                                >
                                                    <i className="fa-solid fa-print" style={{ marginLeft: '4px' }}></i> فاتورة
                                                </button>

                                                <button 
                                                    className="btn btn-danger" 
                                                    onClick={(e) => { e.stopPropagation(); handleDeleteOrder(e, ord.id); }}
                                                    style={{ fontSize: '11px', padding: '6px 10px', background: 'rgba(231,76,60,0.1)', borderColor: 'rgba(231,76,60,0.2)', color: '#e74c3c' }}
                                                >
                                                    <i className="fa-solid fa-trash-can" style={{ marginLeft: '4px' }}></i> حذف
                                                </button>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })
                    )}
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
