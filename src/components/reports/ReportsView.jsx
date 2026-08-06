import React, { useContext, useState } from 'react';
import { getLocalDateString } from '../../utils/dateUtils';
import { formatProductDisplayName } from '../../utils/productUtils';
import { AppContext } from '../../context/AppContext';
import Modal from '../common/Modal';

export default function ReportsView() {
    const { state, isDeductedStatus, t } = useContext(AppContext);
    const currency = state.storeSettings.currency || 'EGP';

    // Time filter state: 'today', 'week', 'month', 'all'
    const [timeFilter, setTimeFilter] = useState('month');
    const [prodPage, setProdPage] = useState(1);
    const [hoveredDayIdx, setHoveredDayIdx] = useState(6);
    const [isCatModalOpen, setIsCatModalOpen] = useState(false);
    const [isProdModalOpen, setIsProdModalOpen] = useState(false);
    const [discountPage, setDiscountPage] = useState(1);

    // Helper date matcher
    // Helper date matcher
    const isDateInPeriod = (dateStr, period) => {
        if (!dateStr) return false;
        if (period === 'all') return true;

        try {
            const datePart = typeof dateStr === 'string' ? dateStr.split('T')[0] : '';
            if (!datePart) return false;

            const [y, m, d] = datePart.split('-').map(Number);
            if (!y || !m || !d) return false;

            const orderDate = new Date(y, m - 1, d);
            const today = new Date();
            today.setHours(0, 0, 0, 0);

            const diffDays = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

            if (period === 'today') return diffDays === 0;
            if (period === 'week') return diffDays >= 0 && diffDays < 7;
            if (period === 'month') return diffDays >= 0 && diffDays < 30;
        } catch (e) {
            return false;
        }
        return true;
    };

    // Calculate last 7 days for the interactive trend chart
    const getDaysList = () => {
        const list = [];
        for (let i = 6; i >= 0; i--) {
            const d = new Date();
            d.setDate(d.getDate() - i);
            list.push(getLocalDateString(d));
        }
        return list;
    };
    const last7Days = getDaysList();

    // Calculate order profit with pro-rata discount consideration
    const getOrderProfitDetails = (ord) => {
        let grossValue = 0;
        let cogs = 0;

        (ord.items || []).forEach(item => {
            const rawPrice = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 1;
            grossValue += rawPrice * qty;

            const itemSku = item.variantSku || item.variant_sku || item.sku;
            let itemCost = parseFloat(item.costAtTimeOfSale || item.cost_at_time_of_sale) || 0;
            if (!itemCost) {
                (state.products || []).forEach(p => {
                    let vr = (p.variants || []).find(v => v.sku === itemSku);
                    if (vr) itemCost = parseFloat(vr.averageCost || vr.average_cost || vr.wholesalePrice || vr.wholesale_price) || 0;
                });
            }
            cogs += qty * itemCost;
        });

        const ordTotal = ord.totalValue !== undefined && ord.totalValue !== null 
            ? parseFloat(ord.totalValue) 
            : (ord.total_value !== undefined && ord.total_value !== null ? parseFloat(ord.total_value) : null);

        const hasTotalValue = ordTotal !== null;
        const netRevenue = hasTotalValue ? ordTotal : Math.max(0, grossValue - (parseFloat(ord.discount_value) || 0));
        const originalTotal = grossValue + (parseFloat(ord.shipping_fee) || 0);
        const discount = hasTotalValue ? Math.max(0, originalTotal - ordTotal) : (parseFloat(ord.discount_value) || 0);
        const netProfit = netRevenue - cogs;

        return { grossValue, discount, cogs, netRevenue, netProfit };
    };

    // 1. Overall Metrics Calculation according to timeFilter
    let totalGrossSales = 0;
    let totalDiscounts = 0;
    let totalNetRevenue = 0;
    let totalCOGS = 0;
    let totalOrdersCount = 0;

    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord)) {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            totalOrdersCount++;
            const details = getOrderProfitDetails(ord);
            totalGrossSales += details.grossValue;
            totalDiscounts += details.discount;
            totalNetRevenue += details.netRevenue;
            totalCOGS += details.cogs;
        }
    });

    // Calculate Waste Cost for the period
    let totalWasteCost = 0;
    (state.wastes || []).forEach(w => {
        if (!isDateInPeriod(w.date, timeFilter)) return;
        totalWasteCost += (w.totalCost || w.cost || ((w.quantity || 1) * (w.unitCost || w.costPrice || 0)) || 0);
    });

    const netRealizedProfit = totalNetRevenue - totalCOGS - totalWasteCost;
    const profitMarginPercent = totalNetRevenue > 0 ? ((netRealizedProfit / totalNetRevenue) * 100).toFixed(1) : '0.0';

    // 2. Chart Data (Last 7 Days)
    const chartRawData = last7Days.map(dateStr => {
        let dayRevenue = 0;
        let dayProfit = 0;
        let dayOrders = 0;

        (state.orders || []).forEach(ord => {
            if (ord.date === dateStr && isDeductedStatus(ord.status, ord)) {
                dayOrders++;
                const details = getOrderProfitDetails(ord);
                dayRevenue += details.netRevenue;
                dayProfit += details.netProfit;
            }
        });
        return { dateStr, dayRevenue, dayProfit, dayOrders };
    });

    const graphWidth = 920;
    const graphHeight = 160;
    const paddingX = 40;
    const paddingY = 30;
    const spacingX = graphWidth / (last7Days.length - 1);

    const maxRev = Math.max(...chartRawData.map(d => d.dayRevenue));
    const maxProf = Math.max(...chartRawData.map(d => d.dayProfit));
    const maxVal = Math.max(100, maxRev, maxProf);
    const scaleMax = Math.ceil(maxVal / 100) * 100;

    const chartNodes = chartRawData.map((d, idx) => {
        const x = paddingX + idx * spacingX;
        const revY = paddingY + graphHeight - (d.dayRevenue / scaleMax) * graphHeight;
        const profY = paddingY + graphHeight - (Math.max(0, d.dayProfit) / scaleMax) * graphHeight;
        const parts = d.dateStr.split('-');
        const name = `${parts[1]}/${parts[2]}`;

        return {
            name,
            x,
            revY,
            profY,
            revenue: d.dayRevenue,
            profit: d.dayProfit,
            orders: d.dayOrders
        };
    });

    const hoveredData = chartNodes[hoveredDayIdx] || chartNodes[chartNodes.length - 1];

    // SVG Line paths
    const revLinePath = chartNodes.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.revY}`).join(' ');
    const profLinePath = chartNodes.map((d, idx) => `${idx === 0 ? 'M' : 'L'} ${d.x} ${d.profY}`).join(' ');

    const revAreaPath = `${revLinePath} L ${chartNodes[chartNodes.length - 1].x} ${paddingY + graphHeight} L ${chartNodes[0].x} ${paddingY + graphHeight} Z`;
    const profAreaPath = `${profLinePath} L ${chartNodes[chartNodes.length - 1].x} ${paddingY + graphHeight} L ${chartNodes[0].x} ${paddingY + graphHeight} Z`;

    // 3. Category Breakdown (Real Data - mapped to Shopify Collections)
    const categoryStats = {};
    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord)) {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            const ordDetails = getOrderProfitDetails(ord);
            const ordSubtotal = ordDetails.grossValue || 1;
            const ordDiscount = ordDetails.discount || 0;

            (ord.items || []).forEach(item => {
                const itemSku = item.variantSku || item.variant_sku || item.sku;
                const prod = (state.products || []).find(p => (p.variants || []).some(v => v.sku === itemSku));
                const itemRawTotal = (parseFloat(item.price) || 0) * (parseInt(item.quantity) || 1);
                const itemNetShare = Math.max(0, itemRawTotal - ((itemRawTotal / ordSubtotal) * ordDiscount));
                const qty = parseInt(item.quantity) || 1;

                const colIds = prod?.shopifyCollectionIds || [];
                if (colIds.length > 0) {
                    colIds.forEach(colId => {
                        const col = (state.collections || []).find(c => String(c.id) === String(colId));
                        const catName = col ? col.title : 'عام';
                        if (!categoryStats[catName]) {
                            categoryStats[catName] = { name: catName, revenue: 0, itemsSold: 0 };
                        }
                        categoryStats[catName].revenue += itemNetShare;
                        categoryStats[catName].itemsSold += qty;
                    });
                } else {
                    const catName = 'عام';
                    if (!categoryStats[catName]) {
                        categoryStats[catName] = { name: catName, revenue: 0, itemsSold: 0 };
                    }
                    categoryStats[catName].revenue += itemNetShare;
                    categoryStats[catName].itemsSold += qty;
                }
            });
        }
    });

    const sortedCategories = Object.values(categoryStats).sort((a, b) => b.revenue - a.revenue);

    // 4. Product Profitability Breakdown (Real Data)
    const productStats = {};
    (state.orders || []).forEach(ord => {
        if (isDeductedStatus(ord.status, ord)) {
            if (!isDateInPeriod(ord.date, timeFilter)) return;
            const ordDetails = getOrderProfitDetails(ord);
            const ordSubtotal = ordDetails.grossValue || 1;
            const ordDiscount = ordDetails.discount || 0;

            (ord.items || []).forEach(item => {
                const sku = item.variantSku || item.variant_sku || item.sku;
                let prodName = sku;
                let catName = 'عام';
                let unitCost = parseFloat(item.costAtTimeOfSale || item.cost_at_time_of_sale) || 0;

                (state.products || []).forEach(p => {
                    const vr = (p.variants || []).find(v => v.sku === sku);
                    if (vr) {
                        prodName = formatProductDisplayName(p.name, vr.name);
                        
                        // Map category to Shopify Collection titles
                        if (p.shopifyCollectionIds && p.shopifyCollectionIds.length > 0) {
                            const colNames = p.shopifyCollectionIds.map(colId => {
                                const col = (state.collections || []).find(c => String(c.id) === String(colId));
                                return col ? col.title : null;
                            }).filter(Boolean);
                            catName = colNames.join(', ') || 'عام';
                        } else {
                            catName = 'عام';
                        }
                        
                        if (!unitCost) unitCost = parseFloat(vr.averageCost || vr.average_cost || vr.wholesalePrice || vr.wholesale_price) || 0;
                    }
                });

                const qty = parseInt(item.quantity) || 1;
                const itemRawTotal = (parseFloat(item.price) || 0) * qty;
                const itemNetRevenue = Math.max(0, itemRawTotal - ((itemRawTotal / ordSubtotal) * ordDiscount));
                const itemCOGS = qty * unitCost;
                const itemProfit = itemNetRevenue - itemCOGS;

                if (!productStats[sku]) {
                    productStats[sku] = {
                        sku,
                        name: prodName,
                        category: catName,
                        qtySold: 0,
                        netRevenue: 0,
                        cogs: 0,
                        netProfit: 0
                    };
                }
                productStats[sku].qtySold += qty;
                productStats[sku].netRevenue += itemNetRevenue;
                productStats[sku].cogs += itemCOGS;
                productStats[sku].netProfit += itemProfit;
            });
        }
    });

    const sortedProducts = Object.values(productStats).map(p => {
        const marginPct = p.netRevenue > 0 ? ((p.netProfit / p.netRevenue) * 100).toFixed(1) : '0.0';
        return { ...p, marginPct: parseFloat(marginPct) };
    }).sort((a, b) => b.netProfit - a.netProfit);

    // 5. Admins & Staff Performance Breakdown
    const adminStats = {};
    (state.users || []).forEach(u => {
        const name = u.name || u.username || u.email;
        if (name) {
            adminStats[name] = {
                name,
                role: u.role === 'SuperAdmin' ? 'سوبر أدمن' : u.role === 'Admin' ? 'أدمن' : (u.role || 'مسؤول'),
                registeredCount: 0,
                approvedCount: 0,
                rejectedCount: 0,
                totalValue: 0
            };
        }
    });

    (state.orders || []).forEach(ord => {
        if (!isDateInPeriod(ord.date, timeFilter)) return;
        if (ord.status === 'Draft') return;

        const rawCreator = ord.createdBy || ord.created_by;
        const rawUpdater = ord.updatedBy || ord.updated_by;
        const rawRejector = ord.rejectedBy || ord.rejected_by_name;
        const isShopify = ord.source === 'shopify' || !!ord.shopify_order_id || !!ord.shopifyOrderId;
        const val = parseFloat(ord.totalValue || ord.total_value) || 0;

        // Resolve admin: created_by → updated_by → 'غير محدد'
        const resolvedCreator = (rawCreator && rawCreator !== 'Shopify Webhook') ? rawCreator
            : (rawUpdater && rawUpdater !== 'Shopify Webhook') ? rawUpdater
            : 'غير محدد';
        const creator = resolvedCreator;
        const rejector = (rawRejector && rawRejector !== 'Shopify Webhook') ? rawRejector : null;

        if (ord.status === 'Rejected' || ord.status === 'Cancelled') {
            const rejKey = rejector || creator;
            if (!adminStats[rejKey]) {
                adminStats[rejKey] = { name: rejKey, role: rejKey === 'غير محدد' ? 'غير محدد' : 'أدمن', registeredCount: 0, approvedCount: 0, rejectedCount: 0, totalValue: 0 };
            }
            adminStats[rejKey].rejectedCount++;
        } else {
            if (!adminStats[creator]) {
                adminStats[creator] = { name: creator, role: creator === 'غير محدد' ? 'غير محدد' : 'أدمن', registeredCount: 0, approvedCount: 0, rejectedCount: 0, totalValue: 0 };
            }
            if (isShopify) {
                adminStats[creator].approvedCount++;
            } else {
                adminStats[creator].registeredCount++;
            }
            adminStats[creator].totalValue += val;
        }
    });

    const sortedAdmins = Object.values(adminStats).filter(a => a.name !== 'غير محدد').sort((a, b) => (b.registeredCount + b.approvedCount) - (a.registeredCount + a.approvedCount));

    // --- Detailed Discount Analytics ---
    let discountedOrdersCount = 0;
    let totalCouponDiscountsVal = 0;
    let totalManualDiscountsVal = 0;
    let totalProductDiscountsVal = 0;
    
    const couponStatsMap = {};
    const manualStatsMap = {};
    const adminDiscountStatsMap = {};
    const discountedOrdersList = [];

    (state.orders || []).forEach(ord => {
        if (!isDeductedStatus(ord.status, ord)) return;
        if (!isDateInPeriod(ord.date, timeFilter)) return;

        const ordDetails = getOrderProfitDetails(ord);
        const orderId = ord.id;
        const clientName = ord.client;
        const creatorName = ord.createdBy || ord.created_by || 'غير محدد';

        // Calculate item-level product discounts
        let itemDiscountsTotal = 0;
        let originalProductsTotal = 0;

        (ord.items || []).forEach(item => {
            const sku = item.variantSku || item.variant_sku || item.sku;
            let originalPrice = parseFloat(item.price) || 0;
            
            // Look up original retail price
            (state.products || []).forEach(p => {
                const vr = (p.variants || []).find(v => v.sku === sku);
                if (vr) {
                    const retailPrice = parseFloat(vr.retailPrice || vr.retail_price) || 0;
                    if (retailPrice > originalPrice) {
                        originalPrice = retailPrice;
                    }
                }
            });
            const qty = parseInt(item.quantity) || 1;
            const salePrice = parseFloat(item.price) || 0;
            const itemDiscount = Math.max(0, originalPrice - salePrice) * qty;

            itemDiscountsTotal += itemDiscount;
            originalProductsTotal += originalPrice * qty;
        });

        // Calculate order-level discount mathematically
        const finalPaidVal = parseFloat(ord.totalValue !== undefined && ord.totalValue !== null ? ord.totalValue : ord.total_value) || 0;
        const originalTotalVal = originalProductsTotal + (parseFloat(ord.shipping_fee) || 0);
        const totalOrderDiscount = Math.max(0, originalTotalVal - finalPaidVal);

        const remainingDiscount = Math.max(0, totalOrderDiscount - itemDiscountsTotal);
        const orderDiscountVal = parseFloat(ord.discount_value) || 0;
        const isCoupon = !!ord.applied_coupon_code;

        // Build manual reason string combining reason and details
        const mainReason = ord.discount_reason ? String(ord.discount_reason).trim() : '';
        const subDetails = ord.discount_reason_details ? String(ord.discount_reason_details).trim() : '';
        const manualReasonStr = mainReason && subDetails 
            ? `${mainReason} (${subDetails})` 
            : (mainReason || subDetails || 'بدون سبب محدد');

        let couponDiscount = 0;
        let manualDiscount = 0;

        if (isCoupon) {
            couponDiscount = remainingDiscount;
        } else if (orderDiscountVal > 0 || remainingDiscount > 0) {
            manualDiscount = remainingDiscount;
        }

        if (totalOrderDiscount > 0) {
            discountedOrdersCount++;
            totalCouponDiscountsVal += couponDiscount;
            totalManualDiscountsVal += manualDiscount;
            totalProductDiscountsVal += itemDiscountsTotal;

            // Track coupon stats
            if (isCoupon && ord.applied_coupon_code) {
                const code = ord.applied_coupon_code;
                if (!couponStatsMap[code]) {
                    couponStatsMap[code] = { code, count: 0, totalDiscount: 0 };
                }
                couponStatsMap[code].count++;
                couponStatsMap[code].totalDiscount += couponDiscount;
            }

            // Track manual reason stats
            const isManualReasonRegistered = manualDiscount > 0 || (manualReasonStr && manualReasonStr !== 'بدون سبب محدد' && !isCoupon);
            if (isManualReasonRegistered) {
                const reason = manualReasonStr;
                const allocatedDiscount = manualDiscount > 0 ? manualDiscount : totalOrderDiscount;
                if (!manualStatsMap[reason]) {
                    manualStatsMap[reason] = { reason, count: 0, totalDiscount: 0 };
                }
                manualStatsMap[reason].count++;
                manualStatsMap[reason].totalDiscount += allocatedDiscount;

                // Track admin who gave the discount
                if (!adminDiscountStatsMap[creatorName]) {
                    adminDiscountStatsMap[creatorName] = { name: creatorName, count: 0, totalDiscount: 0 };
                }
                adminDiscountStatsMap[creatorName].count++;
                adminDiscountStatsMap[creatorName].totalDiscount += allocatedDiscount;
            }

            discountedOrdersList.push({
                id: orderId,
                date: ord.date,
                client: clientName,
                originalTotal: originalTotalVal,
                finalTotal: finalPaidVal,
                couponCode: ord.applied_coupon_code || null,
                couponDiscount,
                manualDiscount,
                productDiscount: itemDiscountsTotal,
                totalDiscount: totalOrderDiscount,
                reason: isCoupon ? 'كوبون تخفيض' : manualReasonStr,
                admin: creatorName
            });
        }
    });

    const sortedCoupons = Object.values(couponStatsMap).sort((a, b) => b.totalDiscount - a.totalDiscount);
    const sortedManualReasons = Object.values(manualStatsMap).sort((a, b) => b.totalDiscount - a.totalDiscount);
    const sortedAdminDiscounts = Object.values(adminDiscountStatsMap).sort((a, b) => b.totalDiscount - a.totalDiscount);
    const sortedDiscountedOrders = discountedOrdersList.sort((a, b) => new Date(b.date) - new Date(a.date));

    return (
        <div id="reports-view" className="view-pane active">
            
            {/* View Header Bar */}
            <div className="page-header" style={{ marginBottom: '20px' }}>
                <div className="page-title-group">
                    <h2>{t('reports')} والتحليلات المالية المستهدفة</h2>
                    <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                        تحليل صافي أرباح المتجر بعد خصم التكلفة، الهالك، وتوزيع الخصومات نسبياً
                    </p>
                </div>

                {/* Time Range Filter Pills */}
                <div style={{ display: 'flex', gap: '8px', background: 'var(--glass-bg)', padding: '4px 6px', borderRadius: 'var(--radius-xl)', border: '1px solid var(--glass-border)' }}>
                    {[
                        { id: 'today', label: 'اليوم' },
                        { id: 'week', label: 'هذا الأسبوع' },
                        { id: 'month', label: 'هذا الشهر' },
                        { id: 'all', label: 'كل الأوقات' }
                    ].map(btn => (
                        <button
                            key={btn.id}
                            onClick={() => { setTimeFilter(btn.id); setProdPage(1); }}
                            className={`btn ${timeFilter === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                            style={{
                                padding: '6px 14px',
                                fontSize: '0.82rem',
                                borderRadius: 'var(--radius-lg)'
                            }}
                        >
                            {btn.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Financial Metrics Cards Grid - Executive Ambient Glow (Theme Compatible) */}
            <div className="metrics-grid" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                
                {/* Net Realized Profit */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(46, 213, 115, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(46, 213, 115, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(46, 213, 115, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        صافي الأرباح الحقيقية
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-success)', letterSpacing: '-0.5px' }}>
                        {currency} {netRealizedProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>هامش الربح</span>
                        <span className={`badge ${parseFloat(profitMarginPercent) >= 20 ? 'badge-success' : 'badge-warning'}`}>
                            {profitMarginPercent}%
                        </span>
                    </div>
                </div>

                {/* Gross Sales */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(212, 175, 55, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(212, 175, 55, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(212, 175, 55, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        إجمالي المبيعات قبل الخصم
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--gold-primary)', letterSpacing: '-0.5px' }}>
                        {currency} {totalGrossSales.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>الأوردرات الناجحة</span>
                        <span style={{ fontWeight: '700', color: 'var(--text-primary)' }}>{totalOrdersCount} أوردر</span>
                    </div>
                </div>

                {/* Total Discounts */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(30, 144, 255, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(30, 144, 255, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(30, 144, 255, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        إجمالي الخصومات المطبقة
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-info)', letterSpacing: '-0.5px' }}>
                        {currency} {totalDiscounts.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>التوزيع</span>
                        <span style={{ color: 'var(--text-secondary)' }}>موزعة نسبياً</span>
                    </div>
                </div>

                {/* COGS */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(160, 132, 220, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(160, 132, 220, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(160, 132, 220, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        تكلفة المباع (COGS)
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: '#a084dc', letterSpacing: '-0.5px' }}>
                        {currency} {totalCOGS.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>المخزون</span>
                        <span style={{ color: 'var(--text-secondary)' }}>التكلفة الفعلية</span>
                    </div>
                </div>

                {/* Waste Loss */}
                <div className="glass-card" style={{ 
                    padding: '20px', 
                    borderRadius: '16px',
                    border: '1px solid rgba(255, 71, 87, 0.25)', 
                    background: 'radial-gradient(circle at top right, rgba(255, 71, 87, 0.12) 0%, var(--glass-bg) 80%)',
                    boxShadow: '0 8px 24px rgba(255, 71, 87, 0.05)'
                }}>
                    <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', fontWeight: '600', marginBottom: '8px' }}>
                        خسائر الهالك والتالف
                    </div>
                    <div style={{ fontSize: '1.5rem', fontWeight: '800', color: 'var(--color-danger)', letterSpacing: '-0.5px' }}>
                        {currency} {totalWasteCost.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', paddingTop: '10px', borderTop: '1px solid var(--glass-border)', fontSize: '0.75rem' }}>
                        <span style={{ color: 'var(--text-muted)' }}>الربحية</span>
                        <span style={{ color: 'var(--color-danger)' }}>مخصومة بالكامل</span>
                    </div>
                </div>

            </div>

            {/* Middle Section: Chart & Categories */}
            <div className="grid-responsive-2-2-1" style={{ gap: '20px', marginBottom: '24px' }}>
                
                {/* Interactive Dual-Curve SVG Chart */}
                <div className="glass-card" style={{ padding: '24px', position: 'relative' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <div>
                            <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                حركة المبيعات وصافي الأرباح اليومية (آخر 7 أيام)
                            </h3>
                            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>مرر المؤشر فوق النودز لعرض التفاصيل اليومية</span>
                        </div>
                    </div>

                    <div style={{ width: '100%', height: '220px', position: 'relative' }}>
                        <svg viewBox="0 0 1000 220" width="100%" height="100%" style={{ overflow: 'visible' }}>
                            <defs>
                                <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#1e90ff" stopOpacity="0.35" />
                                    <stop offset="100%" stopColor="#1e90ff" stopOpacity="0.0" />
                                </linearGradient>
                                <linearGradient id="profGrad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor="#2ed573" stopOpacity="0.3" />
                                    <stop offset="100%" stopColor="#2ed573" stopOpacity="0.0" />
                                </linearGradient>
                            </defs>

                            {/* Horizontal Grid lines */}
                            <line x1="40" y1="30" x2="960" y2="30" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="85" x2="960" y2="85" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="140" x2="960" y2="140" stroke="var(--glass-border)" strokeWidth="1" />
                            <line x1="40" y1="195" x2="960" y2="195" stroke="var(--glass-border-hover)" strokeWidth="1.5" />

                            {/* Area Gradient Fills */}
                            <path d={revAreaPath} fill="url(#revGrad)" />
                            <path d={profAreaPath} fill="url(#profGrad)" />

                            {/* Revenue Line */}
                            <path d={revLinePath} fill="none" stroke="var(--color-info)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Profit Line */}
                            <path d={profLinePath} fill="none" stroke="var(--color-success)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />

                            {/* Active Hover Guide Line & Circles */}
                            {hoveredDayIdx !== null && chartNodes[hoveredDayIdx] && (
                                <>
                                    <line
                                        x1={chartNodes[hoveredDayIdx].x}
                                        y1={30}
                                        x2={chartNodes[hoveredDayIdx].x}
                                        y2={195}
                                        stroke="var(--gold-primary)"
                                        strokeWidth="1.5"
                                        strokeDasharray="4 4"
                                    />
                                    <circle cx={chartNodes[hoveredDayIdx].x} cy={chartNodes[hoveredDayIdx].revY} r="6" fill="var(--color-info)" stroke="#fff" strokeWidth="2.5" />
                                    <circle cx={chartNodes[hoveredDayIdx].x} cy={chartNodes[hoveredDayIdx].profY} r="6" fill="var(--color-success)" stroke="#fff" strokeWidth="2.5" />
                                </>
                            )}

                            {/* X-Axis Day Labels & Hover Hotspots */}
                            {chartNodes.map((m, idx) => (
                                <g key={`chart-col-${idx}`}>
                                    <text
                                        x={m.x}
                                        y="215"
                                        fill={hoveredDayIdx === idx ? "var(--gold-primary)" : "var(--text-muted)"}
                                        fontSize="11"
                                        fontWeight={hoveredDayIdx === idx ? "700" : "400"}
                                        textAnchor="middle"
                                    >
                                        {m.name}
                                    </text>
                                    <rect
                                        x={m.x - 65}
                                        y="30"
                                        width="130"
                                        height="165"
                                        fill="transparent"
                                        style={{ cursor: 'pointer' }}
                                        onMouseEnter={() => setHoveredDayIdx(idx)}
                                    />
                                </g>
                            ))}
                        </svg>

                        {/* Glassmorphism Dynamic Floating Tooltip */}
                        {hoveredData && (
                            <div style={{
                                position: 'absolute',
                                left: `${(hoveredData.x / 1000) * 100}%`,
                                top: '12px',
                                transform: 'translateX(-50%)',
                                background: 'var(--glass-bg-hover)',
                                border: '1px solid var(--gold-border-focus)',
                                borderRadius: 'var(--radius-xl)',
                                padding: '10px 14px',
                                fontSize: '12px',
                                pointerEvents: 'none',
                                boxShadow: '0 12px 30px rgba(0, 0, 0, 0.4)',
                                zIndex: 10,
                                backdropFilter: 'var(--blur)',
                                transition: 'left 0.15s cubic-bezier(0.2, 0.8, 0.2, 1)'
                            }}>
                                <div style={{ color: 'var(--gold-primary)', fontWeight: '700', fontSize: '0.85rem', marginBottom: '4px' }}>
                                    تاريخ: {hoveredData.name} ({hoveredData.orders} أوردر)
                                </div>
                                <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', fontSize: '0.78rem', marginBottom: '3px' }}>
                                    <span style={{ color: 'var(--color-info)' }}>صافي الإيراد:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{currency} {hoveredData.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                                </div>
                                <div style={{ display: 'flex', gap: '14px', justifyContent: 'space-between', fontSize: '0.78rem' }}>
                                    <span style={{ color: 'var(--color-success)' }}>صافي الربح:</span>
                                    <strong style={{ color: 'var(--text-primary)' }}>{currency} {hoveredData.profit.toLocaleString('en-US', { maximumFractionDigits: 0 })}</strong>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Chart Color Legends */}
                    <div style={{ display: 'flex', justifyContent: 'center', gap: '28px', marginTop: '16px', fontSize: '0.82rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-info)' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-info)' }}></span>
                            صافي الإيرادات
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--color-success)' }}>
                            <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: 'var(--color-success)' }}></span>
                            صافي الربح
                        </div>
                    </div>
                </div>

                {/* Category Performance Breakdown */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <h3 style={{ fontSize: '1rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                            مبيعات الأقسام
                        </h3>
                        {sortedCategories.length > 4 && (
                            <button onClick={() => setIsCatModalOpen(true)} style={{ background: 'none', border: 'none', color: 'var(--gold-primary)', cursor: 'pointer', fontSize: '0.82rem', fontWeight: '600' }}>
                                عرض الكل
                            </button>
                        )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {sortedCategories.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                                لا توجد مبيعات مسجلة في هذه الفترة
                            </div>
                        ) : (
                            sortedCategories.slice(0, 5).map((cat, idx) => {
                                const catPct = totalNetRevenue > 0 ? ((cat.revenue / totalNetRevenue) * 100).toFixed(1) : 0;
                                return (
                                    <div key={`cat-row-${idx}`} style={{ background: 'var(--glass-bg)', padding: '10px 14px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--glass-border)' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', marginBottom: '4px' }}>
                                            <span style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{cat.name}</span>
                                            <span style={{ fontWeight: '700', color: 'var(--gold-primary)' }}>{currency} {cat.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}</span>
                                        </div>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                                            <span>الكمية المباعة: {cat.itemsSold} قطعة</span>
                                            <span>الحصة: {catPct}%</span>
                                        </div>
                                    </div>
                                );
                            })
                        )}
                    </div>
                </div>

            </div>

            {/* Admins & Staff Performance Breakdown Section */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-user-shield" style={{ color: 'var(--gold-primary)' }}></i>
                            تقرير أداء فريق الأدمن والموظفين (Admin Performance)
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            تفاصيل الأوردرات المسجلة والمقبولة والمرفوضة حسب كل أدمن خلال الفترة المحددة
                        </p>
                    </div>
                </div>

                <div className="table-wrapper reports-desktop-only" style={{ overflowX: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'right' }}>الأدمن / المسؤول</th>
                                <th style={{ textAlign: 'center' }}>أوردرات مسجلة (يدوياً)</th>
                                <th style={{ textAlign: 'center' }}>أوردرات مقبولة (شوبيفاي)</th>
                                <th style={{ textAlign: 'center' }}>إجمالي المقبول والمُسجل</th>
                                <th style={{ textAlign: 'center' }}>أوردرات مرفوضة</th>
                                <th style={{ textAlign: 'center' }}>إجمالي قيمة الأوردرات</th>
                                <th style={{ textAlign: 'center' }}>الحصة من العمل</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedAdmins.length === 0 ? (
                                <tr>
                                    <td colSpan="7" style={{ textAlign: 'center', padding: '28px', color: 'var(--text-muted)' }}>
                                        لا توجد بيانات أداء مسجلة للأدمنز في هذه الفترة
                                    </td>
                                </tr>
                            ) : (
                                sortedAdmins.map((adm, idx) => {
                                    const totalHandled = adm.registeredCount + adm.approvedCount;
                                    const sharePct = totalOrdersCount > 0 ? ((totalHandled / totalOrdersCount) * 100).toFixed(1) : '0.0';
                                    return (
                                        <tr key={`adm-perf-${idx}`}>
                                            <td style={{ fontWeight: '600', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--gold-border-focus)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 'bold', color: 'var(--gold-primary)' }}>
                                                    {adm.name.charAt(0).toUpperCase()}
                                                </span>
                                                <div>
                                                    <div>{adm.name}</div>
                                                    <div style={{ fontSize: '10px', color: 'var(--text-muted)', fontWeight: 'normal' }}>{adm.role}</div>
                                                </div>
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '700', color: '#1e90ff' }}>
                                                {adm.registeredCount} أوردر
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '700', color: '#2ed573' }}>
                                                {adm.approvedCount} أوردر
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '800', color: 'var(--gold-primary)' }}>
                                                {totalHandled} أوردر
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '600', color: adm.rejectedCount > 0 ? '#ef4444' : 'var(--text-muted)' }}>
                                                {adm.rejectedCount} أوردر
                                            </td>
                                            <td style={{ textAlign: 'center', fontWeight: '700', color: 'var(--text-primary)' }}>
                                                {currency} {adm.totalValue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                            </td>
                                            <td style={{ textAlign: 'center' }}>
                                                <span className="badge badge-gold" style={{ fontSize: '11px' }}>
                                                    {sharePct}%
                                                </span>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>

                {/* Mobile view cards for Admin Performance */}
                <div className="reports-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
                    {sortedAdmins.map((adm, idx) => {
                        const totalHandled = adm.registeredCount + adm.approvedCount;
                        const sharePct = totalOrdersCount > 0 ? ((totalHandled / totalOrdersCount) * 100).toFixed(1) : '0.0';
                        return (
                            <div key={`adm-perf-mob-${idx}`} className="sa-mobile-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                    <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{adm.name} ({adm.role})</strong>
                                    <span className="badge badge-gold" style={{ fontSize: '10.5px' }}>{sharePct}% حصة</span>
                                </div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', fontSize: '11.5px', marginTop: '4px' }}>
                                    <div>أوردرات مسجلة: <strong style={{ color: '#1e90ff' }}>{adm.registeredCount}</strong></div>
                                    <div>أوردرات مقبولة: <strong style={{ color: '#2ed573' }}>{adm.approvedCount}</strong></div>
                                    <div>أوردرات مرفوضة: <strong style={{ color: '#ef4444' }}>{adm.rejectedCount}</strong></div>
                                    <div>إجمالي القيمة: <strong style={{ color: 'var(--gold-primary)' }}>{currency} {adm.totalValue.toLocaleString()}</strong></div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Bottom Table: Real Product Profitability Breakdown */}
            {(() => {
                const top50Products = sortedProducts.slice(0, 50);
                const itemsPerPage = 5;
                const totalProdPages = Math.ceil(top50Products.length / itemsPerPage) || 1;
                const currentPageProducts = top50Products.slice((prodPage - 1) * itemsPerPage, prodPage * itemsPerPage);

                return (
                    <div className="glass-card" style={{ padding: '24px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
                            <div>
                                <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0 }}>
                                    أعلى الأصناف والمنتجات ربحية (Product Profitability)
                                </h3>
                                <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                    محسوبة بالصافي الفعلي لكل قطعة (عرض أعلى 50 صنفاً ربحية - 5 منتجات لكل صفحة)
                                </p>
                            </div>

                            {sortedProducts.length > 5 && (
                                <button onClick={() => setIsProdModalOpen(true)} className="btn btn-secondary" style={{ padding: '8px 14px', fontSize: '0.82rem' }}>
                                    عرض جميع المنتجات ({sortedProducts.length})
                                </button>
                            )}
                        </div>

                        <div className="table-wrapper reports-desktop-only" style={{ overflowX: 'auto' }}>
                            <table className="custom-table" style={{ fontSize: '0.88rem', whiteSpace: 'nowrap' }}>
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'right' }}>المنتج والصنف</th>
                                        <th style={{ textAlign: 'right' }}>رمز SKU</th>
                                        <th style={{ textAlign: 'right' }}>القسم</th>
                                        <th style={{ textAlign: 'center' }}>الكمية المباعة</th>
                                        <th style={{ textAlign: 'center' }}>صافي الإيراد</th>
                                        <th style={{ textAlign: 'center' }}>تكلفة المباع (COGS)</th>
                                        <th style={{ textAlign: 'center' }}>صافي الربح</th>
                                        <th style={{ textAlign: 'center' }}>نسبة الهامش</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {currentPageProducts.length === 0 ? (
                                        <tr>
                                            <td colSpan="8" style={{ textAlign: 'center', padding: '36px', color: 'var(--text-muted)' }}>
                                                لا توجد بيانات مبيعات مطابقة للفترة المحددة
                                            </td>
                                        </tr>
                                    ) : (
                                        currentPageProducts.map((prod, idx) => (
                                            <tr key={`prod-profit-${idx}`}>
                                                <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prod.name}</td>
                                                <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{prod.sku}</td>
                                                <td>{prod.category}</td>
                                                <td style={{ textAlign: 'center', fontWeight: '700' }}>{prod.qtySold}</td>
                                                <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-info)' }}>
                                                    {currency} {prod.netRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center', color: '#a084dc' }}>
                                                    {currency} {prod.cogs.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: '700', color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                                    {currency} {prod.netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                                </td>
                                                <td style={{ textAlign: 'center' }}>
                                                    <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`}>
                                                        {prod.marginPct}%
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Mobile view cards */}
                        <div className="reports-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px' }}>
                            {currentPageProducts.length === 0 ? (
                                <p style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '24px' }}>لا توجد بيانات مبيعات مطابقة للفترة المحددة</p>
                            ) : (
                                currentPageProducts.map((prod, idx) => (
                                    <div key={`prod-profit-mob-${idx}`} className="sa-mobile-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{prod.name}</strong>
                                            <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10.5px' }}>
                                                {prod.marginPct}% هامش
                                            </span>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                            <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>SKU: {prod.sku}</span>
                                            <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{prod.category}</span>
                                        </div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', fontSize: '11.5px', marginTop: '4px' }}>
                                            <div>الكمية المباعة: <strong style={{ color: '#fff' }}>{prod.qtySold}</strong></div>
                                            <div>صافي الإيراد: <strong style={{ color: 'var(--color-info)' }}>{currency} {prod.netRevenue.toLocaleString()}</strong></div>
                                            <div>تكلفة المباع: <strong style={{ color: '#a084dc' }}>{currency} {prod.cogs.toLocaleString()}</strong></div>
                                            <div>صافي الربح: <strong style={{ color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{currency} {prod.netProfit.toLocaleString()}</strong></div>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Pagination Controls */}
                        {top50Products.length > 0 && (
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--glass-border)', flexWrap: 'wrap', gap: '12px' }}>
                                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                                    عرض <strong>{((prodPage - 1) * itemsPerPage) + 1} - {Math.min(prodPage * itemsPerPage, top50Products.length)}</strong> من أصل <strong>{top50Products.length}</strong> منتج أعلى ربحية
                                </div>

                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setProdPage(prev => Math.max(1, prev - 1))}
                                        disabled={prodPage === 1}
                                        style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: prodPage === 1 ? 0.4 : 1, cursor: prodPage === 1 ? 'not-allowed' : 'pointer' }}
                                    >
                                        <i className="fa-solid fa-chevron-right"></i> السابق
                                    </button>

                                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--gold-primary)', padding: '0 8px' }}>
                                        {prodPage} / {totalProdPages}
                                    </span>

                                    <button
                                        className="btn btn-secondary"
                                        onClick={() => setProdPage(prev => Math.min(totalProdPages, prev + 1))}
                                        disabled={prodPage >= totalProdPages}
                                        style={{ padding: '6px 14px', fontSize: '0.8rem', opacity: prodPage >= totalProdPages ? 0.4 : 1, cursor: prodPage >= totalProdPages ? 'not-allowed' : 'pointer' }}
                                    >
                                        التالي <i className="fa-solid fa-chevron-left"></i>
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Section: Discounts & Coupon Reports (User Requested) */}
            <div className="glass-card" style={{ padding: '24px', marginBottom: '24px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                    <div>
                        <h3 style={{ fontSize: '1.05rem', fontWeight: '700', color: 'var(--text-primary)', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <i className="fa-solid fa-tags" style={{ color: 'var(--gold-primary)' }}></i>
                            تقرير وتحليلات الخصومات والعروض (Discounts & Coupons Report)
                        </h3>
                        <p style={{ margin: '4px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                            تحليل شامل لجميع الخصومات الممنوحة للعملاء بالتفصيل عبر الكوبونات، الخصومات اليدوية للأدمنز، والعروض الخاصة بالمنتجات
                        </p>
                    </div>
                </div>

                {/* Discount Metrics Sub-Grid */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    {/* Discounted Orders Ratio */}
                    <div style={{ padding: '16px', background: 'rgba(30, 144, 255, 0.05)', border: '1px solid rgba(30, 144, 255, 0.15)', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>نسبة الطلبات المخصومة</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#1e90ff' }}>
                            {totalOrdersCount > 0 ? ((discountedOrdersCount / totalOrdersCount) * 100).toFixed(1) : 0}%
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {discountedOrdersCount} من أصل {totalOrdersCount} طلبات
                        </div>
                    </div>

                    {/* Coupons Total discount */}
                    <div style={{ padding: '16px', background: 'rgba(46, 204, 113, 0.05)', border: '1px solid rgba(46, 204, 113, 0.15)', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>إجمالي خصومات الكوبونات</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#2ecc71' }}>
                            {currency} {totalCouponDiscountsVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            {sortedCoupons.length} كوبونات مستخدمة
                        </div>
                    </div>

                    {/* Manual Admin Discounts Total */}
                    <div style={{ padding: '16px', background: 'rgba(234, 179, 8, 0.05)', border: '1px solid rgba(234, 179, 8, 0.15)', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>الخصومات اليدوية للأدمنز</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#eab308' }}>
                            {currency} {totalManualDiscountsVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            ممنوحة بأمر المسؤول يدوياً
                        </div>
                    </div>

                    {/* Product-level Discounts Total */}
                    <div style={{ padding: '16px', background: 'rgba(160, 132, 220, 0.05)', border: '1px solid rgba(160, 132, 220, 0.15)', borderRadius: '12px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', color: 'var(--text-secondary)', marginBottom: '6px', fontWeight: 600 }}>إجمالي عروض المنتجات</div>
                        <div style={{ fontSize: '20px', fontWeight: '800', color: '#a084dc' }}>
                            {currency} {totalProductDiscountsVal.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                        </div>
                        <div style={{ fontSize: '10px', color: 'var(--text-muted)', marginTop: '4px' }}>
                            فروق تسعير الأصناف الفردية
                        </div>
                    </div>
                </div>

                {/* Custom styling classes for the Discounts & Coupons reports */}
                <style>{`
                    .discount-report-subgrid {
                        display: grid;
                        grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
                        gap: 20px;
                        margin-bottom: 24px;
                    }
                    .discount-mini-card {
                        padding: 18px;
                        background: rgba(255, 255, 255, 0.015);
                        border: 1px solid rgba(255, 255, 255, 0.04);
                        border-radius: 14px;
                        box-shadow: inset 0 1px 1px rgba(255, 255, 255, 0.02);
                        transition: transform 0.2s, border-color 0.2s;
                    }
                    .discount-mini-card:hover {
                        border-color: rgba(255, 255, 255, 0.08);
                    }
                    .discount-mini-title {
                        font-size: 13px;
                        font-weight: 700;
                        color: var(--text-primary);
                        margin: 0 0 14px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.05);
                        padding-bottom: 8px;
                    }
                    .discount-mini-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 11.5px;
                    }
                    .discount-mini-table th {
                        color: var(--text-secondary);
                        font-weight: 600;
                        padding: 6px 8px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.08);
                    }
                    .discount-mini-table td {
                        padding: 8px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                        color: var(--text-secondary);
                    }
                    .discount-mini-table tr:hover td {
                        color: var(--text-primary);
                        background: rgba(255, 255, 255, 0.01);
                    }
                    .discount-detailed-section {
                        border-top: 1px dashed var(--glass-border);
                        padding-top: 20px;
                    }
                    .discount-detailed-title {
                        font-size: 14px;
                        font-weight: 700;
                        color: var(--text-primary);
                        margin: 0 0 16px 0;
                        display: flex;
                        align-items: center;
                        gap: 8px;
                    }
                    .discount-main-table {
                        width: 100%;
                        border-collapse: collapse;
                        font-size: 12px;
                    }
                    .discount-main-table th {
                        color: var(--text-secondary);
                        font-weight: 600;
                        padding: 12px 10px;
                        background: rgba(255, 255, 255, 0.01);
                        border-bottom: 2px solid rgba(255, 255, 255, 0.08);
                    }
                    .discount-main-table td {
                        padding: 12px 10px;
                        border-bottom: 1px solid rgba(255, 255, 255, 0.03);
                        vertical-align: middle;
                        color: var(--text-secondary);
                    }
                    .discount-main-table tr {
                        transition: background-color 0.2s;
                    }
                    .discount-main-table tr:hover td {
                        color: var(--text-primary);
                        background: rgba(255, 255, 255, 0.015);
                    }
                    .badge-coupon-pill {
                        background: rgba(46, 204, 113, 0.06);
                        color: #2ecc71;
                        border: 1px solid rgba(46, 204, 113, 0.15);
                        padding: 3px 8px;
                        border-radius: 6px;
                        font-size: 10.5px;
                        font-weight: 700;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .badge-code-text {
                        color: #2ecc71;
                        font-size: 11px;
                        font-weight: 700;
                        font-family: monospace;
                        background: rgba(46, 204, 113, 0.04);
                        border: 1px dashed rgba(46, 204, 113, 0.25);
                        padding: 2px 6px;
                        border-radius: 4px;
                    }
                    .badge-manual-pill {
                        background: rgba(245, 158, 11, 0.06);
                        color: #fbbf24;
                        border: 1px solid rgba(245, 158, 11, 0.15);
                        padding: 3px 8px;
                        border-radius: 6px;
                        font-size: 10.5px;
                        font-weight: 700;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .badge-reason-text {
                        background: rgba(245, 158, 11, 0.03);
                        color: #fbbf24;
                        border: 1px solid rgba(245, 158, 11, 0.12);
                        padding: 2px 6px;
                        border-radius: 5px;
                        font-size: 11px;
                        font-weight: 600;
                    }
                    .badge-details-text {
                        color: rgba(255, 255, 255, 0.5);
                        font-size: 10.5px;
                        font-weight: 500;
                        background: rgba(255, 255, 255, 0.02);
                        border: 1px solid rgba(255, 255, 255, 0.05);
                        padding: 2px 6px;
                        border-radius: 5px;
                    }
                    .badge-product-pill {
                        background: rgba(160, 132, 220, 0.08);
                        color: #a084dc;
                        border: 1px solid rgba(160, 132, 220, 0.2);
                        padding: 3px 8px;
                        border-radius: 6px;
                        font-size: 10.5px;
                        font-weight: 700;
                        display: inline-flex;
                        align-items: center;
                        gap: 4px;
                    }
                    .tabular-amount {
                        font-family: monospace;
                        font-variant-numeric: tabular-nums;
                        font-weight: 600;
                    }
                `}</style>

                {/* Sub-tables: Coupons, Reasons & Admin metrics */}
                <div className="discount-report-subgrid">
                    {/* Top Coupons Table */}
                    <div className="discount-mini-card">
                        <h4 className="discount-mini-title">
                            <i className="fa-solid fa-ticket" style={{ color: 'var(--gold-primary)' }}></i> الكوبونات الأكثر فاعلية
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="discount-mini-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'right' }}>رمز الكوبون</th>
                                        <th style={{ textAlign: 'center' }}>الاستخدامات</th>
                                        <th style={{ textAlign: 'left' }}>إجمالي التخفيض</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedCoupons.length === 0 ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>لا توجد كوبونات مستخدمة</td></tr>
                                    ) : (
                                        sortedCoupons.slice(0, 5).map((cp, idx) => (
                                            <tr key={idx}>
                                                <td style={{ textAlign: 'right', fontWeight: 'bold' }}>
                                                    <span className="badge-coupon-pill">
                                                        <i className="fa-solid fa-ticket" style={{ fontSize: '9px' }}></i> {cp.code}
                                                    </span>
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: '500' }}>{cp.count} مرات</td>
                                                <td style={{ textAlign: 'left', color: '#2ecc71' }} className="tabular-amount">
                                                    {currency} {cp.totalDiscount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>



                    {/* Admin Discounts table */}
                    <div className="discount-mini-card">
                        <h4 className="discount-mini-title">
                            <i className="fa-solid fa-user-shield" style={{ color: 'var(--gold-primary)' }}></i> الخصومات الممنوحة من الأدمنز
                        </h4>
                        <div style={{ overflowX: 'auto' }}>
                            <table className="discount-mini-table">
                                <thead>
                                    <tr>
                                        <th style={{ textAlign: 'right' }}>الأدمن المسؤول</th>
                                        <th style={{ textAlign: 'center' }}>الأوردرات</th>
                                        <th style={{ textAlign: 'left' }}>إجمالي الخصم</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedAdminDiscounts.length === 0 ? (
                                        <tr><td colSpan="3" style={{ textAlign: 'center', padding: '16px', color: 'var(--text-muted)' }}>لا توجد خصومات ممنوحة من الأدمنز</td></tr>
                                    ) : (
                                        sortedAdminDiscounts.slice(0, 5).map((ad, idx) => (
                                            <tr key={idx}>
                                                <td style={{ textAlign: 'right', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', padding: '8px' }}>
                                                    <i className="fa-regular fa-user" style={{ opacity: 0.5 }}></i> {ad.name}
                                                </td>
                                                <td style={{ textAlign: 'center', fontWeight: '500' }}>{ad.count} أوردرات</td>
                                                <td style={{ textAlign: 'left', color: 'var(--text-primary)' }} className="tabular-amount">
                                                    {currency} {ad.totalDiscount.toLocaleString()}
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Detailed Discounted Orders Table */}
                {(() => {
                    const discountItemsPerPage = 10;
                    const totalDiscountPages = Math.ceil(sortedDiscountedOrders.length / discountItemsPerPage) || 1;
                    const paginatedDiscountOrders = sortedDiscountedOrders.slice((discountPage - 1) * discountItemsPerPage, discountPage * discountItemsPerPage);

                    return (
                        <div className="discount-detailed-section">
                            <h4 className="discount-detailed-title">
                                <i className="fa-solid fa-list-check" style={{ color: 'var(--gold-primary)' }}></i> سجل تفاصيل الطلبات المخصومة ({sortedDiscountedOrders.length} طلب مخصوم)
                            </h4>

                            <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid rgba(255,255,255,0.05)', background: 'rgba(0,0,0,0.1)' }}>
                                <table className="discount-main-table">
                                    <thead>
                                        <tr>
                                            <th style={{ textAlign: 'right', width: '90px' }}>
                                                <i className="fa-solid fa-hashtag" style={{ marginLeft: '4px', opacity: 0.5 }}></i> رقم الأوردر
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                <i className="fa-solid fa-user" style={{ marginLeft: '4px', opacity: 0.5 }}></i> العميل
                                            </th>
                                            <th style={{ textAlign: 'left' }}>
                                                <i className="fa-solid fa-money-bill-wave" style={{ marginLeft: '4px', opacity: 0.5 }}></i> قبل الخصم
                                            </th>
                                            <th style={{ textAlign: 'left' }}>
                                                <i className="fa-solid fa-percent" style={{ marginLeft: '4px', opacity: 0.5 }}></i> الخصم المطبق
                                            </th>
                                            <th style={{ textAlign: 'left' }}>
                                                <i className="fa-solid fa-wallet" style={{ marginLeft: '4px', opacity: 0.5 }}></i> المبلغ الصافي
                                            </th>
                                            <th style={{ textAlign: 'right' }}>
                                                <i className="fa-solid fa-tags" style={{ marginLeft: '4px', opacity: 0.5 }}></i> نوع وتفاصيل الخصم
                                            </th>
                                            <th style={{ textAlign: 'center', width: '130px' }}>
                                                <i className="fa-solid fa-user-shield" style={{ marginLeft: '4px', opacity: 0.5 }}></i> الأدمن المسؤول
                                            </th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {paginatedDiscountOrders.length === 0 ? (
                                            <tr>
                                                <td colSpan="7" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
                                                    لا توجد طلبات مخصومة مسجلة في هذه الفترة
                                                </td>
                                            </tr>
                                        ) : (
                                            paginatedDiscountOrders.map((ord, idx) => {
                                                const hasCoupon = !!ord.couponCode;
                                                const hasManual = ord.manualDiscount > 0 || (ord.reason && ord.reason !== 'كوبون تخفيض' && ord.reason !== 'بدون سبب محدد');
                                                const hasProduct = ord.productDiscount > 0 && !hasManual && !hasCoupon;
                                                
                                                // Create elegant badges representing type of discount
                                                const discountTypeBadge = (() => {
                                                    const badges = [];
                                                    if (hasCoupon) {
                                                        badges.push(
                                                            <div key="cp" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                                                                <span className="badge-coupon-pill">
                                                                    <i className="fa-solid fa-ticket" style={{ fontSize: '9px' }}></i> كوبون
                                                                </span>
                                                                {ord.couponCode && (
                                                                    <span className="badge-code-text">
                                                                        {ord.couponCode}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        );
                                                    }
                                                    if (hasManual) {
                                                         const cleanReason = (ord.reason || '').replace(/\s*\((.*?)\)\s*/g, ' - $1');
                                                         const parts = cleanReason.split(' - ');
                                                         const main = parts[0] || 'خصم يدوي';
                                                         const sub = parts.slice(1).join(' - ');

                                                         badges.push(
                                                             <div key="mn" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                                                                 <span className="badge-manual-pill">
                                                                     <i className="fa-solid fa-user-pen" style={{ fontSize: '9px' }}></i> يدوي
                                                                 </span>
                                                                 {main && main !== 'بدون سبب محدد' && (
                                                                     <span className="badge-reason-text">
                                                                         {main}
                                                                     </span>
                                                                 )}
                                                                 {sub && (
                                                                     <span className="badge-details-text">
                                                                         {sub}
                                                                     </span>
                                                                 )}
                                                             </div>
                                                         );
                                                     }
                                                    if (hasProduct) {
                                                        badges.push(
                                                            <span key="pd" className="badge-product-pill">
                                                                <i className="fa-solid fa-box-open" style={{ fontSize: '9px' }}></i> عروض منتجات
                                                            </span>
                                                        );
                                                    }
                                                    return <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', justifyContent: 'flex-start', alignItems: 'center' }}>{badges}</div>;
                                                })();

                                                return (
                                                    <tr key={idx}>
                                                        <td style={{ fontWeight: '700', color: 'var(--gold-primary)', fontFamily: 'monospace' }}>{ord.id}</td>
                                                        <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{ord.client}</td>
                                                        <td style={{ textAlign: 'left' }} className="tabular-amount">
                                                            {currency} {ord.originalTotal.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                                        </td>
                                                        <td style={{ textAlign: 'left', fontWeight: 'bold', color: '#ef4444' }} className="tabular-amount">
                                                            -{currency} {ord.totalDiscount.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                                        </td>
                                                        <td style={{ textAlign: 'left', fontWeight: 'bold', color: '#2ecc71' }} className="tabular-amount">
                                                            {currency} {ord.finalTotal.toLocaleString('en-US', {maximumFractionDigits: 0})}
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>{discountTypeBadge}</td>
                                                        <td style={{ textAlign: 'center', color: 'var(--text-secondary)' }}>
                                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                                                <i className="fa-regular fa-user" style={{ opacity: 0.4, fontSize: '10px' }}></i>
                                                                {ord.admin}
                                                            </div>
                                                        </td>
                                                    </tr>
                                                );
                                            })
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Discount Pagination Controls */}
                            {sortedDiscountedOrders.length > 0 && (
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>
                                        عرض <strong>{((discountPage - 1) * discountItemsPerPage) + 1} - {Math.min(discountPage * discountItemsPerPage, sortedDiscountedOrders.length)}</strong> من أصل <strong>{sortedDiscountedOrders.length}</strong> طلب مخصوم
                                    </div>

                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setDiscountPage(prev => Math.max(1, prev - 1))}
                                            disabled={discountPage === 1}
                                            style={{ padding: '4px 10px', fontSize: '11px', opacity: discountPage === 1 ? 0.4 : 1, cursor: discountPage === 1 ? 'not-allowed' : 'pointer' }}
                                        >
                                            <i className="fa-solid fa-chevron-right"></i> السابق
                                        </button>

                                        <span style={{ fontSize: '11px', fontWeight: '700', color: 'var(--gold-primary)', padding: '0 6px' }}>
                                            {discountPage} / {totalDiscountPages}
                                        </span>

                                        <button
                                            className="btn btn-secondary"
                                            onClick={() => setDiscountPage(prev => Math.min(totalDiscountPages, prev + 1))}
                                            disabled={discountPage >= totalDiscountPages}
                                            style={{ padding: '4px 10px', fontSize: '11px', opacity: discountPage >= totalDiscountPages ? 0.4 : 1, cursor: discountPage >= totalDiscountPages ? 'not-allowed' : 'pointer' }}
                                        >
                                            التالي <i className="fa-solid fa-chevron-left"></i>
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })()}

            </div>

            {/* Modals for All Categories & All Products */}
            <Modal isOpen={isCatModalOpen} onClose={() => setIsCatModalOpen(false)} title="تقرير مبيعات الأقسام التفصيلي" width="600px">
                <div className="table-wrapper" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.85rem' }}>
                        <thead>
                            <tr>
                                <th>اسم القسم</th>
                                <th>الكمية المباعة</th>
                                <th style={{ textAlign: 'right' }}>صافي الإيراد</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedCategories.map((cat, idx) => (
                                <tr key={`mod-cat-${idx}`}>
                                    <td style={{ fontWeight: '600' }}>{cat.name}</td>
                                    <td>{cat.itemsSold} قطعة</td>
                                    <td style={{ textAlign: 'right', fontWeight: '700', color: 'var(--gold-primary)' }}>
                                        {currency} {cat.revenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Modal>

            <Modal isOpen={isProdModalOpen} onClose={() => setIsProdModalOpen(false)} title="ربحية جميع المنتجات والأصناف" width="1000px">
                <div className="table-wrapper reports-desktop-only" style={{ maxHeight: '65vh', overflowY: 'auto', overflowX: 'auto' }}>
                    <table className="custom-table" style={{ fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                        <thead>
                            <tr>
                                <th style={{ textAlign: 'right' }}>المنتج والصنف</th>
                                <th style={{ textAlign: 'right' }}>SKU</th>
                                <th style={{ textAlign: 'right' }}>القسم</th>
                                <th style={{ textAlign: 'center' }}>الكمية المباعة</th>
                                <th style={{ textAlign: 'center' }}>صافي الإيراد</th>
                                <th style={{ textAlign: 'center' }}>تكلفة المباع (COGS)</th>
                                <th style={{ textAlign: 'center' }}>صافي الربح</th>
                                <th style={{ textAlign: 'center' }}>نسبة الهامش</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedProducts.map((prod, idx) => (
                                <tr key={`mod-prod-${idx}`}>
                                    <td style={{ fontWeight: '600', color: 'var(--text-primary)' }}>{prod.name}</td>
                                    <td style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>{prod.sku}</td>
                                    <td>{prod.category}</td>
                                    <td style={{ textAlign: 'center', fontWeight: '700' }}>{prod.qtySold}</td>
                                    <td style={{ textAlign: 'center', fontWeight: '600', color: 'var(--color-info)' }}>
                                        {currency} {prod.netRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center', color: '#a084dc' }}>
                                        {currency} {prod.cogs.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center', fontWeight: '700', color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>
                                        {currency} {prod.netProfit.toLocaleString('en-US', { maximumFractionDigits: 0 })}
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`}>
                                            {prod.marginPct}%
                                        </span>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="reports-mobile-cards" style={{ display: 'none', flexDirection: 'column', gap: '12px', maxHeight: '65vh', overflowY: 'auto', padding: '8px' }}>
                    {sortedProducts.map((prod, idx) => (
                        <div key={`mod-prod-mob-${idx}`} className="sa-mobile-card" style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '14px', display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <strong style={{ color: 'var(--text-primary)', fontSize: '13px' }}>{prod.name}</strong>
                                <span className={`badge ${prod.marginPct >= 30 ? 'badge-success' : prod.marginPct >= 15 ? 'badge-warning' : 'badge-danger'}`} style={{ fontSize: '10.5px' }}>
                                    {prod.marginPct}% هامش
                                </span>
                            </div>
                            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', fontSize: '11px', color: 'var(--text-secondary)' }}>
                                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>SKU: {prod.sku}</span>
                                <span style={{ background: 'rgba(255,255,255,0.04)', padding: '2px 6px', borderRadius: '4px' }}>{prod.category}</span>
                            </div>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '8px', padding: '8px', background: 'rgba(255,255,255,0.01)', borderRadius: '4px', fontSize: '11.5px', marginTop: '4px' }}>
                                <div>الكمية المباعة: <strong style={{ color: '#fff' }}>{prod.qtySold}</strong></div>
                                <div>صافي الإيراد: <strong style={{ color: 'var(--color-info)' }}>{currency} {prod.netRevenue.toLocaleString()}</strong></div>
                                <div>تكلفة المباع: <strong style={{ color: '#a084dc' }}>{currency} {prod.cogs.toLocaleString()}</strong></div>
                                <div>صافي الربح: <strong style={{ color: prod.netProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' }}>{currency} {prod.netProfit.toLocaleString()}</strong></div>
                            </div>
                        </div>
                    ))}
                </div>
            </Modal>

        </div>
    );
}
