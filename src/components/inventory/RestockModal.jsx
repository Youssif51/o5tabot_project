import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function RestockModal({ isOpen, onClose, product, variant }) {
    const { restockVariant, t } = useContext(AppContext);
    
    const [quantity, setQuantity] = useState('');
    const [unitCost, setUnitCost] = useState('');
    const [notes, setNotes] = useState('');
    
    // Derived states for calculation
    const [newAvgCost, setNewAvgCost] = useState(0);
    
    useEffect(() => {
        if (isOpen && variant) {
            setQuantity('');
            setUnitCost(variant.averageCost || variant.wholesalePrice || '');
            setNotes('');
        }
    }, [isOpen, variant]);
    
    useEffect(() => {
        if (!variant) return;
        
        const currentQty = variant.stock?.Sulur || 0;
        const currentAvgCost = variant.averageCost || variant.wholesalePrice || 0;
        
        const addedQty = parseInt(quantity) || 0;
        const newCost = parseFloat(unitCost) || 0;
        
        const totalNewQty = currentQty + addedQty;
        
        if (totalNewQty > 0) {
            const calculated = ((currentQty * currentAvgCost) + (addedQty * newCost)) / totalNewQty;
            setNewAvgCost(calculated);
        } else {
            setNewAvgCost(currentAvgCost);
        }
    }, [quantity, unitCost, variant]);

    if (!isOpen || !variant || !product) return null;

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!quantity || parseInt(quantity) <= 0) {
            alert("Please enter a valid quantity.");
            return;
        }
        if (!unitCost || parseFloat(unitCost) < 0) {
            alert("Please enter a valid cost.");
            return;
        }
        
        restockVariant(product.id, variant.sku, quantity, unitCost, 'Sulur', notes);
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="إضافة مخزون جديد (Restock)" width="500px">
            <p style={{ color: '#aaa', marginBottom: '15px' }}>
                منتج: <strong style={{ color: '#fff' }}>{product.name}</strong><br/>
                النوع: <strong style={{ color: '#fff' }}>{variant.name}</strong>
            </p>
            
            <form onSubmit={handleSubmit}>
                <div className="form-group">
                    <label className="form-label">الكمية المضافة (Quantity Added)</label>
                    <input 
                        type="number" 
                        className="form-input" 
                        value={quantity} 
                        onChange={(e) => setQuantity(e.target.value)}
                        placeholder="مثال: 50"
                        required
                        min="1"
                    />
                </div>
                
                <div className="form-group">
                    <label className="form-label">تكلفة القطعة في هذه الطلبية (Unit Cost for this batch)</label>
                    <input 
                        type="number" 
                        className="form-input" 
                        value={unitCost} 
                        onChange={(e) => setUnitCost(e.target.value)}
                        placeholder="مثال: 60"
                        required
                        min="0"
                        step="0.01"
                    />
                </div>

                <div className="form-group">
                    <label className="form-label">ملاحظات (Notes - اختياري)</label>
                    <input 
                        type="text" 
                        className="form-input" 
                        value={notes} 
                        onChange={(e) => setNotes(e.target.value)}
                        placeholder="مثال: دفعة شهر 7، مورد كذا..."
                    />
                </div>

                <div style={{ background: 'rgba(255,255,255,0.05)', padding: '15px', borderRadius: '8px', marginTop: '20px' }}>
                    <h4 style={{ marginBottom: '10px', fontSize: '14px', color: '#4a90e2' }}><i className="fa-solid fa-calculator"></i> معاينة التكلفة الجديدة</h4>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ color: '#aaa' }}>المخزون الحالي:</span>
                        <span>{variant.stock?.Sulur || 0}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '5px' }}>
                        <span style={{ color: '#aaa' }}>متوسط التكلفة القديم:</span>
                        <span>{(variant.averageCost || variant.wholesalePrice || 0).toFixed(2)} ج.م</span>
                    </div>
                    <hr style={{ borderColor: 'rgba(255,255,255,0.1)', my: '10px' }} />
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold' }}>
                        <span style={{ color: '#4ae290' }}>متوسط التكلفة الجديد المتوقع:</span>
                        <span style={{ color: '#4ae290' }}>{newAvgCost.toFixed(2)} ج.م</span>
                    </div>
                </div>

                <div className="modal-actions" style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                    <button type="button" className="btn btn-secondary" onClick={onClose}>{t('cancel')}</button>
                    <button type="submit" className="btn btn-primary"><i className="fa-solid fa-plus"></i> تأكيد وإضافة المخزون</button>
                </div>
            </form>
        </Modal>
    );
}
