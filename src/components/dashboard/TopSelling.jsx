import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';
import { formatProductDisplayName } from '../../utils/productUtils';
import Modal from '../common/Modal';

export default function TopSelling() {
    const { state, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || '$';
    const [isModalOpen, setIsModalOpen] = useState(false);

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
                    name: formatProductDisplayName(prod.name, vr.name),
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
                    onClick={(e) => { e.preventDefault(); setIsModalOpen(true); }}
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
                                        {currency} {item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('topSellingStock')} width="900px">
                <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '13px', whiteSpace: 'nowrap', textAlign: 'right' }}>
                        <thead>
                            <tr>
                                <th>{t('name')}</th>
                                <th>{t('soldQuantity')}</th>
                                <th>{t('remainingQuantity')}</th>
                                <th>{t('price')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {topSelling.slice(0, 15).length === 0 ? (
                                <tr>
                                    <td colSpan="4" style={{ textAlign: 'center', padding: '18px', color: 'var(--text-muted)' }}>
                                        {t('noItemsSold')}
                                    </td>
                                </tr>
                            ) : (
                                topSelling.slice(0, 15).map((item, idx) => (
                                    <tr key={`modal-top-sell-${idx}`}>
                                        <td style={{ fontWeight: '600' }}>{item.name}</td>
                                        <td>{item.soldQty} {t('units')}</td>
                                        <td>{item.remainingQty} {t('left')}</td>
                                        <td style={{ fontWeight: '600', color: 'var(--gold-primary)' }}>
                                            {currency} {item.price.toLocaleString('en-US', {maximumFractionDigits: 2})}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Modal>
        </div>
    );
}
