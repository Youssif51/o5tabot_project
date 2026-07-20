import React, { useContext, useState, useEffect, useRef } from 'react';
import { AppContext } from '../../context/AppContext';
import { getLocalDateString } from '../../utils/dateUtils';
import bostaData from '../../../محافظات/المناطق التابعه لكل محافظة.json';

export default function ShopifyPendingList() {
    const { state, updateOrderStatus, approveOrderWithBosta, showToast, showConfirm, addCustomer, setCustomerSpam, logActivity } = useContext(AppContext);
    const [globalSearch, setGlobalSearch] = useState('');
    const [expandedOrderIds, setExpandedOrderIds] = useState({});
    
    const [selectedCities, setSelectedCities] = useState({}); // { [orderId]: CityObject }
    const [selectedDistricts, setSelectedDistricts] = useState({}); // { [orderId]: DistrictObject }
    const [customDeposits, setCustomDeposits] = useState({}); // { [orderId]: string/number }
    const [allowToOpenMap, setAllowToOpenMap] = useState({}); // { [orderId]: boolean }
    
    // Dropdowns UI search states
    const [citySearch, setCitySearch] = useState({}); // { [orderId]: string }
    const [districtSearch, setDistrictSearch] = useState({}); // { [orderId]: string }
    const [activeCityDropdown, setActiveCityDropdown] = useState(null); // orderId
    const [activeDistrictDropdown, setActiveDistrictDropdown] = useState(null); // orderId

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;
    
    const currency = state.storeSettings.currency || 'EGP';

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

    // Parse address JSON structure safely
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

    const normalizePhoneNumber = (phoneStr) => {
        if (!phoneStr) return '';
        let clean = phoneStr.replace(/\D/g, '');
        if (clean.startsWith('20') && clean.length > 10) {
            clean = clean.substring(2);
        } else if (clean.startsWith('2') && clean.length > 10) {
            clean = clean.substring(1);
        }
        if (clean.length === 10 && (clean.startsWith('10') || clean.startsWith('11') || clean.startsWith('12') || clean.startsWith('15'))) {
            clean = '0' + clean;
        }
        if (!clean.startsWith('0') && clean.length === 10) {
            clean = '0' + clean;
        }
        return clean;
    };

    // Filter Logic: only pending Shopify orders
    const pendingOrders = (state.orders || []).filter(ord => {
        if (ord.status !== 'Pending' || ord.source !== 'shopify') return false;
        
        // Search filter
        if (globalSearch.trim() !== '') {
            const query = globalSearch.toLowerCase();
            const clientMatches = (ord.client || '').toLowerCase().includes(query);
            const idMatches = (ord.id || '').toLowerCase().includes(query);
            const phoneMatches = parseAddressData(ord.address).phone.includes(query);
            if (!clientMatches && !idMatches && !phoneMatches) return false;
        }
        return true;
    });

    // Fuzzy matching Shopify governorate to Bosta cities
    const getAutoMatchedCity = (govName) => {
        if (!govName) return null;
        const cleanGov = govName.toLowerCase().trim().replace(" governorate", "").replace("ال", "");
        return bostaData.data.find(c => {
            const cleanCityName = c.cityName.toLowerCase().replace(" governorate", "");
            const cleanCityOther = c.cityOtherName.replace("ال", "");
            return cleanCityName.includes(cleanGov) || cleanGov.includes(cleanCityName) ||
                   cleanCityOther.includes(cleanGov) || cleanGov.includes(cleanCityOther);
        });
    };

    // Auto-match on mount or when orders list updates
    useEffect(() => {
        const initialCities = {};
        const initialDistricts = {};
        
        pendingOrders.forEach(ord => {
            const { address } = ord;
            let parsed = {};
            if (address && address.startsWith('{')) {
                try { parsed = JSON.parse(address); } catch(e) {}
            }
            
            if (parsed.bostaCityCode) {
                const matchedCity = bostaData.data.find(c => c.cityCode === parsed.bostaCityCode);
                if (matchedCity) {
                    initialCities[ord.id] = matchedCity;
                    if (parsed.bostaDistrictId) {
                        const matchedDist = matchedCity.districts.find(d => d.districtId === parsed.bostaDistrictId);
                        if (matchedDist) {
                            initialDistricts[ord.id] = matchedDist;
                        }
                    }
                }
            } else {
                const matchedCity = getAutoMatchedCity(ord.governorate);
                if (matchedCity) {
                    initialCities[ord.id] = matchedCity;
                }
            }
        });
        
        setSelectedCities(prev => ({ ...initialCities, ...prev }));
        setSelectedDistricts(prev => ({ ...initialDistricts, ...prev }));
    }, [state.orders]);

    // Pagination calculations
    const totalEntries = pendingOrders.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const activePage = currentPage > totalPages ? totalPages : currentPage;
    const startIdx = (activePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalEntries);
    const paginatedOrders = pendingOrders.slice(startIdx, endIdx);

    // Summary Metric calculations
    const pendingCount = pendingOrders.length;
    const pendingValue = pendingOrders.reduce((sum, o) => sum + (parseFloat(o.totalValue) || 0), 0);
    const avgPendingValue = pendingCount > 0 ? pendingValue / pendingCount : 0;

    // Toggle Row Expansion
    const toggleRow = (orderId) => {
        setExpandedOrderIds(prev => ({
            ...prev,
            [orderId]: !prev[orderId]
        }));
    };

    // Helper to fetch product name for item sub-table
    const getProductNameBySku = (sku) => {
        let name = sku;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) name = v.name === 'Standard Option' || v.name === 'Default Title' ? `${p.name} (أساسي)` : `${p.name} (${v.name})`;
        });
        return name;
    };

    // Approve Action
    const handleApprove = (e, ordId) => {
        e.stopPropagation();
        
        const city = selectedCities[ordId];
        const district = selectedDistricts[ordId];
        
        if (!city || !district) {
            showToast('يرجى تحديد المحافظة والمنطقة لشركة بوسطة قبل الموافقة على الطلب', 'warning');
            return;
        }

        const depositAmount = customDeposits[ordId] !== undefined ? (parseFloat(customDeposits[ordId]) || 0) : (pendingOrders.find(o => o.id === ordId)?.deposit || 0);
        const allowToOpen = allowToOpenMap[ordId] !== undefined ? allowToOpenMap[ordId] : false;

        showConfirm('هل أنت متأكد من الموافقة على هذا الطلب وتأكيده للخصم من المخزون؟', () => {
            approveOrderWithBosta(ordId, {
                bostaCityCode: city.cityCode,
                bostaCityName: city.cityOtherName,
                bostaDistrictId: district.districtId,
                bostaDistrictName: district.districtOtherName,
                bostaZoneId: district.zoneId,
                allowToOpenPackage: allowToOpen
            }, depositAmount);
            showToast('تمت الموافقة على الطلب وتأكيده للتحويل لبوسطة وخصم الكميات بنجاح!', 'success');
        });
    };

    // Cancel Action
    const handleCancel = (e, ordId) => {
        e.stopPropagation();
        showConfirm('هل أنت متأكد من رفض وإلغاء هذا الطلب؟', (flagAsSpam) => {
            updateOrderStatus(ordId, 'Cancelled');
            showToast('تم إلغاء الطلب بنجاح', 'warning');
            if (flagAsSpam) {
                console.log('🚨 Spam flag enabled for Shopify order', ordId);
                const ord = state.orders.find(o => o.id === ordId);
                if (ord) {
                    const { phone } = parseAddressData(ord.address);
                    const normPhone = normalizePhoneNumber(phone);
                    const cust = (state.customers || []).find(c => c.id === ord.customer_id || (normPhone && normalizePhoneNumber(c.phone) === normPhone));
                    if (cust) {
                        console.log('🔍 Found existing customer:', cust.id, cust.name);
                        setCustomerSpam(cust.id, true);
                        logActivity("customer", `Flagged customer ${cust.name} as spam upon order rejection.`);
                    } else {
                        console.log('➕ Creating new spam customer for:', ord.client, normPhone);
                        const newCust = {
                            id: crypto.randomUUID(),
                            name: ord.client || "عميل شوبيفاي جديد",
                            phone: normPhone || "00000000000",
                            governorate: ord.governorate || "",
                            customer_type: 'Regular',
                            total_purchases: 0,
                            orders_count: 0,
                            is_spam: true
                        };
                        addCustomer(newCust);
                        logActivity("customer", `Created spam customer profile for ${newCust.name} (${newCust.phone}) upon order rejection.`);
                    }
                }
            }
        }, null, { showSpamToggle: true });
    };

    return (
        <div id="shopify-pending-view" className="view-pane active" dir="rtl" style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
            
            {/* Header */}
            <div className="page-header" style={{ marginBottom: '24px' }}>
                <div className="page-title-group" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '8px',
                        background: 'linear-gradient(135deg, #96bf48, #5a8a1e)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'white',
                        fontSize: '18px',
                        boxShadow: '0 4px 15px rgba(150,191,72,0.3)'
                    }}>
                        <i className="fa-brands fa-shopify"></i>
                    </div>
                    <div>
                        <h2 style={{ fontSize: '22px', fontWeight: 'bold', margin: 0 }}>طلبات شوبيفاي المعلقة للمراجعة</h2>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>مراجعة وتأكيد الطلبات القادمة من المتجر الإلكتروني وتنسيقها مع أكواد بوسطة</span>
                    </div>
                </div>
            </div>

            {/* 3. METRICS ROW */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                <div className="glass-card" style={{ padding: '18px', borderRight: '4px solid #2ecc71', background: 'var(--glass-bg)', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>عدد الطلبات في الانتظار</span>
                    <strong style={{ fontSize: '24px', color: 'var(--text-primary)' }}>{pendingCount} طلبات</strong>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '28px', color: 'rgba(46,204,113,0.1)' }}>
                        <i className="fa-solid fa-hourglass-half"></i>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '18px', borderRight: '4px solid var(--gold-primary)', background: 'var(--glass-bg)', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>إجمالي القيمة المعلقة</span>
                    <strong style={{ fontSize: '24px', color: 'var(--gold-primary)' }}>{currency} {pendingValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '28px', color: 'rgba(212,175,55,0.1)' }}>
                        <i className="fa-solid fa-coins"></i>
                    </div>
                </div>
                <div className="glass-card" style={{ padding: '18px', borderRight: '4px solid #3498db', background: 'var(--glass-bg)', position: 'relative', overflow: 'hidden' }}>
                    <span style={{ fontSize: '12px', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>متوسط قيمة الطلب المعلق</span>
                    <strong style={{ fontSize: '24px', color: '#3498db' }}>{currency} {avgPendingValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                    <div style={{ position: 'absolute', top: '16px', left: '16px', fontSize: '28px', color: 'rgba(52,152,219,0.1)' }}>
                        <i className="fa-solid fa-calculator"></i>
                    </div>
                </div>
            </div>

            {/* 4. FILTER BAR */}
            <div className="glass-card filter-bar" style={{ padding: '16px', marginBottom: '24px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div className="search-input-wrapper" style={{ minWidth: '300px', flex: 1 }}>
                        <i className="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            placeholder="ابحث برقم الأوردر، العميل، التليفون..."
                            value={globalSearch}
                            onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                            style={{ width: '100%', background: 'var(--glass-bg)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '8px 12px 8px 36px', borderRadius: '6px' }}
                        />
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
                        حدد المحافظة والمنطقة المتوافقة مع بوسطة لكل أوردر قبل اعتماده.
                    </div>
                </div>
            </div>

            {/* 5. TABLE / CARDS GRID */}
            <div className="glass-card" style={{ overflow: 'visible', border: '1px solid var(--glass-border)' }}>
                <div className="table-wrapper" style={{ overflowX: 'auto', overflowY: 'visible' }}>
                    <table className="custom-table" style={{ width: '100%', borderCollapse: 'collapse', overflow: 'visible' }}>
                        <thead>
                            <tr style={{ borderBottom: '1px solid var(--glass-border-hover)' }}>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>رقم الطلب ERP</th>
                                <th style={{ textAlign: 'right', padding: '12px 16px' }}>العميل + الهاتف</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>تاريخ الطلب</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>عدد القطع</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>إجمالي الفاتورة</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>طريقة الدفع</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>أكواد بوسطة</th>
                                <th style={{ textAlign: 'center', padding: '12px 16px' }}>مراجعة وإجراءات</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <i className="fa-brands fa-shopify" style={{ fontSize: '40px', color: 'rgba(150,191,72,0.2)' }}></i>
                                            <span>لا توجد طلبات معلقة من متجر شوبيفاي حالياً.</span>
                                        </div>
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map(ord => {
                                    const isExpanded = expandedOrderIds[ord.id];
                                    const { phone, detailAddress } = parseAddressData(ord.address);
                                    const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
                                    const matchedCust = (state.customers || []).find(c => c.id === ord.customer_id) || {};
                                    const customerEmail = matchedCust.email || '';

                                    // Bosta mapping status
                                    const citySelected = selectedCities[ord.id];
                                    const districtSelected = selectedDistricts[ord.id];

                                    // Filter city list based on search
                                    const cleanCityQuery = (citySearch[ord.id] || '').trim().toLowerCase();
                                    const filteredCities = bostaData.data.filter(c => 
                                        c.cityName.toLowerCase().includes(cleanCityQuery) ||
                                        c.cityOtherName.includes(cleanCityQuery)
                                    );

                                    // Filter district list based on search
                                    const cleanDistrictQuery = (districtSearch[ord.id] || '').trim().toLowerCase();
                                    const rawDistricts = citySelected ? citySelected.districts || [] : [];
                                    // Bosta areas with dropOffAvailability = true
                                    const filteredDistricts = rawDistricts.filter(d => 
                                        d.dropOffAvailability && (
                                            d.districtName.toLowerCase().includes(cleanDistrictQuery) ||
                                            d.districtOtherName.includes(cleanDistrictQuery)
                                        )
                                    );

                                    return (
                                        <React.Fragment key={ord.id}>
                                            <tr 
                                                onClick={() => toggleRow(ord.id)}
                                                style={{ 
                                                    borderBottom: '1px solid var(--glass-border)', 
                                                    cursor: 'pointer',
                                                    background: isExpanded ? 'rgba(150,191,72,0.03)' : 'transparent',
                                                    transition: 'background 0.2s ease'
                                                }}
                                                className="table-row-hover"
                                            >
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, padding: '14px 16px', color: 'var(--gold-primary)' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {ord.id}
                                                        <span style={{
                                                            background: 'rgba(150,191,72,0.15)',
                                                            color: '#96bf48',
                                                            padding: '2px 6px',
                                                            borderRadius: '4px',
                                                            fontSize: '0.65rem',
                                                            fontWeight: 'bold'
                                                        }}>
                                                            #{ord.shopifyOrderId || 'Shopify'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td style={{ padding: '14px 16px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
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
                                                    <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>{phone || 'بدون هاتف'}</div>
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px' }}>
                                                    <div>{ord.date}</div>
                                                    {ord.createdAt && (
                                                        <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '2px' }}>
                                                            <i className="fa-regular fa-clock" style={{ marginLeft: '4px', fontSize: '10px' }}></i>
                                                            {formatOrderTime(ord.createdAt)}
                                                        </div>
                                                    )}
                                                </td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '13px' }}>{totalQty} قطع</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontWeight: 600, color: 'var(--gold-primary)' }}>{currency} {ord.totalValue.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                <td style={{ textAlign: 'center', padding: '14px 16px', fontSize: '12px' }}>
                                                    <span style={{ background: 'rgba(255,255,255,0.04)', padding: '4px 8px', borderRadius: '4px', border: '1px solid var(--glass-border)' }}>
                                                        {ord.paymentMethod || 'COD'}
                                                    </span>
                                                </td>
                                                
                                                {/* Bosta status indicator */}
                                                <td style={{ textAlign: 'center', padding: '14px 16px' }}>
                                                    {citySelected && districtSelected ? (
                                                        <span className="badge" style={{ background: 'rgba(46,204,113,0.1)', color: '#2ecc71', border: '1px solid rgba(46,204,113,0.2)', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
                                                            <i className="fa-solid fa-map-location-dot" style={{ marginLeft: '4px' }}></i>
                                                            {citySelected.cityOtherName} - {districtSelected.districtOtherName}
                                                        </span>
                                                    ) : (
                                                        <span className="badge" style={{ background: 'rgba(231,76,60,0.1)', color: '#e74c3c', border: '1px solid rgba(231,76,60,0.2)', fontSize: '11px', padding: '4px 8px', borderRadius: '4px' }}>
                                                            <i className="fa-solid fa-circle-exclamation" style={{ marginLeft: '4px' }}></i>
                                                            بحاجة لربط المنطقة
                                                        </span>
                                                    )}
                                                </td>
                                                
                                                <td style={{ padding: '14px 16px', textAlign: 'center' }} onClick={(e) => e.stopPropagation()}>
                                                    <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                        <button 
                                                            className="btn btn-secondary"
                                                            style={{ padding: '4px 8px', fontSize: '11px', background: 'var(--glass-bg-hover)', color: 'var(--text-primary)', borderColor: 'var(--glass-border-hover)' }}
                                                            onClick={() => toggleRow(ord.id)}
                                                        >
                                                            <i className={`fa-solid ${isExpanded ? 'fa-eye-slash' : 'fa-eye'}`} style={{ marginLeft: '4px' }}></i>
                                                            {isExpanded ? 'إخفاء' : 'عرض'}
                                                        </button>
                                                        <button 
                                                            className="btn"
                                                            disabled={!citySelected || !districtSelected}
                                                            style={{ 
                                                                padding: '4px 12px', 
                                                                fontSize: '11px', 
                                                                background: (!citySelected || !districtSelected) ? '#3e4e45' : '#2ecc71', 
                                                                color: (!citySelected || !districtSelected) ? '#a0a0a0' : 'white', 
                                                                border: 'none', 
                                                                borderRadius: '4px', 
                                                                fontWeight: 'bold', 
                                                                cursor: (!citySelected || !districtSelected) ? 'not-allowed' : 'pointer' 
                                                            }}
                                                            onClick={(e) => handleApprove(e, ord.id)}
                                                        >
                                                            <i className="fa-solid fa-circle-check" style={{ marginLeft: '4px' }}></i>
                                                            موافقة
                                                        </button>
                                                        <button 
                                                            className="btn"
                                                            style={{ padding: '4px 12px', fontSize: '11px', background: '#e74c3c', color: 'white', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}
                                                            onClick={(e) => handleCancel(e, ord.id)}
                                                        >
                                                            <i className="fa-solid fa-circle-xmark" style={{ marginLeft: '4px' }}></i>
                                                            رفض
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>

                                            {/* Expandable detailed drawer */}
                                            {isExpanded && (
                                                <tr style={{ background: 'var(--glass-bg)' }}>
                                                    <td colSpan="8" style={{ padding: '20px', borderBottom: '1px solid var(--glass-border)' }}>
                                                        
                                                        {/* Step 1 & 2 layout: Address mapping & Details cards */}
                                                        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                                                            
                                                            {/* Bosta Address Matching Card */}
                                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '2px solid rgba(150,191,72,0.15)', borderRadius: '8px' }}>
                                                                <h4 style={{ fontSize: '13px', color: '#96bf48', marginBottom: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                    <i className="fa-solid fa-map-location-dot"></i>
                                                                    <span>ربط العنوان بوليصة شحن بوسطة</span>
                                                                </h4>
                                                                
                                                                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                                                                    
                                                                    {/* Shopify Address Preview */}
                                                                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '10px', borderRadius: '6px', border: '1px dashed var(--glass-border)' }}>
                                                                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>العنوان والمحافظة من شوبيفاي:</span>
                                                                        <strong style={{ fontSize: '12px', color: 'var(--text-primary)' }}>{ord.governorate} - {detailAddress}</strong>
                                                                    </div>

                                                                    {/* Governorate Search Dropdown */}
                                                                    <div style={{ position: 'relative' }}>
                                                                        <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>محافظة بوسطة (Bosta Governorate)*</label>
                                                                        <div 
                                                                            onClick={() => {
                                                                                setActiveCityDropdown(activeCityDropdown === ord.id ? null : ord.id);
                                                                                setActiveDistrictDropdown(null);
                                                                            }}
                                                                            style={{
                                                                                background: 'var(--glass-bg)',
                                                                                color: citySelected ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                                border: '1px solid var(--glass-border)',
                                                                                padding: '10px 12px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '12.5px',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center',
                                                                                cursor: 'pointer'
                                                                            }}
                                                                        >
                                                                            <span>{citySelected ? `${citySelected.cityOtherName} (${citySelected.cityName})` : 'اختر المحافظة...'}</span>
                                                                            <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
                                                                        </div>

                                                                        {activeCityDropdown === ord.id && (
                                                                            <div className="glass-card" style={{
                                                                                position: 'absolute',
                                                                                top: '100%',
                                                                                right: 0,
                                                                                left: 0,
                                                                                background: 'var(--bg-secondary)',
                                                                                border: '1px solid var(--glass-border)',
                                                                                borderRadius: '6px',
                                                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                                                zIndex: 200,
                                                                                padding: '6px',
                                                                                marginTop: '4px'
                                                                            }}>
                                                                                <input 
                                                                                    type="text"
                                                                                    placeholder="ابحث عن المحافظة..."
                                                                                    value={citySearch[ord.id] || ''}
                                                                                    onChange={(e) => setCitySearch({ ...citySearch, [ord.id]: e.target.value })}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '6px 10px', borderRadius: '4px', color: 'white', fontSize: '12px', marginBottom: '6px' }}
                                                                                />
                                                                                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                                                                    {filteredCities.map(city => (
                                                                                        <div 
                                                                                            key={city.cityId}
                                                                                            onClick={() => {
                                                                                                setSelectedCities({ ...selectedCities, [ord.id]: city });
                                                                                                setSelectedDistricts({ ...selectedDistricts, [ord.id]: null }); // reset district on city change
                                                                                                setCitySearch({ ...citySearch, [ord.id]: '' });
                                                                                                setActiveCityDropdown(null);
                                                                                            }}
                                                                                            style={{ padding: '8px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: citySelected?.cityId === city.cityId ? 'rgba(150,191,72,0.15)' : 'transparent' }}
                                                                                            className="autocomplete-option"
                                                                                        >
                                                                                            {city.cityOtherName} ({city.cityName})
                                                                                        </div>
                                                                                    ))}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* District/Area Search Dropdown */}
                                                                    <div style={{ position: 'relative' }}>
                                                                        <label style={{ fontSize: '11.5px', color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>المنطقة / الحي (Bosta Area)*</label>
                                                                        <div 
                                                                            onClick={() => {
                                                                                if (!citySelected) return;
                                                                                setActiveDistrictDropdown(activeDistrictDropdown === ord.id ? null : ord.id);
                                                                                setActiveCityDropdown(null);
                                                                            }}
                                                                            style={{
                                                                                background: citySelected ? 'var(--glass-bg)' : '#26262b',
                                                                                color: districtSelected ? 'var(--text-primary)' : 'var(--text-muted)',
                                                                                border: '1px solid var(--glass-border)',
                                                                                padding: '10px 12px',
                                                                                borderRadius: '6px',
                                                                                fontSize: '12.5px',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center',
                                                                                cursor: citySelected ? 'pointer' : 'not-allowed',
                                                                                opacity: citySelected ? 1 : 0.5
                                                                            }}
                                                                        >
                                                                            <span>{districtSelected ? `${districtSelected.districtOtherName} (${districtSelected.districtName})` : 'اختر المنطقة...'}</span>
                                                                            <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
                                                                        </div>

                                                                        {activeDistrictDropdown === ord.id && citySelected && (
                                                                            <div className="glass-card" style={{
                                                                                position: 'absolute',
                                                                                top: '100%',
                                                                                right: 0,
                                                                                left: 0,
                                                                                background: 'var(--bg-secondary)',
                                                                                border: '1px solid var(--glass-border)',
                                                                                borderRadius: '6px',
                                                                                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                                                                zIndex: 200,
                                                                                padding: '6px',
                                                                                marginTop: '4px'
                                                                            }}>
                                                                                <input 
                                                                                    type="text"
                                                                                    placeholder="ابحث عن المنطقة..."
                                                                                    value={districtSearch[ord.id] || ''}
                                                                                    onChange={(e) => setDistrictSearch({ ...districtSearch, [ord.id]: e.target.value })}
                                                                                    onClick={(e) => e.stopPropagation()}
                                                                                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', padding: '6px 10px', borderRadius: '4px', color: 'white', fontSize: '12px', marginBottom: '6px' }}
                                                                                />
                                                                                <div style={{ maxHeight: '180px', overflowY: 'auto' }}>
                                                                                    {filteredDistricts.length === 0 ? (
                                                                                        <div style={{ padding: '8px 10px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center' }}>لا توجد مناطق مطابقة أو قابلة للتوصيل.</div>
                                                                                    ) : (
                                                                                        filteredDistricts.map(dist => (
                                                                                            <div 
                                                                                                key={dist.districtId}
                                                                                                onClick={() => {
                                                                                                    setSelectedDistricts({ ...selectedDistricts, [ord.id]: dist });
                                                                                                    setDistrictSearch({ ...districtSearch, [ord.id]: '' });
                                                                                                    setActiveDistrictDropdown(null);
                                                                                                }}
                                                                                                style={{ padding: '8px 10px', fontSize: '12px', cursor: 'pointer', borderRadius: '4px', background: districtSelected?.districtId === dist.districtId ? 'rgba(150,191,72,0.15)' : 'transparent' }}
                                                                                                className="autocomplete-option"
                                                                                            >
                                                                                                {dist.districtOtherName} ({dist.districtName})
                                                                                            </div>
                                                                                        ))
                                                                                    )}
                                                                                </div>
                                                                            </div>
                                                                        )}
                                                                    </div>

                                                                    {/* Allow to Open Package checkbox */}
                                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '12px', background: 'rgba(255,255,255,0.02)', padding: '8px 10px', borderRadius: '6px', border: '1px solid var(--glass-border)' }}>
                                                                        <input 
                                                                            type="checkbox" 
                                                                            id={`allow-open-${ord.id}`}
                                                                            checked={allowToOpenMap[ord.id] !== undefined ? allowToOpenMap[ord.id] : false}
                                                                            onChange={(e) => {
                                                                                setAllowToOpenMap({
                                                                                    ...allowToOpenMap,
                                                                                    [ord.id]: e.target.checked
                                                                                });
                                                                            }}
                                                                            style={{
                                                                                accentColor: '#96bf48',
                                                                                cursor: 'pointer',
                                                                                width: '15px',
                                                                                height: '15px',
                                                                                margin: 0
                                                                            }}
                                                                        />
                                                                        <label 
                                                                            htmlFor={`allow-open-${ord.id}`}
                                                                            style={{ fontSize: '11px', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 500, userSelect: 'none' }}
                                                                        >
                                                                            السماح للعميل بفتح الشحنة عند الاستلام
                                                                        </label>
                                                                    </div>

                                                                </div>
                                                            </div>

                                                            {/* Products list */}
                                                            <div className="glass-card" style={{ padding: '16px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                <h4 style={{ fontSize: '13px', color: '#96bf48', marginBottom: '12px', fontWeight: 600 }}>
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

                                                            {/* Customer Details & Pricing */}
                                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                                                                {/* Customer Details */}
                                                                <div className="glass-card" style={{ padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
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
                                                                        <div><strong>رقم الهاتف:</strong> {phone || 'غير مسجل'}</div>
                                                                        <div><strong>البريد الإلكتروني:</strong> {customerEmail || 'غير مسجل'}</div>
                                                                        <div><strong>طريقة الدفع شوبيفاي:</strong> {ord.paymentMethod || 'COD'}</div>
                                                                    </div>
                                                                </div>

                                                                {/* Pricing Card */}
                                                                <div className="glass-card" style={{ padding: '14px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}>
                                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '11.5px' }}>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>إجمالي المنتجات:</span>
                                                                            <span>{currency} {(ord.totalValue - (ord.shipping_fee || 0)).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                                            <span>مصاريف الشحن شوبيفاي:</span>
                                                                            <span>+{currency} {(ord.shipping_fee || 0).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                        </div>
                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', color: '#2ecc71', fontWeight: 500 }}>
                                                                            <span>العربون (Deposit):</span>
                                                                            <span>-{currency} {(customDeposits[ord.id] !== undefined ? (parseFloat(customDeposits[ord.id]) || 0) : (ord.deposit || 0)).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                        </div>
                                                                        
                                                                        {/* Editable Deposit Input */}
                                                                        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', borderTop: '1px solid var(--glass-border)', paddingTop: '8px', marginTop: '4px' }}>
                                                                            <label style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>تعديل العربون المدفوع (Deposit):</label>
                                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                                                <input 
                                                                                    type="number"
                                                                                    min="0"
                                                                                    max={ord.totalValue}
                                                                                    value={customDeposits[ord.id] !== undefined ? customDeposits[ord.id] : (ord.deposit || 0)}
                                                                                    onChange={(e) => {
                                                                                        const val = e.target.value;
                                                                                        setCustomDeposits({ ...customDeposits, [ord.id]: val });
                                                                                    }}
                                                                                    style={{
                                                                                        background: 'rgba(0,0,0,0.2)',
                                                                                        border: '1px solid var(--glass-border)',
                                                                                        color: 'var(--text-primary)',
                                                                                        borderRadius: '4px',
                                                                                        padding: '4px 8px',
                                                                                        width: '100px',
                                                                                        fontSize: '12px'
                                                                                    }}
                                                                                />
                                                                                <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{currency}</span>
                                                                            </div>
                                                                        </div>

                                                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', color: 'var(--gold-primary)', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '6px', marginTop: '4px' }}>
                                                                            <span>المتبقي للتحصيل:</span>
                                                                            <span>{currency} {Math.max(0, ord.totalValue - (customDeposits[ord.id] !== undefined ? (parseFloat(customDeposits[ord.id]) || 0) : (ord.deposit || 0))).toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                        </div>

                                                        {/* Bottom Approval Section */}
                                                        <div style={{
                                                            background: 'linear-gradient(135deg, rgba(150,191,72,0.04), rgba(46,204,113,0.06))',
                                                            border: '1px solid rgba(150,191,72,0.2)',
                                                            borderRadius: '8px',
                                                            padding: '16px 20px',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            gap: '16px',
                                                            flexWrap: 'wrap'
                                                        }}>
                                                            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                                                <i className="fa-solid fa-circle-info" style={{ color: 'var(--gold-primary)', fontSize: '18px' }}></i>
                                                                <span style={{ fontSize: '12.5px', color: 'var(--text-primary)', fontWeight: 500 }}>
                                                                    الموافقة ستسجل الطلب كـ Completed وتخصم المخزون وتحفظ أكواد بوسطة المحددة للطلب.
                                                                </span>
                                                            </div>
                                                            <div style={{ display: 'flex', gap: '10px' }}>
                                                                <button
                                                                    disabled={!citySelected || !districtSelected}
                                                                    onClick={(e) => handleApprove(e, ord.id)}
                                                                    className="btn"
                                                                    style={{ 
                                                                        background: (!citySelected || !districtSelected) ? '#3e4e45' : '#2ecc71', 
                                                                        color: (!citySelected || !districtSelected) ? '#a0a0a0' : 'white', 
                                                                        border: 'none', 
                                                                        padding: '8px 18px', 
                                                                        borderRadius: '6px', 
                                                                        fontWeight: 'bold', 
                                                                        fontSize: '12px', 
                                                                        cursor: (!citySelected || !districtSelected) ? 'not-allowed' : 'pointer', 
                                                                        display: 'flex', 
                                                                        alignItems: 'center', 
                                                                        gap: '6px' 
                                                                    }}
                                                                >
                                                                    <i className="fa-solid fa-circle-check"></i>
                                                                    موافقة وتأكيد الأوردر
                                                                </button>
                                                                <button
                                                                    onClick={(e) => handleCancel(e, ord.id)}
                                                                    className="btn"
                                                                    style={{ background: '#e74c3c', color: 'white', border: 'none', padding: '8px 18px', borderRadius: '6px', fontWeight: 'bold', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}
                                                                >
                                                                    <i className="fa-solid fa-circle-xmark"></i>
                                                                    رفض وإلغاء الأوردر
                                                                </button>
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

                {/* Pagination footer */}
                {totalPages > 1 && (
                    <div className="table-pagination" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', borderTop: '1px solid var(--glass-border-hover)' }}>
                        <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            عرض {startIdx + 1} - {endIdx} من أصل {totalEntries} أوردر معلق
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                            <button 
                                className="btn btn-secondary" 
                                disabled={activePage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                                السابق
                            </button>
                            <button 
                                className="btn btn-secondary" 
                                disabled={activePage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                                style={{ padding: '4px 10px', fontSize: '12px' }}
                            >
                                التالي
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
