import React, { useContext, useState, useEffect } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export const shippingFees = {
  "القاهرة": 55,
  "الجيزة": 55,
  "الإسكندرية": 65,
  "القليوبية": 60,
  "الشرقية": 70,
  "الدقهلية": 70,
  "البحيرة": 75,
  "الغربية": 70,
  "المنوفية": 70,
  "كفر الشيخ": 75,
  "دمياط": 75,
  "بورسعيد": 75,
  "الإسماعيلية": 75,
  "السويس": 75,
  "شمال سيناء": 95,
  "جنوب سيناء": 110,
  "بني سويف": 85,
  "الفيوم": 85,
  "المنيا": 90,
  "أسيوط": 95,
  "سوهاج": 100,
  "قنا": 105,
  "الأقصر": 110,
  "أسوان": 115,
  "البحر الأحمر": 115,
  "الوادي الجديد": 130,
  "مطروح": 120,
};

export default function RecordOrderModal({ isOpen, onClose, editOrderId }) {
    const { state, addOrder, editOrder, showToast, t, validateCoupon, getOrCreateCustomer } = useContext(AppContext);
    
    // Order info
    const [orderId, setOrderId] = useState('');
    const [status, setStatus] = useState('Draft'); // 'Draft', 'Pending', 'Completed'
    const [step, setStep] = useState(1); // 1: بيانات العميل, 2: المنتجات, 3: الشحن والدفع, 4: مراجعة
    
    // Customer Section
    const [client, setClient] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponValid, setCouponValid] = useState(false);
    const [couponDiscountValue, setCouponDiscountValue] = useState(0);
    const [couponDiscountType, setCouponDiscountType] = useState('');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [phone, setPhone] = useState('');
    const [governorate, setGovernorate] = useState('');
    const [address, setAddress] = useState('');
    
    // Products Table
    const [items, setItems] = useState([
        { variantSku: '', quantity: 1, price: 0, discountPercent: 0, maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }
    ]);
    
    // Financial Summaries
    const [orderDiscountPercent, setOrderDiscountPercent] = useState('');
    const [shippingFee, setShippingFee] = useState('');
    const [vatEnabled, setVatEnabled] = useState(false);
    const [deposit, setDeposit] = useState('');
    
    const currency = state.storeSettings.currency || '$';
    
    // Helper to parse address JSON structure safely
    const parseAddressData = (addressStr) => {
        let detailAddress = addressStr || '';
        let phone = '';
        let vatEnabled = false;
        let orderDiscountPercent = 0;
        let customerCode = 'CUS-0000';
        let appliedCoupon = '';
        
        if (addressStr && addressStr.startsWith('{')) {
            try {
                const parsed = JSON.parse(addressStr);
                detailAddress = parsed.detailAddress || '';
                phone = parsed.phone || '';
                vatEnabled = parsed.vatEnabled || false;
                orderDiscountPercent = parseFloat(parsed.orderDiscountPercent) || 0;
                customerCode = parsed.customerCode || 'CUS-0000';
                appliedCoupon = parsed.appliedCoupon || '';
            } catch(e) {}
        }
        return { detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode, appliedCoupon };
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

    const customerCode = getCustomerCode(client);

    // Load active unique customers list for searchable dropdown
    const existingCustomers = state.customers ? state.customers.map(c => c.name) : Array.from(new Set((state.orders || []).map(o => o.client))).filter(Boolean);
    const filteredCustomers = existingCustomers.filter(c => c.toLowerCase().includes(client.toLowerCase()));

    // Reset and initialize form on open
    useEffect(() => {
        if (isOpen) {
            if (editOrderId) {
                // LOAD EXISTING ORDER DETAILS
                const order = state.orders.find(o => o.id === editOrderId);
                if (order) {
                    setOrderId(order.id);
                    setStatus(order.status);
                    setStep(1);
                    setClient(order.client);
                    setIsClientDropdownOpen(false);
                    
                    const parsed = parseAddressData(order.address);
                    setPhone(parsed.phone);
                    setAddress(parsed.detailAddress || order.address);
                    setVatEnabled(parsed.vatEnabled);
                    setOrderDiscountPercent(parsed.orderDiscountPercent || '');
                    setCouponCode(parsed.appliedCoupon || '');
                    setCustomerId(order.customer_id || null);
                    
                    setGovernorate(order.governorate || '');
                    setShippingFee(order.shipping_fee || '');
                    setDeposit(order.deposit || '');
                    
                    // Map items
                    const mappedItems = order.items.map(oi => {
                        let retailPrice = oi.price;
                        let maxStock = oi.quantity;
                        let productName = oi.variantSku;
                        let variantName = '';
                        state.products.forEach(p => {
                            const v = p.variants.find(vr => vr.sku === oi.variantSku);
                            if (v) {
                                retailPrice = v.retailPrice;
                                maxStock = (v.stock?.['Sulur'] || 0) + oi.quantity; // add existing qty back to editing stock limits
                                productName = p.name;
                                variantName = v.name;
                            }
                        });
                        
                        let itemDiscount = 0;
                        if (retailPrice > 0) {
                            itemDiscount = Math.round(100 * (1 - oi.price / retailPrice));
                            if (itemDiscount < 0 || itemDiscount > 100) itemDiscount = 0;
                        }
                        
                        return {
                            variantSku: oi.variantSku,
                            quantity: oi.quantity,
                            price: retailPrice,
                            discountPercent: itemDiscount,
                            maxStock: maxStock,
                            searchVal: variantName ? `${productName} | ${variantName}` : oi.variantSku,
                            isOpen: false,
                            productName: productName,
                            variantName: variantName
                        };
                    });
                    setItems(mappedItems);
                }
            } else {
                // RESET TO NEW ORDER INITIAL VALUES
                const rand = Math.floor(1000 + Math.random() * 9000);
                setOrderId(`ORD-2026-${rand}`);
                setStatus('Draft');
                setStep(1);
                setClient('');
                setIsClientDropdownOpen(false);
                setPhone('');
                setGovernorate('');
                setAddress('');
                setItems([{ variantSku: '', quantity: 1, price: 0, discountPercent: 0, maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }]);
                setOrderDiscountPercent('');
                setShippingFee('');
                setVatEnabled(false);
                setDeposit('');
                setCustomerId(null);
                setCouponCode('');
                setCouponValid(false);
                setCouponDiscountValue(0);
                setCouponDiscountType('');
            }
        }
    }, [isOpen, editOrderId]);

    // Helper to find stock for a SKU in the default warehouse 'Sulur'
    const getStockQty = (sku) => {
        let stock = 0;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) stock = v.stock?.['Sulur'] || 0;
        });
        return stock;
    };

    // Client Selection Auto-fill Details
    const handleSelectCustomer = (name) => {
        setClient(name);
        setIsClientDropdownOpen(false);
        const cust = state.customers?.find(c => c.name === name);
        if (cust) {
            setCustomerId(cust.id);
            setPhone(cust.phone || '');
            setGovernorate(cust.governorate || '');
            setAddress(cust.address || '');
        } else {
            setCustomerId(null);
        }
        const lastOrder = (state.orders || []).find(o => o.client === name);
        if (lastOrder) {
            if (lastOrder.address && lastOrder.address.startsWith('{')) {
                try {
                    const parsed = JSON.parse(lastOrder.address);
                    setPhone(parsed.phone || '');
                    setAddress(parsed.detailAddress || lastOrder.address);
                    setVatEnabled(parsed.vatEnabled || false);
                    setOrderDiscountPercent(parsed.orderDiscountPercent || 0);
                } catch (e) {
                    setAddress(lastOrder.address);
                }
            } else {
                setAddress(lastOrder.address || '');
            }
            setGovernorate(lastOrder.governorate || '');
            setShippingFee(lastOrder.shipping_fee || 0);
            showToast("تم ملء بيانات العميل تلقائياً من طلباته السابقة", "success");
        }
    };

    // Products table actions
    const handleAddItem = () => {
        setItems(prev => [...prev, { variantSku: '', quantity: 1, price: 0, discountPercent: 0, maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const setItemOpen = (index, val) => {
        setItems(prev => prev.map((item, i) => i === index ? { ...item, isOpen: val } : item));
    };

    const handleItemSearchChange = (index, text) => {
        setItems(prev => prev.map((item, i) => i === index ? {
            ...item,
            searchVal: text,
            isOpen: true
        } : item));
    };

    const handleSelectOption = (index, variant) => {
        setItems(prev => prev.map((item, i) => i === index ? {
            ...item,
            variantSku: variant.sku,
            price: variant.retailPrice,
            maxStock: variant.stock,
            productName: variant.productName,
            variantName: variant.name,
            searchVal: `${variant.productName} | ${variant.name}`,
            isOpen: false
        } : item));
    };

    const handleQtyChange = (index, val) => {
        const qty = parseInt(val) || 1;
        const maxStock = items[index].maxStock || 1;
        
        if (qty > maxStock) {
            showToast(`الكمية المدخلة تتجاوز المخزون المتاح (${maxStock} وحدة)`, "warning");
            setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: maxStock } : item));
        } else if (qty < 1) {
            setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: 1 } : item));
        } else {
            setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: qty } : item));
        }
    };

    const handleDiscountChange = (index, val) => {
        let disc = parseFloat(val) || 0;
        if (disc < 0) disc = 0;
        if (disc > 100) disc = 100;
        setItems(prev => prev.map((item, i) => i === index ? { ...item, discountPercent: disc } : item));
    };

    const handleGovernorateChange = (gov) => {
        setGovernorate(gov);
        const fee = shippingFees[gov] || 0;
        setShippingFee(fee);
    };

    // Financial Math calculations (parsed for string safety)
    const orderDiscountPercentVal = parseFloat(orderDiscountPercent) || 0;
    const shippingFeeVal = parseFloat(shippingFee) || 0;
    const depositVal = parseFloat(deposit) || 0;

    const totalProductsSubtotal = items.reduce((sum, item) => {
        const sub = item.quantity * item.price * (1 - (item.discountPercent || 0) / 100);
        return sum + (item.variantSku ? sub : 0);
    }, 0);

    let couponDisc = 0;
    if (couponValid) {
        if (couponDiscountType === 'Percentage') {
            couponDisc = totalProductsSubtotal * (couponDiscountValue / 100);
        } else {
            couponDisc = couponDiscountValue;
        }
    }
    const orderDiscountAmount = (totalProductsSubtotal * (orderDiscountPercentVal / 100)) + couponDisc;
    const discountedProductsTotal = totalProductsSubtotal - orderDiscountAmount;
    
    const vatAmount = vatEnabled ? (discountedProductsTotal * 0.14) : 0;
    const finalOrderTotal = discountedProductsTotal + vatAmount + shippingFeeVal;
    const remainingToCollect = finalOrderTotal - depositVal;

    // Get top 5 selling products based on orders
    const getPopularProducts = () => {
        const salesCounts = {};
        (state.orders || []).forEach(o => {
            (o.items || []).forEach(item => {
                salesCounts[item.variantSku] = (salesCounts[item.variantSku] || 0) + item.quantity;
            });
        });
        
        const allVariants = [];
        (state.products || []).forEach(p => {
            (p.variants || []).forEach(v => {
                const stock = v.stock?.['Sulur'] || 0;
                allVariants.push({
                    sku: v.sku,
                    name: v.name,
                    productName: p.name,
                    retailPrice: v.retailPrice,
                    stock,
                    salesCount: salesCounts[v.sku] || 0
                });
            });
        });
        
        return allVariants.sort((a, b) => b.salesCount - a.salesCount).slice(0, 5);
    };

    // Filter variants based on row search value
    const getRowOptions = (item) => {
        const query = (item.searchVal || '').trim().toLowerCase();
        
        if (!query) {
            // Show top 5 popular products first when empty
            return getPopularProducts();
        }

        // Map all variants in stock
        const allVariants = [];
        (state.products || []).forEach(p => {
            (p.variants || []).forEach(v => {
                const stock = v.stock?.['Sulur'] || 0;
                allVariants.push({
                    sku: v.sku,
                    name: v.name,
                    productName: p.name,
                    retailPrice: v.retailPrice,
                    stock
                });
            });
        });

        // Filter based on query
        return allVariants.filter(v => 
            v.productName.toLowerCase().includes(query) || 
            v.name.toLowerCase().includes(query)
        );
    };

    // Validations
    const isStep1Valid = client.trim() !== '' && phone.trim().length === 11 && governorate !== '' && address.trim() !== '';
    const isStep2Valid = items.length > 0 && items.every(item => item.variantSku !== '' && item.quantity > 0);
    const isStep3Valid = shippingFeeVal >= 0 && orderDiscountPercentVal >= 0 && orderDiscountPercentVal <= 100 && depositVal >= 0;
    
    const canConfirm = isStep1Valid && isStep2Valid && isStep3Valid;

    // Handle Submit
    const handleSaveOrder = async (isDraftSave) => {
        if (!client.trim()) {
            showToast("يرجى إدخال اسم العميل", "error");
            setStep(1);
            return;
        }
        if (!phone.trim() || phone.trim().length !== 11) {
            showToast("يرجى إدخال رقم هاتف عميل مكون من 11 رقماً", "error");
            setStep(1);
            return;
        }
        if (governorate === '') {
            showToast("يرجى اختيار المحافظة لشحن الطلب", "error");
            setStep(1);
            return;
        }
        if (!address.trim()) {
            showToast("يرجى إدخال العنوان التفصيلي للشحن", "error");
            setStep(1);
            return;
        }
        if (!isStep2Valid) {
            showToast("يرجى إدخال أصناف وكميات صالحة في سلة المنتجات", "error");
            setStep(2);
            return;
        }

        const orderItems = items.map(item => ({
            variantSku: item.variantSku,
            quantity: item.quantity,
            price: item.price * (1 - (item.discountPercent || 0) / 100)
        }));

        const finalStatus = isDraftSave ? 'Draft' : 'Completed'; // Draft = مسودة, Completed = مؤكد/مكتمل

        
        // Ensure we have a valid customer_id in DB
        let finalCustomerId = customerId;
        if (!finalCustomerId) {
            finalCustomerId = await getOrCreateCustomer(phone, client, governorate);
            setCustomerId(finalCustomerId); // update local state as well
        }

        const newOrderObj = {
            id: orderId,
            client: client,
            date: getLocalDateString(),
            items: orderItems,
            totalValue: finalOrderTotal,
            customer_id: finalCustomerId,
            discount_type: couponValid ? couponDiscountType : null,
            discount_value: couponValid ? couponDiscountValue : 0,
            applied_coupon_code: couponValid ? couponCode : null,
            warehouse: 'Sulur',
            status: finalStatus,
            address: JSON.stringify({
                detailAddress: address,
                phone: phone,
                vatEnabled: vatEnabled,
                orderDiscountPercent: orderDiscountPercentVal,
                customerCode: customerCode,
                appliedCoupon: couponValid ? couponCode : ''
            }),
            governorate: governorate,
            deposit: depositVal,
            shipping_fee: shippingFeeVal,
            createdBy: state.currentUser ? state.currentUser.name : 'sfsf'
        };

        if (editOrderId) {
            editOrder(newOrderObj);
            showToast(isDraftSave ? "تم تحديث مسودة الطلب بنجاح" : "تم تعديل وتأكيد الطلب بنجاح", "success");
        } else {
            addOrder(newOrderObj);
            showToast(isDraftSave ? "تم حفظ الطلب كمسودة بنجاح" : "تم تأكيد طلب المبيعات بنجاح", "success");
        }
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={editOrderId ? `تعديل طلب مبيعات: ${orderId}` : "تسجيل طلب مبيعات جديد"} width="1150px">
            <div dir="rtl" style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', padding: '10px 4px', borderRadius: '8px' }}>
                
                {/* 1. ORDER HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--glass-border)' }}>
                    <div>
                        <span style={{ fontSize: '13px', color: 'var(--text-secondary)', marginLeft: '8px' }}>رقم الطلب (تلقائي):</span>
                        <strong style={{ fontSize: '16px', color: 'var(--gold-primary)', letterSpacing: '0.5px' }}>{orderId}</strong>
                    </div>
                    <div>
                        <span className={`status-badge ${status === 'Draft' ? 'draft' : 'completed'}`} style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                            {status === 'Draft' ? 'مسودة' : 'مؤكد'}
                        </span>
                    </div>
                </div>

                {/* 4-STEP STEPPER */}
                <div className="stepper-container" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '30px', position: 'relative', padding: '0 40px' }}>
                    <div style={{ position: 'absolute', top: '15px', left: '60px', right: '60px', height: '2px', background: 'var(--glass-border-hover)', zIndex: 1 }} />
                    <div style={{ position: 'absolute', top: '15px', right: '60px', width: `${((step - 1) / 3) * 100}%`, height: '2px', background: 'var(--gold-primary)', zIndex: 2, transition: 'width 0.3s ease' }} />
                    {[
                        { stepNum: 1, label: 'بيانات العميل' },
                        { stepNum: 2, label: 'المنتجات' },
                        { stepNum: 3, label: 'الشحن والدفع' },
                        { stepNum: 4, label: 'مراجعة وتأكيد' }
                    ].map((s) => (
                        <div key={s.stepNum} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 3, cursor: 'pointer' }} onClick={() => {
                            setStep(s.stepNum);
                        }}>
                            <div style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '50%',
                                background: step === s.stepNum ? 'var(--gold-primary)' : (step > s.stepNum ? '#27AE60' : '#26262b'),
                                color: step === s.stepNum ? '#000' : '#fff',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                border: '2px solid',
                                borderColor: step === s.stepNum ? 'var(--gold-primary)' : (step > s.stepNum ? '#27AE60' : 'var(--glass-border-hover)'),
                                transition: 'all 0.3s ease'
                            }}>
                                {step > s.stepNum ? <i className="fa-solid fa-check" style={{ fontSize: '11px' }}></i> : s.stepNum}
                            </div>
                            <span style={{ fontSize: '12px', marginTop: '6px', color: step === s.stepNum ? 'var(--gold-primary)' : 'rgba(255,255,255,0.5)', fontWeight: step === s.stepNum ? 'bold' : 'normal' }}>
                                {s.label}
                            </span>
                        </div>
                    ))}
                </div>

                {/* STEP PANELS CONTAINER */}
                <div style={{ minHeight: '460px', padding: '10px 0' }}>
                    
                    {/* STEP 1: CUSTOMER SECTION */}
                    {step === 1 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group" style={{ position: 'relative' }}>
                                    <label className="form-label">اسم العميل *</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={client}
                                        onChange={(e) => { setClient(e.target.value); setIsClientDropdownOpen(true); }}
                                        onFocus={() => setIsClientDropdownOpen(true)}
                                        onBlur={() => setTimeout(() => setIsClientDropdownOpen(false), 200)}
                                        placeholder="اكتب اسم العميل للبحث أو الإضافة..." 
                                        required 
                                    />
                                    {isClientDropdownOpen && filteredCustomers.length > 0 && (
                                        <div className="glass-card" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            maxHeight: '150px',
                                            overflowY: 'auto',
                                            zIndex: 1000,
                                            background: 'rgba(30, 30, 40, 0.99)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '4px'
                                        }}>
                                            {filteredCustomers.map(custName => (
                                                <div 
                                                    key={custName}
                                                    onMouseDown={() => handleSelectCustomer(custName)}
                                                    style={{ padding: '8px 12px', fontSize: '12px', cursor: 'pointer', borderBottom: '1px solid var(--glass-bg-hover)', color: 'var(--text-primary)', borderRadius: '4px' }}
                                                    className="autocomplete-option"
                                                >
                                                    {custName}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">كود العميل (تلقائي)</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={customerCode} 
                                        disabled 
                                        style={{ background: 'var(--glass-bg-hover)', color: 'var(--text-secondary)', cursor: 'not-allowed' }}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">رقم الهاتف * (11 رقم)</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={phone}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            if (digits.length <= 11) {
                                                setPhone(digits);
                                            }
                                        }}
                                        placeholder="مثال: 01012345678" 
                                        maxLength={11}
                                        required 
                                    />
                                    {phone && phone.length < 11 && (
                                        <div style={{ fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px' }}>
                                            يجب إدخال 11 رقماً (المتبقي: {11 - phone.length})
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">المحافظة (الشحن) *</label>
                                    <select 
                                        className="form-select" 
                                        value={governorate}
                                        onChange={(e) => handleGovernorateChange(e.target.value)}
                                        required
                                    >
                                        <option value="">اختر المحافظة...</option>
                                        {Object.keys(shippingFees).map(gov => (
                                            <option key={gov} value={gov}>{gov} ({currency}{shippingFees[gov]})</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="form-group">
                                <label className="form-label">العنوان التفصيلي *</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={address}
                                    onChange={(e) => setAddress(e.target.value)}
                                    placeholder="اسم الشارع / رقم العقار / علامة مميزة"
                                    required 
                                />
                            </div>
                        </div>
                    )}

                    {/* STEP 2: PRODUCTS TABLE */}
                    {step === 2 && (
                        <div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                <h4 style={{ fontSize: '15px', color: 'var(--gold-primary)' }}>قائمة المنتجات المطلوبة</h4>
                                <button type="button" className="btn btn-secondary" style={{ padding: '6px 14px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }} onClick={handleAddItem}>
                                    <i className="fa-solid fa-plus"></i> إضافة منتج
                                </button>
                            </div>
                            <div style={{ overflow: 'visible' }}>
                                <table className="summary-table" style={{ width: '100%', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border-hover)' }}>
                                            <th style={{ width: '38%', textAlign: 'right', padding: '10px' }}>المنتج / SKU</th>
                                            <th style={{ width: '15%', textAlign: 'center', padding: '10px' }}>الكمية</th>
                                            <th style={{ width: '15%', textAlign: 'center', padding: '10px' }}>سعر الوحدة</th>
                                            <th style={{ width: '10%', textAlign: 'center', padding: '10px' }}>خصم %</th>
                                            <th style={{ width: '14%', textAlign: 'center', padding: '10px' }}>الإجمالي</th>
                                            <th style={{ width: '8%', textAlign: 'center', padding: '10px' }}>حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const subtotal = item.quantity * item.price * (1 - (item.discountPercent || 0) / 100);
                                            const rowOptions = getRowOptions(item);
                                            return (
                                                <tr key={`order-item-${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', position: 'relative' }}>
                                                        <input 
                                                            type="text"
                                                            className="form-input"
                                                            placeholder="ابحث عن منتج..."
                                                            value={item.searchVal || ''}
                                                            onChange={(e) => handleItemSearchChange(idx, e.target.value)}
                                                            onFocus={() => setItemOpen(idx, true)}
                                                            onBlur={() => setTimeout(() => setItemOpen(idx, false), 250)}
                                                            required
                                                            style={{ background: 'var(--glass-bg)', borderColor: item.variantSku ? 'var(--color-success)' : 'var(--glass-border)' }}
                                                        />
                                                        {item.maxStock > 0 && (
                                                            <div style={{ fontSize: '10px', color: 'var(--gold-primary)', marginTop: '4px' }}>
                                                                المتاح في المخزن: {item.maxStock} وحدات
                                                            </div>
                                                        )}
                                                        
                                                        {item.isOpen && (
                                                            <div className="glass-card" style={{
                                                                position: 'absolute',
                                                                top: '100%',
                                                                right: 0,
                                                                width: '500px',
                                                                maxHeight: '320px',
                                                                overflowY: 'auto',
                                                                zIndex: 2000,
                                                                background: 'var(--bg-secondary)',
                                                                border: '1px solid var(--glass-border)',
                                                                borderRadius: '10px',
                                                                boxShadow: '0 12px 40px rgba(0,0,0,0.6)',
                                                                padding: '6px'
                                                            }}>
                                                                {/* Popular items header when query is empty */}
                                                                {!(item.searchVal || '').trim() && rowOptions.length > 0 && (
                                                                    <div style={{ padding: '6px 12px', fontSize: '10px', color: 'var(--gold-primary)', fontWeight: 'bold', borderBottom: '1px solid var(--glass-border)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                                        <i className="fa-solid fa-fire" style={{ color: '#E74C3C' }}></i> الأكثر طلباً وشيوعاً
                                                                    </div>
                                                                )}
                                                                {rowOptions.length === 0 ? (
                                                                    <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>لا توجد خيارات مطابقة</div>
                                                                ) : (
                                                                    rowOptions.map(opt => (
                                                                        <div 
                                                                            key={opt.sku}
                                                                            onMouseDown={() => handleSelectOption(idx, opt)}
                                                                            style={{
                                                                                padding: '8px 12px',
                                                                                fontSize: '11px',
                                                                                cursor: 'pointer',
                                                                                borderBottom: '1px solid var(--glass-bg-hover)',
                                                                                display: 'flex',
                                                                                justifyContent: 'space-between',
                                                                                alignItems: 'center',
                                                                                color: 'var(--text-primary)',
                                                                                borderRadius: '4px'
                                                                            }}
                                                                            className="autocomplete-option"
                                                                        >
                                                                            <span>{opt.productName} <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>({opt.name})</span></span>
                                                                            <span style={{ color: 'var(--gold-primary)', fontSize: '10px', fontWeight: 600 }}>الرصيد: {opt.stock}</span>
                                                                        </div>
                                                                    ))
                                                                )}
                                                            </div>
                                                        )}
                                                    </td>
                                                    
                                                    {/* Custom Quantity Stepper */}
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                        <div style={{ 
                                                            display: 'inline-flex', 
                                                            alignItems: 'center', 
                                                            background: 'var(--glass-bg)', 
                                                            border: '1px solid var(--glass-border)', 
                                                            borderRadius: '6px', 
                                                            overflow: 'hidden',
                                                            height: '36px'
                                                        }}>
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleQtyChange(idx, item.quantity - 1)}
                                                                disabled={!item.variantSku || item.quantity <= 1}
                                                                style={{
                                                                    width: '28px',
                                                                    height: '100%',
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    color: 'var(--text-primary)',
                                                                    cursor: (!item.variantSku || item.quantity <= 1) ? 'not-allowed' : 'pointer',
                                                                    opacity: (!item.variantSku || item.quantity <= 1) ? 0.3 : 0.8,
                                                                    fontSize: '10px'
                                                                }}
                                                            >
                                                                <i className="fa-solid fa-minus"></i>
                                                            </button>
                                                            <input 
                                                                type="number"
                                                                min="1"
                                                                max={item.maxStock || 1}
                                                                value={item.quantity}
                                                                onChange={(e) => handleQtyChange(idx, e.target.value)}
                                                                disabled={!item.variantSku}
                                                                style={{
                                                                    width: '34px',
                                                                    height: '100%',
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    color: 'var(--text-primary)',
                                                                    textAlign: 'center',
                                                                    fontSize: '12px',
                                                                    fontWeight: 600,
                                                                    padding: 0
                                                                }}
                                                                className="no-spinners"
                                                            />
                                                            <button 
                                                                type="button" 
                                                                onClick={() => handleQtyChange(idx, item.quantity + 1)}
                                                                disabled={!item.variantSku || item.quantity >= item.maxStock}
                                                                style={{
                                                                    width: '28px',
                                                                    height: '100%',
                                                                    border: 'none',
                                                                    background: 'none',
                                                                    color: 'var(--text-primary)',
                                                                    cursor: (!item.variantSku || item.quantity >= item.maxStock) ? 'not-allowed' : 'pointer',
                                                                    opacity: (!item.variantSku || item.quantity >= item.maxStock) ? 0.3 : 0.8,
                                                                    fontSize: '10px'
                                                                }}
                                                            >
                                                                <i className="fa-solid fa-plus"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                    
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                                                        <input 
                                                            type="text"
                                                            className="form-input"
                                                            value={item.variantSku ? `${currency}${item.price.toFixed(2)}` : ''}
                                                            placeholder={`${currency}0.00`}
                                                            readOnly
                                                            style={{ textAlign: 'center', background: 'var(--glass-bg)', color: 'rgba(255,255,255,0.8)' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                                                        <input 
                                                            type="number"
                                                            className="form-input"
                                                            min="0"
                                                            max="100"
                                                            value={item.discountPercent || 0}
                                                            onChange={(e) => handleDiscountChange(idx, e.target.value)}
                                                            disabled={!item.variantSku}
                                                            style={{ textAlign: 'center' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center', fontWeight: 'bold' }}>
                                                        {item.variantSku ? `${currency}${subtotal.toFixed(2)}` : `${currency}0.00`}
                                                    </td>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center' }}>
                                                        <button 
                                                            type="button"
                                                            className="action-btn-circle"
                                                            style={{ color: 'var(--color-danger)', borderColor: 'rgba(255,71,87,0.15)' }}
                                                            onClick={() => handleRemoveItem(idx)}
                                                        >
                                                            <i className="fa-solid fa-trash"></i>
                                                        </button>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* STEP 3: FINANCIAL DETAILS */}
                    {step === 3 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                <div className="form-group">
                                    <label className="form-label">خصم الأوردر % (خصم إضافي إجمالي)</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="0" 
                                        max="100"
                                        value={orderDiscountPercent}
                                        onChange={(e) => {
                                            let val = parseFloat(e.target.value) || 0;
                                            if (val < 0) val = 0;
                                            if (val > 100) val = 100;
                                            setOrderDiscountPercent(val);
                                        }}
                                        placeholder="0"
                                    />
                                </div>
                                <div className="form-group">
                                    <label className="form-label">كود الخصم (كوبون)</label>
                                    <div style={{ display: 'flex', gap: '8px' }}>
                                        <input 
                                            type="text" 
                                            className="form-input" 
                                            value={couponCode}
                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                                            placeholder="أدخل كود الخصم"
                                        />
                                        <button 
                                            type="button"
                                            className="btn btn-secondary"
                                            onClick={async () => {
                                                if(!couponCode) return;
                                                const res = await validateCoupon(couponCode, totalProductsSubtotal);
                                                if (res.valid) {
                                                    setCouponValid(true);
                                                    setCouponDiscountValue(res.discount_value);
                                                    setCouponDiscountType(res.discount_type);
                                                    showToast("تم تطبيق الكوبون بنجاح", "success");
                                                } else {
                                                    setCouponValid(false);
                                                    setCouponDiscountValue(0);
                                                    showToast(res.message || "كوبون غير صالح", "error");
                                                }
                                            }}
                                        >
                                            تطبيق
                                        </button>
                                    </div>
                                    {couponValid && <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '4px' }}>خصم: {couponDiscountValue} {couponDiscountType === 'Percentage' ? '%' : currency}</div>}
                                </div>

                                <div className="form-group">
                                    <label className="form-label">سعر الشحن ({currency})</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="0"
                                        value={shippingFee}
                                        onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                                    />
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                                <div className="form-group">
                                    <label className="form-label">العربون المستلم (Deposit) ({currency})</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="0"
                                        value={deposit}
                                        onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
                                        placeholder="0.00"
                                    />
                                </div>
                                <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginTop: '24px' }}>
                                    <label className="form-label" style={{ marginBottom: 0 }}>تطبيق ضريبة القيمة المضافة 14%</label>
                                    <div 
                                        onClick={() => setVatEnabled(prev => !prev)}
                                        style={{
                                            width: '46px',
                                            height: '24px',
                                            borderRadius: '12px',
                                            background: vatEnabled ? 'var(--gold-primary)' : 'var(--glass-border-hover)',
                                            position: 'relative',
                                            cursor: 'pointer',
                                            transition: 'background 0.3s ease'
                                        }}
                                    >
                                        <div style={{
                                            width: '18px',
                                            height: '18px',
                                            borderRadius: '50%',
                                            background: '#000',
                                            position: 'absolute',
                                            top: '3px',
                                            left: vatEnabled ? '25px' : '3px',
                                            transition: 'left 0.3s ease'
                                        }} />
                                    </div>
                                </div>
                            </div>

                            {/* 4. FINANCIAL SUMMARY (Auto-calculated) */}
                            <div className="glass-card" style={{ padding: '16px', marginTop: '16px', border: '1px solid rgba(212, 175, 55, 0.15)', background: 'rgba(0,0,0,0.15)' }}>
                                <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '12px', fontWeight: 600 }}>الخلاصة المالية المؤقتة</h4>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px 24px', fontSize: '13px' }}>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>مجموع المنتجات:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{currency}{totalProductsSubtotal.toFixed(2)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>خصم الأوردر:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px', color: 'var(--color-danger)' }}>
                                            -{currency}{orderDiscountAmount.toFixed(2)} ({orderDiscountPercent}%)
                                        </strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>ضريبة القيمة المضافة (14%):</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{currency}{vatAmount.toFixed(2)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>سعر الشحن ({governorate || 'لم تحدد'}):</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>+{currency}{shippingFeeVal.toFixed(2)}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>العربون المستلم:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px', color: 'var(--color-success)' }}>
                                            -{currency}{depositVal.toFixed(2)}
                                        </strong>
                                    </div>
                                    <div style={{ borderLeft: '1px dashed var(--glass-border-hover)', paddingRight: '12px' }}>
                                        <span style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>المتبقي للتحصيل:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '18px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                                            {currency}{remainingToCollect.toFixed(2)}
                                        </strong>
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* STEP 4: REVIEW & CONFIRM */}
                    {step === 4 && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '16px' }}>
                                
                                {/* Customer Review */}
                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)' }}>
                                    <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                                        <i className="fa-solid fa-user" style={{ marginLeft: '6px' }}></i> بيانات العميل والشحن
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                        <div><strong>اسم العميل:</strong> {client} <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>({customerCode})</span></div>
                                        <div><strong>رقم الهاتف:</strong> {phone}</div>
                                        <div><strong>المحافظة:</strong> {governorate}</div>
                                        <div><strong>العنوان التفصيلي:</strong> {address}</div>
                                    </div>
                                </div>

                                {/* Cost Breakdown Review */}
                                <div className="glass-card" style={{ padding: '16px', background: 'rgba(0,0,0,0.15)', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                                    <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '12px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '6px' }}>
                                        <i className="fa-solid fa-calculator" style={{ marginLeft: '6px' }}></i> الخلاصة المالية النهائية
                                    </h4>
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '13px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>مجموع المنتجات:</span>
                                            <span>{currency}{totalProductsSubtotal.toFixed(2)}</span>
                                        </div>
                                        {orderDiscountPercent > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                                                <span>خصم إضافي للأوردر ({orderDiscountPercent}%):</span>
                                                <span>-{currency}{orderDiscountAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        {vatEnabled && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>ضريبة القيمة المضافة (14%):</span>
                                                <span>{currency}{vatAmount.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>مصاريف الشحن:</span>
                                            <span>+{currency}{shippingFeeVal.toFixed(2)}</span>
                                        </div>
                                        {deposit > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                                                <span>عربون مستلم (Deposit):</span>
                                                <span>-{currency}{depositVal.toFixed(2)}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '8px', marginTop: '4px', color: 'var(--gold-primary)' }}>
                                            <span>المتبقي للتحصيل:</span>
                                            <span>{currency}{remainingToCollect.toFixed(2)}</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Products Review List */}
                            <div className="glass-card" style={{ padding: '16px', background: 'rgba(0,0,0,0.1)', maxHeight: '180px', overflowY: 'auto' }}>
                                <h4 style={{ fontSize: '14px', color: 'var(--gold-primary)', marginBottom: '10px' }}>
                                    <i className="fa-solid fa-box-open" style={{ marginLeft: '6px' }}></i> المنتجات المختارة للمراجعة ({items.length})
                                </h4>
                                <table style={{ width: '100%', fontSize: '12px', borderCollapse: 'collapse' }}>
                                    <thead>
                                        <tr style={{ borderBottom: '1px solid var(--glass-border)', color: 'var(--text-secondary)' }}>
                                            <th style={{ textAlign: 'right', padding: '6px 4px' }}>اسم المنتج</th>
                                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>الكمية</th>
                                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>سعر الوحدة</th>
                                            <th style={{ textAlign: 'center', padding: '6px 4px' }}>الخصم</th>
                                            <th style={{ textAlign: 'left', padding: '6px 4px' }}>الإجمالي</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, i) => {
                                            const sub = item.quantity * item.price * (1 - (item.discountPercent || 0) / 100);
                                            return (
                                                <tr key={`review-item-${i}`} style={{ borderBottom: '1px solid var(--glass-bg-hover)' }}>
                                                    <td style={{ padding: '6px 4px' }}>{item.productName} <span style={{ color: 'var(--text-muted)', fontSize: '10px' }}>({item.variantName})</span></td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>{item.quantity}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>{currency}{item.price.toFixed(2)}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--color-danger)' }}>{item.discountPercent > 0 ? `${item.discountPercent}%` : '-'}</td>
                                                    <td style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>{currency}{sub.toFixed(2)}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>

                {/* NAVIGATION FOOTER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)' }}>
                    <div>
                        {step > 1 ? (
                            <button type="button" className="btn btn-secondary" onClick={() => setStep(prev => prev - 1)}>
                                السابق
                            </button>
                        ) : (
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                إلغاء
                            </button>
                        )}
                    </div>
                    
                    <div style={{ display: 'flex', gap: '12px' }}>
                        {/* Draft Action */}
                        <button 
                            type="button" 
                            className="btn btn-secondary" 
                            onClick={() => handleSaveOrder(true)}
                            style={{ borderColor: 'var(--gold-border)' }}
                        >
                            حفظ مسودة
                        </button>
                        
                        {/* Step Navigation / Confirmation */}
                        {step < 4 ? (
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={() => setStep(prev => prev + 1)}

                            >
                                التالي
                            </button>
                        ) : (
                            <button 
                                type="button" 
                                className="btn btn-primary" 
                                onClick={() => handleSaveOrder(false)}

                                style={{ background: '#27AE60', borderColor: '#27AE60' }}
                            >
                                تأكيد الطلب
                            </button>
                        )}
                    </div>
                </div>

            </div>
        </Modal>
    );
}
