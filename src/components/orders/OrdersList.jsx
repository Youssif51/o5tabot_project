import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function OrdersList({ globalSearch, setGlobalSearch, onOpenAddOrder }) {
    const { state, updateOrderStatus, deleteOrder, showToast, logActivity, t } = useContext(AppContext);
    
    // Filters & Search
    // Using globalSearch instead of local searchVal
    const [statusFilter, setStatusFilter] = useState('all');

    // Pagination
    const [currentPage, setCurrentPage] = useState(1);
    const pageSize = 10;

    // Return Modal state
    const [isReturnOpen, setIsReturnOpen] = useState(false);
    const [returnOrder, setReturnOrder] = useState(null);
    const [returnQty, setReturnQty] = useState(1);
    const [isRestockable, setIsRestockable] = useState(true);

    const currency = state.storeSettings.currency || '$';
    const activeSearch = globalSearch || '';

    // Filter logic
    const filteredOrders = (state.orders || []).filter(ord => {
        if (statusFilter !== 'all' && ord.status !== statusFilter) return false;
        const clientMatches = (ord.client || '').toLowerCase().includes(activeSearch.toLowerCase());
        const idMatches = (ord.id || '').toLowerCase().includes(activeSearch.toLowerCase());
        return clientMatches || idMatches;
    });

    // Pagination calculations
    const totalEntries = filteredOrders.length;
    const totalPages = Math.ceil(totalEntries / pageSize) || 1;
    const activePage = currentPage > totalPages ? totalPages : currentPage;
    const startIdx = (activePage - 1) * pageSize;
    const endIdx = Math.min(startIdx + pageSize, totalEntries);
    const paginatedOrders = filteredOrders.slice(startIdx, endIdx);

    // Return triggers
    const handleOpenReturn = (order) => {
        if (order.items.length === 0) {
            alert("This order contains no items.");
            return;
        }
        setReturnOrder(order);
        setReturnQty(1);
        setIsRestockable(true);
        setIsReturnOpen(true);
    };

    const handleConfirmReturn = (e) => {
        e.preventDefault();
        if (!returnOrder) return;
        
        const firstItem = returnOrder.items[0];
        if (returnQty <= 0 || returnQty > firstItem.quantity) {
            alert("Invalid return quantity.");
            return;
        }

        const product = state.products.find(p => p.variants.some(v => v.sku === firstItem.variantSku));
        if (!product) return;

        const variantObj = product.variants.find(v => v.sku === firstItem.variantSku);

        // Process Return
        if (isRestockable) {
            // Restock to warehouse
            const newBatchId = `B-${firstItem.variantSku.substring(0, 6)}-RET-${Math.floor(10 + Math.random() * 90)}`;
            const expiryStr = getLocalDateString(new Date(Date.now() + 180 * 24 * 60 * 60 * 1000));
            
            product.batches.push({
                batchId: newBatchId,
                variantSku: firstItem.variantSku,
                expiryDate: expiryStr,
                quantity: returnQty,
                warehouse: returnOrder.warehouse
            });

            variantObj.stock[returnOrder.warehouse] = (variantObj.stock[returnOrder.warehouse] || 0) + returnQty;
            
            logActivity("stock", `Returned: Restocked ${returnQty} units of ${firstItem.variantSku} to ${returnOrder.warehouse} branch (FIFO).`);
            showToast(`Item restocked in ${returnOrder.warehouse}`);
        } else {
            // Waste loss
            const costLoss = returnQty * variantObj.wholesalePrice;
            state.wastes.push({
                id: `WST-${Math.floor(100 + Math.random() * 900)}`,
                date: getLocalDateString(),
                variantSku: firstItem.variantSku,
                quantity: returnQty,
                warehouse: returnOrder.warehouse,
                cost: costLoss,
                reporter: state.currentUser.name
            });

            logActivity("waste", `Damaged Return: Logged ${returnQty} units of ${firstItem.variantSku} as waste. Loss ${currency}${costLoss.toFixed(2)}.`);
            showToast(`Logged return as Waste loss.`, "error");
        }

        // Adjust Order details
        firstItem.quantity -= returnQty;
        returnOrder.totalValue -= returnQty * firstItem.price;

        if (firstItem.quantity <= 0) {
            returnOrder.items = returnOrder.items.filter(i => i.variantSku !== firstItem.variantSku);
        }

        if (returnOrder.items.length === 0) {
            returnOrder.status = "Cancelled";
        }

        // Trigger react state update
        updateOrderStatus(returnOrder.id, returnOrder.status);
        setIsReturnOpen(false);
    };

    const handleDelete = (id) => {
        if (window.confirm("Permanently delete this order record? This will not replenish stock.")) {
            deleteOrder(id);
        }
    };

    const translateStatus = (status) => {
        const key = status.replace(/\s+/g, '').toLowerCase();
        return t(key);
    };

    return (
        <div id="orders-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('orders')}</h2>
                </div>
                <div className="page-actions">
                    <button className="btn btn-primary" onClick={onOpenAddOrder}>
                        <i className="fa-solid fa-plus"></i> {t('newOrder')}
                    </button>
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
                            value={globalSearch || ''}
                            onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                        />
                    </div>
                    
                    <select 
                        className="form-select" 
                        style={{ width: '180px', padding: '8px 12px' }}
                        value={statusFilter}
                        onChange={(e) => { setStatusFilter(e.target.value); setCurrentPage(1); }}
                    >
                        <option value="all">{t('allOrderStatuses')}</option>
                        <option value="Draft">{t('draft')}</option>
                        <option value="Paid">{t('paid')}</option>
                        <option value="Partially Delivered">{t('partiallydelivered')}</option>
                        <option value="Completed">{t('completed')}</option>
                        <option value="Cancelled">{t('cancelled')}</option>
                    </select>
                </div>
            </div>

            {/* Table */}
            <div className="glass-card" style={{ marginTop: '24px', overflow: 'hidden' }}>
                <div className="table-wrapper">
                    <table className="custom-table">
                        <thead>
                            <tr>
                                <th>{t('orderId')}</th>
                                <th>{t('customer')}</th>
                                <th>{t('date')}</th>
                                <th>{t('quantity')}</th>
                                <th>{t('total')}</th>
                                <th>المُسجِل</th>
                                <th>{t('warehouse')}</th>
                                <th>{t('status')}</th>
                                <th style={{ textAlign: 'right' }}>{t('actions')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {paginatedOrders.length === 0 ? (
                                <tr>
                                    <td colSpan="9" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>
                                        {t('noOrders')}
                                    </td>
                                </tr>
                            ) : (
                                paginatedOrders.map(ord => {
                                    const totalQty = (ord.items || []).reduce((acc, curr) => acc + curr.quantity, 0);
                                    let statusClass = "badge-grey";
                                    if (ord.status === "Draft") statusClass = "badge-warning";
                                    else if (ord.status === "Paid") statusClass = "badge-gold";
                                    else if (ord.status === "Partially Delivered") statusClass = "badge-info";
                                    else if (ord.status === "Completed") statusClass = "badge-success";
                                    else if (ord.status === "Cancelled") statusClass = "badge-danger";

                                    return (
                                        <tr key={ord.id}>
                                            <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{ord.id}</td>
                                            <td>{ord.client}</td>
                                            <td>{ord.date}</td>
                                            <td>{totalQty} {t('units')}</td>
                                            <td style={{ fontWeight: 600 }}>{currency}{ord.totalValue.toFixed(2)}</td>
                                            <td style={{ fontWeight: 500, color: 'var(--text-secondary)' }}>{ord.createdBy || 'sfsf'}</td>
                                            <td>{t('inSulur')}</td>
                                            <td><span className={`badge ${statusClass}`}>{translateStatus(ord.status)}</span></td>
                                            <td style={{ textAlign: 'right' }}>
                                                <div className="table-actions-cell">
                                                    {ord.status !== "Cancelled" && ord.status !== "Completed" && (
                                                        <button 
                                                            className="action-btn-circle" 
                                                            style={{ color: 'var(--color-success)', borderColor: 'rgba(46,213,115,0.15)' }}
                                                            onClick={() => updateOrderStatus(ord.id, 'Completed')}
                                                            title="Complete Order"
                                                        >
                                                            <i className="fa-solid fa-circle-check"></i>
                                                        </button>
                                                    )}
                                                    {ord.status !== "Cancelled" && (
                                                        <button 
                                                            className="action-btn-circle" 
                                                            style={{ color: 'var(--color-warning)' }}
                                                            onClick={() => handleOpenReturn(ord)}
                                                            title="Process Return"
                                                        >
                                                            <i className="fa-solid fa-rotate-left"></i>
                                                        </button>
                                                    )}
                                                    <button 
                                                        className="action-btn-circle" 
                                                        onClick={() => handleDelete(ord.id)}
                                                        title="Delete Log"
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

                {/* Pagination footer */}
                <div style={{ padding: '24px 0 12px 0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--glass-border)', marginTop: '16px' }}>
                    <button 
                        className="btn btn-secondary" 
                        disabled={activePage === 1}
                        onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                        {t('previous')}
                    </button>
                    <span style={{ fontSize: '14px', color: 'var(--text-secondary)' }}>
                        {t('page')} <strong style={{ color: 'var(--text-primary)' }}>{activePage}</strong> {t('of')} <strong style={{ color: 'var(--text-primary)' }}>{totalPages}</strong>
                    </span>
                    <button 
                        className="btn btn-secondary" 
                        disabled={activePage === totalPages}
                        onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                        style={{ padding: '8px 16px', fontSize: '13px' }}
                    >
                        {t('next')}
                    </button>
                </div>
            </div>

            {/* Return Modal */}
            {returnOrder && (
                <Modal 
                    isOpen={isReturnOpen} 
                    onClose={() => setIsReturnOpen(false)} 
                    title={`${t('processStockReturn')}: ${returnOrder.id}`}
                >
                    <form onSubmit={handleConfirmReturn}>
                        <div className="form-group">
                            <label className="form-label">{t('customerName')}</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={`${returnOrder.id} (${returnOrder.client})`} 
                                disabled 
                            />
                        </div>
                        <div className="form-group">
                            <label className="form-label">{t('returnItemSku')}</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                value={`${returnOrder.items[0]?.variantSku || ''}`} 
                                disabled 
                            />
                        </div>
                        <div className="form-row">
                            <div className="form-group">
                                <label className="form-label">{t('quantityToReturn')} (Max: {returnOrder.items[0]?.quantity || 1})</label>
                                <input 
                                    type="number" 
                                    className="form-input" 
                                    min="1" 
                                    max={returnOrder.items[0]?.quantity || 1} 
                                    value={returnQty}
                                    onChange={(e) => setReturnQty(parseInt(e.target.value) || 1)}
                                    required 
                                />
                            </div>
                            <div className="form-group">
                                 <label className="form-label">{t('fulfillmentWarehouse')}</label>
                                 <input 
                                     type="text" 
                                     className="form-input" 
                                     value={t('inSulur')} 
                                     disabled 
                                 />
                            </div>
                        </div>

                        {/* Defected / Waste Loss Toggle */}
                        <div className="form-group" style={{ marginTop: '10px' }}>
                            <label className="form-label">{t('itemCondition')}</label>
                            <label className="switch-container">
                                <input 
                                    type="checkbox" 
                                    className="switch-input" 
                                    checked={isRestockable} 
                                    onChange={(e) => setIsRestockable(e.target.checked)} 
                                  />
                                <span className="switch-slider"></span>
                                <span 
                                    style={{ 
                                        fontWeight: 600, 
                                        fontSize: '13px', 
                                        color: isRestockable ? 'var(--color-success)' : 'var(--color-danger)' 
                                    }}
                                >
                                    {isRestockable ? t('restockable') : t('damagedWaste')}
                                </span>
                            </label>
                        </div>

                        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
                            <button 
                                type="button" 
                                className="btn btn-secondary" 
                                onClick={() => setIsReturnOpen(false)}
                            >
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
