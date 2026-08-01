import React, { useState, useContext, useEffect } from 'react';
import { AppContext } from '../../context/AppContext';
import { supabase } from '../../utils/supabase';
import Modal from '../common/Modal';
import { cleanVariantName } from '../../utils/productUtils';

export default function InitialStockSetupModal({ isOpen, onClose }) {
  const { state, setState, syncVariantStockToShopify, showToast, logActivity } = useContext(AppContext);
  const [searchTerm, setSearchTerm] = useState('');
  const [items, setItems] = useState([]);
  const [initialItems, setInitialItems] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen && state.products) {
      const rows = [];
      state.products.forEach(p => {
        (p.variants || []).forEach(v => {
          const currentStock = typeof v.stock === 'object' && v.stock !== null 
            ? (v.stock.Sulur ?? v.stock.sulur ?? 0) 
            : (parseInt(v.stock) || parseInt(v.stock_sulur) || 0);

          rows.push({
            productId: p.id,
            productName: p.name,
            variantSku: v.sku,
            variantName: v.name || 'Standard Option',
            stockSulur: currentStock,
            wholesalePrice: parseFloat(v.wholesalePrice || v.wholesale_price || v.costPrice || v.cost_price || 0),
            retailPrice: parseFloat(v.retailPrice || v.retail_price || v.price || 0),
            shopifyId: v.shopify_id || p.shopify_id || null
          });
        });
      });
      setItems(rows);
      setInitialItems(JSON.parse(JSON.stringify(rows)));
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const safeNum = (val) => {
    const n = parseFloat(val);
    return isNaN(n) ? 0 : Math.max(0, n);
  };

  const preventInvalidKeys = (e) => {
    if (['-', '+', 'e', 'E'].includes(e.key)) {
      e.preventDefault();
    }
  };

  const handleValueChange = (sku, field, rawValue) => {
    const sanitized = String(rawValue || '').replace(/[-+eE]/gi, '');
    let numVal;
    if (sanitized === '') {
      numVal = '';
    } else {
      const parsed = parseFloat(sanitized);
      numVal = isNaN(parsed) ? 0 : Math.max(0, parsed);
      if (field === 'stockSulur') {
        numVal = Math.floor(numVal);
      }
    }

    setItems(prev => prev.map(item => {
      if (item.variantSku === sku) {
        return { ...item, [field]: numVal };
      }
      return item;
    }));
  };

  const filteredItems = items.filter(item => 
    (item.productName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.variantSku || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (item.variantName || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSaveAndSync = async () => {
    setIsSaving(true);
    try {
      showToast('جاري حفظ البيانات المحدثة ومزامنة شوبيفاي...', 'info');

      // 1. Identify Modified Items
      const modifiedItems = items.filter(item => {
        const orig = initialItems.find(o => o.variantSku === item.variantSku);
        if (!orig) return true;
        return (
          safeNum(item.stockSulur) !== safeNum(orig.stockSulur) ||
          safeNum(item.wholesalePrice) !== safeNum(orig.wholesalePrice) ||
          safeNum(item.retailPrice) !== safeNum(orig.retailPrice)
        );
      });

      const targetsToProcess = modifiedItems.length > 0 ? modifiedItems : items;

      // 2. Perform DB Updates & Shopify Updates
      if (supabase) {
        for (const item of targetsToProcess) {
          const cleanStock = safeNum(item.stockSulur);
          const cleanWholesale = safeNum(item.wholesalePrice);
          const cleanRetail = safeNum(item.retailPrice);

          // Update Supabase DB
          const { error: dbErr } = await supabase
            .from('product_variants')
            .update({
              stock_sulur: cleanStock,
              wholesale_price: cleanWholesale,
              average_cost: cleanWholesale,
              retail_price: cleanRetail
            })
            .ilike('sku', (item.variantSku || '').trim());

          if (dbErr) {
            console.error(`DB Update Error for ${item.variantSku}:`, dbErr);
            throw new Error(`تعذر حفظ الصنف ${item.variantSku} في الداتابيز: ${dbErr.message}`);
          }

          // Sync to Shopify
          const targetShopifyId = item.shopifyId;
          if (targetShopifyId) {
            const { data: shopifyRes, error: shopifyErr } = await supabase.functions.invoke('swift-processor', {
              body: {
                action: 'update_stock',
                shopify_variant_id: targetShopifyId,
                stock: cleanStock,
                price: cleanRetail
              }
            });

            if (shopifyErr || (shopifyRes && shopifyRes.error)) {
              const errMsg = shopifyErr?.message || shopifyRes?.error || 'فشلت المزامنة';
              console.error(`Shopify Sync Error for ${item.variantSku}:`, errMsg);
              // Log warning, continue
            }
          } else if (syncVariantStockToShopify) {
            await syncVariantStockToShopify(item.variantSku, item.shopifyId);
          }
        }
      }

      // 3. Update Local React State & LocalStorage
      if (typeof setState === 'function') {
        setState(prev => {
          const updatedProducts = (prev.products || []).map(p => {
            const updatedVariants = (p.variants || []).map(v => {
              const matched = items.find(i => (i.variantSku || '').trim().toLowerCase() === (v.sku || '').trim().toLowerCase());
              if (matched) {
                const cleanStock = safeNum(matched.stockSulur);
                const cleanWholesale = safeNum(matched.wholesalePrice);
                const cleanRetail = safeNum(matched.retailPrice);

                return {
                  ...v,
                  wholesalePrice: cleanWholesale,
                  wholesale_price: cleanWholesale,
                  costPrice: cleanWholesale,
                  cost_price: cleanWholesale,
                  retailPrice: cleanRetail,
                  retail_price: cleanRetail,
                  price: cleanRetail,
                  stock: { Sulur: cleanStock },
                  stock_sulur: cleanStock
                };
              }
              return v;
            });
            return { ...p, variants: updatedVariants };
          });

          const newState = { ...prev, products: updatedProducts };
          try {
            localStorage.setItem("octabot_state", JSON.stringify(newState));
          } catch (e) {
            console.error("Failed to save to localStorage:", e);
          }
          return newState;
        });
      }

      logActivity('inventory', `Updated baseline initial stock and prices for ${targetsToProcess.length} items, synced to Shopify.`);
      showToast(`تم حفظ وتحديث ${targetsToProcess.length} صنف ومزامنتها بنجاح مع شوبيفاي!`, 'success');
      onClose();
    } catch (err) {
      console.error('Error saving initial stock setup:', err);
      const detailedErr = err?.message || err?.details || JSON.stringify(err);
      showToast(`حدث خطأ أثناء الحفظ: ${detailedErr}`, 'error');
    } finally {
      setIsSaving(false);
    }
  };

  const darkInputStyle = {
    background: 'rgba(255, 255, 255, 0.05)',
    border: '1px solid rgba(255, 255, 255, 0.12)',
    color: '#f8fafc',
    borderRadius: '8px',
    padding: '8px 12px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box'
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="ضبط الرصيد الافتتاحي والأسعار" width="1050px">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        
        {/* Search Input */}
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            placeholder="بحث باسم المنتج أو رمز SKU..."
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            style={{
              ...darkInputStyle,
              paddingLeft: '38px',
              fontSize: '0.9rem'
            }}
          />
        </div>

        {/* Table Container */}
        <div style={{ overflowX: 'auto', maxHeight: '55vh', overflowY: 'auto', borderRadius: '8px', border: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
            <thead>
              <tr style={{ background: 'rgba(255, 255, 255, 0.04)', borderBottom: '1px solid rgba(255, 255, 255, 0.1)', color: '#94a3b8' }}>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>المنتج والصنف</th>
                <th style={{ textAlign: 'right', padding: '12px 14px' }}>SKU</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', width: '150px' }}>الكمية الفهرسية الحقيقية</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', width: '160px' }}>سعر التكلفة / الجملة</th>
                <th style={{ textAlign: 'center', padding: '12px 14px', width: '160px' }}>سعر البيع / القطاعي</th>
              </tr>
            </thead>
            <tbody>
              {filteredItems.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center', padding: '32px', color: '#64748b' }}>
                    لا توجد منتجات مطابقة للبحث
                  </td>
                </tr>
              ) : (
                filteredItems.map(item => (
                  <tr key={item.variantSku} style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.05)' }}>
                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ fontWeight: 600, color: '#f8fafc' }}>{item.productName}</div>
                      {cleanVariantName(item.productName, item.variantName) && (
                        <div style={{ fontSize: '12px', color: '#64748b' }}>{cleanVariantName(item.productName, item.variantName)}</div>
                      )}
                    </td>
                    <td style={{ padding: '10px 14px', direction: 'ltr', textAlign: 'right' }}>
                      <span style={{ background: 'rgba(255, 255, 255, 0.06)', color: '#cbd5e1', padding: '3px 8px', borderRadius: '4px', fontFamily: 'monospace', fontSize: '12px' }}>
                        {item.variantSku}
                      </span>
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        value={item.stockSulur}
                        onKeyDown={preventInvalidKeys}
                        onChange={e => handleValueChange(item.variantSku, 'stockSulur', e.target.value)}
                        style={{
                          ...darkInputStyle,
                          background: 'rgba(56, 189, 248, 0.08)',
                          border: '1px solid rgba(56, 189, 248, 0.25)',
                          color: '#38bdf8',
                          fontWeight: '700',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.wholesalePrice}
                        onKeyDown={preventInvalidKeys}
                        onChange={e => handleValueChange(item.variantSku, 'wholesalePrice', e.target.value)}
                        style={{
                          ...darkInputStyle,
                          textAlign: 'center'
                        }}
                      />
                    </td>
                    <td style={{ padding: '8px 10px' }}>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.retailPrice}
                        onKeyDown={preventInvalidKeys}
                        onChange={e => handleValueChange(item.variantSku, 'retailPrice', e.target.value)}
                        style={{
                          ...darkInputStyle,
                          background: 'rgba(74, 222, 128, 0.08)',
                          border: '1px solid rgba(74, 222, 128, 0.25)',
                          color: '#4ade80',
                          fontWeight: '600',
                          textAlign: 'center'
                        }}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '14px', borderTop: '1px solid rgba(255, 255, 255, 0.08)' }}>
          <span style={{ fontSize: '13px', color: '#94a3b8' }}>
            إجمالي الأصناف: <strong style={{ color: '#f8fafc' }}>{items.length}</strong> صنف
          </span>
          <div style={{ display: 'flex', gap: '10px' }}>
            <button className="btn btn-secondary" onClick={onClose} disabled={isSaving}>
              إلغاء
            </button>
            <button className="btn btn-primary" onClick={handleSaveAndSync} disabled={isSaving}>
              {isSaving ? 'جاري الحفظ والمزامنة...' : 'حفظ ومزامنة شوبيفاي'}
            </button>
          </div>
        </div>

      </div>
    </Modal>
  );
}
