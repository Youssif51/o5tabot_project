import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function TopSelling() {
    const { state, setCurrentView, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';

    let variantSales = {};
    state.orders.forEach(ord => {
        if (ord.status !== "Cancelled" && ord.status !== "Draft") {
            ord.items.forEach(item => {
                variantSales[item.variantSku] = (variantSales[item.variantSku] || 0) + item.quantity;
            });
        }
    });

    let topSelling = [];
    state.products.forEach(prod => {
        prod.variants.forEach(vr => {
            let sold = variantSales[vr.sku] || 0;
            if (sold > 0) {
                topSelling.push({
                    name: `${prod.name} (${vr.name})`,
                    soldQty: sold,
                    remainingQty: (vr.stock.Sulur || 0),
                    price: vr.retailPrice
                });
            }
        });
    });

    topSelling.sort((a, b) => b.soldQty - a.soldQty);
    const displayList = topSelling.slice(0, 4);

    return (
        <div className="glass-card dashboard-widget" style={{ padding: 0, display: 'flex', flexDirection: 'column' }}>
            <div className="card-header-bar">
                <h3>{t('topSellingStock')}</h3>
                <a 
                    href="#" 
                    className="see-all-link" 
                    onClick={(e) => { e.preventDefault(); setCurrentView('reports'); }}
                >
                    {t('seeAll')}
                </a>
            </div>
            <div className="table-wrapper">
                <table className="custom-table" style={{ fontSize: '13px' }}>
                    <thead>
                        <tr>
                            <th>{t('name')}</th>
                            <th>{t('soldQuantity')}</th>
                            <th>{t('remainingQuantity')}</th>
                            <th>{t('price')}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {displayList.length === 0 ? (
                            <tr>
                                <td colSpan="4" style={{ textAlign: 'center', padding: '18px', color: 'var(--text-muted)' }}>
                                    {t('noItemsSold')}
                                </td>
                            </tr>
                        ) : (
                            displayList.map((item, idx) => (
                                <tr key={`top-sell-${idx}`}>
                                    <td style={{ fontWeight: '600' }}>{item.name}</td>
                                    <td>{item.soldQty} {t('units')}</td>
                                    <td>{item.remainingQty} {t('left')}</td>
                                    <td style={{ fontWeight: '600', color: 'var(--gold-primary)' }}>
                                        {currency}{item.price.toFixed(2)}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
