import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function RecordOrderModal({ isOpen, onClose }) {
    const { state, addOrder, showToast, t } = useContext(AppContext);
    
    const [client, setClient] = useState('');
    const [warehouse, setWarehouse] = useState('Sulur');
    const [status, setStatus] = useState('Draft');
    const [items, setItems] = useState([
        { variantSku: '', quantity: 1, price: 0, maxStock: 0 }
    ]);

    const currency = state.storeSettings.currency || '$';

    // Reset form on open
    useEffect(() => {
        if (isOpen) {
            setClient('');
            setWarehouse('Sulur');
            setStatus('Draft');
            setItems([{ variantSku: '', quantity: 1, price: 0, maxStock: 0 }]);
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
        setItems(prev => [...prev, { variantSku: '', quantity: 1, price: 0, maxStock: 0 }]);
    };

    const handleRemoveItem = (index) => {
        if (items.length <= 1) return;
        setItems(prev => prev.filter((_, i) => i !== index));
    };

    const handleItemChange = (index, sku) => {
        if (!sku) {
            setItems(prev => prev.map((item, i) => i === index ? { variantSku: '', quantity: 1, price: 0, maxStock: 0 } : item));
            return;
        }

        // Get retail price and stock
        let price = 0;
        state.products.forEach(p => {
            const v = p.variants.find(vr => vr.sku === sku);
            if (v) price = v.retailPrice;
        });

        const stock = getStockQty(sku, warehouse);

        setItems(prev => prev.map((item, i) => i === index ? {
            variantSku: sku,
            price,
            maxStock: stock,
            quantity: 1
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
            date: new Date().toISOString().substring(0, 10),
            items: orderItems,
            totalValue,
            warehouse,
            status
        };

        addOrder(newOrderObj);
        onClose();
    };

    // Calculate total order value for display
    const totalOrderVal = items.reduce((sum, item) => sum + (item.quantity * item.price), 0);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={t('recordOrder')}>
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">{t('customerName')}</label>
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
                    <label className="form-label">{t('orderStatus')}</label>
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
                            <div key={`order-item-${idx}`} className="variant-row-item" style={{ gridTemplateColumns: '3fr 1.5fr 1.5fr auto' }}>
                                <select 
                                    className="form-select order-item-var-select" 
                                    value={item.variantSku}
                                    onChange={(e) => handleItemChange(idx, e.target.value)}
                                    required
                                >
                                    <option value="">{t('chooseVariant')}</option>
                                    {state.products.map(p => 
                                        p.variants.map(v => {
                                            const stock = v.stock[warehouse] || 0;
                                            if (stock <= 0) return null;
                                            return (
                                                <option key={v.sku} value={v.sku}>
                                                    {p.name} - {v.name} ({t('quantity')}: {stock})
                                                </option>
                                            );
                                        })
                                    )}
                                </select>
                                <input 
                                    type="text" 
                                    className="form-input order-item-price" 
                                    value={item.variantSku ? `${currency}${item.price.toFixed(2)}` : ''} 
                                    placeholder={`${currency}0.00`} 
                                    readOnly 
                                />
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
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '24px', padding: '16px 0', borderTop: '1px solid var(--glass-border)' }}>
                    <div style={{ fontSize: '15px', fontWeight: 600 }}>
                        {t('orderTotal')}: <span style={{ color: 'var(--gold-primary)', fontSize: '18px' }}>{currency}{totalOrderVal.toFixed(2)}</span>
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
            </form>
        </Modal>
    );
}
