import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function LowQuantity() {
    const { state, setCurrentView, t } = useContext(AppContext);

    let lowStock = [];
    state.products.forEach(prod => {
        prod.variants.forEach(vr => {
            const totalQty = (vr.stock.Sulur || 0) + (vr.stock.Singanallur || 0);
            if (totalQty <= vr.reorderLimit) {
                lowStock.push({
                    name: `${prod.name} - ${vr.name}`,
                    remainingQty: totalQty,
                    status: totalQty === 0 ? t('outOfStock') : t('lowStock')
                });
            }
        });
    });

    const displayList = lowStock.slice(0, 3);

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header-bar">
                <h3>{t('lowQuantityStock')}</h3>
                <a 
                    href="#" 
                    className="see-all-link" 
                    onClick={(e) => { e.preventDefault(); setCurrentView('inventory'); }}
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
        </div>
    );
}
