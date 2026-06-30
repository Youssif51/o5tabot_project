import React, { useContext, useState, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function AddProductModal({ isOpen, onClose, editProductId }) {
    const { state, addProduct, editProduct, t } = useContext(AppContext);

    // Form states
    const [name, setName] = useState('');
    const [productId, setProductId] = useState('');
    const [category, setCategory] = useState('Electronics');
    const [unit, setUnit] = useState('Piece');
    const [image, setImage] = useState('');
    
    // Multiple variants state (without SKU and Barcode input properties in UI)
    const [variants, setVariants] = useState([
        { name: 'Standard Option', sku: '', barcode: '', wholesalePrice: 50.00, retailPrice: 90.00, reorderLimit: 1, stockSulur: 10 }
    ]);

    useEffect(() => {
        if (editProductId) {
            const prod = state.products.find(p => p.id === editProductId);
            if (prod) {
                setName(prod.name);
                setProductId(prod.id);
                setCategory(prod.category);
                setUnit(prod.unit || 'Piece');
                setImage(prod.image || '');
                
                if (prod.variants && prod.variants.length > 0) {
                    setVariants(prod.variants.map(v => ({
                        name: v.name,
                        sku: v.sku,
                        barcode: v.barcode,
                        wholesalePrice: v.wholesalePrice,
                        retailPrice: v.retailPrice,
                        reorderLimit: v.reorderLimit,
                        stockSulur: v.stock.Sulur || 0
                    })));
                }
            }
        } else {
            // Reset to defaults with random product ID
            const randomId = Math.floor(100 + Math.random()*900);
            setName('');
            setProductId(`PROD-${randomId}`);
            setCategory('Electronics');
            setUnit(t('piece'));
            setImage('');
            setVariants([
                { 
                    name: 'Standard Option', 
                    sku: `OCT-SKU-${randomId}`, 
                    barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`, 
                    wholesalePrice: 50.00, 
                    retailPrice: 90.00, 
                    reorderLimit: 1, 
                    stockSulur: 10 
                }
            ]);
        }
    }, [editProductId, isOpen, t]);

    const handleAddVariantRow = () => {
        const index = variants.length + 1;
        setVariants([
            ...variants,
            { 
                name: `Option ${index}`, 
                sku: `OCT-SKU-${productId.replace('PROD-', '')}-${index}`, 
                barcode: `${Math.floor(100000000000 + Math.random() * 900000000000)}`, 
                wholesalePrice: 50.00, 
                retailPrice: 90.00, 
                reorderLimit: 1, 
                stockSulur: 0 
            }
        ]);
    };

    const handleRemoveVariantRow = (index) => {
        if (variants.length <= 1) return;
        setVariants(variants.filter((_, i) => i !== index));
    };

    const handleVariantChange = (index, field, value) => {
        setVariants(variants.map((v, i) => {
            if (i === index) {
                return { ...v, [field]: value };
            }
            return v;
        }));
    };

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                setImage(event.target.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handlePlaceholderClick = () => {
        document.getElementById('product-image-uploader-input').click();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !productId) {
            alert("Product Name and Product ID are required.");
            return;
        }

        // Auto-generate SKUs and Barcodes internally
        const mappedVariants = variants.map((v, idx) => {
            const cleanId = productId.replace('PROD-', '').replace(/[^a-zA-Z0-9]/g, '');
            const generatedSku = v.sku || `SKU-${cleanId}-${idx + 1}`;
            const generatedBarcode = v.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
            return {
                sku: generatedSku,
                name: v.name || 'Standard Option',
                barcode: generatedBarcode,
                wholesalePrice: parseFloat(v.wholesalePrice) || 0,
                retailPrice: parseFloat(v.retailPrice) || 0,
                reorderLimit: parseInt(v.reorderLimit) || 0,
                stock: {
                    Sulur: parseInt(v.stockSulur) || 0,
                    Singanallur: 0
                }
            };
        });

        // Expiry Date is set to far future so it never triggers alerts
        const mappedBatches = [];
        mappedVariants.forEach((v, idx) => {
            const totalQty = v.stock.Sulur;
            if (totalQty > 0) {
                mappedBatches.push({
                    batchId: `B-${v.sku.substring(0, 8).replace(/[^a-zA-Z0-9]/g, '')}-${idx}`,
                    variantSku: v.sku,
                    expiryDate: '2099-12-31',
                    quantity: totalQty,
                    warehouse: 'Sulur'
                });
            }
        });

        const originalProduct = editProductId ? state.products.find(p => p.id === editProductId) : null;
        const productObj = {
            id: productId,
            name,
            category,
            unit,
            image,
            createdDate: originalProduct ? (originalProduct.createdDate || new Date().toISOString().substring(0, 10)) : new Date().toISOString().substring(0, 10),
            description: `${name} catalog entry, unit size ${unit}.`,
            variants: mappedVariants,
            batches: mappedBatches,
            suppliers: ["SUP-01"]
        };

        if (editProductId) {
            editProduct(productObj);
        } else {
            addProduct(productObj);
        }
        onClose();
    };

    return (
        <Modal 
            isOpen={isOpen} 
            onClose={onClose} 
            title={editProductId ? t('editProduct') : t('newProduct')}
            width="1150px"
        >
            <form onSubmit={handleSubmit}>
                
                {/* Image Uploader Input & Place Holder */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '10px 0 24px 0' }}>
                    <input 
                        type="file" 
                        id="product-image-uploader-input" 
                        accept="image/*" 
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                    <div 
                        onClick={handlePlaceholderClick}
                        style={{
                            width: '90px',
                            height: '90px',
                            border: image ? 'none' : '2px dashed rgba(255, 255, 255, 0.15)',
                            borderRadius: '8px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            background: 'rgba(255, 255, 255, 0.01)',
                            cursor: 'pointer',
                            overflow: 'hidden',
                            position: 'relative'
                        }} 
                        className="image-upload-dashed"
                        title="Upload Product Photo"
                    >
                        {image ? (
                            <img src={image} alt="Upload preview" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        ) : (
                            <i className="fa-regular fa-image" style={{ fontSize: '24px', color: 'var(--text-muted)' }}></i>
                        )}
                        <div style={{
                            position: 'absolute',
                            bottom: 0,
                            left: 0,
                            right: 0,
                            background: 'rgba(0,0,0,0.5)',
                            color: '#fff',
                            fontSize: '9px',
                            padding: '2px 0',
                            textAlign: 'center',
                            opacity: 0,
                            transition: 'opacity 0.2s'
                        }} className="image-upload-hover-label">
                            {t('edit')}
                        </div>
                    </div>
                </div>

                {/* Primary details grid */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">{t('productName')}</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('productId')}</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={productId}
                            onChange={(e) => setProductId(e.target.value)}
                            required 
                            disabled={!!editProductId}
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">{t('categories')}</label>
                        <select 
                            className="form-select" 
                            value={category}
                            onChange={(e) => setCategory(e.target.value)}
                            required
                        >
                            <option value="Electronics">{t('electronics')}</option>
                            <option value="Mobile Accessories">{t('mobileAccessories')}</option>
                            <option value="Accessories">{t('accessories')}</option>
                        </select>
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '16px', marginBottom: '20px' }}>
                    <div className="form-group">
                        <label className="form-label">{t('unit')}</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={unit}
                            onChange={(e) => setUnit(e.target.value)}
                            required 
                        />
                    </div>
                </div>

                {/* Multiple Variants Builder Table */}
                <div style={{ marginBottom: '20px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h4 style={{ margin: 0, color: '#fff', fontSize: '14px' }}>{t('productVariants')}</h4>
                        <button type="button" className="btn btn-secondary" onClick={handleAddVariantRow} style={{ padding: '4px 10px', fontSize: '12px' }}>
                            <i className="fa-solid fa-plus" style={{ marginRight: '6px' }}></i> {t('addVariantOption')}
                        </button>
                    </div>

                    <div style={{ overflowX: 'auto', border: '1px solid var(--glass-border)', borderRadius: '8px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '11px', textAlign: 'left' }}>
                            <thead>
                                <tr style={{ background: 'rgba(255,255,255,0.02)', borderBottom: '1px solid var(--glass-border)' }}>
                                    <th style={{ padding: '8px' }}>{t('optionName')}</th>
                                    <th style={{ padding: '8px' }}>{t('wholesalePrice')}</th>
                                    <th style={{ padding: '8px' }}>{t('retailPrice')}</th>
                                    <th style={{ padding: '8px' }}>{t('limit')}</th>
                                    <th style={{ padding: '8px' }}>{t('stock')}</th>
                                    <th style={{ padding: '8px', textAlign: 'center' }}>{t('actions')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {variants.map((v, idx) => (
                                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
                                        <td style={{ padding: '6px' }}>
                                            <input type="text" className="form-input" style={{ padding: '4px', fontSize: '11px' }} value={v.name} onChange={(e) => handleVariantChange(idx, 'name', e.target.value)} required />
                                        </td>
                                        <td style={{ padding: '6px', width: '120px' }}>
                                            <input type="number" step="0.01" className="form-input" style={{ padding: '4px', fontSize: '11px' }} value={v.wholesalePrice} onChange={(e) => handleVariantChange(idx, 'wholesalePrice', parseFloat(e.target.value) || 0)} required />
                                        </td>
                                        <td style={{ padding: '6px', width: '120px' }}>
                                            <input type="number" step="0.01" className="form-input" style={{ padding: '4px', fontSize: '11px' }} value={v.retailPrice} onChange={(e) => handleVariantChange(idx, 'retailPrice', parseFloat(e.target.value) || 0)} required />
                                        </td>
                                        <td style={{ padding: '6px', width: '100px' }}>
                                            <input type="number" className="form-input" style={{ padding: '4px', fontSize: '11px' }} value={v.reorderLimit} onChange={(e) => handleVariantChange(idx, 'reorderLimit', parseInt(e.target.value) || 0)} required />
                                        </td>
                                        <td style={{ padding: '6px', width: '120px' }}>
                                            <input type="number" className="form-input" style={{ padding: '4px', fontSize: '11px' }} value={v.stockSulur} onChange={(e) => handleVariantChange(idx, 'stockSulur', parseInt(e.target.value) || 0)} required />
                                        </td>
                                        <td style={{ padding: '6px', textAlign: 'center', width: '80px' }}>
                                            <button 
                                                type="button" 
                                                className="action-btn-circle" 
                                                onClick={() => handleRemoveVariantRow(idx)}
                                                disabled={variants.length <= 1}
                                                style={{ border: 'none', background: 'rgba(255,75,75,0.1)', color: 'var(--color-danger)', width: '24px', height: '24px' }}
                                            >
                                                <i className="fa-solid fa-trash" style={{ fontSize: '10px' }}></i>
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '28px', borderTop: '1px solid var(--glass-border)', paddingTop: '20px' }}>
                    <button 
                        type="button" 
                        className="btn btn-secondary" 
                        onClick={onClose}
                        style={{ padding: '8px 20px', fontSize: '13px' }}
                    >
                        {t('discard')}
                    </button>
                    <button 
                        type="submit" 
                        className="btn btn-primary"
                        style={{ padding: '8px 20px', fontSize: '13px' }}
                    >
                        {editProductId ? t('saveChanges') : t('addProduct')}
                    </button>
                </div>
            </form>
        </Modal>
    );
}
