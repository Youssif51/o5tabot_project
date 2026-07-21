import { formatProductDisplayName } from '../../utils/productUtils';
import React, { useContext, useState, useEffect } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';
import bostaData from '../../../محافظات/المناطق التابعه لكل محافظة.json';

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

const calculateBostaShippingFee = (cityName) => {
    if (!cityName) return 65;
    const city = cityName.trim();
    if (["بور سعيد", "الاسماعيليه", "السويس"].includes(city)) return 75;
    if (["الفيوم", "بني سويف", "المنيا", "اسيوط", "سوهاج"].includes(city)) return 80;
    if (["قنا", "الاقصر", "اسوان", "البحر الاحمر", "مرسي مطروح", "الساحل الشمالي"].includes(city)) return 100;
    if (["شمال سيناء", "جنوب سيناء", "الوادي الجديد"].includes(city)) return 120;
    return 65;
};

export default function RecordOrderModal({ isOpen, onClose, editOrderId }) {
    const { state, addOrder, editOrder, showToast, showConfirm, t, validateCoupon, applyCouponUsage, getOrCreateCustomer, approveOrderWithBosta } = useContext(AppContext);
    
    // Order info
    const [orderId, setOrderId] = useState('');
    const [status, setStatus] = useState('Draft'); // 'Draft', 'Pending', 'Completed'
    const [step, setStep] = useState(1); // 1: بيانات العميل, 2: المنتجات, 3: الشحن والدفع, 4: مراجعة
    const [syncWithBosta, setSyncWithBosta] = useState(true);
    const [allowToOpenPackage, setAllowToOpenPackage] = useState(false);
    const [originalAddressObj, setOriginalAddressObj] = useState({});
    
    // Customer Section
    const [client, setClient] = useState('');
    const [customerId, setCustomerId] = useState(null);
    const [couponCode, setCouponCode] = useState('');
    const [couponValid, setCouponValid] = useState(false);
    const [couponDiscountValue, setCouponDiscountValue] = useState(0);
    const [couponDiscountType, setCouponDiscountType] = useState('');
    const [globalDiscountValue, setGlobalDiscountValue] = useState('');
    const [globalDiscountType, setGlobalDiscountType] = useState('Percentage');
    const [isClientDropdownOpen, setIsClientDropdownOpen] = useState(false);
    const [phone, setPhone] = useState('');
    const [secondPhone, setSecondPhone] = useState('');
    const [governorate, setGovernorate] = useState('');
    const [address, setAddress] = useState('');
    
    // Products Table
    const [items, setItems] = useState([
        { variantSku: '', quantity: 1, price: 0, discountPercent: 0, discountType: 'Percentage', maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }
    ]);
    
    // Financial Summaries
    // Removed global order discount
    const [citySelected, setCitySelected] = useState(null);
    const [districtSelected, setDistrictSelected] = useState(null);
    const [activeCityDropdown, setActiveCityDropdown] = useState(false);
    const [activeDistrictDropdown, setActiveDistrictDropdown] = useState(false);
    const [citySearch, setCitySearch] = useState('');
    const [districtSearch, setDistrictSearch] = useState('');
    const [shippingFee, setShippingFee] = useState('');
    const [vatEnabled, setVatEnabled] = useState(false);
    const [deposit, setDeposit] = useState('');
    const [depositReceiverId, setDepositReceiverId] = useState('');
    const [depositStatus, setDepositStatus] = useState('confirmed');
    
    const currency = state.storeSettings.currency || '$';
    
    const parseAddressData = (addressStr) => {
        let detailAddress = addressStr || '';
        let phone = '';
        let secondPhone = '';
        let vatEnabled = false;
        let globalDiscountValue = '';
        let globalDiscountType = 'Percentage';
        let customerCode = 'CUS-0000';
        let appliedCoupon = '';
        let originalObj = {};
        let bostaCityCode = null;
        let bostaCityName = '';
        let bostaDistrictId = null;
        let bostaDistrictName = '';
        let bostaZoneId = null;
        
        if (addressStr) {
            let parsed = addressStr;
            if (typeof addressStr === 'string' && addressStr.startsWith('{')) {
                try {
                    parsed = JSON.parse(addressStr);
                } catch(e) {}
            }
            if (parsed && typeof parsed === 'object') {
                originalObj = parsed;
                detailAddress = parsed.detailAddress || (typeof addressStr === 'string' && !addressStr.startsWith('{') ? addressStr : '');
                phone = parsed.phone || '';
                secondPhone = parsed.secondPhone || '';
                vatEnabled = parsed.vatEnabled || false;
                globalDiscountValue = parsed.globalDiscountValue || '';
                globalDiscountType = parsed.globalDiscountType || 'Percentage';
                customerCode = parsed.customerCode || 'CUS-0000';
                appliedCoupon = parsed.appliedCoupon || '';
                bostaCityCode = parsed.bostaCityCode || null;
                bostaCityName = parsed.bostaCityName || '';
                bostaDistrictId = parsed.bostaDistrictId || null;
                bostaDistrictName = parsed.bostaDistrictName || '';
                bostaZoneId = parsed.bostaZoneId || null;
            }
        }
        return { 
            detailAddress, phone, secondPhone, vatEnabled, globalDiscountValue, globalDiscountType, 
            customerCode, appliedCoupon, originalObj,
            bostaCityCode, bostaCityName, bostaDistrictId, bostaDistrictName, bostaZoneId
        };
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

    const resolveBostaCityAndDistrict = (govName, cityCode, districtId, districtName, fullAddress = '') => {
        let city = null;
        if (cityCode) {
            city = bostaData.data.find(c => String(c.cityCode) === String(cityCode));
        }
        if (!city && govName) {
            const trimmedGov = govName.trim().toLowerCase();
            city = bostaData.data.find(c => 
                c.cityOtherName.trim().toLowerCase() === trimmedGov ||
                c.cityName.trim().toLowerCase() === trimmedGov ||
                c.cityOtherName.includes(govName) ||
                govName.includes(c.cityOtherName)
            );
        }
        
        let district = null;
        if (city && city.districts) {
            if (districtId) {
                district = city.districts.find(d => String(d.districtId) === String(districtId));
            }
            if (!district && districtName) {
                const trimmedDist = districtName.trim().toLowerCase();
                district = city.districts.find(d => 
                    d.districtOtherName.trim().toLowerCase() === trimmedDist ||
                    d.districtName.trim().toLowerCase() === trimmedDist ||
                    d.districtOtherName.includes(districtName) ||
                    districtName.includes(d.districtOtherName)
                );
            }
            if (!district && fullAddress) {
                const trimmedAddr = fullAddress.trim().toLowerCase();
                district = city.districts.find(d => 
                    (d.districtOtherName && trimmedAddr.includes(d.districtOtherName.trim().toLowerCase())) ||
                    (d.districtName && trimmedAddr.includes(d.districtName.trim().toLowerCase()))
                );
            }
            if (!district) {
                const avail = city.districts.filter(d => d.dropOffAvailability);
                if (avail.length === 1) {
                    district = avail[0];
                }
            }
        }
        return { city, district };
    };

    // Build rich list of unique customers for auto-fill & searching
    const getCustomerOptions = () => {
        const map = new Map();
        
        (state.customers || []).forEach(c => {
            if (c.name) {
                map.set(c.name.toLowerCase().trim(), {
                    id: c.id,
                    name: c.name,
                    phone: c.phone || '',
                    secondPhone: c.secondPhone || '',
                    governorate: c.governorate || '',
                    address: c.address || ''
                });
            }
        });

        (state.orders || []).forEach(o => {
            if (o.client) {
                const key = o.client.toLowerCase().trim();
                const existing = map.get(key) || {};
                const parsed = parseAddressData(o.address);
                map.set(key, {
                    id: existing.id || o.customer_id || null,
                    name: o.client,
                    phone: existing.phone || parsed.phone || '',
                    secondPhone: existing.secondPhone || parsed.secondPhone || '',
                    governorate: existing.governorate || o.governorate || '',
                    address: existing.address || parsed.detailAddress || (typeof o.address === 'string' && !o.address.startsWith('{') ? o.address : ''),
                    bostaCityCode: parsed.bostaCityCode,
                    bostaCityName: parsed.bostaCityName,
                    bostaDistrictId: parsed.bostaDistrictId,
                    bostaDistrictName: parsed.bostaDistrictName,
                    shippingFee: o.shipping_fee || 0
                });
            }
        });

        return Array.from(map.values());
    };

    const customerOptions = getCustomerOptions();
    const filteredCustomers = customerOptions.filter(c => 
        (c.name || '').toLowerCase().includes((client || '').toLowerCase()) ||
        (c.phone || '').includes(client || '')
    );

    // Reset all form state variables cleanly
    const resetFormState = () => {
        const rand = Math.floor(1000 + Math.random() * 9000);
        setOrderId(`ORD-2026-${rand}`);
        setStatus('Draft');
        setStep(1);
        setClient('');
        setIsClientDropdownOpen(false);
        setPhone('');
        setSecondPhone('');
        setGovernorate('');
        setAddress('');
        setCitySelected(null);
        setDistrictSelected(null);
        setCitySearch('');
        setDistrictSearch('');
        setActiveCityDropdown(false);
        setActiveDistrictDropdown(false);
        setItems([{ variantSku: '', quantity: 1, price: 0, discountPercent: 0, discountType: 'Percentage', maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }]);
        setShippingFee('');
        setVatEnabled(false);
        setGlobalDiscountValue('');
        setGlobalDiscountType('Percentage');
        setOriginalAddressObj({});
        setDeposit('');
        setDepositReceiverId('');
        setDepositStatus('confirmed');
        setCustomerId(null);
        setCouponCode('');
        setCouponValid(false);
        setCouponDiscountValue(0);
        setCouponDiscountType('');
        setSyncWithBosta(true);
    };

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
                    setSecondPhone(parsed.secondPhone);
                    setAddress(parsed.detailAddress || order.address);
                    setVatEnabled(parsed.vatEnabled);
                    setGlobalDiscountValue(parsed.globalDiscountValue || '');
                    setGlobalDiscountType(parsed.globalDiscountType || 'Percentage');
                    setOriginalAddressObj(parsed.originalObj || {});
                    
                    setCouponCode(parsed.appliedCoupon || '');
                    setCustomerId(order.customer_id || null);
                    
                    setGovernorate(order.governorate || '');
                    setShippingFee(order.shipping_fee || '');
                    setDeposit(order.deposit || '');
                    setDepositReceiverId(order.depositReceiverId || '');
                    setDepositStatus(order.depositStatus || 'confirmed');

                    const { city, district } = resolveBostaCityAndDistrict(order.governorate, parsed.bostaCityCode, parsed.bostaDistrictId, parsed.bostaDistrictName);
                    setCitySelected(city || null);
                    setDistrictSelected(district || null);
                    setCitySearch('');
                    setDistrictSearch('');
                    setActiveCityDropdown(false);
                    setActiveDistrictDropdown(false);
                    
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
                            discountType: 'Percentage',
                            maxStock: maxStock,
                            searchVal: formatProductDisplayName(productName, variantName),
                            isOpen: false,
                            productName: productName,
                            variantName: variantName
                        };
                    });
                    setItems(mappedItems);
                }
            } else {
                resetFormState();
            }
        } else {
            resetFormState();
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
    const handleSelectCustomer = (custObj) => {
        if (!custObj) return;
        setClient(custObj.name);
        setIsClientDropdownOpen(false);
        setCustomerId(custObj.id || null);
        
        if (custObj.phone) setPhone(custObj.phone);
        if (custObj.secondPhone) setSecondPhone(custObj.secondPhone);
        
        const latestOrder = (state.orders || [])
            .filter(o => (custObj.id && o.customer_id === custObj.id) || o.client === custObj.name)
            .sort((a, b) => new Date(b.createdAt || b.date) - new Date(a.createdAt || a.date))[0];

        let finalGov = custObj.governorate || '';
        let finalAddr = custObj.address || '';
        let bCode = custObj.bostaCityCode;
        let bCityName = custObj.bostaCityName;
        let bDistId = custObj.bostaDistrictId;
        let bDistName = custObj.bostaDistrictName;
        let sFee = custObj.shippingFee || 0;

        if (latestOrder) {
            if (!finalGov) finalGov = latestOrder.governorate || '';
            const parsed = parseAddressData(latestOrder.address);
            if (!finalAddr) finalAddr = parsed.detailAddress || (typeof latestOrder.address === 'string' && !latestOrder.address.startsWith('{') ? latestOrder.address : '');
            if (!bCode) bCode = parsed.bostaCityCode;
            if (!bCityName) bCityName = parsed.bostaCityName;
            if (!bDistId) bDistId = parsed.bostaDistrictId;
            if (!bDistName) bDistName = parsed.bostaDistrictName;
            if (!sFee) sFee = latestOrder.shipping_fee || 0;
            if (!custObj.phone && parsed.phone) setPhone(parsed.phone);
            if (!custObj.secondPhone && parsed.secondPhone) setSecondPhone(parsed.secondPhone);
        }

        if (finalGov) setGovernorate(finalGov);
        if (finalAddr) setAddress(finalAddr);

        const { city, district } = resolveBostaCityAndDistrict(finalGov, bCode, bDistId, bDistName, finalAddr);
        setCitySelected(city || null);
        setDistrictSelected(district || null);
        
        if (city) {
            const calculatedFee = calculateBostaShippingFee(city.cityOtherName);
            setShippingFee(sFee || calculatedFee);
        } else if (finalGov) {
            setShippingFee(sFee || shippingFees[finalGov] || 0);
        }

        showToast("تم ملء بيانات العميل والمحافظة والمنطقة تلقائياً", "success");
    };

    // Products table actions
    const handleAddItem = () => {
        const hasUnselectedItem = items.some(item => !item.variantSku);
        if (hasUnselectedItem) {
            showToast("يرجى اختيار المنتج والتنوع في الصف الحالي أولاً قبل إضافة منتج جديد", "warning");
            return;
        }
        setItems(prev => [...prev, { variantSku: '', quantity: 1, price: 0, discountPercent: 0, discountType: 'Percentage', maxStock: 0, searchVal: '', isOpen: false, productName: '', variantName: '' }]);
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
        if ((variant.stock || 0) <= 0) {
            showToast("عفواً هذا المنتج غير متوفر في المخزن حالياً (الاستوك صفر)", "error");
        }
        setItems(prev => prev.map((item, i) => i === index ? {
            ...item,
            variantSku: variant.sku,
            price: variant.retailPrice,
            maxStock: variant.stock || 0,
            productName: variant.productName,
            variantName: variant.name,
            searchVal: formatProductDisplayName(variant.productName, variant.name),
            isOpen: false
        } : item));
    };

    const handleClearItem = (index) => {
        setItems(prev => prev.map((item, i) => i === index ? {
            ...item,
            variantSku: '',
            price: 0,
            discountPercent: 0,
            maxStock: 0,
            searchVal: '',
            productName: '',
            variantName: '',
            quantity: 1,
            isOpen: true
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

    const handleDiscountChange = (index, val, type) => {
        let disc = parseFloat(val) || 0;
        if (disc < 0) disc = 0;
        if (type === 'Percentage' && disc > 100) disc = 100;
        setItems(prev => prev.map((item, i) => i === index ? { ...item, discountPercent: disc, discountType: type } : item));
    };

    const handleGovernorateChange = (gov) => {
        setGovernorate(gov);
        const fee = shippingFees[gov] || 0;
        setShippingFee(fee);
    };

    // Financial Math calculations (parsed for string safety)
    
    const shippingFeeVal = parseFloat(shippingFee) || 0;
    const depositVal = parseFloat(deposit) || 0;

    const totalProductsSubtotal = items.reduce((sum, item) => {
        const sub = item.discountType === 'Percentage' ? (item.quantity * item.price * (1 - (item.discountPercent || 0) / 100)) : Math.max(0, (item.quantity * item.price) - (item.discountPercent || 0));
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
    
    let globalDisc = 0;
    const gDiscountVal = parseFloat(globalDiscountValue) || 0;
    if (gDiscountVal > 0) {
        if (globalDiscountType === 'Percentage') {
            globalDisc = totalProductsSubtotal * (gDiscountVal / 100);
        } else {
            globalDisc = gDiscountVal;
        }
    }

    const orderDiscountAmount = couponDisc + globalDisc;
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
    const isStep2Valid = items.length > 0 && items.every(item => item.variantSku !== '' && item.quantity > 0 && (item.maxStock || 0) > 0 && item.quantity <= (item.maxStock || 0));
    useEffect(() => {
        if (depositVal > 0 && !depositReceiverId && state.currentUser) {
            setDepositReceiverId(state.currentUser.id);
        }
    }, [deposit, depositReceiverId, state.currentUser]);

    const isStep3Valid = shippingFee !== '' && shippingFee !== null && !isNaN(shippingFee) && parseFloat(shippingFee) > 0 && depositVal >= 0 && (depositVal === 0 || !!depositReceiverId);
    
    const canNavigateToStep = (targetStep) => {
        if (targetStep <= step) return true;
        if (targetStep >= 2 && !isStep1Valid) return false;
        if (targetStep >= 3 && (!isStep1Valid || !isStep2Valid)) return false;
        if (targetStep >= 4 && (!isStep1Valid || !isStep2Valid || !isStep3Valid)) return false;
        return true;
    };

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
        if (!isDraftSave && syncWithBosta) {
            if (!citySelected || !districtSelected) {
                showToast("يرجى اختيار المحافظة والمنطقة الخاصة ببوسطة من الخطوة الأولى لتفعيل المزامنة التلقائية للشحن.", "error");
                setStep(1);
                return;
            }
        }
        if (!isStep2Valid) {
            showToast("يرجى إدخال أصناف وكميات صالحة في سلة المنتجات", "error");
            setStep(2);
            return;
        }

        const orderItems = items.map(item => ({
            variantSku: item.variantSku,
            quantity: item.quantity,
            price: item.discountType === 'Percentage' ? (item.price * (1 - (item.discountPercent || 0) / 100)) : (item.price - (item.discountPercent || 0) / item.quantity)
        }));

        const finalStatus = isDraftSave ? 'Draft' : 'Pending'; // Draft = مسودة, Pending = قيد التجهيز/الانتظار, Completed = تم التسليم

        
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
                ...originalAddressObj,
                detailAddress: address,
                phone: phone,
                secondPhone: secondPhone,
                vatEnabled: vatEnabled,
                globalDiscountValue: globalDiscountValue,
                globalDiscountType: globalDiscountType,
                customerCode: customerCode,
                appliedCoupon: couponValid ? couponCode : '',
                bostaCityCode: citySelected?.cityCode || null,
                bostaCityName: citySelected?.cityName || citySelected?.cityOtherName || '',
                bostaDistrictId: districtSelected?.districtId || null,
                bostaDistrictName: districtSelected?.districtName || districtSelected?.districtOtherName || '',
                bostaZoneId: districtSelected?.zoneId || null
            }),
            governorate: governorate,
            deposit: depositVal,
            depositReceiverId: depositVal > 0 ? (depositReceiverId || state.currentUser?.id || null) : null,
            depositStatus: depositVal > 0 ? (depositReceiverId === state.currentUser?.id ? 'confirmed' : (depositStatus || 'pending')) : 'confirmed',
            shipping_fee: shippingFeeVal,
            createdBy: state.currentUser ? state.currentUser.name : 'sfsf'
        };

        if (editOrderId) {
            editOrder(newOrderObj);
            showToast(isDraftSave ? "تم تعديل الطلب كمسودة بنجاح" : "تم تعديل واعتماد الطلب بنجاح", "success");
        } else {
            addOrder(newOrderObj);
            showToast(isDraftSave ? "تم حفظ الطلب كمسودة بنجاح" : "تم إضافة طلب العميل بنجاح", "success");
            
            if (!isDraftSave && syncWithBosta && newOrderObj.status !== 'Draft' && newOrderObj.depositStatus !== 'pending') {
                const bostaMetadata = {
                    customerName: client,
                    customerPhone: phone,
                    customerSecondPhone: secondPhone,
                    customerAddress: address,
                    governorate: governorate,
                    bostaCityCode: citySelected?.cityCode,
                    bostaCityName: citySelected?.cityOtherName,
                    bostaDistrictId: districtSelected?.districtId,
                    bostaDistrictName: districtSelected?.districtOtherName,
                    bostaZoneId: districtSelected?.zoneId,
                    allowToOpenPackage: allowToOpenPackage
                };
                // Fire and forget
                approveOrderWithBosta(newOrderObj.id, bostaMetadata, newOrderObj.deposit);
            }
        }

        // Apply coupon usage to update its statistics
        if (couponValid && couponCode) {
            applyCouponUsage(couponCode, newOrderObj.id);
        }

        onClose();
    };

    const handleRequestClose = () => {
        const isDirty = client.trim() !== '' || phone.trim() !== '' || address.trim() !== '' || items.some(i => i.variantSku !== '');
        if (isDirty) {
            showConfirm(
                "هل أنت تأكد أنك تريد الخروج وإلغاء تسجيل الطلب؟ سيتم فقد البيانات المدخلة غير المحفوظة.",
                () => {
                    resetFormState();
                    onClose();
                }
            );
        } else {
            resetFormState();
            onClose();
        }
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={handleRequestClose} 
            title={editOrderId ? `تعديل طلب مبيعات: ${orderId}` : "تسجيل طلب مبيعات جديد"} 
            width="1150px"
            closeOnBackdropClick={false}
        >
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
                    ].map((s) => {
                        const isAccessible = canNavigateToStep(s.stepNum);
                        return (
                            <div 
                                key={s.stepNum} 
                                style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column', 
                                    alignItems: 'center', 
                                    zIndex: 3, 
                                    cursor: isAccessible ? 'pointer' : 'not-allowed',
                                    opacity: isAccessible ? 1 : 0.45,
                                    transition: 'opacity 0.2s ease'
                                }} 
                                onClick={() => {
                                    if (s.stepNum <= step) {
                                        setStep(s.stepNum);
                                        return;
                                    }
                                    if (s.stepNum >= 2 && !isStep1Valid) {
                                        showToast("يرجى استكمال بيانات العميل ورقم الهاتف والمحافظة والعنوان أولاً", "warning");
                                        return;
                                    }
                                    if (s.stepNum >= 3 && !isStep2Valid) {
                                        const hasZeroStock = items.some(i => i.variantSku && (i.maxStock || 0) <= 0);
                                        if (hasZeroStock) {
                                            showToast("لا يمكن الانتقال: يوجد منتج مختار غير متوفر في المخزن (الاستوك صفر)", "error");
                                        } else {
                                            showToast("يرجى اختيار منتجات صالحة ومتوفرة في المخزن أولاً", "warning");
                                        }
                                        return;
                                    }
                                    if (s.stepNum >= 4 && !isStep3Valid) {
                                        showToast("يرجى تحديد مبلغ وسعر الشحن الإلزامي أولاً للمتابعة", "warning");
                                        return;
                                    }
                                    setStep(s.stepNum);
                                }}
                            >
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
                        );
                    })}
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
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            zIndex: 1000,
                                            background: 'rgba(25, 25, 35, 0.98)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            padding: '6px',
                                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)'
                                        }}>
                                            {filteredCustomers.map((cust, idx) => (
                                                <div 
                                                    key={cust.id || cust.name || idx}
                                                    onMouseDown={() => handleSelectCustomer(cust)}
                                                    style={{ 
                                                        padding: '10px 12px', 
                                                        fontSize: '12px', 
                                                        cursor: 'pointer', 
                                                        borderBottom: '1px solid var(--glass-border)', 
                                                        color: 'var(--text-primary)', 
                                                        borderRadius: '6px',
                                                        display: 'flex',
                                                        justify: 'space-between',
                                                        alignItems: 'center'
                                                    }}
                                                    className="autocomplete-option"
                                                >
                                                    <div>
                                                        <strong style={{ color: '#fff', fontSize: '13px' }}>{cust.name}</strong>
                                                        {cust.phone && <span style={{ marginRight: '8px', color: 'var(--text-secondary)', fontSize: '11px' }}>({cust.phone})</span>}
                                                    </div>
                                                    {cust.governorate && (
                                                        <span style={{ fontSize: '11px', color: 'var(--gold-primary)', background: 'rgba(212, 175, 55, 0.12)', padding: '2px 8px', borderRadius: '4px', border: '1px solid rgba(212, 175, 55, 0.2)' }}>
                                                            {cust.governorate}
                                                        </span>
                                                    )}
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
                                                if (digits.length === 11) {
                                                    const match = customerOptions.find(c => c.phone === digits);
                                                    if (match && (!client || client === match.name)) {
                                                        handleSelectCustomer(match);
                                                    }
                                                }
                                            }
                                        }}
                                        placeholder="مثال: 01012345678" 
                                        maxLength={11}
                                        required 
                                    />
                                    {(() => {
                                        const cust = state.customers.find(c => phone && c.phone === phone);
                                        if (cust && cust.is_spam) {
                                            return (
                                                <div className="glass-card" style={{ fontSize: '11px', color: 'var(--color-danger)', border: '1px solid rgba(239, 68, 68, 0.4)', backgroundColor: 'rgba(239, 68, 68, 0.1)', padding: '6px 12px', borderRadius: '8px', marginTop: '6px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <i className="fa-solid fa-triangle-exclamation animate-pulse"></i>
                                                    <strong>تنبيه: هذا العميل مسجل في قائمة المزعجين!</strong>
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                    {phone && phone.length < 11 && (
                                        <div style={{ fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px' }}>
                                            يجب إدخال 11 رقماً (المتبقي: {11 - phone.length})
                                        </div>
                                    )}
                                </div>
                                <div className="form-group">
                                    <label className="form-label">رقم الهاتف البديل (اختياري)</label>
                                    <input 
                                        type="text" 
                                        className="form-input" 
                                        value={secondPhone}
                                        onChange={(e) => {
                                            const digits = e.target.value.replace(/\D/g, '');
                                            if (digits.length <= 11) {
                                                setSecondPhone(digits);
                                            }
                                        }}
                                        placeholder="مثال: 01112345678" 
                                    />
                                    {secondPhone && secondPhone.length > 0 && secondPhone.length < 11 && (
                                        <div style={{ fontSize: '10px', color: 'var(--color-warning)', marginTop: '4px' }}>
                                            رقم الهاتف يجب أن يكون 11 رقماً (المتبقي: {11 - secondPhone.length})
                                        </div>
                                    )}
                                </div>
                                
<div style={{ display: 'flex', gap: '10px' }}>
    <div className="form-group" style={{ flex: 1, position: 'relative' }}>
        <label className="form-label">المحافظة (الشحن) *</label>
        <div 
            onClick={() => setActiveCityDropdown(!activeCityDropdown)}
            style={{ 
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', 
                padding: '10px 12px', fontSize: '13px', color: citySelected ? '#fff' : '#aaa', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            }}
        >
            <span>{citySelected ? citySelected.cityOtherName : 'اختر المحافظة...'}</span>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
        </div>
        
        {activeCityDropdown && (
            <div className="glass-card" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '200px',
                overflowY: 'auto', background: '#1e1e24', border: '1px solid var(--glass-border)', borderRadius: '8px',
                marginTop: '4px', padding: '4px'
            }}>
                <input 
                    type="text" 
                    placeholder="ابحث عن المحافظة..." 
                    value={citySearch}
                    onChange={(e) => setCitySearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', marginBottom: '4px', outline: 'none' }}
                />
                {bostaData.data.filter(c => c.cityOtherName.includes(citySearch) || c.cityName.toLowerCase().includes(citySearch.toLowerCase())).map(c => (
                    <div 
                        key={c.cityCode}
                        onClick={() => {
                            setCitySelected(c);
                            setGovernorate(c.cityOtherName);
                            const { district } = resolveBostaCityAndDistrict(c.cityOtherName, c.cityCode, null, null, address);
                            setDistrictSelected(district || null);
                            setShippingFee(calculateBostaShippingFee(c.cityOtherName));
                            setActiveCityDropdown(false);
                            setCitySearch('');
                        }}
                        style={{ padding: '8px', fontSize: '12px', cursor: 'pointer', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                        {c.cityOtherName}
                    </div>
                ))}
            </div>
        )}
    </div>

    <div className="form-group" style={{ flex: 1, position: 'relative' }}>
        <label className="form-label">المنطقة (Bosta) *</label>
        <div 
            onClick={() => { if(citySelected) setActiveDistrictDropdown(!activeDistrictDropdown) }}
            style={{ 
                background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '8px', 
                padding: '10px 12px', fontSize: '13px', color: districtSelected ? '#fff' : '#aaa', cursor: citySelected ? 'pointer' : 'not-allowed',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: citySelected ? 1 : 0.5
            }}
        >
            <span>{districtSelected ? districtSelected.districtOtherName : 'اختر المنطقة...'}</span>
            <i className="fa-solid fa-chevron-down" style={{ fontSize: '10px' }}></i>
        </div>
        
        {activeDistrictDropdown && citySelected && (
            <div className="glass-card" style={{
                position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 100, maxHeight: '200px',
                overflowY: 'auto', background: '#1e1e24', border: '1px solid var(--glass-border)', borderRadius: '8px',
                marginTop: '4px', padding: '4px'
            }}>
                <input 
                    type="text" 
                    placeholder="ابحث عن المنطقة..." 
                    value={districtSearch}
                    onChange={(e) => setDistrictSearch(e.target.value)}
                    onClick={(e) => e.stopPropagation()}
                    style={{ width: '100%', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: '#fff', padding: '6px 10px', fontSize: '12px', borderRadius: '4px', marginBottom: '4px', outline: 'none' }}
                />
                {citySelected.districts.filter(d => d.dropOffAvailability && (d.districtOtherName.includes(districtSearch) || d.districtName.toLowerCase().includes(districtSearch.toLowerCase()))).map(d => (
                    <div 
                        key={d.districtId}
                        onClick={() => {
                            setDistrictSelected(d);
                            setActiveDistrictDropdown(false);
                            setDistrictSearch('');
                        }}
                        style={{ padding: '8px', fontSize: '12px', cursor: 'pointer', color: '#fff', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                    >
                        {d.districtOtherName}
                    </div>
                ))}
            </div>
        )}
    </div>
</div>

                            </div>

                            <div className="form-group">
                                <label className="form-label">العنوان التفصيلي *</label>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={address}
                                    onChange={(e) => {
                                        const val = e.target.value;
                                        setAddress(val);
                                        if (citySelected && !districtSelected && val.trim().length > 2) {
                                            const { district } = resolveBostaCityAndDistrict(citySelected.cityOtherName, citySelected.cityCode, null, null, val);
                                            if (district) setDistrictSelected(district);
                                        }
                                    }}
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
                                            <th style={{ width: '14%', textAlign: 'center', padding: '10px' }}>الخصم</th>
                                            <th style={{ width: '14%', textAlign: 'center', padding: '10px' }}>الإجمالي</th>
                                            <th style={{ width: '8%', textAlign: 'center', padding: '10px' }}>حذف</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((item, idx) => {
                                            const subtotal = item.discountType === 'Percentage' ? (item.quantity * item.price * (1 - (item.discountPercent || 0) / 100)) : Math.max(0, (item.quantity * item.price) - (item.discountPercent || 0));
                                            const rowOptions = getRowOptions(item);
                                            return (
                                                <tr key={`order-item-${idx}`} style={{ borderBottom: '1px solid var(--glass-border)' }}>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', position: 'relative' }}>
                                                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                                                            <input 
                                                                type="text"
                                                                className="form-input"
                                                                placeholder="ابحث عن منتج..."
                                                                value={item.searchVal || ''}
                                                                onChange={(e) => handleItemSearchChange(idx, e.target.value)}
                                                                onFocus={() => setItemOpen(idx, true)}
                                                                onBlur={() => setTimeout(() => setItemOpen(idx, false), 250)}
                                                                required
                                                                style={{ 
                                                                    width: '100%',
                                                                    background: 'var(--glass-bg)', 
                                                                    borderColor: item.variantSku ? 'var(--color-success)' : 'var(--glass-border)',
                                                                    paddingLeft: (item.searchVal || item.variantSku) ? '32px' : '12px'
                                                                }}
                                                            />
                                                            {(item.searchVal || item.variantSku) && (
                                                                <button
                                                                    type="button"
                                                                    onMouseDown={(e) => {
                                                                        e.preventDefault();
                                                                        handleClearItem(idx);
                                                                    }}
                                                                    style={{
                                                                        position: 'absolute',
                                                                        left: '10px',
                                                                        top: '50%',
                                                                        transform: 'translateY(-50%)',
                                                                        background: 'transparent',
                                                                        border: 'none',
                                                                        color: 'var(--text-secondary)',
                                                                        cursor: 'pointer',
                                                                        fontSize: '12px',
                                                                        padding: '4px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        justifyContent: 'center',
                                                                        cursor: 'pointer',
                                                                        fontSize: '11px',
                                                                        transition: 'all 0.2s ease',
                                                                        zIndex: 5
                                                                    }}
                                                                    title="تفريغ المنتج المختار"
                                                                >
                                                                    <i className="fa-solid fa-xmark"></i>
                                                                </button>
                                                            )}
                                                        </div>
                                                        {item.variantSku && (item.maxStock || 0) <= 0 ? (
                                                            <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                                <i className="fa-solid fa-triangle-exclamation"></i>
                                                                عفواً غير متوفر في المخزن حالياً (الاستوك 0)!
                                                            </div>
                                                        ) : item.maxStock > 0 ? (
                                                            <div style={{ fontSize: '10px', color: 'var(--gold-primary)', marginTop: '4px' }}>
                                                                المتاح في المخزن: {item.maxStock} وحدات
                                                            </div>
                                                        ) : null}
                                                        
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
                                                                            <span>{formatProductDisplayName(opt.productName, opt.name)}</span>
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
                                                            value={item.variantSku ? `${currency} ${item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}` : ''}
                                                            placeholder={`${currency}0.00`}
                                                            readOnly
                                                            style={{ textAlign: 'center', background: 'var(--glass-bg)', color: 'rgba(255,255,255,0.8)' }}
                                                        />
                                                    </td>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle' }}>
                                                        <div style={{ display: 'flex', gap: '4px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
                                                            <input 
                                                                type="number"
                                                                min="0"
                                                                value={item.discountPercent || ''}
                                                                onChange={(e) => handleDiscountChange(idx, e.target.value, item.discountType || 'Percentage')}
                                                                disabled={!item.variantSku}
                                                                placeholder="0"
                                                                style={{
                                                                    width: '60px',
                                                                    background: 'transparent',
                                                                    border: 'none',
                                                                    color: 'var(--text-primary)',
                                                                    textAlign: 'center',
                                                                    fontSize: '13px',
                                                                    padding: '8px 4px',
                                                                    outline: 'none'
                                                                }}
                                                            />
                                                            <select 
                                                                value={item.discountType || 'Percentage'}
                                                                onChange={(e) => handleDiscountChange(idx, item.discountPercent, e.target.value)}
                                                                disabled={!item.variantSku}
                                                                style={{
                                                                    background: 'var(--glass-bg-hover)',
                                                                    border: 'none',
                                                                    borderLeft: '1px solid var(--glass-border)',
                                                                    color: 'var(--gold-primary)',
                                                                    fontSize: '13px',
                                                                    cursor: 'pointer',
                                                                    padding: '0 8px',
                                                                    outline: 'none'
                                                                }}
                                                            >
                                                                <option value="Percentage">%</option>
                                                                <option value="Fixed">ج</option>
                                                            </select>
                                                        </div>
                                                    </td>
                                                    <td style={{ padding: '8px 10px', verticalAlign: 'middle', textAlign: 'center', fontWeight: 'bold' }}>
                                                        {item.variantSku ? `${currency} ${subtotal.toLocaleString('en-US', {maximumFractionDigits: 2})}` : `${currency}0.00`}
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
                                    <label className="form-label">خصم عام على إجمالي المنتجات</label>
                                    <div style={{ display: 'flex', gap: '4px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '6px', overflow: 'hidden' }}>
                                        <input 
                                            type="number"
                                            min="0"
                                            value={globalDiscountValue}
                                            onChange={(e) => setGlobalDiscountValue(e.target.value)}
                                            placeholder="0"
                                            style={{
                                                flex: 1,
                                                background: 'transparent',
                                                border: 'none',
                                                color: 'var(--text-primary)',
                                                padding: '8px 12px',
                                                outline: 'none'
                                            }}
                                        />
                                        <select 
                                            value={globalDiscountType}
                                            onChange={(e) => setGlobalDiscountType(e.target.value)}
                                            style={{
                                                background: 'var(--glass-bg-hover)',
                                                border: 'none',
                                                borderLeft: '1px solid var(--glass-border)',
                                                color: 'var(--gold-primary)',
                                                cursor: 'pointer',
                                                padding: '0 12px',
                                                outline: 'none'
                                            }}
                                        >
                                            <option value="Percentage">%</option>
                                            <option value="Fixed">ج</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="form-group">
                                    <label className="form-label">سعر الشحن ({currency}) *</label>
                                    <input 
                                        type="number" 
                                        className="form-input" 
                                        min="0"
                                        value={shippingFee}
                                        onChange={(e) => setShippingFee(e.target.value)}
                                        placeholder="أدخل مصاريف الشحن..."
                                        required
                                    />
                                    {(shippingFee === '' || shippingFee === null || isNaN(shippingFee) || parseFloat(shippingFee) <= 0) && (
                                        <div style={{ fontSize: '11px', color: '#ef4444', marginTop: '4px', fontWeight: 'bold' }}>
                                            * مصاريف الشحن إجبارية وتتطلب تحديد قيمة برقم أكبر من الصفر للمتابعة.
                                        </div>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', alignItems: 'center' }}>
                                <div className="form-group">
                                    <label className="form-label">العربون المستلم (Deposit) ({currency})</label>
                                    <input 
                                        type="text" 
                                        inputMode="decimal"
                                        className="form-input" 
                                        value={deposit}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            if (val === '' || /^\d*\.?\d*$/.test(val)) {
                                                setDeposit(val);
                                                const numericVal = parseFloat(val) || 0;
                                                if (numericVal <= 0) {
                                                    setDepositReceiverId('');
                                                } else if (!depositReceiverId && state.currentUser) {
                                                    setDepositReceiverId(state.currentUser.id);
                                                }
                                            }
                                        }}
                                        placeholder="0.00"
                                    />
                                </div>
                                {deposit > 0 && (
                                    <div className="form-group">
                                        <label className="form-label">الأدمن المستلم للعربون *</label>
                                        <select
                                            className="form-input"
                                            value={depositReceiverId}
                                            onChange={(e) => {
                                                setDepositReceiverId(e.target.value);
                                                if (state.currentUser && e.target.value !== state.currentUser.id) {
                                                    setDepositStatus('pending');
                                                } else {
                                                    setDepositStatus('confirmed');
                                                }
                                            }}
                                            required
                                            style={{ background: 'var(--glass-bg)', color: 'var(--text-primary)' }}
                                        >
                                            <option value="" style={{ background: '#121216' }}>-- اختر الأدمن --</option>
                                            {(state.users || []).filter(u => u.is_active).map(u => (
                                                <option key={u.id} value={u.id} style={{ background: '#121216' }}>
                                                    {u.name} {u.id === state.currentUser?.id ? ' (أنت)' : ''}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                )}
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
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{currency} {totalProductsSubtotal.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>خصم الأوردر:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px', color: 'var(--color-danger)' }}>
                                            -{currency} {orderDiscountAmount.toLocaleString('en-US', {maximumFractionDigits: 2})}
                                        </strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>ضريبة القيمة المضافة (14%):</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>{currency} {vatAmount.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>سعر الشحن ({governorate || 'لم تحدد'}):</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px' }}>+{currency} {shippingFeeVal.toLocaleString('en-US', {maximumFractionDigits: 2})}</strong>
                                    </div>
                                    <div>
                                        <span style={{ color: 'var(--text-secondary)' }}>العربون المستلم:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '15px', color: 'var(--color-success)' }}>
                                            -{currency} {depositVal.toLocaleString('en-US', {maximumFractionDigits: 2})}
                                        </strong>
                                    </div>
                                    <div style={{ borderLeft: '1px dashed var(--glass-border-hover)', paddingRight: '12px' }}>
                                        <span style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>المتبقي للتحصيل:</span>
                                        <strong style={{ display: 'block', marginTop: '4px', fontSize: '18px', color: 'var(--gold-primary)', fontWeight: 'bold' }}>
                                            {currency} {remainingToCollect.toLocaleString('en-US', {maximumFractionDigits: 2})}
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
                                        <div><strong>رقم الهاتف:</strong> {phone} {secondPhone && `- ${secondPhone}`}</div>
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
                                            <span>{currency} {totalProductsSubtotal.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                        </div>
                                        {couponValid && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-danger)' }}>
                                                <span>خصم الكوبون:</span>
                                                <span>-{currency} {orderDiscountAmount.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        {vatEnabled && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                                <span>ضريبة القيمة المضافة (14%):</span>
                                                <span>{currency} {vatAmount.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                            <span>مصاريف الشحن:</span>
                                            <span>+{currency} {shippingFeeVal.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                        </div>
                                        {deposit > 0 && (
                                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
                                                <span>عربون مستلم (Deposit):</span>
                                                <span>-{currency} {depositVal.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
                                            </div>
                                        )}
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 'bold', borderTop: '1px dashed var(--glass-border-hover)', paddingTop: '8px', marginTop: '4px', color: 'var(--gold-primary)' }}>
                                            <span>المتبقي للتحصيل:</span>
                                            <span>{currency} {remainingToCollect.toLocaleString('en-US', {maximumFractionDigits: 2})}</span>
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
                                            const sub = item.discountType === 'Percentage' ? (item.quantity * item.price * (1 - (item.discountPercent || 0) / 100)) : Math.max(0, (item.quantity * item.price) - (item.discountPercent || 0));
                                            return (
                                                <tr key={`review-item-${i}`} style={{ borderBottom: '1px solid var(--glass-bg-hover)' }}>
                                                    <td style={{ padding: '6px 4px' }}>{formatProductDisplayName(item.productName, item.variantName)}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>{item.quantity}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px' }}>{currency} {item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                    <td style={{ textAlign: 'center', padding: '6px 4px', color: 'var(--color-danger)' }}>{item.discountPercent > 0 ? (item.discountType === 'Percentage' ? `${item.discountPercent}%` : `${currency} ${item.discountPercent}`) : '-'}</td>
                                                    <td style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 'bold' }}>{currency} {sub.toLocaleString('en-US', {maximumFractionDigits: 2})}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                            
                            {!editOrderId && (
                                <div style={{ 
                                    marginTop: '16px',
                                    padding: '20px', 
                                    background: syncWithBosta ? 'rgba(227, 0, 15, 0.08)' : 'rgba(255,255,255,0.03)', 
                                    border: syncWithBosta ? '1px solid rgba(227, 0, 15, 0.3)' : '1px solid var(--glass-border)',
                                    borderRadius: '12px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    gap: '16px',
                                    transition: 'all 0.3s ease'
                                }}>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer' }} onClick={() => setSyncWithBosta(!syncWithBosta)}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                            <div style={{
                                                width: '44px',
                                                height: '44px',
                                                borderRadius: '10px',
                                                background: syncWithBosta ? '#E3000F' : 'rgba(255,255,255,0.1)',
                                                color: '#fff',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                transition: 'all 0.3s ease'
                                            }}>
                                                <svg viewBox="0 0 100 100" style={{ width: '26px', height: '26px', stroke: 'currentColor', strokeWidth: 9, fill: 'none', strokeLinejoin: 'round', strokeLinecap: 'round' }}>
                                                    <polygon points="50,10 90,32 90,68 50,90 10,68 10,32" />
                                                    <line x1="10" y1="32" x2="90" y2="68" />
                                                    <line x1="10" y1="68" x2="90" y2="32" />
                                                </svg>
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '16px', fontWeight: 'bold', color: syncWithBosta ? '#E3000F' : 'var(--text-primary)', transition: 'color 0.3s' }}>
                                                    بوسطة (Bosta)
                                                </div>
                                                <div style={{ fontSize: '13px', color: 'var(--text-secondary)', marginTop: '4px' }}>
                                                    إرسال الطلب لشركة الشحن تلقائياً عند التأكيد
                                                </div>
                                            </div>
                                        </div>

                                        <div style={{
                                            position: 'relative',
                                            display: 'inline-block',
                                            width: '44px',
                                            height: '24px',
                                            background: syncWithBosta ? '#E3000F' : 'rgba(255,255,255,0.2)',
                                            borderRadius: '12px',
                                            transition: '0.3s',
                                        }}>
                                            <div style={{
                                                position: 'absolute',
                                                top: '2px',
                                                left: syncWithBosta ? '22px' : '2px',
                                                width: '20px',
                                                height: '20px',
                                                background: '#fff',
                                                borderRadius: '50%',
                                                transition: '0.3s',
                                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                                            }} />
                                        </div>
                                    </div>
                                    
                                    {syncWithBosta && (
                                        <div style={{ 
                                            display: 'flex', 
                                            alignItems: 'center', 
                                            gap: '12px', 
                                            padding: '12px', 
                                            background: 'rgba(0,0,0,0.15)', 
                                            borderRadius: '8px',
                                            marginTop: '4px',
                                            cursor: 'pointer'
                                        }} onClick={(e) => { e.stopPropagation(); setAllowToOpenPackage(!allowToOpenPackage); }}>
                                            <div style={{
                                                width: '20px',
                                                height: '20px',
                                                borderRadius: '4px',
                                                border: allowToOpenPackage ? 'none' : '2px solid var(--glass-border-hover)',
                                                background: allowToOpenPackage ? '#E3000F' : 'transparent',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: '#fff',
                                                transition: '0.2s'
                                            }}>
                                                {allowToOpenPackage && <i className="fa-solid fa-check" style={{ fontSize: '12px' }}></i>}
                                            </div>
                                            <div style={{ fontSize: '14px', color: '#fff', userSelect: 'none' }}>
                                                السماح للعميل بفتح الشحنة
                                                <span style={{ color: 'var(--text-muted)', fontSize: '12px', marginLeft: '6px' }}>(Allow to open package)</span>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            )}

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
                            <button type="button" className="btn btn-secondary" onClick={handleRequestClose}>
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
                                onClick={() => {
                                    if (step === 1 && !isStep1Valid) {
                                        showToast("يرجى استكمال بيانات العميل ورقم الهاتف والمحافظة والعنوان أولاً", "warning");
                                        return;
                                    }
                                    if (step === 2 && !isStep2Valid) {
                                        const hasZeroStock = items.some(i => i.variantSku && (i.maxStock || 0) <= 0);
                                        if (hasZeroStock) {
                                            showToast("لا يمكن المتابعة: يوجد منتج مختار غير متوفر في المخزن (الاستوك صفر)", "error");
                                        } else {
                                            showToast("يرجى اختيار منتجات صالحة ومتوفرة في المخزن أولاً", "warning");
                                        }
                                        return;
                                    }
                                    if (step === 3 && !isStep3Valid) {
                                        showToast("يرجى تحديد مبلغ وسعر الشحن الزامي أولاً للمتابعة", "warning");
                                        return;
                                    }
                                    setStep(prev => prev + 1);
                                }}
                                disabled={
                                    (step === 1 && !isStep1Valid) ||
                                    (step === 2 && !isStep2Valid) ||
                                    (step === 3 && !isStep3Valid)
                                }
                                style={{
                                    opacity: ((step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)) ? 0.5 : 1,
                                    cursor: ((step === 1 && !isStep1Valid) || (step === 2 && !isStep2Valid) || (step === 3 && !isStep3Valid)) ? 'not-allowed' : 'pointer'
                                }}
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
