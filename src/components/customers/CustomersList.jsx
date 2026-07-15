import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';
import { getLocalDateString } from '../../utils/dateUtils';
import CustomerProfileDrawer from './CustomerProfileDrawer';

export default function CustomersList({ globalSearch, setGlobalSearch }) {
    const { state, addCustomer, editCustomer, showToast, logActivity, t, showConfirm, showAlert, setCustomerSpam } = useContext(AppContext);
    
    // Modal state
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [isEditMode, setIsEditMode] = useState(false);
    const [selectedProfileCustomer, setSelectedProfileCustomer] = useState(null);
    const [activeTab, setActiveTab] = useState('all'); // 'all', 'vip', 'spam'
    
    const [formId, setFormId] = useState('');
    const [formName, setFormName] = useState('');
    const [formPhone, setFormPhone] = useState('');
    const [formGov, setFormGov] = useState('Cairo');
    
    const currency = state.storeSettings.currency || 'EGP';
    const activeSearch = globalSearch || '';

    // Filtered customers
    const filteredCustomers = (state.customers || []).filter(c => {
        // Tab check
        if (activeTab === 'vip' && c.customer_type !== 'VIP') return false;
        if (activeTab === 'spam' && !c.is_spam) return false;
        
        // Hide spam-only records from the 'all' tab (customers created purely for blacklisting)
        if (activeTab === 'all' && c.is_spam && (!c.orders_count || c.orders_count === 0) && (!c.total_purchases || c.total_purchases == 0)) {
            return false;
        }

        const nameMatches = (c.name || '').toLowerCase().includes(activeSearch.toLowerCase());
        const phoneMatches = (c.phone || '').includes(activeSearch);
        return nameMatches || phoneMatches;
    });

    const vipCount = (state.customers || []).filter(c => c.customer_type === 'VIP').length;
    const totalPurchases = (state.customers || []).reduce((sum, c) => sum + (parseFloat(c.total_purchases) || 0), 0);

    const handleOpenAdd = () => {
        setIsEditMode(false);
        setFormId('');
        setFormName('');
        setFormPhone('');
        setFormGov('Cairo');
        setIsFormOpen(true);
    };

    const handleOpenEdit = (customer) => {
        setIsEditMode(true);
        setFormId(customer.id);
        setFormName(customer.name);
        setFormPhone(customer.phone);
        setFormGov(customer.governorate || 'Cairo');
        setIsFormOpen(true);
    };

    const handleSubmitForm = (e) => {
        e.preventDefault();
        if (!formName || !formPhone) {
            showAlert("الاسم ورقم الهاتف مطلوبان لتسجيل العميل.");
            return;
        }

        const isNew = !formId;
        const finalId = formId || crypto.randomUUID();
        
        const customerObj = {
            id: finalId,
            name: formName,
            phone: formPhone,
            governorate: formGov,
            total_purchases: isNew ? 0 : (state.customers.find(c => c.id === formId)?.total_purchases || 0),
            orders_count: isNew ? 0 : (state.customers.find(c => c.id === formId)?.orders_count || 0),
            customer_type: isNew ? 'Regular' : (state.customers.find(c => c.id === formId)?.customer_type || 'Regular'),
            created_at: isNew ? new Date().toISOString() : (state.customers.find(c => c.id === formId)?.created_at || new Date().toISOString())
        };

        if (isNew) {
            addCustomer(customerObj);
            logActivity("customer", `Added new customer: ${formName}`);
        } else {
            editCustomer(customerObj);
            logActivity("customer", `Updated customer profile: ${formName}`);
        }
        setIsFormOpen(false);
    };

    const handleToggleVip = (customer) => {
        const isVip = customer.customer_type === 'VIP';
        const newType = isVip ? 'Regular' : 'VIP';
        showConfirm(`هل أنت متأكد من تغيير فئة العميل ${customer.name} إلى ${newType === 'VIP' ? 'مميز (VIP)' : 'عادي'}؟`, () => {
            editCustomer({ ...customer, customer_type: newType });
            logActivity("customer", `Changed ${customer.name} status to ${newType}`);
        });
    };

    const handleToggleSpam = (customer) => {
        const isSpam = !!customer.is_spam;
        const confirmMsg = isSpam 
            ? `هل أنت متأكد من إزالة العميل ${customer.name} من قائمة المزعجين؟` 
            : `هل أنت متأكد من إضافة العميل ${customer.name} إلى قائمة المزعجين؟ سيتم إظهار تنبيه أحمر عند وروده في الطلبات الجديدة.`;
        
        showConfirm(confirmMsg, () => {
            setCustomerSpam(customer.id, !isSpam);
            logActivity("customer", `${isSpam ? 'Removed' : 'Added'} customer ${customer.name} ${isSpam ? 'from' : 'to'} spam list.`);
        });
    };

    return (
        <div id="customers-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('customersList')}</h2>
                </div>
                <div className="page-actions" style={{ display: 'flex', gap: '10px' }}>
                    <button className="btn btn-primary" onClick={handleOpenAdd}>
                        <i className="fa-solid fa-plus"></i> {t('addCustomer')}
                    </button>
                </div>
            </div>

            {/* Summary Metrics Cards */}
            <div className="metrics-grid">
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('totalCustomers')}</h3>
                        <div className="metric-value">{state.customers.length}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-users"></i></div>
                </div>
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('vipCustomers')}</h3>
                        <div className="metric-value" style={{ color: 'var(--gold-primary)' }}>{vipCount}</div>
                    </div>
                    <div className="metric-icon-box" style={{ background: 'rgba(212, 175, 55, 0.15)', color: 'var(--gold-primary)' }}>
                        <i className="fa-solid fa-crown"></i>
                    </div>
                </div>
                <div className="glass-card metric-card">
                    <div className="metric-glow-decor"></div>
                    <div className="metric-info">
                        <h3>{t('totalPurchases')}</h3>
                        <div className="metric-value" style={{ color: 'var(--color-success)' }}>{currency} {totalPurchases.toLocaleString('en-US', {minimumFractionDigits: 0})}</div>
                    </div>
                    <div className="metric-icon-box"><i className="fa-solid fa-chart-line"></i></div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', marginTop: '24px' }}>
                <button 
                    onClick={() => setActiveTab('all')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: activeTab === 'all' ? 'var(--gold-gradient)' : 'var(--glass-bg)',
                        color: activeTab === 'all' ? '#000' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease'
                    }}
                >
                    الكل ({(state.customers || []).length})
                </button>
                <button 
                    onClick={() => setActiveTab('vip')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: activeTab === 'vip' ? 'linear-gradient(135deg, #d4af37, #aa7c11)' : 'var(--glass-bg)',
                        color: activeTab === 'vip' ? '#000' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <i className="fa-solid fa-crown" style={{ fontSize: '11px' }}></i>
                    المميزين VIP ({vipCount})
                </button>
                <button 
                    onClick={() => setActiveTab('spam')}
                    style={{
                        padding: '8px 16px',
                        fontSize: '13px',
                        fontWeight: 600,
                        borderRadius: '8px',
                        border: '1px solid var(--glass-border)',
                        background: activeTab === 'spam' ? 'linear-gradient(135deg, #e74c3c, #c0392b)' : 'var(--glass-bg)',
                        color: activeTab === 'spam' ? '#fff' : 'var(--text-primary)',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px'
                    }}
                >
                    <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '12px' }}></i>
                    المزعجين / سبام ({(state.customers || []).filter(c => c.is_spam).length})
                </button>
            </div>

            {/* Filter Bar */}
            <div className="glass-card filter-bar" style={{ marginTop: '0px' }}>
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

            {/* Customers Table */}
            <div className="glass-card" style={{ marginTop: '24px', overflow: 'hidden' }}>
                <div className="table-wrapper">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>{t('customerName')}</th>
                                <th>{t('phone')}</th>
                                <th>{t('governorate')}</th>
                                <th>{t('customerType')}</th>
                                <th>{t('ordersCount')}</th>
                                <th>{t('totalPurchases')}</th>
                                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredCustomers.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                        {t('noRecords')}
                                    </td>
                                </tr>
                            ) : (
                                filteredCustomers.map(c => {
                                    const isVip = c.customer_type === 'VIP';
                                    return (
                                        <tr key={c.id}>
                                            <td style={{ fontWeight: 600, color: c.is_spam ? 'var(--color-danger)' : (isVip ? 'var(--gold-primary)' : 'inherit') }}>
                                                {c.name}
                                                {c.is_spam && <span className="badge badge-danger" style={{ marginRight: '6px', fontSize: '9px', padding: '2px 6px' }}>⚠️ مزعج</span>}
                                                {isVip && <i className="fa-solid fa-crown" style={{ marginLeft: '6px', fontSize: '10px' }}></i>}
                                            </td>
                                            <td style={{ fontFamily: 'monospace' }}>{c.phone}</td>
                                            <td>{c.governorate || 'N/A'}</td>
                                            <td>
                                                <span className={`badge ${isVip ? 'badge-warning' : 'badge-grey'}`} style={isVip ? { backgroundColor: 'rgba(212, 175, 55, 0.1)', color: 'var(--gold-primary)' } : {}}>
                                                    {isVip ? t('vip') : t('regular')}
                                                </span>
                                            </td>
                                            <td><span className="badge badge-info">{c.orders_count || 0}</span></td>
                                            <td style={{ fontWeight: 600 }}>{currency} {(parseFloat(c.total_purchases) || 0).toLocaleString('en-US', {minimumFractionDigits: 2})}</td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="table-actions-cell">
                                                    <button 
                                                        className="action-btn-circle" 
                                                        onClick={() => setSelectedProfileCustomer(c)}
                                                        title="View History"
                                                    >
                                                        <i className="fa-solid fa-eye" style={{ color: 'var(--text-secondary)' }}></i>
                                                    </button>
                                                    <button 
                                                        className="action-btn-circle" 
                                                        onClick={() => handleToggleVip(c)}
                                                        title={isVip ? "Remove VIP" : "Make VIP"}
                                                    >
                                                        <i className="fa-solid fa-crown" style={{ color: isVip ? 'var(--text-muted)' : 'var(--gold-primary)' }}></i>
                                                    </button>
                                                    <button 
                                                        className="action-btn-circle" 
                                                        onClick={() => handleToggleSpam(c)}
                                                        title={c.is_spam ? "إزالة من قائمة المزعجين" : "تحديد كـ مزعج"}
                                                        style={c.is_spam ? { color: 'var(--color-danger)', backgroundColor: 'rgba(239, 68, 68, 0.15)' } : {}}
                                                    >
                                                        <i className="fa-solid fa-circle-exclamation" style={{ color: c.is_spam ? 'var(--color-danger)' : 'var(--text-secondary)' }}></i>
                                                    </button>
                                                    <button 
                                                        className="action-btn-circle" 
                                                        onClick={() => handleOpenEdit(c)}
                                                        title="Edit Profile"
                                                    >
                                                        <i className="fa-solid fa-pencil"></i>
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

            {/* Modal */}
            <Modal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} title={isEditMode ? t('editCustomer') : t('addCustomer')}>
                <form onSubmit={handleSubmitForm}>
                    <div className="form-group">
                        <label className="form-label">{t('customerName')}*</label>
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
                            <label className="form-label">{t('phone')}*</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={formPhone}
                                onChange={(e) => setFormPhone(e.target.value)}
                                required 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('governorate')}</label>
                            <select 
                                className="form-input"
                                value={formGov}
                                onChange={(e) => setFormGov(e.target.value)}
                            >
                                <option value="Cairo">Cairo</option>
                                <option value="Giza">Giza</option>
                                <option value="Alexandria">Alexandria</option>
                                <option value="Dakahlia">Dakahlia</option>
                                <option value="Red Sea">Red Sea</option>
                                <option value="Beheira">Beheira</option>
                                <option value="Fayoum">Fayoum</option>
                                <option value="Gharbia">Gharbia</option>
                                <option value="Ismailia">Ismailia</option>
                                <option value="Menofia">Menofia</option>
                                <option value="Minya">Minya</option>
                                <option value="Qaliubiya">Qaliubiya</option>
                                <option value="New Valley">New Valley</option>
                                <option value="Suez">Suez</option>
                                <option value="Aswan">Aswan</option>
                                <option value="Assiut">Assiut</option>
                                <option value="Beni Suef">Beni Suef</option>
                                <option value="Port Said">Port Said</option>
                                <option value="Damietta">Damietta</option>
                                <option value="Sharkia">Sharkia</option>
                                <option value="South Sinai">South Sinai</option>
                                <option value="Kafr Al Sheikh">Kafr Al Sheikh</option>
                                <option value="Matrouh">Matrouh</option>
                                <option value="Luxor">Luxor</option>
                                <option value="Qena">Qena</option>
                                <option value="North Sinai">North Sinai</option>
                                <option value="Sohag">Sohag</option>
                            </select>
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

            {/* Profile Drawer */}
            <CustomerProfileDrawer 
                customer={selectedProfileCustomer} 
                onClose={() => setSelectedProfileCustomer(null)} 
            />
        </div>
    );
}
