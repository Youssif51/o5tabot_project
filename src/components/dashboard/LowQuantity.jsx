import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function LowQuantity() {
    const { state, t } = useContext(AppContext);
    const [isModalOpen, setIsModalOpen] = useState(false);

    let lowStock = [];
    state.products.forEach(prod => {
        prod.variants.forEach(vr => {
            const totalQty = (vr.stock.Sulur || 0);
            const limit = vr.reorderLimit || 5; // Default to 5 if not set or 0
            if (totalQty <= limit) {
                lowStock.push({
                    name: vr.name && vr.name !== 'Standard Option' ? `${prod.name} - ${vr.name}` : prod.name,
                    remainingQty: totalQty,
                    status: totalQty === 0 ? t('outOfStock') : t('lowStock')
                });
            }
        });
    });

    // Sort by remaining quantity ascending (0 first)
    lowStock.sort((a, b) => a.remainingQty - b.remainingQty);
    const displayList = lowStock.slice(0, 3);

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header-bar">
                <h3>{t('lowQuantityStock')}</h3>
                <a 
                    href="#" 
                    className="see-all-link" 
                    onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }}
                >
                    {t('seeAll')}
                </a>
            </div>
            <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
                {displayList.length === 0 ? (
                    <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px 0' }}>
                        {t('stockHealthy')}
                    </div>
                ) : (
                    displayList.map((item, idx) => {
                        const initial = item.name.charAt(0).toUpperCase();
                        const badgeClass = item.remainingQty === 0 ? "badge-danger" : "badge-warning";
                        return (
                            <div key={`low-stock-${idx}`} className="low-stock-item">
                                <div className="low-stock-item-info">
                                    <div className="low-stock-item-thumb">{initial}</div>
                                    <div className="low-stock-item-details">
                                        <h4>{item.name}</h4>
                                        <p>{t('remaining')}: {item.remainingQty} {t('units')}</p>
                                    </div>
                                </div>
                                <span className={`badge ${badgeClass}`}>{item.status}</span>
                            </div>
                        );
                    })
                )}
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('lowQuantityStock')} width="600px">
                <div style={{ padding: '18px', display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '60vh', overflowY: 'auto' }}>
                    {lowStock.slice(0, 15).length === 0 ? (
                        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '12px 0' }}>
                            {t('stockHealthy')}
                        </div>
                    ) : (
                        lowStock.slice(0, 15).map((item, idx) => {
                            const initial = item.name.charAt(0).toUpperCase();
                            const badgeClass = item.remainingQty === 0 ? "badge-danger" : "badge-warning";
                            return (
                                <div key={`modal-low-stock-${idx}`} className="low-stock-item">
                                    <div className="low-stock-item-info">
                                        <div className="low-stock-item-thumb">{initial}</div>
                                        <div className="low-stock-item-details">
                                            <h4>{item.name}</h4>
                                            <p>{t('remaining')}: {item.remainingQty} {t('units')}</p>
                                        </div>
                                    </div>
                                    <span className={`badge ${badgeClass}`}>{item.status}</span>
                                </div>
                            );
                        })
                    )}
                </div>
            </Modal>
        </div>
    );
}
