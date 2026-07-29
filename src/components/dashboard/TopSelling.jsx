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
            <div className="table-wrapper g-desktop-only">
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

            <div className="g-mobile-only" style={{ display: 'none', flexDirection: 'column', gap: '8px', padding: '12px' }}>
                {displayList.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>
                        {t('noItemsSold')}
                    </div>
                ) : (
                    displayList.map((item, idx) => (
                        <div key={`top-sell-mob-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '8px' }}>
                            <div style={{
                                width: '28px',
                                height: '28px',
                                borderRadius: '50%',
                                background: idx === 0 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                color: idx === 0 ? 'var(--gold-primary)' : 'var(--text-secondary)',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 'bold',
                                fontSize: '13px',
                                border: idx === 0 ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent'
                            }}>
                                {idx + 1}
                            </div>
                            <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                <div style={{ fontWeight: '600', fontSize: '13.5px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '4px' }}>
                                    {item.name}
                                </div>
                                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                    <span>{t('soldQuantity')}: <strong style={{ color: '#2ecc71' }}>{item.soldQty}</strong></span>
                                    <span style={{ color: 'var(--glass-border)' }}>|</span>
                                    <span>{t('remainingQuantity')}: <strong style={{ color: item.remainingQty < 10 ? 'var(--color-danger)' : 'inherit' }}>{item.remainingQty}</strong></span>
                                </div>
                            </div>
                            <div style={{ textAlign: 'left', fontWeight: '600', color: 'var(--gold-primary)', fontSize: '13.5px' }}>
                                {currency} {item.price.toLocaleString()}
                            </div>
                        </div>
                    ))
                )}
            </div>

            <Modal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} title={t('topSellingStock')} width="900px">
                <div className="table-wrapper g-desktop-only" style={{ maxHeight: '60vh', overflowY: 'auto', overflowX: 'auto' }}>
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

                <div className="g-mobile-only" style={{ display: 'none', flexDirection: 'column', gap: '8px', padding: '8px 0', maxHeight: '60vh', overflowY: 'auto' }}>
                    {topSelling.slice(0, 15).length === 0 ? (
                        <p style={{ textAlign: 'center', color: 'var(--text-muted)' }}>{t('noItemsSold')}</p>
                    ) : (
                        topSelling.slice(0, 15).map((item, idx) => (
                            <div key={`modal-top-sell-mob-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', padding: '10px 12px', borderRadius: '8px' }}>
                                <div style={{
                                    width: '28px',
                                    height: '28px',
                                    borderRadius: '50%',
                                    background: idx === 0 ? 'rgba(212, 175, 55, 0.2)' : 'rgba(255, 255, 255, 0.05)',
                                    color: idx === 0 ? 'var(--gold-primary)' : 'var(--text-secondary)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    fontWeight: 'bold',
                                    fontSize: '13px',
                                    border: idx === 0 ? '1px solid rgba(212, 175, 55, 0.3)' : '1px solid transparent'
                                }}>
                                    {idx + 1}
                                </div>
                                <div style={{ flex: 1, minWidth: 0, textAlign: 'right' }}>
                                    <div style={{ fontWeight: '600', fontSize: '13px', color: '#fff', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', marginBottom: '2px' }}>
                                        {item.name}
                                    </div>
                                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        <span>{t('soldQuantity')}: <strong style={{ color: '#2ecc71' }}>{item.soldQty}</strong></span>
                                        <span style={{ color: 'var(--glass-border)' }}>|</span>
                                        <span>{t('remainingQuantity')}: <strong style={{ color: item.remainingQty < 10 ? 'var(--color-danger)' : 'inherit' }}>{item.remainingQty}</strong></span>
                                    </div>
                                </div>
                                <div style={{ textAlign: 'left', fontWeight: '600', color: 'var(--gold-primary)', fontSize: '13px' }}>
                                    {currency} {item.price.toLocaleString()}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </Modal>
        </div>
    );
}
