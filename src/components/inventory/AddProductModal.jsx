import React, { useContext, useState, useEffect } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';
import RichTextEditor from '../common/RichTextEditor';

export default function AddProductModal({ isOpen, onClose, editProductId }) {
    const { state, addProduct, editProduct, syncShopifyCollections, t, showAlert } = useContext(AppContext);

    // Form states
    const [shopifyCollectionIds, setShopifyCollectionIds] = useState([]);
    const [showCollectionDropdown, setShowCollectionDropdown] = useState(false);
    const [syncingCollections, setSyncingCollections] = useState(false);

    // Dynamic categories calculation
    const existingCategories = [...new Set((state.products || []).map(p => p.category))].filter(Boolean);
    const defaultCategories = ['Electronics', 'Mobile Accessories', 'Accessories'];
    const allCategories = [...new Set([...defaultCategories, ...existingCategories])];

    // Form states
    const [name, setName] = useState('');
    const [productId, setProductId] = useState('');
    const [category, setCategory] = useState('Electronics');
    const [unit, setUnit] = useState('Piece');
    const [images, setImages] = useState([]);
    const [vendor, setVendor] = useState('');
    const [tags, setTags] = useState('');
    const [description, setDescription] = useState('');
    const [status, setStatus] = useState('active');
    
    // Dynamic category addition states
    const [showNewCategoryInput, setShowNewCategoryInput] = useState(false);
    const [newCategoryName, setNewCategoryName] = useState('');
    
    // Multiple variants state (without SKU and Barcode input properties in UI)
    const [hasVariants, setHasVariants] = useState(false);
    const [variants, setVariants] = useState([
        { name: 'Standard Option', sku: '', barcode: '', wholesalePrice: 50.00, retailPrice: 90.00, reorderLimit: 1, stockSulur: 10 }
    ]);

    useEffect(() => {
        if (!isOpen) return;

        if (!state.collections || state.collections.length === 0) {
            syncShopifyCollections();
        }
        
        if (editProductId) {
            const prod = state.products.find(p => p.id === editProductId);
            if (prod) {
                setName(prod.name);
                setProductId(prod.id);
                setCategory(prod.category);
                setUnit(prod.unit || 'Piece');
                
                // Handle both old single image and new array
                if (prod.images && Array.isArray(prod.images) && prod.images.length > 0) {
                    setImages(prod.images.filter(img => img && img.startsWith && (img.startsWith('data:') || img.startsWith('http'))));
                } else if (prod.image && typeof prod.image === 'string') {
                    // Try to parse JSON array first
                    try {
                        const parsed = JSON.parse(prod.image);
                        if (Array.isArray(parsed) && parsed.length > 0) {
                            setImages(parsed.filter(img => img && img.startsWith && (img.startsWith('data:') || img.startsWith('http'))));
                        } else {
                            setImages([]);
                        }
                    } catch {
                        // Not JSON, check if it's a valid image string
                        if (prod.image.startsWith('data:') || prod.image.startsWith('http')) {
                            setImages([prod.image]);
                        } else {
                            setImages([]);
                        }
                    }
                } else {
                    setImages([]);
                }
                
                setVendor(prod.vendor || '');
                setTags(prod.tags || '');
                setDescription(prod.description || '');
                setStatus(prod.status || 'active');
                setShopifyCollectionIds(prod.shopifyCollectionIds || []);
                setShowNewCategoryInput(false);
                setNewCategoryName('');
                
                if (prod.variants && prod.variants.length > 0) {
                    setHasVariants(prod.variants.length > 1 || prod.variants[0].name !== 'Standard Option');
                    setVariants(prod.variants.map(v => ({
                        name: v.name,
                        sku: v.sku,
                        barcode: v.barcode,
                        wholesalePrice: v.wholesalePrice,
                        retailPrice: v.retailPrice,
                        reorderLimit: v.reorderLimit,
                        stockSulur: v.stock.Sulur || 0,
                        shopify_id: v.shopify_id
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
            setImages([]);
            setVendor('');
            setTags('');
            setDescription('');
            setStatus('active');
            setShopifyCollectionIds([]);
            setShowNewCategoryInput(false);
            setNewCategoryName('');
            setHasVariants(false);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [editProductId, isOpen]);

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
        const files = Array.from(e.target.files);
        if (files.length > 0) {
            files.forEach(file => {
                const reader = new FileReader();
                reader.onload = (event) => {
                    setImages(prev => [...prev, event.target.result]);
                };
                reader.readAsDataURL(file);
            });
        }
    };

    const [draggedIdx, setDraggedIdx] = useState(null);

    const handleRemoveImage = (indexToRemove) => {
        setImages(images.filter((_, idx) => idx !== indexToRemove));
    };

    const handleDragStart = (e, index) => {
        setDraggedIdx(index);
        e.dataTransfer.setData('text/plain', index);
        e.dataTransfer.effectAllowed = 'move';
    };

    const handleDragOver = (e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
    };

    const handleDrop = (e, targetIndex) => {
        e.preventDefault();
        const sourceIndex = parseInt(e.dataTransfer.getData('text/plain'), 10);
        if (isNaN(sourceIndex) || sourceIndex === targetIndex) {
            setDraggedIdx(null);
            return;
        }

        const newImages = [...images];
        const [movedImage] = newImages.splice(sourceIndex, 1);
        newImages.splice(targetIndex, 0, movedImage);
        setImages(newImages);
        setDraggedIdx(null);
    };

    const handleDragEnd = () => {
        setDraggedIdx(null);
    };

    const handleSyncCollections = async () => {
        setSyncingCollections(true);
        await syncShopifyCollections();
        setSyncingCollections(false);
    };

    const handlePlaceholderClick = () => {
        document.getElementById('product-image-uploader-input').click();
    };

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!name || !productId) {
            showAlert("اسم المنتج وكود المنتج مطلوبان لحفظ الصنف.");
            return;
        }

        // Auto-generate SKUs and Barcodes internally
        const mappedVariants = variants.map((v, idx) => {
            const cleanId = productId.replace('PROD-', '').replace(/[^a-zA-Z0-9]/g, '');
            const generatedSku = v.sku || `SKU-${cleanId}-${idx + 1}`;
            const generatedBarcode = v.barcode || `${Math.floor(100000000000 + Math.random() * 900000000000)}`;
            return {
                sku: generatedSku,
                name: hasVariants ? (v.name || 'Standard Option') : 'Standard Option',
                barcode: generatedBarcode,
                wholesalePrice: parseFloat(v.wholesalePrice) || 0,
                retailPrice: parseFloat(v.retailPrice) || 0,
                reorderLimit: parseInt(v.reorderLimit) || 0,
                shopify_id: v.shopify_id,
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
            images,
            vendor,
            tags,
            // Keep old image prop as stringified version for database backwards compatibility if needed
            image: JSON.stringify(images), 
            createdDate: originalProduct ? (originalProduct.createdDate || getLocalDateString()) : getLocalDateString(),
            createdBy: originalProduct ? (originalProduct.createdBy || 'sfsf') : (state.currentUser ? state.currentUser.name : 'sfsf'),
            description: description,
            status: status,
            shopifyCollectionIds: shopifyCollectionIds,
            variants: mappedVariants,
            batches: mappedBatches,
            suppliers: originalProduct ? (originalProduct.suppliers || []) : [],
            shopify_id: originalProduct ? originalProduct.shopify_id : undefined
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
                
                {/* Multiple Images Uploader */}
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', margin: '10px 0 24px 0' }}>
                    <input 
                        type="file" 
                        id="product-image-uploader-input" 
                        accept="image/*" 
                        multiple
                        onChange={handleFileChange} 
                        style={{ display: 'none' }} 
                    />
                    
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', justifyContent: 'center', marginBottom: '10px' }}>
                        {images.map((imgSrc, idx) => (
                            <div 
                                key={idx} 
                                draggable
                                onDragStart={(e) => handleDragStart(e, idx)}
                                onDragOver={handleDragOver}
                                onDrop={(e) => handleDrop(e, idx)}
                                onDragEnd={handleDragEnd}
                                title="اسحب لتغيير ترتيب الصورة"
                                style={{ 
                                    position: 'relative', 
                                    width: '90px', 
                                    height: '90px', 
                                    borderRadius: '8px', 
                                    overflow: 'hidden',
                                    cursor: 'grab',
                                    opacity: draggedIdx === idx ? 0.4 : 1,
                                    border: idx === 0 ? '2px solid var(--gold-primary, #d4af37)' : '1px solid rgba(255, 255, 255, 0.1)',
                                    transition: 'all 0.2s ease',
                                    boxShadow: idx === 0 ? '0 0 10px rgba(212, 175, 55, 0.3)' : 'none'
                                }}
                            >
                                <img src={imgSrc} alt={`Preview ${idx}`} style={{ width: '100%', height: '100%', objectFit: 'cover', pointerEvents: 'none' }} />
                                {idx === 0 && (
                                    <div style={{
                                        position: 'absolute', bottom: '0', left: '0', right: '0',
                                        background: 'rgba(212, 175, 55, 0.85)', color: '#000',
                                        fontSize: '9px', fontWeight: 'bold', textAlign: 'center', padding: '2px 0'
                                    }}>
                                        الرئيسية
                                    </div>
                                )}
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); handleRemoveImage(idx); }}
                                    style={{
                                        position: 'absolute', top: '4px', right: '4px', background: 'rgba(255,0,0,0.8)', color: 'white',
                                        border: 'none', borderRadius: '50%', width: '20px', height: '20px', display: 'flex',
                                        alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '10px',
                                        zIndex: 2
                                    }}
                                >
                                    <i className="fa-solid fa-times"></i>
                                </button>
                            </div>
                        ))}
                        
                        <div 
                            onClick={handlePlaceholderClick}
                            style={{
                                width: '90px',
                                height: '90px',
                                border: '2px dashed rgba(255, 255, 255, 0.15)',
                                borderRadius: '8px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                background: 'rgba(255, 255, 255, 0.01)',
                                cursor: 'pointer',
                                transition: 'background 0.2s'
                            }} 
                            title="Upload Product Photos"
                        >
                            <i className="fa-solid fa-plus" style={{ fontSize: '24px', color: 'var(--text-muted)' }}></i>
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
                            value={showNewCategoryInput ? 'NEW_CATEGORY' : category}
                            onChange={(e) => {
                                const val = e.target.value;
                                if (val === 'NEW_CATEGORY') {
                                    setShowNewCategoryInput(true);
                                    setCategory('');
                                } else {
                                    setShowNewCategoryInput(false);
                                    setCategory(val);
                                }
                            }}
                            required
                        >
                            {allCategories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                            <option value="NEW_CATEGORY" style={{ color: 'var(--gold-primary)', fontWeight: 600 }}>+ إضافة قسم جديد...</option>
                        </select>
                        
                        {showNewCategoryInput && (
                            <div style={{ marginTop: '10px' }}>
                                <input 
                                    type="text" 
                                    className="form-input" 
                                    value={newCategoryName} 
                                    onChange={(e) => {
                                        setNewCategoryName(e.target.value);
                                        setCategory(e.target.value);
                                    }} 
                                    placeholder="مثال: ملابس، عطور..."
                                    required
                                    style={{ border: '1px solid var(--gold-border-focus)' }}
                                />
                            </div>
                        )}
                    </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
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
                    <div className="form-group">
                        <label className="form-label">الماركة (Vendor)</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={vendor}
                            onChange={(e) => setVendor(e.target.value)}
                            placeholder="مثال: Sarafox"
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">كلمات مفتاحية (Tags)</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={tags}
                            onChange={(e) => setTags(e.target.value)}
                            placeholder="صيفي, عرض, جديد..."
                        />
                    </div>
                    <div className="form-group">
                        <label className="form-label">الحالة (Status)</label>
                        <select 
                            className="form-select"
                            value={status}
                            onChange={(e) => setStatus(e.target.value)}
                            style={{ height: '38px', padding: '0 10px' }}
                        >
                            <option value="active" style={{ background: '#1d1d21', color: '#fff' }}>Active</option>
                            <option value="draft" style={{ background: '#1d1d21', color: '#fff' }}>Draft</option>
                            <option value="archived" style={{ background: '#1d1d21', color: '#fff' }}>Unlisted / Archived</option>
                        </select>
                    </div>
                    
                    <div className="form-group" style={{ gridColumn: 'span 2' }}>
                        <label className="form-label" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span>مجموعة شوبيفاي (Shopify Collection)</span>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={handleSyncCollections}
                                disabled={syncingCollections}
                                style={{ padding: '2px 8px', fontSize: '11px', height: '24px', display: 'flex', alignItems: 'center', gap: '4px', border: 'none', background: 'rgba(255,255,255,0.05)' }}
                            >
                                <i className={`fa-solid fa-arrows-rotate ${syncingCollections ? 'fa-spin' : ''}`}></i>
                                {syncingCollections ? 'جاري التحديث...' : 'تحديث المجموعات 🔄'}
                            </button>
                        </label>
                        <div className="multi-select-dropdown" style={{ position: 'relative' }}>
                            <div className="form-select" style={{ minHeight: '38px', padding: '5px 10px', height: 'auto', display: 'flex', flexWrap: 'wrap', gap: '5px', cursor: 'pointer', background: 'transparent', border: '1px solid #333' }} onClick={() => setShowCollectionDropdown(!showCollectionDropdown)}>
                                {shopifyCollectionIds.length === 0 ? <span style={{ color: '#aaa', padding: '4px 0' }}>لا يوجد كوليكشن (None)</span> : 
                                    shopifyCollectionIds.map(id => {
                                        const col = (state.collections || []).find(c => String(c.id) === String(id));
                                        return col ? <span key={id} style={{ background: 'rgba(46, 122, 243, 0.2)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', display: 'flex', alignItems: 'center' }}>{col.title}</span> : null;
                                    })
                                }
                            </div>
                            {showCollectionDropdown && (
                                <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: '#1d1d21', border: '1px solid #333', zIndex: 100, maxHeight: '200px', overflowY: 'auto', borderRadius: '4px', marginTop: '4px', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }}>
                                    {(state.collections || []).map(col => (
                                        <div key={col.id} style={{ padding: '8px 10px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', borderBottom: '1px solid #2a2a2a' }} onClick={() => {
                                            if (shopifyCollectionIds.includes(String(col.id))) {
                                                setShopifyCollectionIds(shopifyCollectionIds.filter(id => id !== String(col.id)));
                                            } else {
                                                setShopifyCollectionIds([...shopifyCollectionIds, String(col.id)]);
                                            }
                                        }}>
                                            <input type="checkbox" checked={shopifyCollectionIds.includes(String(col.id))} readOnly style={{ cursor: 'pointer' }} />
                                            <span>{col.title} <small style={{color: '#888'}}>({col.type === 'smart' ? 'ذكي' : 'عادي'})</small></span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <div className="form-group" style={{ marginBottom: '20px' }}>
                    <label className="form-label">الوصف (Description)</label>
                    <RichTextEditor 
                        value={description}
                        onChange={setDescription}
                        placeholder="اكتب وصف المنتج هنا..."
                    />
                </div>

                {/* Toggle Variants */}
                <div style={{ marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <label className="ios-toggle" style={{ margin: 0 }}>
                        <input 
                            type="checkbox" 
                            checked={hasVariants}
                            onChange={(e) => setHasVariants(e.target.checked)}
                        />
                        <span className="ios-toggle-slider"></span>
                    </label>
                    <span style={{ fontSize: '14px', cursor: 'pointer' }} onClick={() => setHasVariants(!hasVariants)}>يوجد بدائل/خيارات متعددة لهذا المنتج (Variants)</span>
                </div>

                {hasVariants ? (
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
                ) : (
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '20px' }}>
                        <div className="form-group">
                            <label className="form-label">{t('wholesalePrice')}</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="form-input" 
                                value={variants[0].wholesalePrice} 
                                onChange={(e) => handleVariantChange(0, 'wholesalePrice', parseFloat(e.target.value) || 0)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('retailPrice')}</label>
                            <input 
                                type="number" 
                                step="0.01" 
                                className="form-input" 
                                value={variants[0].retailPrice} 
                                onChange={(e) => handleVariantChange(0, 'retailPrice', parseFloat(e.target.value) || 0)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('stock')}</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={variants[0].stockSulur} 
                                onChange={(e) => handleVariantChange(0, 'stockSulur', parseInt(e.target.value) || 0)} 
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('limit')}</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={variants[0].reorderLimit} 
                                onChange={(e) => handleVariantChange(0, 'reorderLimit', parseInt(e.target.value) || 0)} 
                                required 
                            />
                        </div>
                    </div>
                )}

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
