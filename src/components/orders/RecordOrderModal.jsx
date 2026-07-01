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

export default function RecordOrderModal({ isOpen, onClose }) {
    const { state, addOrder, showToast, t } = useContext(AppContext);
    
    const [client, setClient] = useState('');
    const [warehouse, setWarehouse] = useState('Sulur');
    const [status, setStatus] = useState('Draft');
    const [address, setAddress] = useState('');
    const [governorate, setGovernorate] = useState('');
    const [shippingFee, setShippingFee] = useState(0);
    const [deposit, setDeposit] = useState(0);
    const [items, setItems] = useState([
        { category: '', variantSku: '', quantity: 1, price: 0, maxStock: 0, searchVal: '', isOpen: false }
    ]);

    const currency = state.storeSettings.currency || '$';

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setClient('');
            setWarehouse('Sulur');
            setStatus('Draft');
            setAddress('');
            setGovernorate('');
            setShippingFee(0);
            setDeposit(0);
            setItems([{ category: '', variantSku: '', quantity: 1, price: 0, maxStock: 0, searchVal: '', isOpen: false }]);
        }
    }, [isOpen]);

    // Handle warehouse change (re-adjust max quantities based on warehouse stock)
    useEffect(() => {
        setItems(prev => prev.map(item => {
            if (!item.variantSku) return item;
            const stockQty = getStockQty(item.variantSku, warehouse);
            return {
                ...item,
                maxStock: stockQty,
                quantity: Math.min(item.quantity, stockQty) || 1
            };
        }));
    }, [warehouse]);

    // Helper to find stock for a SKU in a warehouse
    const getStockQty = (sku, wh) => {
        let stock = 0;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) stock = v.stock[wh] || 0;
        });
        return stock;
    };

    const handleAddItem = () => {
        setItems(prev => [...prev, { category: '', variantSku: '', quantity: 1, price: 0, maxStock: 0, searchVal: '', isOpen: false }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemCategoryChange = (index, cat) => {
        setItems(prev => prev.map((item, i) => i === index ? {
            ...item,
            category: cat,
            variantSku: '',
            price: 0,
            maxStock: 0,
            searchVal: '',
            isOpen: false
        } : item));
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
            searchVal: `${variant.productName} | ${variant.name}`,
            isOpen: false
        } : item));
    };

    const handleQtyChange = (index, val) => {
        const qty = parseInt(val) || 1;
        const maxStock = items[index].maxStock;
        
        if (qty > maxStock) {
            showToast(`Selected quantity exceeds available branch stock (${maxStock} units max)`, "warning");
            setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: maxStock } : item));
        } else {
            setItems(prev => prev.map((item, i) => i === index ? { ...item, quantity: qty } : item));
        }
    };

    const handleGovernorateChange = (gov) => {
        setGovernorate(gov);
        const fee = shippingFees[gov] || 0;
        setShippingFee(fee);
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!client) {
            alert("Please enter a client name.");
            return;
        }

        let orderItems = [];
        let totalValue = 0;
        let hasError = false;

        items.forEach(item => {
            if (!item.variantSku || item.quantity <= 0) {
                alert("Ensure all items are selected with valid quantities.");
                hasError = true;
                return;
            }
            orderItems.push({
                variantSku: item.variantSku,
                quantity: item.quantity,
                price: item.price
            });
            totalValue += item.quantity * item.price;
        });

        if (hasError) return;

        const orderId = `ORD-${Math.floor(1000 + Math.random() * 9000)}`;
        const newOrderObj = {
            id: orderId,
            client,
            date: getLocalDateString(),
            items: orderItems,
            totalValue: totalValue + shippingFee - deposit,
            warehouse,
            status,
            address,
            governorate,
            shipping_fee: shippingFee,
            deposit,
            createdBy: state.currentUser ? state.currentUser.name : 'sfsf'
        };

        addOrder(newOrderObj);
        onClose();
    };

    // Calculate total order value for display
    const totalOrderVal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    // Dynamic categories calculation for items filtering
    const categories = ['الكل', ...new Set((state.products || []).map(p => p.category))].filter(Boolean);

    // Filter variants based on row category and row search value
    const getRowOptions = (item) => {
        const list = [];
        (state.products || []).forEach(p => {
            if (item.category && item.category !== 'الكل' && p.category !== item.category) return;
            (p.variants || []).forEach(v => {
                const stock = v.stock[warehouse] || 0;
                if (stock <= 0) return;
                
                const productName = p.name;
                const variantName = v.name;
                
                // Search match
                const search = (item.searchVal || '').toLowerCase();
                const matchesSearch = !search || 
                    productName.toLowerCase().includes(search) || 
                    variantName.toLowerCase().includes(search) ||
                    (item.variantSku && search === `${productName} | ${variantName}`.toLowerCase());

                if (matchesSearch) {
                    list.push({
                        sku: v.sku,
                        name: variantName,
                        productName: productName,
                        retailPrice: v.retailPrice,
                        stock
                    });
                }
            });
        });
        return list;
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('recordOrder')} width="1150px">
            <form onSubmit={handleSubmit}>
                <div className="form-row">
                    <div className="form-group">
                        <label className="form-label">{t('customerName')} *</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={client}
                            onChange={(e) => setClient(e.target.value)}
                            placeholder="e.g. Acme Corp" 
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('orderStatus')} *</label>
                        <select 
                            className="form-select" 
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            required
                        >
                            <option value="Draft">{t('draft')}</option>
                            <option value="Paid">{t('paid')}</option>
                            <option value="Partially Delivered">{t('partiallydelivered')}</option>
                            <option value="Completed">{t('completed')}</option>
                        </select>
                    </div>
                </div>

                <div className="form-row">
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
                    <div className="form-group">
                        <label className="form-label">سعر الشحن ({currency}) *</label>
                        <input 
                            type="number" 
                            className="form-input" 
                            value={shippingFee}
                            onChange={(e) => setShippingFee(parseFloat(e.target.value) || 0)}
                            required 
                            min="0"
                        />
                    </div>
                </div>

                <div className="form-row">
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
                    <div className="form-group">
                        <label className="form-label">العربون المستلم (Deposit) ({currency})</label>
                        <input 
                            type="number" 
                            className="form-input" 
                            value={deposit}
                            onChange={(e) => setDeposit(parseFloat(e.target.value) || 0)}
                            placeholder="0.00" 
                            min="0"
                        />
                    </div>
                </div>

                {/* Items rows list */}
                <div style={{ marginTop: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                        <h4 style={{ fontSize: '15px' }}>{t('orderedItems')}</h4>
                        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '12px' }} onClick={handleAddItem}>
                            <i className="fa-solid fa-plus"></i> {t('addItem')}
                        </button>
                    </div>
                    <div className="variants-creator-box">
                        {items.map((item, idx) => (
                            <div key={`order-item-${idx}`} className="variant-row-item" style={{ gridTemplateColumns: '1.2fr 2fr 1fr 1fr auto', gap: '8px', position: 'relative', marginBottom: '12px' }}>
                                
                                {/* Category Dropdown Filter */}
                                <select 
                                    className="form-select" 
                                    value={item.category || 'الكل'}
                                    onChange={(e) => handleItemCategoryChange(idx, e.target.value)}
                                    title="تصفية حسب القسم"
                                >
                                    {categories.map(cat => (
                                        <option key={cat} value={cat}>{cat}</option>
                                    ))}
                                </select>

                                {/* Searchable Autocomplete Product Select */}
                                <div style={{ position: 'relative' }}>
                                    <input 
                                        type="text" 
                                        className="form-input"
                                        placeholder="ابحث عن منتج..."
                                        value={item.searchVal || ''}
                                        onChange={(e) => handleItemSearchChange(idx, e.target.value)}
                                        onFocus={() => setItems(prev => prev.map((it, i) => i === idx ? { ...it, isOpen: true } : it))}
                                        onBlur={() => {
                                            setTimeout(() => {
                                                setItems(prev => prev.map((it, i) => i === idx ? { ...it, isOpen: false } : it));
                                            }, 200);
                                        }}
                                        required
                                        style={{ background: 'rgba(255,255,255,0.02)', borderColor: item.variantSku ? 'var(--color-success)' : 'var(--glass-border)' }}
                                    />
                                    {item.isOpen && (
                                        <div className="glass-card" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            maxHeight: '180px',
                                            overflowY: 'auto',
                                            zIndex: 1000,
                                            background: 'rgba(30, 30, 40, 0.99)',
                                            border: '1px solid var(--glass-border)',
                                            borderRadius: '8px',
                                            boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
                                            padding: '4px'
                                        }}>
                                            {getRowOptions(item).length === 0 ? (
                                                <div style={{ padding: '8px 12px', fontSize: '11px', color: 'var(--text-muted)' }}>لا توجد خيارات مطابقة</div>
                                            ) : (
                                                getRowOptions(item).map(opt => (
                                                    <div 
                                                        key={opt.sku}
                                                        onMouseDown={() => handleSelectOption(idx, opt)}
                                                        style={{
                                                            padding: '8px 12px',
                                                            fontSize: '11px',
                                                            cursor: 'pointer',
                                                            borderBottom: '1px solid rgba(255,255,255,0.03)',
                                                            display: 'flex',
                                                            justifyContent: 'space-between',
                                                            alignItems: 'center',
                                                            color: '#fff',
                                                            borderRadius: '4px',
                                                            transition: 'background 0.2s'
                                                        }}
                                                        className="autocomplete-option"
                                                    >
                                                        <span style={{ fontWeight: 500 }}>{opt.productName} <span style={{ color: 'var(--text-secondary)', fontSize: '10px' }}>({opt.name})</span></span>
                                                        <span style={{ color: 'var(--gold-primary)', fontSize: '10px', fontWeight: 600 }}>الرصيد: {opt.stock}</span>
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Price Output */}
                                <input 
                                    type="text" 
                                    className="form-input order-item-price" 
                                    value={item.variantSku ? `${currency}${item.price.toFixed(2)}` : ''} 
                                    placeholder={`${currency}0.00`} 
                                    readOnly 
                                />

                                {/* Quantity Input */}
                                <input 
                                    type="number" 
                                    className="form-input order-item-qty" 
                                    min="1" 
                                    max={item.maxStock || 1}
                                    value={item.quantity}
                                    onChange={(e) => handleQtyChange(idx, e.target.value)}
                                    required 
                                    placeholder="0" 
                                    disabled={!item.variantSku}
                                />

                                {/* Delete Row Button */}
                                <button 
                                    type="button" 
                                    className="action-btn-circle" 
                                    style={{ color: 'var(--color-danger)', borderColor: 'rgba(255,71,87,0.15)' }} 
                                    onClick={() => handleRemoveItem(idx)}
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Bottom summaries */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '24px', padding: '16px 0', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                        <span>إجمالي المنتجات:</span>
                        <span>{currency}{totalOrderVal.toFixed(2)}</span>
                    </div>
                    {shippingFee > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--text-secondary)' }}>
                            <span>مصاريف الشحن ({governorate}):</span>
                            <span>+{currency}{shippingFee.toFixed(2)}</span>
                        </div>
                    )}
                    {deposit > 0 && (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', color: 'var(--color-success)' }}>
                            <span>العربون المستلم (Deposit):</span>
                            <span>-{currency}{deposit.toFixed(2)}</span>
                        </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px', paddingTop: '8px', borderTop: '1px dashed var(--glass-border)' }}>
                        <div style={{ fontSize: '15px', fontWeight: 600 }}>
                            {t('orderTotal')} (المتبقي): <span style={{ color: 'var(--gold-primary)', fontSize: '18px' }}>{currency}{(totalOrderVal + shippingFee - deposit).toFixed(2)}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={onClose}>
                                {t('discard')}
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {t('saveChanges')}
                            </button>
                        </div>
                    </div>
                </div>
            </form>
        </Modal>
    );
}
