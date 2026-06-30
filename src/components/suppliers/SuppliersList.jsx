import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function SuppliersList({ globalSearch }) {
    const { state, addSupplier, recordSupplierPayment, showToast, logActivity, t } = useContext(AppContext);
    
    // Search
    const [searchVal, setSearchVal] = useState('');

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

    const currency = state.storeSettings.currency || '$';
    const activeSearch = searchVal || globalSearch || '';

    // Calculations for summary metrics
    let totalPaid = 0;
    let totalDebt = 0;
    let totalItems = 0;
    state.suppliers.forEach(s => {
        totalPaid += s.paid;
        totalDebt += s.debt;
        totalItems += s.suppliedVariants.length;
    });

    // Filtered suppliers
    const filteredSuppliers = state.suppliers.filter(s => {
        const nameMatches = s.name.toLowerCase().includes(activeSearch.toLowerCase());
        const emailMatches = s.email.toLowerCase().includes(activeSearch.toLowerCase());
        return nameMatches || emailMatches;
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
            suppliedVariants: isNew ? [] : state.suppliers.find(s => s.id === formId).suppliedVariants
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

    return (
        <div id="suppliers-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('suppliers')}</h2>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <i className="fa-solid fa-plus"></i> {t('addSupplier')}
                    </button>
                </div>
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

            {/* Filter Bar */}
            <div className="glass-card filter-bar">
                <div className="filter-controls">
                    <div className="search-input-wrapper">
                        <i className="fa-solid fa-magnifying-glass search-icon"></i>
                        <input 
                            type="text" 
                            placeholder={t('searchPlaceholder')}
                            value={searchVal}
                            onChange={(e) => setSearchVal(e.target.value)}
                        />
                    </div>
                </div>
            </div>

            {/* Table */}
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
                                <th>{t('status')}</th>
                                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredSuppliers.length === 0 ? (
                                <tr>
                                    <td colSpan="8" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
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
                                            <td>{sup.email}</td>
                                            <td>{sup.phone || 'N/A'}</td>
                                            <td><span className="badge badge-grey">{sup.suppliedVariants.length} {t('catalogItems')}</span></td>
                                            <td>{currency}{sup.paid.toFixed(2)}</td>
                                            <td style={{ fontWeight: 600, color: sup.debt > 0 ? 'var(--color-danger)' : 'inherit' }}>
                                                {currency}{sup.debt.toFixed(2)}
                                            </td>
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

            {/* Register / Edit Modal */}
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
                            {t('saveChanges')}
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
                                {t('saveChanges')}
                            </button>
                        </div>
                    </form>
                </Modal>
            )}
        </div>
    );
}
