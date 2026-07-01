import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function SuppliersList({ globalSearch, setGlobalSearch }) {
    const { state, addSupplier, recordSupplierPayment, recordPurchaseOrder, showToast, logActivity, t } = useContext(AppContext);
    
    // View state tab: 'suppliers' or 'purchases'
    const [activeTab, setActiveTab] = useState('suppliers');

    // Search
    // Using globalSearch instead of local searchVal

    // Modal state for register/edit supplier
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [formId, setFormId] = useState('');
    const [formName, setFormName] = useState('');
    const [formEmail, setFormEmail] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formPaid, setFormPaid] = useState(0);
    const [formDebt, setFormDebt] = useState(0);

    // Modal state for paying debt
    const [isPayOpen, setIsPayOpen] = useState(false);
    const [paySupplierId, setPaySupplierId] = useState(null);
    const [payAmount, setPayAmount] = useState(0);

    // Modal state for logging purchase order
    const [isPoOpen, setIsPoOpen] = useState(false);
    const [poSupplierId, setPoSupplierId] = useState('');
    const [poWarehouse, setPoWarehouse] = useState('Sulur');
    const [poDate, setPoDate] = useState(getLocalDateString());
    const [poItems, setPoItems] = useState([{ variantSku: '', quantity: 1, cost: 50.00, expiryDate: '2027-12-31' }]);

    const currency = state.storeSettings.currency || '$';
    const activeSearch = globalSearch || '';

    // Calculations for summary metrics
    let totalPaid = 0;
    let totalDebt = 0;
    let totalItems = 0;
    (state.suppliers || []).forEach(s => {
        totalPaid += s.paid || 0;
        totalDebt += s.debt || 0;
        totalItems += (s.suppliedVariants || []).length;
    });

    // Filtered suppliers
    const filteredSuppliers = (state.suppliers || []).filter(s => {
        const nameMatches = (s.name || '').toLowerCase().includes(activeSearch.toLowerCase());
        const emailMatches = (s.email || s.contact || '').toLowerCase().includes(activeSearch.toLowerCase());
        return nameMatches || emailMatches;
    });

    // Build allVariants options
    const allVariants = [];
    state.products.forEach(p => {
        p.variants.forEach(v => {
            allVariants.push({
                sku: v.sku,
                name: `${p.name} - ${v.sku}`,
                defaultCost: v.wholesalePrice || 50.00
            });
        });
    });

    const handleOpenAdd = () => {
        setIsEditMode(false);
        setFormId('');
        setFormName('');
        setFormEmail('');
        setFormPhone('');
        setFormPaid(0);
        setFormDebt(0);
        setIsFormOpen(true);
    };

    const handleOpenEdit = (sup) => {
        setIsEditMode(true);
        setFormId(sup.id);
        setFormName(sup.name);
        setFormEmail(sup.email);
        setFormPhone(sup.phone || '');
        setFormPaid(sup.paid);
        setFormDebt(sup.debt);
        setIsFormOpen(true);
    };

    const handleSubmitForm = (e) => {
        e.preventDefault();
        if (!formName || !formEmail) {
            alert("Supplier Name and email are required fields.");
            return;
        }

        const isNew = !formId;
        const finalId = formId || `SUP-${Math.floor(10 + Math.random() * 90)}`;
        
        const supplierObj = {
            id: finalId,
            name: formName,
            email: formEmail,
            phone: formPhone,
            paid: parseFloat(formPaid) || 0,
            debt: parseFloat(formDebt) || 0,
            suppliedVariants: isNew ? [] : (state.suppliers.find(s => s.id === formId)?.suppliedVariants || []),
            createdBy: isNew ? (state.currentUser ? state.currentUser.name : 'sfsf') : (state.suppliers.find(s => s.id === formId)?.createdBy || 'sfsf')
        };

        if (isNew) {
            addSupplier(supplierObj);
        } else {
            // Edit supplier
            state.suppliers = state.suppliers.map(s => s.id === formId ? supplierObj : s);
            logActivity("supplier", `Updated supplier profile details for ${formName}.`);
            showToast(`Supplier profile updated.`);
        }
        setIsFormOpen(false);
    };

    const handleOpenPay = (sup) => {
        setPaySupplierId(sup.id);
        setPayAmount(sup.debt);
        setIsPayOpen(true);
    };

    const handleConfirmPayment = (e) => {
        e.preventDefault();
        recordSupplierPayment(paySupplierId, parseFloat(payAmount) || 0);
        setIsPayOpen(false);
    };

    const handleDeleteSupplier = (id) => {
        if (window.confirm("Permanently delete this supplier profile? This will not remove their products.")) {
            const supName = state.suppliers.find(s => s.id === id)?.name;
            state.suppliers = state.suppliers.filter(s => s.id !== id);
            logActivity("supplier", `Supplier profile ${supName} deleted.`);
            showToast(`Supplier deleted successfully.`);
        }
    };

    // Purchase Order Actions
    const handleOpenPo = () => {
        setPoSupplierId(state.suppliers[0]?.id || '');
        setPoWarehouse('Sulur');
        setPoDate(getLocalDateString());
        setPoItems([{ variantSku: '', quantity: 1, cost: 50.00, expiryDate: '2099-12-31' }]);
        setIsPoOpen(true);
    };

    const handleAddPoItem = () => {
        setPoItems([...poItems, { variantSku: '', quantity: 1, cost: 50.00, expiryDate: '2099-12-31' }]);
    };

    const handleRemovePoItem = (idx) => {
        if (poItems.length > 1) {
            setPoItems(poItems.filter((_, i) => i !== idx));
        }
    };

    const handlePoItemChange = (idx, field, value) => {
        setPoItems(poItems.map((item, i) => {
            if (i === idx) {
                const updated = { ...item, [field]: value };
                if (field === 'variantSku') {
                    const match = allVariants.find(v => v.sku === value);
                    if (match) {
                        updated.cost = match.defaultCost;
                    }
                }
                return updated;
            }
            return item;
        }));
    };

    const handleConfirmPO = (e) => {
        e.preventDefault();
        if (!poSupplierId) {
            alert("Please select a supplier.");
            return;
        }
        const invalid = poItems.some(i => !i.variantSku || i.quantity <= 0);
        if (invalid) {
            alert("Please verify all items have a selected option and positive quantity.");
            return;
        }

        const totalCost = poItems.reduce((sum, item) => sum + ((parseFloat(item.cost) || 0) * (parseInt(item.quantity) || 1)), 0);

        const newPO = {
            id: `PO-${Math.floor(1000 + Math.random() * 9000)}`,
            supplierId: poSupplierId,
            date: poDate,
            items: poItems.map(item => ({
                variantSku: item.variantSku,
                quantity: parseInt(item.quantity) || 1,
                cost: parseFloat(item.cost) || 0,
                expiryDate: item.expiryDate
            })),
            totalCost,
            warehouse: poWarehouse,
            createdBy: state.currentUser ? state.currentUser.name : 'sfsf'
        };

        recordPurchaseOrder(newPO);
        setIsPoOpen(false);
    };

    const totalPoCost = poItems.reduce((sum, item) => sum + ((parseFloat(item.cost) || 0) * (parseInt(item.quantity) || 1)), 0);

    return (
        <div id="suppliers-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('suppliers')}</h2>
                </div>
                <div className="page-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-secondary" onClick={handleOpenPo}>
                        <i className="fa-solid fa-file-invoice-dollar"></i> {t('recordPurchaseOrder')}
                    </button>
                    <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <i className="fa-solid fa-plus"></i> {t('addSupplier')}
                    </button>
                </div>
            </div>

            {/* Segment Tab Controls */}
            <div className="glass-card" style={{ display: 'flex', gap: '8px', padding: '10px 16px', marginBottom: '24px' }}>
                <button 
                    className={`btn ${activeTab === 'suppliers' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('suppliers')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                    <i className="fa-solid fa-handshake"></i> {t('suppliers')}
                </button>
                <button 
                    className={`btn ${activeTab === 'purchases' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setActiveTab('purchases')}
                    style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13px' }}
                >
                    <i className="fa-solid fa-receipt"></i> {t('purchaseOrders')}
                </button>
            </div>

            {/* Summary Metrics Cards */}
            <div className="metrics-grid">
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('totalActiveSuppliers')}</h3>
                        <div className="metric-value">{state.suppliers.length}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-handshake"></i></div>
                </div>
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('outstandingLiabilities')}</h3>
                        <div className="metric-value" style={{ color: 'var(--color-danger)' }}>{currency}{totalDebt.toFixed(0)}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-receipt"></i></div>
                </div>
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('totalPaidAssets')}</h3>
                        <div className="metric-value" style={{ color: 'var(--color-success)' }}>{currency}{totalPaid.toFixed(0)}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-circle-check"></i></div>
                </div>
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('productVarietiesRange')}</h3>
                        <div className="metric-value">{totalItems} {t('variants')}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-folder-tree"></i></div>
                </div>
            </div>

            {activeTab === 'suppliers' ? (
                <>
                    {/* Filter Bar */}
                    <div className="glass-card filter-bar">
                        <div className="filter-controls">
                            <div className="search-input-wrapper">
                                <i className="fa-solid fa-magnifying-glass search-icon"></i>
                                <input 
                                    type="text" 
                                    placeholder={t('searchPlaceholder')}
                                    value={globalSearch || ''}
                                    onChange={(e) => setGlobalSearch(e.target.value)}
                                />
                            </div>
                        </div>
                    </div>

                    {/* Suppliers Table */}
                    <div className="glass-card" style={{ marginTop: '24px', overflow: 'hidden' }}>
                        <div className="table-wrapper">
                            <table className="custom-table">
                                <thead>
                                    <tr>
                                        <th>{t('supplierName')}</th>
                                        <th>{t('email')}</th>
                                        <th>{t('phone')}</th>
                                        <th>{t('variants')}</th>
                                        <th>{t('paid')}</th>
                                        <th>{t('debt')}</th>
                                        <th>المُسجِل</th>
                                        <th>{t('status')}</th>
                                        <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {filteredSuppliers.length === 0 ? (
                                        <tr>
                                            <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                                {t('noSuppliers')}
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredSuppliers.map(sup => {
                                            const statusBadge = sup.debt > 0 
                                                ? <span className="badge badge-danger">{t('liabilityOutstanding')}</span> 
                                                : <span className="badge badge-success">{t('clearedLedger')}</span>;

                                            return (
                                                <tr key={sup.id}>
                                                    <td style={{ fontWeight: 600, color: 'var(--gold-primary)' }}>{sup.name}</td>
                                                    <td>{sup.email || sup.contact || 'N/A'}</td>
                                                    <td>{sup.phone || 'N/A'}</td>
                                                    <td><span className="badge badge-grey">{sup.suppliedVariants?.length || 0} {t('catalogItems')}</span></td>
                                                    <td>{currency}{(sup.paid || 0).toFixed(2)}</td>
                                                    <td style={{ fontWeight: 600, color: sup.debt > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                                        {currency}{(sup.debt || 0).toFixed(2)}
                                                    </td>
                                                    <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{sup.createdBy || 'sfsf'}</td>
                                                    <td>{statusBadge}</td>
                                                    <td style={{ textAlign: 'right' }}>
                                                        <div className="table-actions-cell">
                                                            {sup.debt > 0 && (
                                                                <button 
                                                                    className="btn btn-primary" 
                                                                    style={{ padding: '6px 12px', fontSize: '11px' }}
                                                                    onClick={() => handleOpenPay(sup)}
                                                                >
                                                                    <i className="fa-solid fa-credit-card"></i> {t('payDebt')}
                                                                </button>
                                                            )}
                                                            <button 
                                                                className="action-btn-circle" 
                                                                onClick={() => handleOpenEdit(sup)}
                                                                title="Edit Profile"
                                                            >
                                                                <i className="fa-solid fa-pencil"></i>
                                                            </button>
                                                            <button 
                                                                className="action-btn-circle" 
                                                                onClick={() => handleDeleteSupplier(sup.id)}
                                                                title="Remove Profile"
                                                            >
                                                                <i className="fa-solid fa-trash-can"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            ) : (
                /* Purchase Orders Log View */
                <div className="glass-card" style={{ marginTop: '24px', overflow: 'hidden' }}>
                    <div className="table-wrapper">
                        <table className="custom-table">
                            <thead>
                                <tr>
                                    <th>PO ID</th>
                                    <th>{t('supplierName')}</th>
                                    <th>{t('date')}</th>
                                    <th>{t('stockLocations')}</th>
                                    <th>{t('products')}</th>
                                    <th>المُسجِل</th>
                                    <th>{t('total')}</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(!state.purchaseOrders || state.purchaseOrders.length === 0) ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                            {t('noRecords')}
                                        </td>
                                    </tr>
                                ) : (
                                    state.purchaseOrders.map(po => {
                                        const supplier = state.suppliers.find(s => s.id === po.supplierId);
                                        return (
                                            <tr key={po.id}>
                                                <td style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--gold-primary)' }}>{po.id}</td>
                                                <td>{supplier ? supplier.name : po.supplierId}</td>
                                                <td>{po.date}</td>
                                                <td><span className="badge badge-info">{t('inSulur')}</span></td>
                                                <td>
                                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                                        {po.items.map((it, idx) => (
                                                            <div key={idx} style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                                                • {it.variantSku} (x{it.quantity}) @ {currency}{it.cost}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                                <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{po.createdBy || 'sfsf'}</td>
                                                <td style={{ fontWeight: 600 }}>{currency}{po.totalCost.toLocaleString(undefined, {minimumFractionDigits: 2, maximumFractionDigits: 2})}</td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Register / Edit Supplier Modal */}
            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={isEditMode ? `${t('editSupplier')}: ${formName}` : t('registerNewSupplier')}>
                <form onSubmit={handleSubmitForm}>
                    <div className="form-group">
                        <label className="form-label">{t('supplierName')}*</label>
                        <input 
                            type="text" 
                            className="form-input" 
                            value={formName}
                            onChange={(e) => setFormName(e.target.value)}
                            required 
                        />
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('contactEmail')}*</label>
                            <input 
                                type="email" 
                                className="form-input" 
                                value={formEmail}
                                onChange={(e) => setFormEmail(e.target.value)}
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('contactPhone')}</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                            />
                        </div>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('paidBalance')} ({currency})</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={formPaid}
                                onChange={(e) => setFormPaid(parseFloat(e.target.value) || 0)}
                                min="0" 
                                step="0.01" 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('outstandingDebt')} ({currency})</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                value={formDebt}
                                onChange={(e) => setFormDebt(parseFloat(e.target.value) || 0)}
                                min="0" 
                                step="0.01" 
                            />
                        </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                        <button type="button" className="btn btn-secondary" onClick={() => setIsFormOpen(false)}>
                            {t('discard')}
                        </button>
                        <button type="submit" className="btn btn-primary">
                            {t('save')}
                        </button>
                    </div>
                </form>
            </Modal>

            {/* Pay Debt Modal */}
            {paySupplierId && (
                <Modal 
                    isOpen={isPayOpen} 
                    onClose={() => setIsPayOpen(false)} 
                    title={`${t('payDebt')}: ${state.suppliers.find(s => s.id === paySupplierId)?.name}`}
                >
                    <form onSubmit={handleConfirmPayment}>
                        <div className="form-group">
                            <label className="form-label">{t('outstandingLiabilities')}</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={`${currency}${state.suppliers.find(s => s.id === paySupplierId)?.debt}`}
                                disabled 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('recordedCashPaid')} ({currency})*</label>
                            <input 
                                type="number" 
                                className="form-input" 
                                min="0.01" 
                                max={state.suppliers.find(s => s.id === paySupplierId)?.debt || 0.01}
                                step="0.01"
                                value={payAmount}
                                onChange={(e) => setPayAmount(parseFloat(e.target.value) || 0)}
                                required 
                            />
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsPayOpen(false)}>
                                {t('discard')}
                            </button>
                            <button type="submit" className="btn btn-primary">
                                {t('save')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}

            {/* Record Purchase Order Modal */}
            <Modal isOpen={isPoOpen} onClose={() => setIsPoOpen(false)} title={t('recordPurchaseOrder')}>
                <form onSubmit={handleConfirmPO}>
                    <div className="form-group">
                        <label className="form-label">{t('supplierName')}*</label>
                        <select 
                            className="form-input" 
                            value={poSupplierId} 
                            onChange={(e) => setPoSupplierId(e.target.value)} 
                            required
                        >
                            <option value="">-- {t('chooseVariant')} --</option>
                            {state.suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name}</option>
                            ))}
                        </select>
                    </div>
                    <div className="form-row">
                        <div className="form-group">
                            <label className="form-label">{t('date')}*</label>
                            <input 
                                type="date" 
                                className="form-input" 
                                value={poDate} 
                                onChange={(e) => setPoDate(e.target.value)} 
                                required 
                            />
                        </div>
                    </div>

                    <div style={{ borderTop: '1px solid var(--glass-border)', marginTop: '16px', paddingTop: '16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                            <label className="form-label" style={{ marginBottom: 0 }}>{t('orderedItems')}*</label>
                            <button type="button" className="btn btn-secondary" onClick={handleAddPoItem} style={{ padding: '4px 10px', fontSize: '11px' }}>
                                <i className="fa-solid fa-plus"></i> {t('addItem')}
                            </button>
                        </div>

                        {poItems.map((item, idx) => (
                            <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px' }}>
                                <select 
                                    className="form-input" 
                                    value={item.variantSku}
                                    onChange={(e) => handlePoItemChange(idx, 'variantSku', e.target.value)}
                                    style={{ flex: 2 }}
                                    required
                                >
                                    <option value="">-- {t('chooseVariant')} --</option>
                                    {allVariants.map(v => (
                                        <option key={v.sku} value={v.sku}>{v.name}</option>
                                    ))}
                                </select>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder={t('quantity')}
                                    value={item.quantity}
                                    onChange={(e) => handlePoItemChange(idx, 'quantity', parseInt(e.target.value) || 0)}
                                    style={{ flex: 0.8 }}
                                    min="1"
                                    required 
                                />
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    placeholder={t('buyingPrice')}
                                    value={item.cost}
                                    onChange={(e) => handlePoItemChange(idx, 'cost', parseFloat(e.target.value) || 0)}
                                    style={{ flex: 1 }}
                                    min="0.01"
                                    step="0.01"
                                    required 
                                />

                                <button 
                                    type="button" 
                                    className="action-btn-circle" 
                                    onClick={() => handleRemovePoItem(idx)}
                                    disabled={poItems.length === 1}
                                    style={{ border: 'none', background: 'rgba(255, 75, 75, 0.1)', color: 'var(--color-danger)' }}
                                >
                                    <i className="fa-solid fa-trash"></i>
                                </button>
                            </div>
                        ))}
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '20px', borderTop: '1px solid var(--glass-border)', paddingTop: '12px' }}>
                        <div style={{ fontSize: '14px', fontWeight: 600 }}>
                            {t('total')}: <span style={{ color: 'var(--gold-primary)' }}>{currency}{totalPoCost.toLocaleString(undefined, {minimumFractionDigits:2})}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button type="button" className="btn btn-secondary" onClick={() => setIsPoOpen(false)}>{t('discard')}</button>
                            <button type="submit" className="btn btn-primary">{t('save')}</button>
                        </div>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
