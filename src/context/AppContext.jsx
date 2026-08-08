import { formatProductDisplayName, normalizePhone, cleanVariantName } from '../utils/productUtils';
import { supabase } from '../utils/supabase';
import { getLocalDateString } from '../utils/dateUtils';
import React, { createContext, useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const AppContext = createContext();

const defaultSuppliers = [];

const defaultProducts = [];

const defaultOrders = [];

const defaultStockLedger = [];

const defaultActivities = [];

export const DEFAULT_SHIPPING_FEES = {
  "القاهرة": 65,
  "الجيزة": 65,
  "الإسكندرية": 65,
  "القليوبية": 65,
  "الشرقية": 65,
  "الدقهلية": 65,
  "البحيرة": 65,
  "الغربية": 65,
  "المنوفية": 65,
  "كفر الشيخ": 65,
  "دمياط": 65,
  "بورسعيد": 75,
  "الإسماعيلية": 75,
  "السويس": 75,
  "بني سويف": 80,
  "الفيوم": 80,
  "المنيا": 80,
  "أسيوط": 80,
  "سوهاج": 80,
  "قنا": 100,
  "الأقصر": 100,
  "أسوان": 100,
  "البحر الأحمر": 100,
  "مطروح": 100,
  "الساحل الشمالي": 100,
  "شمال سيناء": 120,
  "جنوب سيناء": 120,
  "الوادي الجديد": 120
};

export const getShippingFeeForGov = (govName, currentFeesMap) => {
    const fees = currentFeesMap || DEFAULT_SHIPPING_FEES;
    if (!govName) return fees["القاهرة"] || 65;

    const clean = (str) => String(str || '')
        .trim()
        .toLowerCase()
        .replace(/[أإآء]/g, 'ا')
        .replace(/ه$/g, 'ة')
        .replace(/\s+/g, '');

    const target = clean(govName);

    // 1. Direct exact key match
    if (fees[govName] !== undefined) return parseFloat(fees[govName]) || 0;

    // 2. Normalized match across keys
    for (const key of Object.keys(fees)) {
        const cleanedKey = clean(key);
        if (cleanedKey === target || target.includes(cleanedKey) || cleanedKey.includes(target)) {
            return parseFloat(fees[key]) || 0;
        }
    }

    return fees["القاهرة"] || 65;
};

    const initialState = {
        products: [],
        suppliers: [],
        orders: [],
        deletedOrdersWithDeposits: [],
        purchaseOrders: [],
        wastes: [],
        stockLedger: [],
        customers: [],
        coupons: [],
        users: [],
        activities: [],
        collections: [],
        storeSettings: { name: "a5tabot dashboard", address: "Egypt", currency: "EGP", vipThresholdPurchases: 5000, vipThresholdOrders: 10 },
        userAvatars: {},
        influencers: [],
        currentUser: null,
        shippingFees: (function() {
            try {
                const saved = localStorage.getItem('octabot_shipping_fees_v2');
                return saved ? JSON.parse(saved) : DEFAULT_SHIPPING_FEES;
            } catch(e) {
                return DEFAULT_SHIPPING_FEES;
            }
        })()
    };

const getFunctionsErrorMessage = async (error) => {
    if (!error) return "";
    try {
        if (error.context && typeof error.context.json === 'function') {
            const errBody = await error.context.json();
            if (errBody && errBody.error) {
                let detailsStr = "";
                if (errBody.details && errBody.details.errors) {
                    detailsStr = " (" + JSON.stringify(errBody.details.errors) + ")";
                } else if (errBody.details) {
                    detailsStr = " (" + JSON.stringify(errBody.details) + ")";
                }
                return `${errBody.error}${detailsStr}`;
            }
        }
    } catch (e) {
        console.error("Error parsing function error response body:", e);
    }
    return error.message || String(error);
};

export const AppProvider = ({ children }) => {
    const [state, setState] = useState(() => {
        try {
            const resetFlag = localStorage.getItem("octabot_reset_v3");
            if (!resetFlag) {
                localStorage.removeItem("octabot_state");
                localStorage.setItem("octabot_reset_v3", "true");
                return initialState;
            }
            const saved = localStorage.getItem("octabot_state");
            if (saved) {
                const parsed = JSON.parse(saved);
                if (parsed &&
                    Array.isArray(parsed.products) &&
                    Array.isArray(parsed.suppliers) &&
                    Array.isArray(parsed.orders) &&
                    Array.isArray(parsed.wastes) &&
                    Array.isArray(parsed.purchaseOrders) &&
                    Array.isArray(parsed.stockLedger) &&
                    parsed.storeSettings) {
                    return {
                        ...parsed,
                        shippingFees: (function() {
                            try {
                                const savedFees = localStorage.getItem('octabot_shipping_fees_v2');
                                return savedFees ? JSON.parse(savedFees) : DEFAULT_SHIPPING_FEES;
                            } catch(e) {
                                return DEFAULT_SHIPPING_FEES;
                            }
                        })()
                    };
                }
            }
        } catch (e) {
            console.error("Failed to parse localStorage state:", e);
        }
        return initialState;
    });

    const stateRef = useRef(state);
    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    // Fetch WMS ERP records from Supabase on load
    const loadSupabaseData = useCallback(async () => {
            if (!supabase) return;
            if (!state.currentUser) return;
            try {
                // Calculate ninety days ago for orders, wastes, ledger
                const ninetyDaysAgo = new Date();
                ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
                const ninetyDaysAgoStr = ninetyDaysAgo.toISOString().split('T')[0];

                // Calculate 180 days ago for purchase orders
                const purchaseCutoff = new Date();
                purchaseCutoff.setDate(purchaseCutoff.getDate() - 180);
                const purchaseCutoffStr = purchaseCutoff.toISOString().split('T')[0];

                const [
                    { data: products, error: pErr },
                    { data: variants, error: vErr },
                    { data: suppliers, error: sErr },
                    { data: orders, error: oErr },
                    { data: purchaseOrders, error: poErr },
                    { data: ledger, error: lErr },
                    { data: wastes, error: wErr },
                    { data: customers, error: cErr },
                    { data: coupons, error: couErr },
                    { data: users, error: uErr },
                    { data: collections, error: colErr }
                ] = await Promise.all([
                    supabase.from('products').select('*'),
                    supabase.from('product_variants').select('*'),
                    supabase.from('suppliers').select('*'),
                    supabase.from('orders')
                        .select('*')
                        .or(`date.gte.${ninetyDaysAgoStr},status.not.in.(Completed,Cancelled),deposit_status.eq.pending,deposit_refund_status.eq.awaiting_return`)
                        .order('date', { ascending: false }),
                    supabase.from('purchase_orders')
                        .select('*')
                        .gte('created_at', purchaseCutoffStr)
                        .order('created_at', { ascending: false }),
                    supabase.from('stock_ledger')
                        .select('*')
                        .gte('date', ninetyDaysAgo.toISOString())
                        .order('date', { ascending: false }),
                    supabase.from('wastes')
                        .select('*')
                        .gte('date', ninetyDaysAgoStr)
                        .order('date', { ascending: false }),
                    supabase.from('customers')
                        .select('*')
                        .order('created_at', { ascending: false })
                        .limit(500),
                    supabase.from('coupons').select('*'),
                    supabase.from('user_profiles').select('*'),
                    supabase.from('shopify_collections').select('*')
                ]);

                if (pErr || vErr || sErr || oErr || poErr || lErr || wErr || cErr || couErr || uErr || colErr) {
                    console.error("Supabase load error detail:", { pErr, vErr, sErr, oErr, poErr, lErr, wErr, cErr, couErr, uErr, colErr });
                    showToast("فشل تحميل البيانات من السيرفر. يرجى تحديث الصفحة أو التحقق من الاتصال بالإنترنت.", "error");
                    return;
                }

                // Fetch items only for loaded orders and purchase orders
                const orderIds = (orders || []).map(o => o.id);
                const poIds = (purchaseOrders || []).map(po => po.id);

                let orderItems = [];
                let purchaseItems = [];

                const itemFetchPromises = [];
                if (orderIds.length > 0) {
                    itemFetchPromises.push(
                        supabase.from('order_items').select('*').in('order_id', orderIds).then(({ data, error }) => {
                            if (error) console.error("Error loading order items:", error);
                            if (data) orderItems = data;
                        })
                    );
                }
                if (poIds.length > 0) {
                    itemFetchPromises.push(
                        supabase.from('purchase_items').select('*').in('po_id', poIds).then(({ data, error }) => {
                            if (error) console.error("Error loading purchase items:", error);
                            if (data) purchaseItems = data;
                        })
                    );
                }

                if (itemFetchPromises.length > 0) {
                    await Promise.all(itemFetchPromises);
                }

                let telegramMappings = [];
                try {
                    const { data: tmData } = await supabase.from('telegram_mappings').select('*');
                    if (tmData) telegramMappings = tmData;
                } catch (e) {
                    console.error("Failed to load telegram mappings:", e);
                }

                const mappedProducts = (products || []).map(p => {
                    const pVars = (variants || []).filter(v => v.product_id === p.id).map(v => ({
                        sku: v.sku,
                        name: v.name,
                        barcode: v.barcode,
                        wholesalePrice: parseFloat(v.wholesale_price) || 0,
                        retailPrice: parseFloat(v.retail_price) || 0,
                        reorderLimit: parseInt(v.reorder_limit) || 0,
                        stock: { Sulur: parseInt(v.stock_sulur) || 0 },
                        shopify_id: v.shopify_id || null,
                        averageCost: parseFloat(v.average_cost) || parseFloat(v.wholesale_price) || 0,
                        is_active: v.is_active !== false
                    }));

                    let parsedImageStr = p.image;
                    let parsedImages = [];
                    let parsedVendor = '';
                    let parsedTags = '';
                    let parsedStatus = p.status || 'active';

                    try {
                        if (p.image && p.image.startsWith('{') && p.image.includes('"images"')) {
                            const obj = JSON.parse(p.image);
                            parsedImages = obj.images || [];
                            parsedVendor = obj.vendor || '';
                            parsedTags = obj.tags || '';
                            if (obj.status) parsedStatus = obj.status;
                            parsedImageStr = JSON.stringify(parsedImages);
                        } else if (p.image && p.image.startsWith('[')) {
                            parsedImageStr = p.image;
                            parsedImages = JSON.parse(p.image);
                        }
                    } catch (e) {
                        parsedImageStr = p.image;
                    }

                    let cleanDescription = p.description || '';
                    if (cleanDescription) {
                        cleanDescription = cleanDescription
                            .replace(/(?:<br\s*\/?>)*\s*<strong>Vendor:<\/strong>[\s\S]*$/i, '')
                            .replace(/(?:<br\s*\/?>)*\s*Vendor:\s*[^\n<]*\s*Tags:[^\n<]*/gi, '')
                            .trim();
                    }

                    return {
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        unit: p.unit,
                        image: parsedImageStr,
                        images: parsedImages,
                        vendor: parsedVendor,
                        tags: parsedTags,
                        createdDate: p.created_date,
                        createdBy: p.created_by,
                        description: cleanDescription,
                        shopify_id: p.shopify_id || null,
                        shopifyCollectionIds: p.shopify_collection_ids || [],
                        status: parsedStatus,
                        variants: pVars
                    };
                });

                const mappedSuppliers = (suppliers || []).map(s => ({
                    id: s.id,
                    name: s.name,
                    contact: s.contact,
                    phone: s.phone,
                    debt: parseFloat(s.debt) || 0,
                    paid: parseFloat(s.paid) || 0,
                    createdBy: s.created_by,
                    createdAt: s.created_at || null
                }));

                const mappedOrders = (orders || []).map(o => {
                    const items = (orderItems || []).filter(oi => oi.order_id === o.id).map(oi => ({
                        variantSku: oi.variant_sku,
                        quantity: parseInt(oi.quantity) || 0,
                        price: parseFloat(oi.price) || 0,
                        costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0,
                        productName: oi.product_name || null,
                        variantName: oi.variant_name || null
                    }));
                    let isReviewed = false;
                    let isDeleted = false;
                    if (o.address) {
                        if (typeof o.address === 'object') {
                            isReviewed = !!(o.address.isReviewed || o.address.is_reviewed);
                            isDeleted = !!(o.address.isDeleted || o.address.is_deleted);
                        } else if (typeof o.address === 'string' && o.address.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(o.address);
                                isReviewed = !!(parsed.isReviewed || parsed.is_reviewed);
                                isDeleted = !!(parsed.isDeleted || parsed.is_deleted);
                            } catch(e) {}
                        }
                    }
                    return {
                        id: o.id,
                        client: o.client,
                        date: o.date,
                        createdAt: o.created_at || null,
                        warehouse: o.warehouse,
                        status: o.status,
                        totalValue: parseFloat(o.total_value) || 0,
                        address: o.address || '',
                        governorate: o.governorate || '',
                        deposit: parseFloat(o.deposit) || 0,
                        depositReceiverId: o.deposit_receiver_id || null,
                        depositStatus: o.deposit_status || 'confirmed',
                        depositRefundStatus: o.deposit_refund_status || null,
                        depositRefundScreenshot: o.deposit_refund_screenshot || o.deposit_refund_proof_url || null,
                        depositRefundAmount: o.deposit_refund_amount !== undefined && o.deposit_refund_amount !== null ? parseFloat(o.deposit_refund_amount) : null,
                        depositRefundType: o.deposit_refund_type || null,
                        shipping_fee: parseFloat(o.shipping_fee) || 0,
                        createdBy: o.created_by,
                        updatedBy: o.updated_by || null,
                        shopifyOrderId: o.shopify_order_id || null,
                        source: o.source || 'manual',
                        paymentMethod: o.payment_method || null,
                        customer_id: o.customer_id || null,
                        discount_type: o.discount_type || null,
                        discount_value: parseFloat(o.discount_value) || 0,
                        applied_coupon_code: o.applied_coupon_code || null,
                        discount_reason: o.discount_reason || null,
                        discount_reason_details: o.discount_reason_details || null,
                        is_reviewed: isReviewed,
                        isReviewed: isReviewed,
                        isDeleted: isDeleted,
                        is_deleted: isDeleted,
                        items
                    };
                });

                const mappedPurchaseOrders = (purchaseOrders || []).map(po => {
                    const items = (purchaseItems || []).filter(poi => poi.po_id === po.id).map(poi => ({
                        variantSku: poi.variant_sku,
                        quantity: parseInt(poi.quantity) || 0,
                        cost: parseFloat(poi.cost) || 0
                    }));
                    return {
                        id: po.id,
                        supplierId: po.supplier_id,
                        date: po.date,
                        createdAt: po.created_at || null,
                        warehouse: po.warehouse,
                        totalCost: parseFloat(po.total_cost) || 0,
                        createdBy: po.created_by,
                        items
                    };
                });

                const mappedWastes = (wastes || []).map(w => ({
                    id: `WST-${w.id}`,
                    rawId: w.id,
                    date: w.date,
                    variantSku: w.variant_sku,
                    quantity: parseInt(w.quantity) || 0,
                    warehouse: "Sulur",
                    cost: 0,
                    reporter: "sfsf",
                    createdAt: w.created_at || null
                }));

                const mappedLedger = (ledger || []).map(l => ({
                    id: l.id,
                    date: l.date,
                    productId: l.product_id,
                    variantSku: l.variant_sku,
                    warehouse: l.warehouse,
                    type: l.type,
                    quantity: parseInt(l.quantity) || 0,
                    balanceAfter: parseInt(l.balance_after) || 0,
                    orderId: l.order_id || null,
                    unitCost: parseFloat(l.unit_cost) || 0,
                    totalCost: parseFloat(l.total_cost) || 0,
                    notes: l.notes || null,
                    created_at: l.created_at || null
                }));

                // Sort products: newest first
                mappedProducts.sort((a, b) => {
                    const dateA = a.createdDate || '';
                    const dateB = b.createdDate || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort suppliers: newest first
                mappedSuppliers.sort((a, b) => {
                    const timeA = a.createdAt || '';
                    const timeB = b.createdAt || '';
                    if (timeA && timeB) return timeB.localeCompare(timeA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort orders: newest first (using created_at timestamp)
                mappedOrders.sort((a, b) => {
                    const timeA = a.createdAt || '';
                    const timeB = b.createdAt || '';
                    if (timeA && timeB) return timeB.localeCompare(timeA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort purchase orders: newest first
                mappedPurchaseOrders.sort((a, b) => {
                    const timeA = a.createdAt || '';
                    const timeB = b.createdAt || '';
                    if (timeA && timeB) return timeB.localeCompare(timeA);
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort wastes: newest first
                mappedWastes.sort((a, b) => {
                    const timeA = a.createdAt || '';
                    const timeB = b.createdAt || '';
                    if (timeA && timeB) return timeB.localeCompare(timeA);
                    return b.rawId - a.rawId;
                });

                // Sort stock ledger logs: newest first
                mappedLedger.sort((a, b) => {
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return b.id - a.id;
                });

                const sortedCustomers = (customers || []).sort((a, b) => {
                    const dateA = a.created_at || '';
                    const dateB = b.created_at || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                const sortedCoupons = (coupons || []).sort((a, b) => {
                    const dateA = a.created_at || '';
                    const dateB = b.created_at || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                const sortedUsers = (users || []).sort((a, b) => {
                    const dateA = a.created_at || '';
                    const dateB = b.created_at || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                const sortedCollections = (collections || []).sort((a, b) => {
                    const dateA = a.updated_at || '';
                    const dateB = b.updated_at || '';
                    return dateB.localeCompare(dateA);
                });

                const sysShippingFeeProfile = (users || []).find(u => u.id === 'system_shipping_fees');
                let dbShippingFees = null;
                if (sysShippingFeeProfile && sysShippingFeeProfile.avatar) {
                    try {
                        const parsed = JSON.parse(sysShippingFeeProfile.avatar);
                        if (parsed && typeof parsed === 'object') {
                            dbShippingFees = parsed;
                            localStorage.setItem('octabot_shipping_fees_v2', JSON.stringify(parsed));
                        }
                    } catch (e) {}
                }

                const actualStaffUsers = (sortedUsers || []).filter(u => u.id !== 'system_shipping_fees');

                const loadedUserAvatars = {};
                (users || []).forEach(u => {
                    if (u.avatar && u.id !== 'system_shipping_fees') {
                        loadedUserAvatars[u.id] = u.avatar;
                    }
                });

                setState(prev => ({
                    ...prev,
                    products: mappedProducts,
                    suppliers: mappedSuppliers,
                    orders: mappedOrders.filter(o => !o.isDeleted),
                    deletedOrdersWithDeposits: mappedOrders.filter(o => o.isDeleted && o.deposit > 0),
                    purchaseOrders: mappedPurchaseOrders,
                    wastes: mappedWastes,
                    customers: sortedCustomers,
                    coupons: sortedCoupons,
                    influencers: (sortedCoupons).filter(c => !!c.name).map(c => ({
                        id: c.id,
                        name: c.name,
                        code: c.code.toUpperCase(),
                        type: c.discount_type === 'Percentage' ? 'percentage' : 'fixed_amount',
                        value: parseFloat(c.discount_value),
                        endDate: c.expiry_date || null,
                        usageLimit: c.usage_limit || null,
                        minOrderValue: c.min_order_value || null,
                        createdAt: c.created_at
                    })),
                    users: (actualStaffUsers).map(u => {
                        const tm = (telegramMappings || []).find(m => m.user_id === u.id);
                        return { ...u, telegram_chat_id: tm ? tm.telegram_chat_id : '' };
                    }),
                    userAvatars: { ...prev.userAvatars, ...loadedUserAvatars },
                    stockLedger: mappedLedger,
                    collections: sortedCollections,
                    shippingFees: dbShippingFees || prev.shippingFees || DEFAULT_SHIPPING_FEES
                }));

                // Retroactively repair legacy orders that have deposit > 0 but null deposit_receiver_id
                setTimeout(() => {
                    const nullDepositOrders = mappedOrders.filter(o => (o.deposit || 0) > 0 && !o.depositReceiverId && !!o.createdBy);
                    if (nullDepositOrders.length > 0 && sortedUsers.length > 0) {
                        const updatesToRun = [];
                        const fixedMap = {};
                        for (const ord of nullDepositOrders) {
                            const creatorName = String(ord.createdBy).trim().toLowerCase();
                            const matchedUser = sortedUsers.find(u => u.name && String(u.name).trim().toLowerCase() === creatorName);
                            if (matchedUser && matchedUser.id) {
                                updatesToRun.push(
                                    supabase
                                        .from('orders')
                                        .update({ deposit_receiver_id: matchedUser.id })
                                        .eq('id', ord.id)
                                );
                                fixedMap[ord.id] = matchedUser.id;
                            }
                        }
                        if (updatesToRun.length > 0) {
                            Promise.all(updatesToRun).then(() => {
                                console.log(`[Auto-Fix] Successfully repaired ${updatesToRun.length} legacy null-deposit orders.`);
                                setState(prev => ({
                                    ...prev,
                                    orders: (prev.orders || []).map(o => {
                                        if (fixedMap[o.id]) {
                                            return { ...o, depositReceiverId: fixedMap[o.id] };
                                        }
                                        return o;
                                    })
                                }));
                            }).catch(err => {
                                console.error("[Auto-Fix] Error updating legacy deposit orders:", err);
                            });
                        }
                    }
                }, 1000);
            } catch (err) {
                console.error("Supabase load error:", err);
            }
    }, [state.currentUser?.id]);

    const searchOrdersDatabase = async (searchVal) => {
        if (!supabase || !searchVal || searchVal.length < 3) return;
        try {
            console.log("Searching orders database for:", searchVal);
            const { data: dbOrders, error } = await supabase
                .from('orders')
                .select('*')
                .or(`id.ilike.%${searchVal}%,client.ilike.%${searchVal}%,address.ilike.%${searchVal}%`)
                .limit(50);

            if (error) throw error;

            if (dbOrders && dbOrders.length > 0) {
                const orderIds = dbOrders.map(o => o.id);
                const { data: dbItems, error: oiErr } = await supabase
                    .from('order_items')
                    .select('*')
                    .in('order_id', orderIds);

                if (oiErr) console.error("Error fetching items during search:", oiErr);

                const enriched = dbOrders.map(o => {
                    const oItems = (dbItems || []).filter(oi => oi.order_id === o.id).map(oi => ({
                        variantSku: oi.variant_sku,
                        quantity: parseInt(oi.quantity) || 0,
                        price: parseFloat(oi.price) || 0,
                        costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0
                    }));
                    let isReviewed = false;
                    if (o.address) {
                        if (typeof o.address === 'object') {
                            isReviewed = !!(o.address.isReviewed || o.address.is_reviewed);
                        } else if (typeof o.address === 'string' && o.address.trim().startsWith('{')) {
                            try {
                                const parsed = JSON.parse(o.address);
                                isReviewed = !!(parsed.isReviewed || parsed.is_reviewed);
                            } catch(e) {}
                        }
                    }
                    return {
                        ...o,
                        items: oItems,
                        isReviewed: isReviewed,
                        is_reviewed: isReviewed,
                        shopifyOrderId: o.shopify_order_id,
                        paymentMethod: o.payment_method,
                        shippingFee: o.shipping_fee,
                        depositReceiverId: o.deposit_receiver_id,
                        depositStatus: o.deposit_status
                    };
                });

                setState(prev => {
                    const existingIds = new Set((prev.orders || []).map(o => o.id));
                    const newOrders = enriched.filter(o => !existingIds.has(o.id));
                    if (newOrders.length === 0) return prev;
                    return {
                        ...prev,
                        orders: [...prev.orders, ...newOrders]
                    };
                });
            }
        } catch (e) {
            console.error("Failed database search for orders:", e);
        }
    };

    const searchCustomersDatabase = async (searchVal) => {
        if (!supabase || !searchVal || searchVal.length < 3) return;
        try {
            console.log("Searching customers database for:", searchVal);
            const { data: dbCust, error } = await supabase
                .from('customers')
                .select('*')
                .or(`name.ilike.%${searchVal}%,phone.ilike.%${searchVal}%`)
                .limit(50);

            if (error) throw error;

            if (dbCust && dbCust.length > 0) {
                setState(prev => {
                    const existingIds = new Set((prev.customers || []).map(c => c.id));
                    const newCust = dbCust.filter(c => !existingIds.has(c.id));
                    if (newCust.length === 0) return prev;
                    return {
                        ...prev,
                        customers: [...prev.customers, ...newCust]
                    };
                });
            }
        } catch (e) {
            console.error("Failed database search for customers:", e);
        }
    };

    useEffect(() => {
        loadSupabaseData();
    }, [loadSupabaseData]);

     // Auto-refresh on visibility/focus was removed to prevent excessive PostgREST egress network traffic in production.


    const navigate = useNavigate();
    const location = useLocation();
    
    // Derived view from path (default 'dashboard' if root)
    const currentView = location.pathname === '/' ? 'dashboard' : location.pathname.substring(1).split('/')[0];
    
    const setCurrentView = (view) => {
        navigate(`/${view}`);
    };
    const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
    const [shopifyNotification, setShopifyNotification] = useState({
        visible: false,
        orderId: "",
        client: "",
        totalValue: 0,
        itemCount: 0
    });
    const [language, setLanguage] = useState("ar");
    const [theme, setTheme] = useState("dark");

    const [confirmSpamToggle, setConfirmSpamToggle] = useState(false);
    const confirmSpamToggleRef = useRef(false);
    const toggleSpamFlag = (val) => {
        confirmSpamToggleRef.current = val;
        setConfirmSpamToggle(val);
    };
    const [confirmModal, setConfirmModal] = useState({
        isOpen: false,
        title: 'تأكيد الإجراء',
        message: '',
        onConfirm: null,
        onCancel: null,
        type: 'confirm',
        showSpamToggle: false
    });

    const showConfirm = (message, onConfirm, onCancel = null, options = {}) => {
        toggleSpamFlag(false);
        setConfirmModal({
            isOpen: true,
            title: language === 'ar' ? 'تأكيد الإجراء' : 'Confirm Action',
            message: message,
            onConfirm: (flagAsSpam) => {
                try {
                    onConfirm(flagAsSpam);
                } catch (e) {
                    console.error("Error in showConfirm callback:", e);
                }
                closeConfirmModal();
            },
            onCancel: () => {
                if (onCancel) onCancel();
                closeConfirmModal();
            },
            type: 'confirm',
            showSpamToggle: !!options.showSpamToggle
        });
    };

    const showAlert = (message) => {
        setConfirmModal({
            isOpen: true,
            title: language === 'ar' ? 'تنبيه' : 'Alert',
            message: message,
            onConfirm: closeConfirmModal,
            onCancel: closeConfirmModal,
            type: 'alert'
        });
    };

    const closeConfirmModal = () => {
        setConfirmModal(prev => ({ ...prev, isOpen: false }));
    };

    // octabot_view localStorage sync removed because URL is now the source of truth

    useEffect(() => {
        localStorage.setItem("octabot_lang", language);
        document.documentElement.dir = language === 'ar' ? 'rtl' : 'ltr';
        document.documentElement.lang = language;
        document.documentElement.style.setProperty('--font-family-active', language === 'ar' ? "'Cairo'" : "'Inter'");
    }, [language]);

    useEffect(() => {
        localStorage.setItem("octabot_theme", theme);
        document.documentElement.setAttribute("data-theme", theme);
    }, [theme]);

    // Realtime postgres subscription for Shopify order webhooks
    useEffect(() => {
        if (!supabase) return;

        console.log("Initializing Supabase Realtime subscription for orders...");

        const ordersChannel = supabase
            .channel('realtime-shopify-orders')
            .on(
                'postgres_changes',
                { event: 'INSERT', schema: 'public', table: 'orders' },
                async (payload) => {
                    const newOrder = payload.new;
                    console.log("Realtime INSERT event payload received for order:", newOrder.id, payload);

                    try {
                        // Retry fetching order_items up to 4 times with 1-second interval to ensure Edge Function finished inserting
                        let orderItems = [];
                        for (let attempt = 0; attempt < 4; attempt++) {
                            await new Promise(resolve => setTimeout(resolve, 1000));
                            const { data: fetchedItems, error: itemsErr } = await supabase
                                .from('order_items')
                                .select('*')
                                .eq('order_id', newOrder.id);
                            
                            if (fetchedItems && fetchedItems.length > 0) {
                                orderItems = fetchedItems;
                                break;
                            }
                        }

                        const items = (orderItems || []).map(oi => ({
                            variantSku: oi.variant_sku,
                            quantity: parseInt(oi.quantity) || 0,
                            price: parseFloat(oi.price) || 0,
                            costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0
                        }));

                        const enrichedOrder = {
                            id: newOrder.id,
                            client: newOrder.client,
                            date: newOrder.date,
                            createdAt: newOrder.created_at || null,
                            warehouse: newOrder.warehouse,
                            status: newOrder.status,
                            totalValue: parseFloat(newOrder.total_value) || 0,
                            address: newOrder.address || '',
                            governorate: newOrder.governorate || '',
                            deposit: parseFloat(newOrder.deposit) || 0,
                            depositReceiverId: newOrder.deposit_receiver_id || null,
                            depositStatus: newOrder.deposit_status || 'confirmed',
                            depositRefundStatus: newOrder.deposit_refund_status || null,
                            depositRefundScreenshot: newOrder.deposit_refund_screenshot || null,
                            shipping_fee: parseFloat(newOrder.shipping_fee) || 0,
                            createdBy: newOrder.created_by,
                            updatedBy: newOrder.updated_by || null,
                            shopifyOrderId: newOrder.shopify_order_id || null,
                            source: newOrder.source || 'manual',
                            paymentMethod: newOrder.payment_method || null,
                            customer_id: newOrder.customer_id || null,
                            discount_type: newOrder.discount_type || null,
                            discount_value: parseFloat(newOrder.discount_value) || 0,
                            applied_coupon_code: newOrder.applied_coupon_code || null,
                            discount_reason: newOrder.discount_reason || null,
                            discount_reason_details: newOrder.discount_reason_details || null,
                            items
                        };

                        console.log("Enriched realtime order structure:", enrichedOrder);

                        let added = false;
                        setState(curr => {
                            const exists = curr.orders.some(o => o.id === enrichedOrder.id);
                            if (exists) {
                                // Order already in local state (manually created). 
                                // Still sync address and customer_id from realtime payload.
                                console.log(`Order ${enrichedOrder.id} already in state. Syncing address/customer_id from realtime.`);
                                return {
                                    ...curr,
                                    orders: curr.orders.map(o => o.id === enrichedOrder.id ? {
                                        ...o,
                                        address: enrichedOrder.address || o.address,
                                        customer_id: enrichedOrder.customer_id || o.customer_id
                                    } : o)
                                };
                            }
                            added = true;
                            return {
                                ...curr,
                                orders: [enrichedOrder, ...curr.orders]
                            };
                        });

                        // Fetch only the fresh variant stock for the sold items in the order
                        const skus = items.map(oi => oi.variantSku).filter(Boolean);
                        if (skus.length > 0) {
                            const { data: freshVariants } = await supabase
                                .from('product_variants')
                                .select('*')
                                .in('sku', skus);

                            if (freshVariants && freshVariants.length > 0) {
                                setState(curr => {
                                    return {
                                        ...curr,
                                        products: (curr.products || []).map(p => ({
                                            ...p,
                                            variants: (p.variants || []).map(v => {
                                                const fv = freshVariants.find(fv => fv.sku === v.sku);
                                                if (fv) {
                                                    return {
                                                        ...v,
                                                        stock: {
                                                            ...v.stock,
                                                            Sulur: fv.stock_sulur !== undefined ? fv.stock_sulur : (v.stock?.Sulur || 0)
                                                        }
                                                    };
                                                }
                                                return v;
                                            })
                                        }))
                                    };
                                });
                            }
                        }

                        // Play sound and trigger popup notification only if it was actually added and is a Shopify order
                        const isShopify = enrichedOrder.source === 'shopify' || !!enrichedOrder.shopifyOrderId;
                        if (added && isShopify) {
                            try {
                                console.log("Playing notification audio alert...");
                                const audio = new Audio('/universfield-new-notification-031-480569.mp3');
                                audio.volume = 0.8;
                                audio.play().catch(e => console.warn("Audio autoplay blocked by browser policy:", e));
                            } catch (err) {
                                console.warn("Audio load/play error:", err);
                            }

                            console.log("Displaying Facebook-style notification popup...");
                            setShopifyNotification({
                                visible: true,
                                orderId: enrichedOrder.id,
                                client: enrichedOrder.client,
                                totalValue: enrichedOrder.totalValue,
                                itemCount: items.reduce((sum, i) => sum + i.quantity, 0)
                            });
                        }
                    } catch (e) {
                        console.error("Realtime load error:", e);
                    }
                }
            )
            .on(
                'postgres_changes',
                { event: 'UPDATE', schema: 'public', table: 'orders' },
                async (payload) => {
                    const updatedOrder = payload.new;
                    console.log("Realtime UPDATE event received for order:", updatedOrder.id, payload);
                    
                    const existing = stateRef.current.orders.find(o => o.id === updatedOrder.id);
                    if (!existing) return;

                    const newStatus = updatedOrder.status;
                    const isNewlyAwaitingRefund = updatedOrder.deposit_refund_status === 'awaiting_return' && existing.depositRefundStatus !== 'awaiting_return';
                    const isMyDeposit = updatedOrder.deposit_receiver_id === stateRef.current.currentUser?.id;

                    if (isNewlyAwaitingRefund && isMyDeposit) {
                        try {
                            const audio = new Audio('/universfield-new-notification-031-480569.mp3');
                            audio.volume = 0.8;
                            audio.play().catch(e => console.warn("Audio autoplay blocked:", e));
                            showToast(`⚠️ تنبيه إرجاع عربون: تم إلغاء الطلب #${updatedOrder.id}. يرجى فتح شاشة (تأكيد العرابين) لإعادة العربون (${updatedOrder.deposit} ج.م) للعميل.`, "warning");
                        } catch (e) {
                            console.error("Notification sound error:", e);
                        }
                    }

                    setState(prev => {
                        return {
                            ...prev,
                            orders: prev.orders.map(o => o.id === updatedOrder.id ? {
                                ...o,
                                status: newStatus,
                                address: updatedOrder.address || o.address,
                                deposit: parseFloat(updatedOrder.deposit) || 0,
                                depositReceiverId: updatedOrder.deposit_receiver_id || null,
                                depositStatus: updatedOrder.deposit_status || 'confirmed',
                                depositRefundStatus: updatedOrder.deposit_refund_status || null,
                                depositRefundAmount: updatedOrder.deposit_refund_amount || null,
                                depositRefundType: updatedOrder.deposit_refund_type || null,
                                customer_id: updatedOrder.customer_id || o.customer_id,
                                discount_type: updatedOrder.discount_type || o.discount_type,
                                discount_value: parseFloat(updatedOrder.discount_value) || o.discount_value,
                                applied_coupon_code: updatedOrder.applied_coupon_code || o.applied_coupon_code,
                                discount_reason: updatedOrder.discount_reason || o.discount_reason,
                                discount_reason_details: updatedOrder.discount_reason_details || o.discount_reason_details,
                                createdBy: updatedOrder.created_by || o.createdBy,
                                updatedBy: updatedOrder.updated_by || o.updatedBy
                            } : o)
                        };
                    });
                }
            )
            .on(
                'postgres_changes',
                { event: 'DELETE', schema: 'public', table: 'orders' },
                (payload) => {
                    const deletedOrder = payload.old;
                    console.log("Realtime DELETE event received for order:", deletedOrder?.id, payload);
                    if (!deletedOrder || !deletedOrder.id) return;
                    setState(prev => {
                        return {
                            ...prev,
                            orders: prev.orders.filter(o => o.id !== deletedOrder.id)
                        };
                    });
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime orders channel status: ${status}`, err || '');
            });

        const orderItemsChannel = supabase
            .channel('realtime-order-items-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'order_items' },
                (payload) => {
                    console.log("Realtime order_items event received:", payload.eventType, payload);
                    const item = payload.eventType === 'DELETE' ? payload.old : payload.new;
                    if (!item || !item.order_id) return;
                    
                    setState(prev => {
                        const orders = (prev.orders || []).map(o => {
                            if (String(o.id) === String(item.order_id)) {
                                let newItems = [...(o.items || [])];
                                const sku = item.variant_sku;
                                
                                if (payload.eventType === 'INSERT') {
                                    const mapped = {
                                        variantSku: item.variant_sku,
                                        quantity: parseInt(item.quantity) || 0,
                                        price: parseFloat(item.price) || 0,
                                        costAtTimeOfSale: parseFloat(item.cost_at_time_of_sale) || 0
                                    };
                                    if (!newItems.some(i => i.variantSku === sku)) {
                                        newItems.push(mapped);
                                    }
                                } else if (payload.eventType === 'UPDATE') {
                                    newItems = newItems.map(i => i.variantSku === sku ? {
                                        ...i,
                                        quantity: parseInt(item.quantity) || 0,
                                        price: parseFloat(item.price) || 0,
                                        costAtTimeOfSale: parseFloat(item.cost_at_time_of_sale) || 0
                                    } : i);
                                } else if (payload.eventType === 'DELETE') {
                                    newItems = newItems.filter(i => i.variantSku !== sku);
                                }
                                return { ...o, items: newItems };
                            }
                            return o;
                        });
                        return { ...prev, orders };
                    });
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime order_items channel status: ${status}`, err || '');
            });

        const customersChannel = supabase
            .channel('realtime-customers-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'customers' },
                (payload) => {
                    console.log("Realtime customers event received:", payload.eventType, payload);
                    if (payload.eventType === 'INSERT' && payload.new) {
                        setState(curr => {
                            if (curr.customers.some(c => c.id === payload.new.id)) return curr;
                            return { ...curr, customers: [payload.new, ...curr.customers] };
                        });
                    } else if (payload.eventType === 'UPDATE' && payload.new) {
                        setState(curr => ({
                            ...curr,
                            customers: curr.customers.map(c => c.id === payload.new.id ? payload.new : c)
                        }));
                    } else if (payload.eventType === 'DELETE' && payload.old) {
                        setState(curr => ({
                            ...curr,
                            customers: curr.customers.filter(c => c.id !== payload.old.id)
                        }));
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime customers channel status: ${status}`, err || '');
            });

        const stockLedgerChannel = supabase
            .channel('realtime-stock-ledger')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'stock_ledger' },
                (payload) => {
                    if (payload.eventType === 'INSERT' && payload.new) {
                        const entry = payload.new;
                        setState(curr => {
                            // Avoid duplicates
                            if (curr.stockLedger.some(l => l.id === entry.id)) return curr;
                            const mapped = {
                                id: entry.id,
                                date: entry.date,
                                productId: entry.product_id,
                                variantSku: entry.variant_sku,
                                warehouse: entry.warehouse,
                                type: entry.type,
                                quantity: parseInt(entry.quantity) || 0,
                                balanceAfter: parseInt(entry.balance_after) || 0,
                                orderId: entry.order_id || null,
                                unitCost: parseFloat(entry.unit_cost) || 0,
                                totalCost: parseFloat(entry.total_cost) || 0,
                                notes: entry.notes || null,
                                created_at: entry.created_at || null
                            };
                            return { ...curr, stockLedger: [mapped, ...curr.stockLedger] };
                        });
                    } else if (payload.eventType === 'DELETE' && payload.old) {
                        setState(curr => ({
                            ...curr,
                            stockLedger: curr.stockLedger.filter(l => l.id !== payload.old.id)
                        }));
                    } else if (payload.eventType === 'UPDATE' && payload.new) {
                        const entry = payload.new;
                        setState(curr => ({
                            ...curr,
                            stockLedger: curr.stockLedger.map(l => l.id === entry.id ? {
                                ...l,
                                quantity: parseInt(entry.quantity) || 0,
                                balanceAfter: parseInt(entry.balance_after) || 0,
                                notes: entry.notes || l.notes,
                                created_at: entry.created_at || l.created_at
                            } : l)
                        }));
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime stock_ledger channel status: ${status}`, err || '');
            });

        const userProfilesChannel = supabase
            .channel('realtime-user-profiles-sync')
            .on(
                'postgres_changes',
                { event: '*', schema: 'public', table: 'user_profiles' },
                (payload) => {
                    if (payload.new && payload.new.id === 'system_shipping_fees' && payload.new.avatar) {
                        try {
                            const freshFees = JSON.parse(payload.new.avatar);
                            if (freshFees && typeof freshFees === 'object') {
                                localStorage.setItem('octabot_shipping_fees_v2', JSON.stringify(freshFees));
                                setState(curr => ({ ...curr, shippingFees: freshFees }));
                                console.log("Realtime shipping fees synced across all admins!");
                            }
                        } catch(e) {}
                    }
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime user_profiles channel status: ${status}`, err || '');
            });

        return () => {
            console.log("Cleaning up Supabase Realtime channels...");
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(orderItemsChannel);
            supabase.removeChannel(customersChannel);
            supabase.removeChannel(stockLedgerChannel);
            supabase.removeChannel(userProfilesChannel);
        };
    }, [supabase, language]);

    const t = (key) => {
        const tr = translations[language] && translations[language][key];
        return tr || key;
    };

    useEffect(() => {
        localStorage.setItem("octabot_state", JSON.stringify(state));
    }, [state]);

    const showToast = (message, type = "success") => {
        setToast({ visible: true, message, type });
        setTimeout(() => {
            setToast(prev => ({ ...prev, visible: false }));
        }, 3000);
    };

    const logActivity = (type, description) => {
        const time = new Date().toISOString().replace('T', ' ').substring(0, 16);
        setState(prev => {
            const activities = [{ type, description, time }, ...prev.activities];
            if (activities.length > 30) activities.pop();
            return { ...prev, activities };
        });
    };

        useEffect(() => {
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single();
                if (profile && !profile.is_active) {
                    await supabase.auth.signOut();
                    setState(prev => ({ ...prev, currentUser: null }));
                    showToast("Your account is deactivated.", "error");
                    return;
                }
                const profileAvatar = profile?.avatar || null;
                setState(prev => ({
                    ...prev,
                    currentUser: {
                        id: session.user.id,
                        email: session.user.email,
                        name: profile ? profile.name : session.user.email.split('@')[0],
                        role: profile ? profile.role : 'Staff',
                        permissions: profile ? (profile.permissions || []) : [],
                        avatar: profileAvatar || (profile ? profile.name : session.user.email).substring(0, 1).toUpperCase()
                    },
                    userAvatars: profileAvatar
                        ? { ...prev.userAvatars, [session.user.id]: profileAvatar }
                        : prev.userAvatars
                }));
            } else {
                setState(prev => ({ ...prev, currentUser: null }));
            }
        });
        return () => subscription?.unsubscribe();
    }, []);

    const authLogin = async (email, password) => {
        if (!supabase) return false;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showToast("امشي يلا ألعب بعيد", "error");
            return false;
        }
        logActivity("auth", `User signed in.`);
        showToast(`Welcome back!`);
        setCurrentView("dashboard");
        return true;
    };

    
    const toggleUserStatus = async (userId, isActive) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('toggle_user_active', {
            p_user_id: userId,
            p_active: isActive
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === userId ? { ...u, is_active: isActive } : u)
        }));
        showToast("User status updated");
        return true;
    };

    const deleteUser = async (userId) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('delete_user_account', {
            p_user_id: userId
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).filter(u => u.id !== userId)
        }));
        showToast("User deleted successfully");
        return true;
    };

    
    const updateUserPermissions = async (userId, permissions) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('update_user_permissions', {
            p_user_id: userId,
            p_permissions: permissions
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === userId ? { ...u, permissions: permissions } : u)
        }));
        showToast("Permissions updated successfully");
        return true;
    };

    const updateUserTelegramChatId = async (userId, chatId) => {
        if (!supabase) return false;
        let error;
        if (!chatId) {
            const { error: err } = await supabase
                .from('telegram_mappings')
                .delete()
                .eq('user_id', userId);
            error = err;
        } else {
            const { error: err } = await supabase
                .from('telegram_mappings')
                .upsert({ user_id: userId, telegram_chat_id: chatId });
            error = err;
        }
        if (error) {
            showToast(error.message, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === userId ? { ...u, telegram_chat_id: chatId } : u)
        }));
        showToast("Telegram ID updated successfully");
        return true;
    };

    const sendAdminNotification = async (action, recipientEmail, data) => {
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/send-admin-notification`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    action,
                    recipientEmail,
                    data
                })
            });
            
            const resData = await response.json();
            if (!response.ok) {
                console.error("sendAdminNotification Error:", resData);
            } else {
                console.log("sendAdminNotification Success:", resData);
            }
        } catch (err) {
            console.error("Failed to send admin notification:", err);
        }
    };

    const authSignup = async (name, email, password, role, permissions = []) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('create_user_account', {
            p_email: email,
            p_password: password,
            p_name: name,
            p_role: role,
            p_permissions: permissions
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        logActivity("auth", `New ${role} account created for ${name}.`);
        showToast(`Account created successfully!`);
        
        // Trigger welcome email notification
        sendAdminNotification("welcome_admin", email, { name, role });
        
        // Refresh users list
        const { data: users } = await supabase.from('user_profiles').select('*');
        let telegramMappings = [];
        try {
            const { data: tmData } = await supabase.from('telegram_mappings').select('*');
            if (tmData) telegramMappings = tmData;
        } catch (e) {}
        const enrichedUsers = (users || []).map(u => {
            const tm = (telegramMappings || []).find(m => m.user_id === u.id);
            return { ...u, telegram_chat_id: tm ? tm.telegram_chat_id : '' };
        });
        setState(prev => ({ ...prev, users: enrichedUsers }));
        
        return true;
    };

    const authLogout = async () => {
        if (supabase) await supabase.auth.signOut();
        setState(prev => ({ ...prev, currentUser: null }));
        showToast("Logged out successfully.");
    };
    // Customers CRUD Actions
    const addCustomer = async (customer) => {
        if (!supabase) return;
        const newCustomer = { ...customer, id: customer.id || crypto.randomUUID() };
        // Optimistic: update state immediately so UI reflects the change
        setState(prev => ({ ...prev, customers: [newCustomer, ...prev.customers] }));
        
        try {
            const { error } = await supabase.from('customers').insert([newCustomer]);
            if (error) {
                console.error("Supabase addCustomer Error:", error);
                showToast(`فشلت إضافة العميل: ${error.message}`, "error");
                // Rollback optimistic update
                setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== newCustomer.id) }));
                return null;
            }
            showToast(`تمت إضافة العميل '${newCustomer.name}' بنجاح.`);
        } catch (e) {
            console.error("Supabase Exception:", e);
            showToast(`حدث خطأ غير متوقع: ${e.message}`, "error");
            setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== newCustomer.id) }));
        }
        return newCustomer;
    };

    const editCustomer = async (updatedCustomer) => {
        if (!supabase) return;
        // Optimistic: update state immediately so UI reflects the change
        const prevCustomers = [...(state.customers || [])];
        setState(prev => ({
            ...prev,
            customers: prev.customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
        }));
        
        try {
            const { error } = await supabase.from('customers').update(updatedCustomer).eq('id', updatedCustomer.id);
            if (error) {
                console.error("Supabase editCustomer Error:", error);
                showToast(`فشل تحديث بيانات العميل: ${error.message}`, "error");
                // Rollback
                setState(prev => ({ ...prev, customers: prevCustomers }));
                return;
            }
            showToast(`تم تحديث بيانات العميل '${updatedCustomer.name}' بنجاح.`);
        } catch (e) {
            console.error("Supabase Exception:", e);
            showToast(`حدث خطأ غير متوقع: ${e.message}`, "error");
            setState(prev => ({ ...prev, customers: prevCustomers }));
        }
    };

    const setCustomerSpam = async (customerId, isSpam) => {
        if (!supabase || !customerId) return false;
        // Optimistic state update
        setState(prev => ({
            ...prev,
            customers: prev.customers.map(c => c.id === customerId ? { ...c, is_spam: isSpam } : c)
        }));
        try {
            const { error } = await supabase.from('customers').update({ is_spam: isSpam }).eq('id', customerId);
            if (error) {
                console.error("setCustomerSpam DB Error:", error);
                showToast(`فشل تحديث حالة السبام: ${error.message}`, "error");
                // Rollback
                setState(prev => ({
                    ...prev,
                    customers: prev.customers.map(c => c.id === customerId ? { ...c, is_spam: !isSpam } : c)
                }));
                return false;
            }
            console.log(`✅ Customer ${customerId} spam flag set to ${isSpam} in DB`);
            return true;
        } catch (e) {
            console.error("setCustomerSpam Exception:", e);
            showToast(`خطأ غير متوقع: ${e.message}`, "error");
            setState(prev => ({
                ...prev,
                customers: prev.customers.map(c => c.id === customerId ? { ...c, is_spam: !isSpam } : c)
            }));
            return false;
        }
    };

    const getOrCreateCustomer = async (phone, name, governorate) => {
        if (!phone) return null;
        const cleanPhone = normalizePhone(phone);
        let customer = state.customers.find(c => normalizePhone(c.phone) === cleanPhone);
        if (customer) return customer.id;

        // Query database if not found in memory
        if (supabase) {
            try {
                const { data: dbCust, error } = await supabase
                    .from('customers')
                    .select('*')
                    .eq('phone', cleanPhone)
                    .maybeSingle();

                if (dbCust) {
                    // Add it to memory so it's cached
                    setState(prev => {
                        if (prev.customers.some(c => c.id === dbCust.id)) return prev;
                        return { ...prev, customers: [...prev.customers, dbCust] };
                    });
                    return dbCust.id;
                }
            } catch (err) {
                console.error("Error querying customer in database:", err);
            }
        }
        
        const newCustomer = {
            id: crypto.randomUUID(),
            name: name || "Unknown",
            phone: cleanPhone || phone,
            governorate: governorate || "",
            customer_type: 'Regular',
            total_purchases: 0,
            orders_count: 0
        };
        await addCustomer(newCustomer);
        return newCustomer.id;
    };

    const deleteCustomer = async (customerId) => {
        if (!supabase || !customerId) return;
        // Optimistic update
        const originalCustomers = [...state.customers];
        setState(prev => ({ ...prev, customers: prev.customers.filter(c => c.id !== customerId) }));

        try {
            const { error } = await supabase.from('customers').delete().eq('id', customerId);
            if (error) {
                console.error("Supabase deleteCustomer Error:", error);
                showToast(`خطأ في حذف العميل: ${error.message}`, "error");
                // Rollback
                setState(prev => ({ ...prev, customers: originalCustomers }));
                return false;
            }
            showToast("تم حذف العميل بنجاح.");
            return true;
        } catch (e) {
            console.error("Supabase Exception:", e);
            showToast(`حدث خطأ غير متوقع: ${e.message}`, "error");
            setState(prev => ({ ...prev, customers: originalCustomers }));
            return false;
        }
    };

    const updateCustomerStats = async (customerId, valueChange, countChange) => {
        if (!supabase || !customerId) return;
        
        setState(prev => {
            let thresholdPurchases = prev.storeSettings?.vipThresholdPurchases || 5000;
            let thresholdOrders = prev.storeSettings?.vipThresholdOrders || 10;
            
            return {
                ...prev,
                customers: prev.customers.map(c => {
                    if (c.id === customerId) {
                        const newTotal = Math.max(0, parseFloat(c.total_purchases || 0) + parseFloat(valueChange));
                        const newCount = Math.max(0, parseInt(c.orders_count || 0) + parseInt(countChange));
                        let newType = c.customer_type;
                        if (c.customer_type !== 'Spam') {
                            newType = (newTotal >= thresholdPurchases || newCount >= thresholdOrders) ? 'VIP' : 'Regular';
                        }
                        return { ...c, total_purchases: newTotal, orders_count: newCount, customer_type: newType };
                    }
                    return c;
                })
            };
        });

        // Background sync
        setTimeout(async () => {
            const { data: cData } = await supabase.from('customers').select('total_purchases, orders_count, customer_type').eq('id', customerId).single();
            if (cData) {
                const thresholdPurchases = state.storeSettings?.vipThresholdPurchases || 5000;
                const thresholdOrders = state.storeSettings?.vipThresholdOrders || 10;
                
                const newTotal = Math.max(0, parseFloat(cData.total_purchases || 0) + parseFloat(valueChange));
                const newCount = Math.max(0, parseInt(cData.orders_count || 0) + parseInt(countChange));
                let newType = cData.customer_type;
                if (cData.customer_type !== 'Spam') {
                    newType = (newTotal >= thresholdPurchases || newCount >= thresholdOrders) ? 'VIP' : 'Regular';
                }
                
                await supabase.from('customers').update({
                    total_purchases: newTotal,
                    orders_count: newCount,
                    customer_type: newType
                }).eq('id', customerId);
            }
        }, 500);
    };

    // Influencers CRUD Actions
    const addInfluencer = async (influencer) => {
        const dbCoupon = {
            id: influencer.id,
            code: influencer.code.toUpperCase(),
            name: influencer.name,
            discount_type: influencer.type === 'percentage' ? 'Percentage' : 'Fixed',
            discount_value: parseFloat(influencer.value),
            min_order_value: influencer.minOrderValue ? parseFloat(influencer.minOrderValue) : 0,
            usage_limit: influencer.usageLimit ? parseInt(influencer.usageLimit) : null,
            expiry_date: influencer.endDate || null,
            is_active: true,
            created_at: influencer.createdAt
        };

        if (supabase) {
            try {
                const { error } = await supabase.from('coupons').insert([dbCoupon]);
                if (error) throw error;
            } catch (err) {
                console.error("Error saving influencer to database:", err);
                showToast("فشل حفظ المؤثر في قاعدة البيانات محلياً", "error");
                return;
            }
        }

        setState(prev => ({
            ...prev,
            coupons: [dbCoupon, ...(prev.coupons || [])],
            influencers: [influencer, ...(prev.influencers || [])]
        }));
        showToast("تم إضافة المؤثر وتوليد الكود بنجاح على شوبيفاي والسيستم!", "success");
    };

    const editInfluencer = async (updatedInfluencer) => {
        const dbCoupon = {
            id: updatedInfluencer.id,
            code: updatedInfluencer.code.toUpperCase(),
            name: updatedInfluencer.name,
            discount_type: updatedInfluencer.type === 'percentage' ? 'Percentage' : 'Fixed',
            discount_value: parseFloat(updatedInfluencer.value),
            min_order_value: updatedInfluencer.minOrderValue ? parseFloat(updatedInfluencer.minOrderValue) : 0,
            usage_limit: updatedInfluencer.usageLimit ? parseInt(updatedInfluencer.usageLimit) : null,
            expiry_date: updatedInfluencer.endDate || null,
            is_active: true
        };

        if (supabase) {
            try {
                const { error } = await supabase.from('coupons').update(dbCoupon).eq('id', updatedInfluencer.id);
                if (error) throw error;
            } catch (err) {
                console.error("Error updating influencer in database:", err);
            }
        }

        setState(prev => ({
            ...prev,
            coupons: (prev.coupons || []).map(c => c.id === updatedInfluencer.id ? { ...c, ...dbCoupon } : c),
            influencers: (prev.influencers || []).map(inf => inf.id === updatedInfluencer.id ? updatedInfluencer : inf)
        }));
        showToast(`تم تحديث بيانات المؤثر '${updatedInfluencer.name}' بنجاح.`, "success");
    };

    const deleteInfluencer = async (id) => {
        const couponToDelete = state.coupons.find(c => c.id === id);
        if (!couponToDelete) return;
        const code = couponToDelete.code;

        // Call Shopify API to delete the Price Rule
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/swift-processor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    action: 'delete_discount',
                    code: code
                })
            });
            const data = await response.json();
            if (!response.ok || data?.error) {
                console.warn("Shopify coupon delete warning/error:", data);
            }
        } catch (err) {
            console.error("Shopify coupon delete exception:", err);
        }

        if (supabase) {
            try {
                const { error } = await supabase.from('coupons').delete().eq('id', id);
                if (error) throw error;
            } catch (err) {
                console.error("Error deleting coupon from database:", err);
            }
        }

        setState(prev => ({
            ...prev,
            coupons: (prev.coupons || []).filter(c => c.id !== id),
            influencers: (prev.influencers || []).filter(inf => inf.id !== id)
        }));
        showToast("تم حذف المؤثر وإلغاء كود الخصم من شوبيفاي والسيستم بنجاح!", "success");
    };

    const checkLiveCouponAvailability = async (code, cartTotal) => {
        if (!code) return { valid: false, error: "كوبون خصم غير صالح.", message: "كوبون خصم غير صالح." };
        const cleanCode = String(code).trim().toUpperCase();
        
        // 1. Check local coupon definition in DB
        const coupon = state.coupons.find(c => String(c.code || '').trim().toUpperCase() === cleanCode && (c.is_active || c.is_active === undefined || c.is_active === null));
        if (!coupon) return { valid: false, error: "كوبون خصم غير صالح أو غير مفعل.", message: "كوبون خصم غير صالح أو غير مفعل." };
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return { valid: false, error: "عفواً، انتهت صلاحية هذا الكوبون.", message: "عفواً، انتهت صلاحية هذا الكوبون." };
        if (coupon.min_order_value && cartTotal < coupon.min_order_value) return { valid: false, error: `الحد الأدنى لقيمة الطلب لاستخدام الكوبون هو ${coupon.min_order_value}.`, message: `الحد الأدنى لقيمة الطلب لاستخدام الكوبون هو ${coupon.min_order_value}.` };
        
        if (!coupon.usage_limit) {
            return { 
                valid: true, 
                coupon, 
                discount_value: parseFloat(coupon.discount_value) || 0, 
                discount_type: coupon.discount_type || 'Percentage' 
            };
        }

        // 2. Fetch live Shopify usage count
        let shopifyUsage = 0;
        try {
            const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
            const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
            
            const response = await fetch(`${supabaseUrl}/functions/v1/swift-processor`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${anonKey}`
                },
                body: JSON.stringify({
                    action: 'check_discount_usage',
                    code: cleanCode
                })
            });
            
            if (response.ok) {
                const data = await response.json();
                if (data?.success && data?.exists) {
                    shopifyUsage = parseInt(data.times_used) || 0;
                }
            }
        } catch (err) {
            console.error("Failed to check live coupon usage on Shopify:", err);
        }

        // 3. Fetch local manual usage count
        let manualUsage = 0;
        (state.orders || []).forEach(o => {
            if (o.source === 'manual' && o.status !== 'Cancelled' && String(o.applied_coupon_code).trim().toUpperCase() === cleanCode) {
                manualUsage += 1;
            }
        });

        const totalUsage = shopifyUsage + manualUsage;
        if (totalUsage >= coupon.usage_limit) {
            // Auto-disable coupon on Shopify if total usage reached limit
            try {
                const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
                const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
                await fetch(`${supabaseUrl}/functions/v1/swift-processor`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${anonKey}`
                    },
                    body: JSON.stringify({
                        action: 'delete_discount',
                        code: cleanCode
                    })
                });
            } catch (e) {
                console.error("Failed to auto-disable Shopify coupon:", e);
            }
            
            return { valid: false, error: "عفواً، تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.", message: "عفواً، تم استنفاد الحد الأقصى لاستخدام هذا الكوبون." };
        }

        return { 
            valid: true, 
            coupon, 
            totalUsage, 
            discount_value: parseFloat(coupon.discount_value) || 0, 
            discount_type: coupon.discount_type || 'Percentage' 
        };
    };

    // Coupons CRUD Actions
    const addCoupon = async (coupon) => {
        if (!supabase) return;
        setState(prev => ({ ...prev, coupons: [coupon, ...prev.coupons] }));
        try {
            await supabase.from('coupons').insert([coupon]);
            showToast(`Coupon '${coupon.code}' added successfully.`);
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    };

    const editCoupon = async (updatedCoupon) => {
        if (!supabase) return;
        setState(prev => ({
            ...prev,
            coupons: prev.coupons.map(c => c.id === updatedCoupon.id ? updatedCoupon : c)
        }));
        try {
            await supabase.from('coupons').update(updatedCoupon).eq('id', updatedCoupon.id);
            showToast(`Coupon '${updatedCoupon.code}' updated successfully.`);
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    };

    const deleteCoupon = async (couponId) => {
        if (!supabase) return;
        setState(prev => ({
            ...prev,
            coupons: prev.coupons.filter(c => c.id !== couponId)
        }));
        try {
            await supabase.from('coupons').delete().eq('id', couponId);
            showToast(`Coupon deleted.`);
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    };

    const validateCoupon = (code, cartTotal) => {
        if (!code) return { valid: false, error: "Invalid coupon.", message: "Invalid coupon." };
        const cleanCode = String(code).trim().toUpperCase();
        const coupon = state.coupons.find(c => String(c.code || '').trim().toUpperCase() === cleanCode && (c.is_active || c.is_active === undefined || c.is_active === null));
        if (!coupon) return { valid: false, error: "كوبون خصم غير صالح أو غير مفعل.", message: "كوبون خصم غير صالح أو غير مفعل." };
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return { valid: false, error: "عفواً، انتهت صلاحية هذا الكوبون.", message: "عفواً، انتهت صلاحية هذا الكوبون." };
        if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) return { valid: false, error: "عفواً، تم استنفاد الحد الأقصى لاستخدام هذا الكوبون.", message: "عفواً، تم استنفاد الحد الأقصى لاستخدام هذا الكوبون." };
        if (coupon.min_order_value && cartTotal < coupon.min_order_value) return { valid: false, error: `الحد الأدنى لقيمة الطلب لاستخدام الكوبون هو ${coupon.min_order_value}.`, message: `الحد الأدنى لقيمة الطلب لاستخدام الكوبون هو ${coupon.min_order_value}.` };
        return { 
            valid: true, 
            coupon, 
            discount_value: parseFloat(coupon.discount_value) || 0, 
            discount_type: coupon.discount_type || 'Percentage' 
        };
    };

    const applyCouponUsage = async (code, increment) => {
        if (!supabase) return;
        setState(prev => ({
            ...prev,
            coupons: prev.coupons.map(c => c.code === code ? { ...c, times_used: c.times_used + increment } : c)
        }));
        try {
            await supabase.rpc('apply_coupon_usage', { p_coupon_code: code, p_increment: increment });
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    };

    // Products CRUD Actions

    const addProduct = (product) => {
        setState(prev => ({
            ...prev,
            products: [product, ...prev.products]
        }));
        logActivity("stock", `New product '${product.name}' was registered.`);
        showToast(`Product '${product.name}' added successfully.`);

        if (supabase) {
            (async () => {
                try {
                    let finalImageStr = product.image;
                    try {
                        let baseImages = [];
                        if (product.image && product.image.startsWith('[')) {
                            baseImages = JSON.parse(product.image);
                        } else if (product.image && typeof product.image === 'string') {
                            baseImages = [product.image];
                        }
                        finalImageStr = JSON.stringify({
                            images: baseImages,
                            vendor: product.vendor || '',
                            tags: product.tags || '',
                            status: product.status || 'Active'
                        });
                    } catch(e) {
                        finalImageStr = product.image;
                    }

                    await supabase.from('products').insert([{
                        id: product.id,
                        name: product.name,
                        category: product.category,
                        unit: product.unit,
                        image: finalImageStr,
                        created_date: product.createdDate,
                        description: product.description,
                        shopify_collection_ids: product.shopifyCollectionIds || []
                    }]);
                    if (product.variants && product.variants.length > 0) {
                        const vars = product.variants.map(v => ({
                            sku: v.sku,
                            product_id: product.id,
                            name: v.name,
                            barcode: v.barcode,
                            wholesale_price: v.wholesalePrice,
                            retail_price: v.retailPrice,
                            reorder_limit: v.reorderLimit,
                            stock_sulur: v.stock.Sulur || 0,
                            average_cost: v.averageCost || v.wholesalePrice || 0,
                            is_active: v.is_active !== false
                        }));
                        await supabase.from('product_variants').insert(vars);
                    }
                    
                    // Sync to Shopify using Edge Function
                    try {
                        console.log("Syncing to Shopify...");
                        const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('swift-processor', {
                            body: {
                                ...product,
                                variants: (product.variants || []).filter(v => v.is_active !== false),
                                collection_ids: product.shopifyCollectionIds || []
                            }
                        });
                        
                        if (shopifyError) {
                            console.error("Failed to sync to Shopify:", shopifyError);
                            const parsedErr = await getFunctionsErrorMessage(shopifyError);
                            showToast(language === 'ar' ? `تم حفظ المنتج محلياً ولكن فشل رفعه لشوبيفاي: ${parsedErr}` : `Saved locally, failed to upload: ${parsedErr}`, "warning");
                        } else {
                            console.log("Shopify sync success:", shopifyData);
                            if (shopifyData.warnings && shopifyData.warnings.length > 0) {
                                console.warn("Shopify Warnings:", shopifyData.warnings);
                                showToast("تم رفع المنتج ولكن فشل تعيين المخزون. راجع الكونسول لمعرفة السبب.", "warning");
                            } else {
                                showToast("تم رفع المنتج وتحديث المخزون بنجاح في شوبيفاي", "success");
                            }
                            
                            // Save Shopify ID to local state and Supabase
                            if (shopifyData.shopify_product_id) {
                                setState(prevState => {
                                    const updatedProducts = prevState.products.map(p => {
                                        if (p.id === product.id) {
                                            const updatedVariants = p.variants.map(v => {
                                                if (v.is_active === false) {
                                                    return { ...v, shopify_id: null };
                                                }
                                                const vMap = shopifyData.variants_map?.find(m => m.sku === v.sku);
                                                return vMap ? { ...v, shopify_id: String(vMap.id) } : v;
                                            });
                                            return { ...p, shopify_id: String(shopifyData.shopify_product_id), variants: updatedVariants };
                                        }
                                        return p;
                                    });
                                    return { ...prevState, products: updatedProducts };
                                });
                                await supabase.from('products').update({ shopify_id: String(shopifyData.shopify_product_id) }).eq('id', product.id);
                                if (shopifyData.variants_map) {
                                    for (const vMap of shopifyData.variants_map) {
                                        await supabase.from('product_variants').update({ shopify_id: String(vMap.id) }).eq('product_id', product.id).eq('sku', vMap.sku);
                                    }
                                }
                                const inactiveSkus = (product.variants || []).filter(v => v.is_active === false).map(v => v.sku);
                                if (inactiveSkus.length > 0) {
                                    await supabase.from('product_variants').update({ shopify_id: null }).eq('product_id', product.id).in('sku', inactiveSkus);
                                }
                            }
                        }
                    } catch (err) {
                        console.error("Shopify invoke error:", err);
                    }
                    
                } catch (e) {
                    console.error("Supabase Error:", e);
                    showToast(language === 'ar' ? `خطأ في قاعدة البيانات: ${e.message || e}` : `Database Error: ${e.message || e}`, "error");
                }
            })();
        }
    };

    const editProduct = (updatedProduct) => {
        let baseImages = updatedProduct.images || [];
        if ((!baseImages || baseImages.length === 0) && updatedProduct.image) {
            try {
                if (typeof updatedProduct.image === 'string') {
                    if (updatedProduct.image.startsWith('[')) baseImages = JSON.parse(updatedProduct.image);
                    else if (updatedProduct.image.startsWith('{')) baseImages = JSON.parse(updatedProduct.image).images || [];
                    else baseImages = [updatedProduct.image];
                } else if (typeof updatedProduct.image === 'object' && Array.isArray(updatedProduct.image.images)) {
                    baseImages = updatedProduct.image.images;
                }
            } catch {}
        }

        const enrichedProduct = {
            ...updatedProduct,
            images: baseImages,
            image: JSON.stringify(baseImages)
        };

        setState(prev => {
            const oldProduct = prev.products.find(p => p.id === updatedProduct.id);
            let newLedger = [...(prev.stockLedger || [])];
            const adminName = prev.currentUser?.name || 'الأدمن';

            // Detect stock changes and record in ledger
            if (oldProduct && enrichedProduct.variants) {
                enrichedProduct.variants.forEach(newV => {
                    const oldV = (oldProduct.variants || []).find(v => v.sku === newV.sku);
                    const oldStock = oldV ? (oldV.stock?.Sulur || 0) : 0;
                    const newStock = newV.stock?.Sulur || 0;
                    const diff = newStock - oldStock;

                    if (diff !== 0) {
                        newLedger = [{
                            date: new Date().toISOString(),
                            productId: updatedProduct.id,
                            variantSku: newV.sku,
                            warehouse: 'Sulur',
                            type: 'Correction',
                            quantity: diff,
                            balanceAfter: newStock,
                            notes: `مُعدل بواسطة: ${adminName} (تعديل منتج)`
                        }, ...newLedger];
                    }
                });
            }

            return {
                ...prev,
                products: prev.products.map(p => p.id === updatedProduct.id ? enrichedProduct : p),
                stockLedger: newLedger
            };
        });
        logActivity("stock", `Product '${updatedProduct.name}' details were updated.`);
        showToast(`Product '${updatedProduct.name}' updated.`);

        if (supabase) {
            (async () => {
                try {
                    const finalImageStr = JSON.stringify({
                        images: baseImages,
                        vendor: updatedProduct.vendor || '',
                        tags: updatedProduct.tags || '',
                        status: updatedProduct.status || 'Active'
                    });

                    await supabase.from('products').update({
                        name: updatedProduct.name,
                        category: updatedProduct.category,
                        unit: updatedProduct.unit,
                        image: finalImageStr,
                        description: updatedProduct.description,
                        shopify_collection_ids: updatedProduct.shopifyCollectionIds || []
                    }).eq('id', updatedProduct.id);

                    if (updatedProduct.variants) {
                        // Clean up deleted variants from Supabase database
                        const newVariantSkus = updatedProduct.variants.map(v => v.sku);
                        const { data: dbVars } = await supabase.from('product_variants').select('sku, stock_sulur').eq('product_id', updatedProduct.id);
                        
                        // Save old stock for ledger comparison
                        const oldStockMap = {};
                        if (dbVars) {
                            dbVars.forEach(v => { oldStockMap[v.sku] = parseInt(v.stock_sulur) || 0; });
                            const dbSkus = dbVars.map(v => v.sku);
                            const skusToDelete = dbSkus.filter(sku => !newVariantSkus.includes(sku));
                            if (skusToDelete.length > 0) {
                                await supabase.from('product_variants').delete().eq('product_id', updatedProduct.id).in('sku', skusToDelete);
                            }
                        }

                        for (const v of updatedProduct.variants) {
                            await supabase.from('product_variants').upsert({
                                sku: v.sku,
                                product_id: updatedProduct.id,
                                name: v.name,
                                barcode: v.barcode,
                                wholesale_price: v.wholesalePrice,
                                retail_price: v.retailPrice,
                                reorder_limit: v.reorderLimit,
                                stock_sulur: v.stock.Sulur || 0,
                                average_cost: v.averageCost || v.wholesalePrice || 0,
                                is_active: v.is_active !== false,
                                shopify_id: v.is_active === false ? null : v.shopify_id
                            });
                        }

                        // Record stock changes in ledger
                        const ledgerEntries = [];
                        const adminName = state.currentUser?.name || 'الأدمن';
                        updatedProduct.variants.forEach(v => {
                            const oldStock = oldStockMap[v.sku] || 0;
                            const newStock = v.stock?.Sulur || 0;
                            const diff = newStock - oldStock;
                            if (diff !== 0) {
                                ledgerEntries.push({
                                    date: new Date().toISOString(),
                                    product_id: updatedProduct.id,
                                    variant_sku: v.sku,
                                    warehouse: 'Sulur',
                                    type: 'Correction',
                                    quantity: diff,
                                    balance_after: newStock,
                                    notes: `مُعدل بواسطة: ${adminName} (تعديل منتج)`
                                });
                            }
                        });
                        if (ledgerEntries.length > 0) {
                            await supabase.from('stock_ledger').insert(ledgerEntries);
                        }
                    }

                    // Sync update to Shopify
                    if (updatedProduct.shopify_id) {
                        try {
                            console.log("Syncing update to Shopify...");
                            let baseImages = updatedProduct.images || [];
                            if ((!baseImages || baseImages.length === 0) && updatedProduct.image) {
                                try {
                                    if (updatedProduct.image.startsWith('[')) baseImages = JSON.parse(updatedProduct.image);
                                    else if (updatedProduct.image.startsWith('{')) baseImages = JSON.parse(updatedProduct.image).images || [];
                                    else baseImages = [updatedProduct.image];
                                } catch {}
                            }

                            const shopifyUpdatePayload = {
                                ...updatedProduct,
                                variants: (updatedProduct.variants || []).filter(v => v.is_active !== false),
                                images: baseImages,
                                action: 'update',
                                collection_ids: updatedProduct.shopifyCollectionIds || []
                            };
                            const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('swift-processor', {
                                body: shopifyUpdatePayload
                            });
                            
                            if (shopifyError) {
                                console.error("Failed to sync update to Shopify:", shopifyError);
                                const parsedErr = await getFunctionsErrorMessage(shopifyError);
                                showToast(language === 'ar' ? `فشل التحديث في شوبيفاي: ${parsedErr}` : `Failed to sync with Shopify: ${parsedErr}`, "error");
                            } else if (shopifyData && shopifyData.error) {
                                console.error("Failed to sync update to Shopify (data error):", shopifyData.error);
                                const det = shopifyData.details ? (typeof shopifyData.details === 'object' ? JSON.stringify(shopifyData.details) : String(shopifyData.details)) : "";
                                showToast(language === 'ar' ? `فشل التحديث في شوبيفاي: ${shopifyData.error} ${det}` : `Shopify Error: ${shopifyData.error} ${det}`, "error");
                            } else {
                                console.log("Shopify update success:", shopifyData);
                                showToast(language === 'ar' ? "تم تحديث المنتج بنجاح في شوبيفاي والسيستم!" : "Product updated and synced successfully with Shopify!", "success");
                                
                                const finalShopifyImages = shopifyData?.images || [];
                                
                                setState(prevState => {
                                    const updatedProducts = prevState.products.map(p => {
                                        if (p.id === updatedProduct.id) {
                                            const updatedVariants = p.variants.map(v => {
                                                if (v.is_active === false) {
                                                    return { ...v, shopify_id: null };
                                                }
                                                const vMap = shopifyData.variants_map?.find(m => m.sku === v.sku);
                                                return vMap ? { ...v, shopify_id: String(vMap.id) } : v;
                                            });
                                            return { 
                                                ...p, 
                                                variants: updatedVariants,
                                                images: finalShopifyImages.length > 0 ? finalShopifyImages : p.images,
                                                image: finalShopifyImages.length > 0 ? JSON.stringify(finalShopifyImages) : p.image
                                            };
                                        }
                                        return p;
                                    });
                                    return { ...prevState, products: updatedProducts };
                                });

                                if (shopifyData?.variants_map) {
                                    for (const vMap of shopifyData.variants_map) {
                                        await supabase.from('product_variants').update({ shopify_id: String(vMap.id) }).eq('product_id', updatedProduct.id).eq('sku', vMap.sku);
                                    }
                                }

                                const inactiveSkus = (updatedProduct.variants || []).filter(v => v.is_active === false).map(v => v.sku);
                                if (inactiveSkus.length > 0) {
                                    await supabase.from('product_variants').update({ shopify_id: null }).eq('product_id', updatedProduct.id).in('sku', inactiveSkus);
                                }

                                if (finalShopifyImages.length > 0) {
                                    const freshImageStr = JSON.stringify({
                                        images: finalShopifyImages,
                                        vendor: updatedProduct.vendor || '',
                                        tags: updatedProduct.tags || '',
                                        status: updatedProduct.status || 'Active'
                                    });
                                    await supabase.from('products').update({ image: freshImageStr }).eq('id', updatedProduct.id);
                                }
                            }
                        } catch (err) {
                            console.error("Shopify invoke error on update:", err);
                            showToast(language === 'ar' ? `خطأ أثناء مزامنة شوبيفاي: ${err.message || err}` : `Error syncing with Shopify: ${err.message || err}`, "error");
                        }
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const deleteProduct = (productId) => {
        const prod = state.products.find(p => p.id === productId);
        if (!prod) return;

        const isReferencedInOrders = (state.orders || []).some(o => 
            (o.items || []).some(i => prod.variants?.some(v => v.sku === (i.variant_sku || i.variantSku)))
        );

        if (isReferencedInOrders) {
            setState(prev => ({
                ...prev,
                products: prev.products.map(p => p.id === productId ? { ...p, status: 'Archived', is_archived: true } : p)
            }));
            logActivity("stock", `Product '${prod.name}' was archived.`);
            showToast(`تم أرشفة المنتج '${prod.name}' للحفاظ على سجل الطلبات التاريخية.`, "info");
            
            if (supabase) {
                let parsedImage = { images: [], vendor: '', tags: '', status: 'Archived' };
                try {
                    if (prod.image) {
                        const parsed = typeof prod.image === 'string' ? JSON.parse(prod.image) : prod.image;
                        parsedImage = {
                            images: parsed.images || [],
                            vendor: parsed.vendor || '',
                            tags: parsed.tags || '',
                            status: 'Archived'
                        };
                    }
                } catch (e) {
                    console.error("Failed parsing image JSON for archiving:", e);
                }

                supabase.from('products').update({ image: JSON.stringify(parsedImage) }).eq('id', productId).then(({ error }) => {
                    if (error) console.error("Error archiving product:", error);
                });
            }
            return;
        }

        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => p.id !== productId)
        }));
        logActivity("stock", `Product '${prod.name}' was deleted.`);
        showToast(`Product '${prod.name}' removed.`);

        if (supabase) {
            (async () => {
                try {
                    if (prod && prod.shopify_id) {
                        try {
                            console.log(`Deleting product ${prod.name} (${prod.shopify_id}) from Shopify...`);
                            await supabase.functions.invoke('swift-processor', {
                                body: { action: 'delete', shopify_id: prod.shopify_id }
                            });
                        } catch (err) {
                            console.error("Shopify delete exception:", err);
                        }
                    }
                    
                    await supabase.from('products').delete().eq('id', productId);
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const deleteMultipleProducts = (productIds) => {
        const prodsToDelete = state.products.filter(p => productIds.includes(p.id));
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => !productIds.includes(p.id))
        }));
        logActivity("stock", `${productIds.length} products deleted in bulk.`);
        showToast(`${productIds.length} products deleted.`);

        if (supabase) {
            (async () => {
                try {
                    // Sync bulk delete to Shopify
                    for (const prod of prodsToDelete) {
                        if (prod.shopify_id) {
                            try {
                                console.log(`Deleting product ${prod.name} (${prod.shopify_id}) from Shopify in bulk...`);
                                const { data, error } = await supabase.functions.invoke('swift-processor', {
                                    body: { action: 'delete', shopify_id: prod.shopify_id }
                                });
                                if (error) {
                                    console.error(`Failed to delete product ${prod.id} from Shopify:`, error);
                                } else {
                                    console.log(`Shopify delete success for product ${prod.id}:`, data);
                                }
                            } catch (err) {
                                console.error("Shopify bulk delete error for product:", prod.id, err);
                            }
                        }
                    }
                    
                    await supabase.from('products').delete().in('id', productIds);
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    // Delete products from LOCAL system only (state + Supabase) - NO Shopify sync
    const deleteProductsLocalOnly = (productIds) => {
        const prodsToDelete = state.products.filter(p => productIds.includes(p.id));
        const count = prodsToDelete.length;
        if (count === 0) {
            showToast('لم يتم العثور على منتجات للحذف', 'warning');
            return;
        }
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => !productIds.includes(p.id))
        }));
        logActivity("stock", `${count} digital products removed from local system only (Shopify untouched).`);
        showToast(`تم حذف ${count} منتج من السيستم المحلي فقط (شوبيفاي لم يتأثر)`, 'success');

        if (supabase) {
            (async () => {
                try {
                    // Only delete from Supabase - NO Shopify deletion
                    await supabase.from('products').delete().in('id', productIds);
                    console.log(`[LOCAL ONLY] Deleted ${count} products from Supabase. Shopify was NOT touched.`);
                } catch (e) {
                    console.error("Supabase local delete error:", e);
                }
            })();
        }
    };


    const updateOrderProperties = (orderId, props) => {
        setState(prev => ({
            ...prev,
            orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, ...props } : o)
        }));

        // Trigger deposit assignment email if deposit is pending and receiver is another admin
        const hasPendingDeposit = props.depositStatus === 'pending' || (!props.depositStatus && props.deposit > 0);
        if (props.deposit > 0 && hasPendingDeposit && props.depositReceiverId && props.depositReceiverId !== state.currentUser?.id) {
            const targetAdmin = (state.users || []).find(u => u.id === props.depositReceiverId);
            const order = (state.orders || []).find(o => o.id === orderId);
            if (targetAdmin && targetAdmin.email) {
                sendAdminNotification("deposit_assignment", targetAdmin.email, {
                    amount: props.deposit,
                    clientName: order?.client || props.client || "العميل",
                    orderId: orderId,
                    creatorName: state.currentUser?.name || "أدمن"
                });
            }
        }
    };

    const settleAdminsCustody = async (adminId, orderIds) => {
        setState(prev => ({
            ...prev,
            orders: (prev.orders || []).map(o => orderIds.includes(o.id) ? { ...o, depositStatus: 'settled' } : o),
            deletedOrdersWithDeposits: (prev.deletedOrdersWithDeposits || []).map(o => orderIds.includes(o.id) ? { ...o, depositStatus: 'settled' } : o)
        }));
        if (supabase) {
            try {
                const { error } = await supabase.from('orders').update({ deposit_status: 'settled' }).in('id', orderIds);
                if (error) throw error;
                showToast("تمت تسوية وتصفير العهدة بنجاح", "success");
                logActivity("order", `Settled custody for admin ${adminId}. ${orderIds.length} deposits settled.`);
            } catch (err) {
                console.error("Error settling custody:", err);
                showToast("حدث خطأ أثناء تسوية العهدة", "error");
            }
        }
    };

    const isDeductedStatus = (st, order = null) => {
        if (!st || st === 'Draft' || st === 'Cancelled' || st === 'Rejected') return false;
        if (st === 'Shipped' || st === 'Completed' || st === 'Processing' || st === 'Delivered' || st === 'Out for Delivery' || st === 'Partially Delivered') return true;
        
        if (st === 'Pending') {
            if (!order) return true;
            const isManual = order.source !== 'shopify';
            let isReviewed = order.is_reviewed || order.isReviewed;
            if (!isReviewed && order.address) {
                if (typeof order.address === 'object') isReviewed = order.address.isReviewed || order.address.is_reviewed;
                if (typeof order.address === 'string') {
                    try {
                        const p = JSON.parse(order.address);
                        isReviewed = p?.isReviewed || p?.is_reviewed;
                    } catch(e) {}
                }
            }
            return isManual || !!isReviewed;
        }
        return true;
    };

    // Orders CRUD Actions
    const addOrder = async (order) => {
        const enrichedItems = order.items.map(item => {
            let avgCost = 0;
            const prod = state.products.find(p => p.variants.some(v => v.sku === item.variantSku));
            if (prod) {
                const vr = prod.variants.find(v => v.sku === item.variantSku);
                if (vr) avgCost = vr.averageCost || vr.wholesalePrice || 0;
            }
            return { ...item, costAtTimeOfSale: avgCost };
        });
        const enrichedOrder = { ...order, items: enrichedItems, createdAt: new Date().toISOString() };

        setState(prev => {
            let products = [...prev.products];
            if (isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                enrichedOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        if (stock[enrichedOrder.warehouse] !== undefined) {
                                            stock[enrichedOrder.warehouse] = Math.max(0, stock[enrichedOrder.warehouse] - item.quantity);
                                        } else {
                                            const keys = Object.keys(stock);
                                            if (keys.length > 0) {
                                                stock[keys[0]] = Math.max(0, stock[keys[0]] - item.quantity);
                                            }
                                        }
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }

            let newLedger = prev.stockLedger || [];
            if (isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                enrichedOrder.items.forEach(item => {
                    const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                    if (prod) {
                        const vr = prod.variants.find(v => v.sku === item.variantSku);
                        const currentBal = vr ? (vr.stock[enrichedOrder.warehouse] || 0) : 0;
                        newLedger = [{
                            date: enrichedOrder.date,
                            productId: prod.id,
                            variantSku: item.variantSku,
                            warehouse: enrichedOrder.warehouse,
                            type: "Sale",
                            quantity: -item.quantity,
                            balanceAfter: currentBal
                        }, ...newLedger];
                    }
                });
            }

            return {
                ...prev,
                products,
                stockLedger: newLedger,
                orders: [enrichedOrder, ...prev.orders]
            };
        });

        // Trigger customer stats update if completed
        if (enrichedOrder.status === "Completed" && enrichedOrder.customer_id) {
            updateCustomerStats(enrichedOrder.customer_id, enrichedOrder.totalValue, 1);
        }

        logActivity("order", `New Order ${enrichedOrder.id} registered.`);
        showToast(
            language === 'ar'
                ? (enrichedOrder.status === 'Pending' ? `تم تسجيل الطلب ${enrichedOrder.id} وهو قيد الانتظار للمراجعة` : `تم تسجيل الطلب ${enrichedOrder.id} بنجاح`)
                : `Order ${enrichedOrder.id} recorded successfully.`
        );

        if (supabase) {
            await (async () => {
                const rollbackLocalState = () => {
                    setState(prev => {
                        let products = [...prev.products];
                        if (isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                            enrichedOrder.items.forEach(item => {
                                products = products.map(p => {
                                    const hasVar = p.variants.some(v => v.sku === item.variantSku);
                                    if (hasVar) {
                                        return {
                                            ...p,
                                            variants: p.variants.map(v => {
                                                if (v.sku === item.variantSku) {
                                                    const stock = { ...v.stock };
                                                    if (stock[enrichedOrder.warehouse] !== undefined) {
                                                        stock[enrichedOrder.warehouse] = stock[enrichedOrder.warehouse] + item.quantity;
                                                    } else {
                                                        const keys = Object.keys(stock);
                                                        if (keys.length > 0) {
                                                            stock[keys[0]] = stock[keys[0]] + item.quantity;
                                                        }
                                                    }
                                                    return { ...v, stock };
                                                }
                                                return v;
                                            })
                                        };
                                    }
                                    return p;
                                });
                            });
                        }

                        const newLedger = (prev.stockLedger || []).filter(entry => {
                            const oId = entry.orderId || entry.order_id;
                            return !oId || String(oId) !== String(enrichedOrder.id);
                        });

                        const newOrders = (prev.orders || []).filter(o => o.id !== enrichedOrder.id);

                        return {
                            ...prev,
                            products,
                            stockLedger: newLedger,
                            orders: newOrders
                        };
                    });

                    if (enrichedOrder.status === "Completed" && enrichedOrder.customer_id) {
                        updateCustomerStats(enrichedOrder.customer_id, -enrichedOrder.totalValue, -1);
                    }
                };

                try {
                    const { error: orderError } = await supabase.from('orders').insert([{
                        id: enrichedOrder.id,
                        client: enrichedOrder.client,
                        customer_id: enrichedOrder.customer_id || null,
                        date: enrichedOrder.date,
                        warehouse: enrichedOrder.warehouse || 'Sulur',
                        status: enrichedOrder.status,
                        total_value: enrichedOrder.totalValue,
                        discount_type: enrichedOrder.discount_type || null,
                        discount_value: enrichedOrder.discount_value || 0,
                        applied_coupon_code: enrichedOrder.applied_coupon_code || null,
                        discount_reason: enrichedOrder.discount_reason || null,
                        discount_reason_details: enrichedOrder.discount_reason_details || null,
                        address: enrichedOrder.address || null,
                        governorate: enrichedOrder.governorate || null,
                        deposit: enrichedOrder.deposit || 0,
                        deposit_receiver_id: (enrichedOrder.deposit && enrichedOrder.deposit > 0) ? (enrichedOrder.depositReceiverId || stateRef.current.currentUser?.id || null) : null,
                        deposit_status: enrichedOrder.depositStatus || 'confirmed',
                        shipping_fee: enrichedOrder.shipping_fee || 0,
                        created_by: enrichedOrder.createdBy || null,
                        shopify_order_id: enrichedOrder.shopifyOrderId || null,
                        source: enrichedOrder.source || 'manual',
                        payment_method: enrichedOrder.paymentMethod || null
                    }]);

                    if (orderError) {
                        console.error("Supabase Error inserting order:", orderError);
                        showToast(`فشل تسجيل الطلب في قاعدة البيانات: ${orderError.message}`, "error");
                        rollbackLocalState();
                        return;
                    }

                    if (enrichedOrder.items && enrichedOrder.items.length > 0) {
                        const items = enrichedOrder.items.map(item => {
                            const rawPrice = parseFloat(item.price) || 0;
                            const qty = parseInt(item.quantity) || 1;
                            
                            return {
                                order_id: enrichedOrder.id,
                                variant_sku: item.variantSku || item.variant_sku || item.sku,
                                quantity: qty,
                                price: rawPrice, // Keep item-level price separate (do not mix with global order-level discount)
                                cost_at_time_of_sale: item.costAtTimeOfSale || item.cost_at_time_of_sale || 0,
                                product_name: item.productName || null,
                                variant_name: item.variantName || null
                            };
                        });
                        
                        const { error: itemsError } = await supabase.from('order_items').insert(items);
                        if (itemsError) {
                            console.error("Supabase Error inserting order items:", itemsError);
                            showToast(`فشل إدخال أصناف الطلب: ${itemsError.message}`, "error");
                            // Clean up the order that was inserted
                            await supabase.from('orders').delete().eq('id', enrichedOrder.id);
                            rollbackLocalState();
                            return;
                        }
                    }

                    // Trigger deposit assignment email if deposit is pending and receiver is another admin
                    if (enrichedOrder.deposit > 0 && enrichedOrder.depositReceiverId && enrichedOrder.depositReceiverId !== state.currentUser?.id) {
                        const targetAdmin = (state.users || []).find(u => u.id === enrichedOrder.depositReceiverId);
                        if (targetAdmin && targetAdmin.email) {
                            sendAdminNotification("deposit_assignment", targetAdmin.email, {
                                amount: enrichedOrder.deposit,
                                clientName: enrichedOrder.client,
                                orderId: enrichedOrder.id,
                                creatorName: state.currentUser?.name || enrichedOrder.createdBy || "أدمن"
                            });
                        }
                    }

                    if (isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                        for (const item of enrichedOrder.items) {
                            const itemSku = item.variant_sku || item.variantSku || item.sku;
                            if (!itemSku) continue;
                            
                            const newStock = await adjustStockAtomically(itemSku, -item.quantity);

                            try {
                                const { data: vData } = await supabase.from('product_variants').select('product_id, average_cost').eq('sku', itemSku).single();
                                if (vData) {
                                    const uCost = item.costAtTimeOfSale || item.cost_at_time_of_sale || vData.average_cost || 0;
                                    const tCost = uCost * Math.abs(item.quantity);

                                    await supabase.from('stock_ledger').insert([{
                                        order_id: enrichedOrder.id,
                                        date: new Date().toISOString(),
                                        product_id: vData.product_id,
                                        variant_sku: itemSku,
                                        warehouse: enrichedOrder.warehouse || 'Sulur',
                                        type: 'Sale',
                                        quantity: -item.quantity,
                                        unit_cost: uCost,
                                        total_cost: tCost,
                                        balance_after: newStock !== undefined ? newStock : 0
                                    }]);
                                }
                            } catch (ledgerErr) {
                                console.error("Failed to insert stock ledger entry:", ledgerErr);
                            }
                        }
                    }
                    await loadSupabaseData();
                } catch (e) {
                    console.error("Supabase Error:", e);
                    showToast(`حدث خطأ أثناء الاتصال بالخادم: ${e.message}`, "error");
                    rollbackLocalState();
                    await loadSupabaseData();
                }
            })();
        }
    };

    const updateOrderStatus = async (orderId, newStatus, newAddress = null, explicitReason = null) => {
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;
        
        let addressObj = null;
        if (order.address) {
            if (typeof order.address === 'object') {
                addressObj = order.address;
            } else {
                try {
                    addressObj = JSON.parse(order.address);
                } catch(e) {
                    addressObj = { detailAddress: order.address };
                }
            }
        }

        let updatedAddressStr = newAddress ? (typeof newAddress === 'string' ? newAddress : JSON.stringify(newAddress)) : order.address;

        if (newStatus === 'Cancelled' && addressObj && addressObj.bostaDeliveryId) {
            if (addressObj.bostaStateCode === 45 || addressObj.bostaStateName?.includes("توصيل") || addressObj.bostaStateName?.includes("Delivered")) {
                showAlert("لا يمكن إلغاء الأوردر آلياً لأنه قيد التوصيل (Out for Delivery). يرجى التواصل مع خدمة عملاء بوسطة.", "error");
                return;
            }
            try {
                showToast("جاري إلغاء الشحنة في بوسطة...", "info");
                const { data: bostaData, error: bostaErr } = await supabase.functions.invoke('manage-bosta-delivery', {
                    body: { action: 'cancel', bostaDeliveryId: addressObj.bostaDeliveryId }
                });
                if (bostaErr || !bostaData || !bostaData.success) {
                    console.error("Bosta cancellation failed:", bostaErr || bostaData);
                    showToast("فشل إلغاء الشحنة في بوسطة، سنقوم بمتابعة إلغاء الأوردر محلياً وفي شوبيفاي.", "warning");
                } else {
                    addressObj.bostaStateName = "Cancelled";
                    addressObj.bostaStateCode = 49;
                    updatedAddressStr = JSON.stringify(addressObj);
                    showToast("تم إلغاء الشحنة في بوسطة بنجاح", "success");
                }
            } catch (e) {
                console.error("Error communicating with Bosta cancellation:", e);
                showToast("حدث خطأ أثناء التواصل مع بوسطة لإلغاء الشحنة، سنتابع إلغاء الأوردر محلياً وفي شوبيفاي.", "warning");
            }
        }

        const oldStatus = order.status;
        const orderTotal = parseFloat(order.totalValue || order.total_value || order.total_amount) || 0;
        const customerId = order.customer_id;
        
        setState(prev => {
            const currentOrder = prev.orders.find(o => o.id === orderId);
            if (!currentOrder) return prev;
            
            let products = [...prev.products];
            
            const wasDeducted = isDeductedStatus(oldStatus, { ...currentOrder, status: oldStatus });
            const isDeducted = isDeductedStatus(newStatus, { ...currentOrder, status: newStatus });
            
            if (!wasDeducted && isDeducted) {
                currentOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = currentOrder.warehouse || "Sulur";
                                        stock[wh] = Math.max(0, (stock[wh] || 0) - item.quantity);
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            } else if (wasDeducted && !isDeducted) {
                currentOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = currentOrder.warehouse || "Sulur";
                                        stock[wh] = (stock[wh] || 0) + item.quantity;
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }

            let newLedger = prev.stockLedger || [];
            if (!wasDeducted && isDeducted) {
                currentOrder.items.forEach(item => {
                    const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                    if (prod) {
                        const vr = prod.variants.find(v => v.sku === item.variantSku);
                        const currentBal = vr ? (vr.stock[currentOrder.warehouse || "Sulur"] || 0) : 0;
                        newLedger = [{
                            date: new Date().toISOString(),
                            productId: prod.id,
                            variantSku: item.variantSku,
                            warehouse: currentOrder.warehouse || "Sulur",
                            type: "Sale",
                            quantity: -item.quantity,
                            balanceAfter: currentBal
                        }, ...newLedger];
                    }
                });
            } else if (wasDeducted && !isDeducted) {
                currentOrder.items.forEach(item => {
                    const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                    if (prod) {
                        const vr = prod.variants.find(v => v.sku === item.variantSku);
                        const currentBal = vr ? (vr.stock[currentOrder.warehouse || "Sulur"] || 0) : 0;
                        newLedger = [{
                            date: new Date().toISOString(),
                            productId: prod.id,
                            variantSku: item.variantSku,
                            warehouse: currentOrder.warehouse || "Sulur",
                            type: "Return",
                            quantity: item.quantity,
                            balanceAfter: currentBal
                        }, ...newLedger];
                    }
                });
            }

            return {
                ...prev,
                products,
                stockLedger: newLedger,
                orders: prev.orders.map(o => {
                    if (o.id === orderId) {
                        const adminName = prev.currentUser?.name || 'الأدمن';
                        const needsCreatorStamp = !o.createdBy || o.createdBy === 'Shopify Webhook';
                        const updatedOrder = { 
                            ...o, 
                            status: newStatus,
                            address: updatedAddressStr,
                            is_reviewed: o.is_reviewed || o.isReviewed || (o.source === 'shopify' ? true : o.is_reviewed),
                            isReviewed: o.is_reviewed || o.isReviewed || (o.source === 'shopify' ? true : o.isReviewed),
                            ...(needsCreatorStamp && { createdBy: adminName, created_by: adminName })
                        };
                        if (newStatus === 'Cancelled' || newStatus === 'Rejected') {
                            updatedOrder.rejectedBy = prev.currentUser?.name || 'الأدمن';
                            updatedOrder.rejected_by_name = prev.currentUser?.name || 'الأدمن';
                        }
                        // Flag deposit refund needed if order was cancelled with a collected deposit
                        if (
                            (newStatus === 'Cancelled' || newStatus === 'Rejected') &&
                            (parseFloat(o.deposit) || 0) > 0 &&
                            o.depositReceiverId
                        ) {
                            updatedOrder.depositRefundStatus = 'awaiting_return';
                        }
                        return updatedOrder;
                    }
                    return o;
                })
            };
        });

        // Trigger customer stats update if transitioning to/from Completed
        if (oldStatus !== "Completed" && newStatus === "Completed" && customerId) {
            updateCustomerStats(customerId, orderTotal, 1);
        } else if (oldStatus === "Completed" && newStatus !== "Completed" && customerId) {
            updateCustomerStats(customerId, -orderTotal, -1);
        }

        logActivity("order", `Order ${orderId} status changed to ${newStatus}.`);
        showToast(`Order status updated to ${newStatus}.`);

        if (supabase) {
            try {
                const adminName = state.currentUser?.name || 'الأدمن';
                const needsCreatorStamp = !order.createdBy || order.createdBy === 'Shopify Webhook';
                // 1. Fetch latest order address from database to prevent overwriting Bosta tracking info
                const { data: dbOrderData } = await supabase.from('orders').select('address, status').eq('id', orderId).maybeSingle();
                let dbAddressObj = null;
                if (dbOrderData && dbOrderData.address) {
                    try {
                        dbAddressObj = typeof dbOrderData.address === 'string' ? JSON.parse(dbOrderData.address) : dbOrderData.address;
                    } catch (e) {}
                }

                if (dbAddressObj && dbAddressObj.bostaDeliveryId) {
                    const localHadBosta = addressObj && addressObj.bostaDeliveryId;
                    if (!localHadBosta) {
                        // The database was updated with Bosta tracking info in the background!
                        addressObj = dbAddressObj;
                        updatedAddressStr = JSON.stringify(dbAddressObj);
                        
                        // Trigger Bosta cancellation here since it was skipped in the synchronous path
                        if (newStatus === 'Cancelled' && dbAddressObj.bostaStateCode !== 49) {
                            try {
                                showToast("جاري إلغاء الشحنة في بوسطة...", "info");
                                const { data: bostaData } = await supabase.functions.invoke('manage-bosta-delivery', {
                                    body: { action: 'cancel', bostaDeliveryId: dbAddressObj.bostaDeliveryId }
                                });
                                if (bostaData && bostaData.success) {
                                    dbAddressObj.bostaStateName = "Cancelled";
                                    dbAddressObj.bostaStateCode = 49;
                                    updatedAddressStr = JSON.stringify(dbAddressObj);
                                    showToast("تم إلغاء الشحنة في بوسطة بنجاح", "success");
                                }
                            } catch (e) {
                                console.error("Error cancelling late-bound Bosta delivery:", e);
                            }
                        }
                    }
                }

                const dbUpdate = { 
                    status: newStatus,
                    address: updatedAddressStr,
                    ...(needsCreatorStamp && { created_by: adminName })
                };
                
                // Flag deposit refund needed if order was cancelled with a collected deposit
                const curOrder = (state.orders || []).find(o => o.id === orderId);
                if (
                    newStatus === 'Cancelled' &&
                    curOrder &&
                    (parseFloat(curOrder.deposit) || 0) > 0 &&
                    curOrder.depositReceiverId
                ) {
                    dbUpdate.deposit_refund_status = 'awaiting_return';
                    showToast(`⚠️ تنبيه عربون: تم إلغاء الطلب ${orderId}. العربون (${curOrder.deposit} ج.م) بعهدة الأدمن وبانتظار الإعادة للعميل.`, "warning");
                }
                
                await supabase.from('orders').update(dbUpdate).eq('id', orderId);
                
                const { data: orderData } = await supabase.from('orders').select('*').eq('id', orderId).single();
                const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
                
                if (orderData && items && items.length > 0) {
                    const isShopifyOrder = orderData.source === 'shopify' || !!orderData.shopify_order_id || !!orderData.shopifyOrderId;
                    const wasDeducted = isDeductedStatus(oldStatus, { ...orderData, status: oldStatus });
                    const isDeducted = isDeductedStatus(newStatus, { ...orderData, status: newStatus });
                    const isCancellation = newStatus === 'Cancelled' || newStatus === 'Rejected';
                    
                    // 1. If cancelled or rejected, cancel order in Shopify first
                    if (isCancellation) {
                        const curOrderInState = (state.orders || []).find(o => o.id === orderId);
                        const sOrderId = orderData?.shopify_order_id || orderData?.shopifyOrderId || curOrderInState?.shopify_order_id || curOrderInState?.shopifyOrderId;
                        if (sOrderId) {
                            try {
                                console.log(`Triggering Shopify cancellation API for order ${sOrderId}...`);
                                const cancelRes = await supabase.functions.invoke('swift-processor', {
                                    body: { action: 'cancel_order', shopify_order_id: sOrderId, reason: 'customer' }
                                });
                                console.log("Shopify cancel API response:", cancelRes);
                            } catch (err) {
                                console.error("Failed to cancel order in Shopify:", err);
                            }
                        }
                    }

                    // 2. Adjust or restore system and Shopify stock
                    if (!wasDeducted && isDeducted) {
                        for (const item of items) {
                            const itemSku = item.variant_sku || item.variantSku || item.sku;
                            if (!itemSku) continue;
                            const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id, average_cost').eq('sku', itemSku).single();
                            if (vData) {
                                const newStock = Math.max(0, vData.stock_sulur - item.quantity);
                                await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', itemSku);
                                
                                setState(prev => ({
                                    ...prev,
                                    products: (prev.products || []).map(p => ({
                                        ...p,
                                        variants: (p.variants || []).map(v => v.sku === itemSku ? {
                                            ...v,
                                            stock: { ...(v.stock || {}), Sulur: newStock }
                                        } : v)
                                    }))
                                }));
                                
                                const uCost = item.cost_at_time_of_sale || item.costAtTimeOfSale || vData.average_cost || 0;
                                const tCost = uCost * Math.abs(item.quantity);

                                await supabase.from('stock_ledger').insert([{
                                    order_id: orderId,
                                    date: new Date().toISOString(),
                                    product_id: vData.product_id,
                                    variant_sku: itemSku,
                                    warehouse: orderData.warehouse || 'Sulur',
                                    type: 'Sale',
                                    quantity: -item.quantity,
                                    unit_cost: uCost,
                                    total_cost: tCost,
                                    balance_after: newStock
                                }]);
                                
                                await syncVariantStockToShopify(itemSku);
                            }
                        }
                    } else if (wasDeducted && !isDeducted) {
                        // Order was previously deducted in system: restore stock in DB, local state & sync to Shopify
                        for (const item of items) {
                            const itemSku = item.variant_sku || item.variantSku || item.sku;
                            if (!itemSku) continue;
                            const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id, average_cost').eq('sku', itemSku).single();
                            if (vData) {
                                const newStock = vData.stock_sulur + item.quantity;
                                await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', itemSku);
                                
                                setState(prev => ({
                                    ...prev,
                                    products: (prev.products || []).map(p => ({
                                        ...p,
                                        variants: (p.variants || []).map(v => v.sku === itemSku ? {
                                            ...v,
                                            stock: { ...(v.stock || {}), Sulur: newStock }
                                        } : v)
                                    }))
                                }));
                                
                                const uCost = item.cost_at_time_of_sale || item.costAtTimeOfSale || vData.average_cost || 0;
                                const tCost = uCost * Math.abs(item.quantity);
                                const cancelReasonText = explicitReason || order.cancellationReason || order.cancellation_reason || (state.orders || []).find(o => o.id === orderId)?.cancellationReason;
                                const entryNotes = cancelReasonText ? `سبب الإلغاء: ${cancelReasonText}` : null;

                                const ledgerEntryObj = {
                                    order_id: orderId,
                                    date: new Date().toISOString(),
                                    product_id: vData.product_id,
                                    variant_sku: itemSku,
                                    warehouse: orderData.warehouse || 'Sulur',
                                    type: 'Return',
                                    quantity: item.quantity,
                                    unit_cost: uCost,
                                    total_cost: tCost,
                                    balance_after: newStock,
                                    notes: entryNotes
                                };

                                await supabase.from('stock_ledger').insert([ledgerEntryObj]);

                                setState(prev => ({
                                    ...prev,
                                    stockLedger: [
                                        {
                                            id: Date.now() + Math.random(),
                                            orderId: orderId,
                                            order_id: orderId,
                                            date: ledgerEntryObj.date,
                                            created_at: ledgerEntryObj.date,
                                            productId: vData.product_id,
                                            product_id: vData.product_id,
                                            variantSku: itemSku,
                                            variant_sku: itemSku,
                                            warehouse: ledgerEntryObj.warehouse,
                                            type: 'Return',
                                            quantity: item.quantity,
                                            unitCost: uCost,
                                            unit_cost: uCost,
                                            totalCost: tCost,
                                            total_cost: tCost,
                                            balanceAfter: newStock,
                                            balance_after: newStock,
                                            notes: entryNotes
                                        },
                                        ...(prev.stockLedger || [])
                                    ]
                                }));
                                
                                await syncVariantStockToShopify(itemSku);
                            }
                        }
                    } else if (isCancellation && isShopifyOrder) {
                        // Order was NOT deducted in system (unapproved pending Shopify order): DO NOT change system stock, but sync current DB stock to Shopify to restore Shopify inventory
                        for (const item of items) {
                            const itemSku = item.variant_sku || item.variantSku || item.sku;
                            if (itemSku) {
                                await syncVariantStockToShopify(itemSku);
                            }
                        }
                    }

                    if (newStatus === 'Completed') {
                        const curOrderInState = (state.orders || []).find(o => o.id === orderId);
                        const sOrderId = orderData?.shopify_order_id || orderData?.shopifyOrderId || curOrderInState?.shopify_order_id || curOrderInState?.shopifyOrderId;
                        if (sOrderId) {
                            try {
                                console.log(`Sending fulfill_order to Shopify for completed order ${sOrderId}...`);
                                await supabase.functions.invoke('swift-processor', {
                                    body: { action: 'fulfill_order', shopify_order_id: sOrderId }
                                });

                                console.log(`Sending mark_order_paid to Shopify for completed order ${sOrderId}...`);
                                await supabase.functions.invoke('swift-processor', {
                                    body: {
                                        action: 'mark_order_paid',
                                        shopify_order_id: sOrderId,
                                        amount: orderData.total_value || orderData.total_value
                                    }
                                });
                            } catch (fErr) {
                                console.error("Error fulfilling/marking paid order on Shopify:", fErr);
                            }
                        }
                    }

                    // Re-evaluate customer stats on cancellation or refund
                    if ((newStatus === 'Cancelled' || newStatus === 'Refunded' || newStatus === 'Returned') && orderData.customer_id) {
                        const orderTotalVal = parseFloat(orderData.total_value) || 0;
                        updateCustomerStats(orderData.customer_id, -orderTotalVal, -1);
                    }
                    await loadSupabaseData();
                }
            } catch (e) {
                console.error("Supabase Error:", e);
                await loadSupabaseData();
            }
        }
    };

    const deleteOrder = async (orderId) => {
        // Find order object from current state BEFORE state mutation
        const targetOrderObj = state.orders.find(o => o.id === orderId);
        const status = targetOrderObj ? targetOrderObj.status : null;
        const customerId = targetOrderObj ? (targetOrderObj.customer_id || targetOrderObj.customerId || null) : null;
        const orderTotal = targetOrderObj ? (parseFloat(targetOrderObj.totalValue || targetOrderObj.total_value) || 0) : 0;
        const orderWarehouse = targetOrderObj ? (targetOrderObj.warehouse || 'Sulur') : 'Sulur';

        // Normalize items list
        let orderItems = targetOrderObj ? (targetOrderObj.items || []) : [];

        // 1. Instantly update local state: restore stock if deducted, and remove order
        setState(prev => {
            let products = [...prev.products];
            if (targetOrderObj && isDeductedStatus(status, targetOrderObj) && orderItems.length > 0) {
                orderItems.forEach(item => {
                    const itemSku = item.variantSku || item.variant_sku || item.sku;
                    const itemQty = Math.abs(parseInt(item.quantity) || 0);
                    if (itemSku && itemQty > 0) {
                        products = products.map(p => {
                            if (p.variants.some(v => v.sku === itemSku)) {
                                return {
                                    ...p,
                                    variants: p.variants.map(v => {
                                        if (v.sku === itemSku) {
                                            const stock = { ...v.stock };
                                            stock[orderWarehouse] = (stock[orderWarehouse] || 0) + itemQty;
                                            return { ...v, stock };
                                        }
                                        return v;
                                    })
                                };
                            }
                            return p;
                        });
                    }
                });
            }
            let newOrders = [];
            let newDeletedOrdersWithDeposits = [...(prev.deletedOrdersWithDeposits || [])];
            
            if (targetOrderObj && parseFloat(targetOrderObj.deposit) > 0) {
                // Soft delete: remove from orders, add to deletedOrdersWithDeposits with updated details
                newOrders = (prev.orders || []).filter(o => o.id !== orderId);
                
                let parsedAddr = {};
                if (targetOrderObj.address) {
                    try {
                        parsedAddr = typeof targetOrderObj.address === 'string' ? JSON.parse(targetOrderObj.address) : targetOrderObj.address;
                    } catch (e) {
                        parsedAddr = { detailAddress: targetOrderObj.address };
                    }
                }
                parsedAddr.isDeleted = true;
                parsedAddr.is_deleted = true;
                
                const softDeletedOrder = {
                    ...targetOrderObj,
                    status: 'Cancelled',
                    address: parsedAddr,
                    isDeleted: true,
                    is_deleted: true,
                    depositRefundStatus: (targetOrderObj.depositRefundStatus !== 'returned' && targetOrderObj.depositStatus !== 'settled') ? 'awaiting_return' : targetOrderObj.depositRefundStatus
                };
                
                // Avoid duplication
                newDeletedOrdersWithDeposits = newDeletedOrdersWithDeposits.filter(o => o.id !== orderId);
                newDeletedOrdersWithDeposits.push(softDeletedOrder);
            } else {
                newOrders = (prev.orders || []).filter(o => o.id !== orderId);
            }

            return {
                ...prev,
                products,
                orders: newOrders,
                deletedOrdersWithDeposits: newDeletedOrdersWithDeposits
            };
        });

        if (status === "Completed" && customerId) {
            updateCustomerStats(customerId, -orderTotal, -1);
        }

        logActivity("order", `Order ${orderId} deleted.`);
        showToast(`تم حذف الطلب ${orderId} بنجاح`, "success");

        if (supabase) {
            (async () => {
                try {
                    // Fetch dbOrderItems if local items are empty to guarantee we have all items
                    let dbOrderItems = orderItems;
                    if (!dbOrderItems || dbOrderItems.length === 0) {
                        const { data: fetchedItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
                        if (fetchedItems) dbOrderItems = fetchedItems;
                    }

                    // Cancel order on Shopify if it's a Shopify order
                    const shopifyOrdId = targetOrderObj?.shopifyOrderId || targetOrderObj?.shopify_order_id;
                    if (targetOrderObj?.source === 'shopify' && shopifyOrdId) {
                        try {
                            console.log(`Cancelling deleted Shopify order ${shopifyOrdId}...`);
                            await supabase.functions.invoke('swift-processor', {
                                body: {
                                    action: 'cancel_order',
                                    shopify_order_id: shopifyOrdId,
                                    reason: 'customer'
                                }
                            });
                        } catch (sErr) {
                            console.error("Error cancelling Shopify order during deletion:", sErr);
                        }
                    }

                    // Cancel Bosta delivery if exists
                    let addressObj = null;
                    try { 
                        addressObj = typeof targetOrderObj?.address === 'string' ? JSON.parse(targetOrderObj.address) : (targetOrderObj?.address || null); 
                    } catch(e) {}

                    if (addressObj && addressObj.bostaDeliveryId) {
                        try {
                            console.log(`Cancelling Bosta delivery ${addressObj.bostaDeliveryId} for deleted order ${orderId}...`);
                            const { data: { session } } = await supabase.auth.getSession();
                            await fetch('https://skvwhgcclmvejmpsgkes.supabase.co/functions/v1/manage-bosta-delivery', {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                    'Authorization': `Bearer ${session?.access_token}`
                                },
                                body: JSON.stringify({ action: 'cancel', bostaDeliveryId: addressObj.bostaDeliveryId })
                            });
                        } catch (bErr) {
                            console.error("Error cancelling Bosta delivery during deletion:", bErr);
                        }
                    }

                    // Restore stock in DB & Shopify atomically if status was deducted
                    const isShopifyOrder = targetOrderObj?.source === 'shopify' || !!targetOrderObj?.shopifyOrderId || !!targetOrderObj?.shopify_order_id;
                    const wasDeducted = isDeductedStatus(status, targetOrderObj);

                    if (wasDeducted && dbOrderItems && dbOrderItems.length > 0) {
                        for (const item of dbOrderItems) {
                            const itemSku = item.variantSku || item.variant_sku || item.sku;
                            const itemQty = Math.abs(parseInt(item.quantity) || 0);
                            if (!itemSku || itemQty <= 0) continue;

                            // Atomic stock adjustment in DB
                            const newStock = await adjustStockAtomically(itemSku, +itemQty);

                            // Sync updated stock to Shopify
                            try {
                                syncVariantStockToShopify(itemSku);
                            } catch (spErr) {
                                console.error("Error syncing stock to Shopify on order delete:", spErr);
                            }

                            // Add Return entry in stock_ledger
                            try {
                                const { data: vData } = await supabase.from('product_variants').select('product_id, average_cost').eq('sku', itemSku).single();
                                if (vData) {
                                    const uCost = vData.average_cost || 0;
                                    const tCost = uCost * itemQty;
                                    await supabase.from('stock_ledger').insert([{
                                        order_id: orderId,
                                        date: new Date().toISOString(),
                                        product_id: vData.product_id,
                                        variant_sku: itemSku,
                                        warehouse: orderWarehouse,
                                        type: 'Return',
                                        quantity: itemQty,
                                        unit_cost: uCost,
                                        total_cost: tCost,
                                        balance_after: newStock !== undefined ? newStock : 0,
                                        notes: `إلغاء وإعادة مخزون بسبب حذف الطلب #${orderId}`
                                    }]);
                                }
                            } catch (ledgerErr) {
                                console.error("Failed to insert stock ledger return on delete:", ledgerErr);
                            }
                        }
                    } else if (isShopifyOrder && dbOrderItems && dbOrderItems.length > 0) {
                        // Unapproved Shopify order deleted: do not increment DB stock, but sync DB stock to Shopify
                        for (const item of dbOrderItems) {
                            const itemSku = item.variantSku || item.variant_sku || item.sku;
                            if (itemSku) {
                                try {
                                    syncVariantStockToShopify(itemSku);
                                } catch (e) {}
                            }
                        }
                    }

                    // If order has deposit, do NOT delete from DB, just update status and address JSON to mark isDeleted
                    if (targetOrderObj && parseFloat(targetOrderObj.deposit) > 0) {
                        let updatedAddressObj = {};
                        if (targetOrderObj.address) {
                            try {
                                updatedAddressObj = typeof targetOrderObj.address === 'string' ? JSON.parse(targetOrderObj.address) : targetOrderObj.address;
                            } catch (e) {
                                updatedAddressObj = { detailAddress: targetOrderObj.address };
                            }
                        }
                        updatedAddressObj.isDeleted = true;
                        updatedAddressObj.is_deleted = true;

                        const dbUpdate = {
                            status: 'Cancelled',
                            address: JSON.stringify(updatedAddressObj)
                        };

                        if (targetOrderObj.depositRefundStatus !== 'returned' && targetOrderObj.depositStatus !== 'settled') {
                            dbUpdate.deposit_refund_status = 'awaiting_return';
                        }

                        await supabase.from('orders').update(dbUpdate).eq('id', orderId);
                    } else {
                        // Finally delete order from DB (cascade deletes order_items)
                        await supabase.from('orders').delete().eq('id', orderId);
                    }
                    await loadSupabaseData();
                } catch (e) {
                    console.error("Supabase Error during order deletion:", e);
                }
            })();
        }
    };

    const editOrder = async (updatedOrder) => {
        let requiresCustomerUpdate = false;
        let customerStatsDiff = { value: 0, count: 0 };
        
        const oldOrderState = state.orders.find(o => o.id === updatedOrder.id);
        let hasChanges = false;
        
        if (oldOrderState) {
            const clientChanged = (oldOrderState.client || '').trim() !== (updatedOrder.client || '').trim();
            const warehouseChanged = (oldOrderState.warehouse || 'Sulur') !== (updatedOrder.warehouse || 'Sulur');
            const statusChanged = (oldOrderState.status || '') !== (updatedOrder.status || '');
            const totalChanged = Math.abs((parseFloat(oldOrderState.totalValue) || 0) - (parseFloat(updatedOrder.totalValue) || 0)) > 0.01;
            
            const oldDiscountType = oldOrderState.discount_type || oldOrderState.discountType || null;
            const newDiscountType = updatedOrder.discount_type || updatedOrder.discountType || null;
            const discountTypeChanged = oldDiscountType !== newDiscountType;
            
            const oldDiscountVal = parseFloat(oldOrderState.discount_value || oldOrderState.discountValue) || 0;
            const newDiscountVal = parseFloat(updatedOrder.discount_value || updatedOrder.discountValue) || 0;
            const discountValChanged = Math.abs(oldDiscountVal - newDiscountVal) > 0.01;
            
            const oldCoupon = oldOrderState.applied_coupon_code || oldOrderState.appliedCouponCode || null;
            const newCoupon = updatedOrder.applied_coupon_code || updatedOrder.appliedCouponCode || null;
            const couponChanged = oldCoupon !== newCoupon;
            
            const oldReason = oldOrderState.discount_reason || oldOrderState.discountReason || null;
            const newReason = updatedOrder.discount_reason || updatedOrder.discountReason || null;
            const reasonChanged = oldReason !== newReason;
            
            const oldReasonDetails = oldOrderState.discount_reason_details || oldOrderState.discountReasonDetails || null;
            const newReasonDetails = updatedOrder.discount_reason_details || updatedOrder.discountReasonDetails || null;
            const reasonDetailsChanged = oldReasonDetails !== newReasonDetails;
            
            const govChanged = (oldOrderState.governorate || '').trim() !== (updatedOrder.governorate || '').trim();
            const depositChanged = Math.abs((parseFloat(oldOrderState.deposit) || 0) - (parseFloat(updatedOrder.deposit) || 0)) > 0.01;
            const receiverChanged = (oldOrderState.depositReceiverId || null) !== (updatedOrder.depositReceiverId || null);
            const depStatusChanged = (oldOrderState.depositStatus || '') !== (updatedOrder.depositStatus || '');
            const shippingChanged = Math.abs((parseFloat(oldOrderState.shipping_fee || oldOrderState.shippingFee) || 0) - (parseFloat(updatedOrder.shipping_fee || updatedOrder.shippingFee) || 0)) > 0.01;
            
            const oldPayment = oldOrderState.paymentMethod || oldOrderState.payment_method || null;
            const newPayment = updatedOrder.paymentMethod || updatedOrder.payment_method || null;
            const paymentMethodChanged = oldPayment !== newPayment;

            // Compare address details instead of raw JSON string to prevent false-positives from key ordering or helper fields
            let addressChanged = false;
            try {
                const parseAddr = (addr) => {
                    if (!addr) return {};
                    if (typeof addr === 'object') return addr;
                    if (typeof addr === 'string' && addr.trim().startsWith('{')) {
                        return JSON.parse(addr);
                    }
                    return { detailAddress: addr };
                };
                const oldAddr = parseAddr(oldOrderState.address);
                const newAddr = parseAddr(updatedOrder.address);
                
                addressChanged = 
                    (oldAddr.detailAddress || '').trim() !== (newAddr.detailAddress || '').trim() ||
                    (oldAddr.phone || '').trim() !== (newAddr.phone || '').trim() ||
                    (oldAddr.secondPhone || '').trim() !== (newAddr.secondPhone || '').trim() ||
                    (oldAddr.bostaCityCode || null) !== (newAddr.bostaCityCode || null) ||
                    (oldAddr.bostaDistrictId || null) !== (newAddr.bostaDistrictId || null) ||
                    (oldAddr.bostaZoneId || null) !== (newAddr.bostaZoneId || null);
            } catch (e) {
                addressChanged = (oldOrderState.address || '') !== (updatedOrder.address || '');
            }

            let itemsChanged = false;
            const oldItems = oldOrderState.items || [];
            const newItems = updatedOrder.items || [];
            if (oldItems.length !== newItems.length) {
                itemsChanged = true;
            } else {
                for (let i = 0; i < oldItems.length; i++) {
                    const oi = oldItems[i];
                    const ni = newItems[i];
                    const oiSku = oi.variantSku || oi.sku || oi.variant_sku;
                    const niSku = ni.variantSku || ni.sku || ni.variant_sku;
                    if (
                        oiSku !== niSku ||
                        oi.quantity !== ni.quantity ||
                        Math.abs((parseFloat(oi.price) || 0) - (parseFloat(ni.price) || 0)) > 0.01
                    ) {
                        itemsChanged = true;
                        break;
                    }
                }
            }

            if (
                clientChanged || warehouseChanged || statusChanged || totalChanged ||
                discountTypeChanged || discountValChanged || couponChanged || reasonChanged ||
                reasonDetailsChanged || addressChanged || govChanged || depositChanged ||
                receiverChanged || depStatusChanged || shippingChanged || paymentMethodChanged ||
                itemsChanged
            ) {
                hasChanges = true;
            }
        } else {
            hasChanges = true;
        }

        const enrichedItems = updatedOrder.items.map(item => {
            if (item.costAtTimeOfSale) return item;
            let avgCost = 0;
            const prod = state.products.find(p => p.variants.some(v => v.sku === item.variantSku));
            if (prod) {
                const vr = prod.variants.find(v => v.sku === item.variantSku);
                if (vr) avgCost = vr.averageCost || vr.wholesalePrice || 0;
            }
            return { ...item, costAtTimeOfSale: avgCost };
        });
        
        const enrichedOrder = { 
            ...updatedOrder, 
            items: enrichedItems,
            updatedBy: hasChanges ? (state.currentUser?.name || null) : (oldOrderState ? (oldOrderState.updatedBy || oldOrderState.updated_by || null) : null)
        };
        
        let oldOrder = null;
        
        setState(prev => {
            oldOrder = prev.orders.find(o => o.id === enrichedOrder.id);
            if (!oldOrder) return prev;

            let products = [...prev.products];

            // Revert old stock changes if deducted
            const oldDeducted = isDeductedStatus(oldOrder.status, oldOrder);
            if (oldDeducted) {
                oldOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = oldOrder.warehouse || "Sulur";
                                        stock[wh] = (stock[wh] || 0) + item.quantity;
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }

            // Deduct new stock changes if new status is deducted
            const newDeducted = isDeductedStatus(enrichedOrder.status, enrichedOrder);
            if (newDeducted) {
                enrichedOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = enrichedOrder.warehouse || "Sulur";
                                        stock[wh] = Math.max(0, (stock[wh] || 0) - item.quantity);
                                        return { ...v, stock };
                                    }
                                    return v;
                                })
                            };
                        }
                        return p;
                    });
                });
            }

            // Delta-based ledger: keep old entries, add adjustment entries for changes
            let newLedger = prev.stockLedger || [];
            const editTimestamp = new Date().toISOString();

            if (oldOrder && isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                // Build old and new SKU maps for comparison
                const oldItems = oldOrder.items || [];
                const newItems = enrichedOrder.items || [];
                const oldMap = {};
                oldItems.forEach(i => { const sk = i.variantSku || i.variant_sku || i.sku; if (sk) oldMap[sk] = (oldMap[sk] || 0) + (i.quantity || 0); });
                const newMap = {};
                newItems.forEach(i => { const sk = i.variantSku || i.variant_sku || i.sku; if (sk) newMap[sk] = (newMap[sk] || 0) + (i.quantity || 0); });

                const allSkus = new Set([...Object.keys(oldMap), ...Object.keys(newMap)]);

                allSkus.forEach(sku => {
                    const oldQty = oldMap[sku] || 0;
                    const newQty = newMap[sku] || 0;
                    const delta = oldQty - newQty; // positive = returned stock, negative = more deducted

                    if (delta === 0) return; // no change for this SKU

                    const prod = products.find(p => p.variants.some(v => v.sku === sku));
                    if (!prod) return;
                    const vr = prod.variants.find(v => v.sku === sku);
                    const currentBal = vr ? (vr.stock[enrichedOrder.warehouse || 'Sulur'] || 0) : 0;
                    const uCost = (vr ? vr.averageCost || vr.wholesalePrice : 0) || 0;
                    const tCost = uCost * Math.abs(delta);

                    // Build descriptive note
                    let note = '';
                    if (oldQty === 0) {
                        note = `تعديل أوردر: تم إضافة منتج جديد (كمية: ${newQty})`;
                    } else if (newQty === 0) {
                        note = `تعديل أوردر: تم حذف المنتج (كمية سابقة: ${oldQty})`;
                    } else {
                        note = `تعديل أوردر: الكمية تغيرت من ${oldQty} إلى ${newQty}`;
                    }

                    newLedger = [{
                        date: editTimestamp,
                        productId: prod.id,
                        variantSku: sku,
                        orderId: enrichedOrder.id,
                        warehouse: enrichedOrder.warehouse || 'Sulur',
                        type: "Edit Adjustment",
                        quantity: delta,
                        unitCost: uCost,
                        totalCost: tCost,
                        balanceAfter: currentBal,
                        notes: note,
                        created_at: editTimestamp
                    }, ...newLedger];
                });
            }

            if (oldOrder) {
                if (oldOrder.status === "Completed" && enrichedOrder.status === "Completed") {
                    if (oldOrder.totalValue !== enrichedOrder.totalValue) {
                        requiresCustomerUpdate = true;
                        customerStatsDiff.value = enrichedOrder.totalValue - oldOrder.totalValue;
                    }
                } else if (oldOrder.status !== "Completed" && enrichedOrder.status === "Completed") {
                    requiresCustomerUpdate = true;
                    customerStatsDiff.value = enrichedOrder.totalValue;
                    customerStatsDiff.count = 1;
                } else if (oldOrder.status === "Completed" && enrichedOrder.status !== "Completed") {
                    requiresCustomerUpdate = true;
                    customerStatsDiff.value = -oldOrder.totalValue;
                    customerStatsDiff.count = -1;
                }
            }

            const newOrders = prev.orders.map(o => o.id === enrichedOrder.id ? enrichedOrder : o);

            return {
                ...prev,
                products,
                orders: newOrders,
                stockLedger: newLedger
            };
        });

        if (requiresCustomerUpdate && enrichedOrder.customer_id) {
            updateCustomerStats(enrichedOrder.customer_id, customerStatsDiff.value, customerStatsDiff.count);
        }

        // Bosta Update check
        let addressObj = null;
        try {
            addressObj = enrichedOrder.address ? JSON.parse(enrichedOrder.address) : null;
        } catch(e) {}

        if (addressObj && addressObj.bostaDeliveryId) {
            try {
                showToast("جاري تحديث بيانات الشحنة في بوسطة...", "info");
                const orderTotal = parseFloat(enrichedOrder.totalValue) || 0;
                const depositAmount = parseFloat(enrichedOrder.deposit) || 0;
                const codAmount = Math.max(0, orderTotal - depositAmount);
                
                // Goods Info Amount should be the original products subtotal (before order discounts) using original retail prices
                const grossProductsTotal = enrichedOrder.items.reduce((sum, item) => {
                    let originalPrice = parseFloat(item.price) || 0; // fallback
                    if (state.products) {
                        const prod = state.products.find(p => p.variants.some(v => v.sku === item.variantSku));
                        if (prod) {
                            const vr = prod.variants.find(v => v.sku === item.variantSku);
                            if (vr) originalPrice = parseFloat(vr.retailPrice) || originalPrice;
                        }
                    }
                    return sum + (originalPrice * (parseInt(item.quantity) || 0));
                }, 0);
                const productValueAmount = grossProductsTotal < 1000 ? grossProductsTotal + 100 : grossProductsTotal;
                
                const totalQty = enrichedOrder.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                const itemsDescription = enrichedOrder.items.map(item => {
                    let prodName = item.productName;
                    let optName = item.variantName || '';
                    
                    if (!prodName && state.products) {
                        state.products.forEach(p => {
                            const v = p.variants.find(vr => vr.sku === item.variantSku);
                            if (v) {
                                prodName = p.name;
                                optName = v.name;
                            }
                        });
                    }
                    
                    if (!prodName) {
                        prodName = "منتج"; // Fallback to "منتج"
                    }
                    
                    const displayName = formatProductDisplayName(prodName, optName);
                    return `${item.quantity}x ${displayName}`;
                }).join(", ").substring(0, 500);

                const altPhoneClean = addressObj.secondPhone ? addressObj.secondPhone.replace(/\D/g, '') : '';

                const fullName = (enrichedOrder.client || "").trim();
                const nameParts = fullName.split(/\s+/);
                const firstName = nameParts[0] || "العميل";
                const lastName = nameParts.slice(1).join(" ") || ".";

                const bostaPayload = {
                    cod: codAmount,
                    dropOffAddress: {
                        city: addressObj.bostaCityName || addressObj.governorate || "القاهرة",
                        ...(addressObj.bostaDistrictId && { districtId: addressObj.bostaDistrictId }),
                        ...(addressObj.bostaZoneId && { zoneId: addressObj.bostaZoneId }),
                        firstLine: addressObj.detailAddress || addressObj.bostaCityName || addressObj.governorate || "القاهرة"
                    },
                    specs: {
                        packageType: "Small",
                        packageDetails: {
                            itemsCount: totalQty,
                            description: itemsDescription.substring(0, 500)
                        }
                    },
                    goodsInfo: {
                        amount: productValueAmount
                    },
                    receiver: {
                        firstName: firstName,
                        lastName: lastName,
                        phone: addressObj.phone,
                        ...(altPhoneClean && { secondPhone: altPhoneClean })
                    }
                };

                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('https://skvwhgcclmvejmpsgkes.supabase.co/functions/v1/manage-bosta-delivery', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ action: 'update', bostaDeliveryId: addressObj.bostaDeliveryId, payload: bostaPayload })
                });

                if (!res.ok) {
                    const resData = await res.json().catch(() => ({}));
                    console.error("BOSTA UPDATE RAW ERROR:", resData);
                    const bostaErr = resData?.bostaRaw?.message || JSON.stringify(resData?.bostaRaw);
                    showAlert(`فشل تحديث بيانات الشحنة في بوسطة: ${resData.error || res.statusText} - التفاصيل: ${bostaErr}`, "warning");
                } else {
                    showToast("تم التعديل في السيستم وبوسطة بنجاح ✅", "success");
                }
            } catch (e) {
                showAlert("حدث خطأ أثناء التواصل مع بوسطة لتحديث الشحنة.", "warning");
            }
        }

        logActivity("order", `Order ${enrichedOrder.id} updated.`);
        showToast(`Order ${enrichedOrder.id} updated.`);

        if (supabase) {
            await (async () => {
                try {
                    let finalAddress = enrichedOrder.address;
                    try {
                        const { data: dbOrder, error: fetchErr } = await supabase
                            .from('orders')
                            .select('address')
                            .eq('id', enrichedOrder.id)
                            .maybeSingle();
                        
                        if (!fetchErr && dbOrder && dbOrder.address) {
                            let dbAddrObj = {};
                            let currentAddrObj = {};
                            try { dbAddrObj = JSON.parse(dbOrder.address); } catch (e) {}
                            try { currentAddrObj = JSON.parse(enrichedOrder.address); } catch (e) {}
                            
                            const hasDbBosta = dbAddrObj && (dbAddrObj.bostaTrackingNumber || dbAddrObj.bostaDeliveryId);
                            const hasCurrentBosta = currentAddrObj && (currentAddrObj.bostaTrackingNumber || currentAddrObj.bostaDeliveryId);
                            
                            if (hasDbBosta && !hasCurrentBosta) {
                                const mergedAddressObj = {
                                    ...currentAddrObj,
                                    bostaTrackingNumber: dbAddrObj.bostaTrackingNumber,
                                    bostaDeliveryId: dbAddrObj.bostaDeliveryId,
                                    bostaStateCode: dbAddrObj.bostaStateCode,
                                    bostaStateName: dbAddrObj.bostaStateName
                                };
                                finalAddress = JSON.stringify(mergedAddressObj);
                                enrichedOrder.address = finalAddress;
                            }
                        }
                    } catch (fetchEx) {
                        console.error("Error merging DB address in editOrder:", fetchEx);
                    }

                    const { error: orderError } = await supabase.from('orders').update({
                        client: enrichedOrder.client,
                        customer_id: enrichedOrder.customer_id || null,
                        date: enrichedOrder.date,
                        warehouse: enrichedOrder.warehouse || 'Sulur',
                        status: enrichedOrder.status,
                        total_value: enrichedOrder.totalValue,
                        discount_type: enrichedOrder.discount_type || null,
                        discount_value: enrichedOrder.discount_value || 0,
                        applied_coupon_code: enrichedOrder.applied_coupon_code || null,
                        discount_reason: enrichedOrder.discount_reason || null,
                        discount_reason_details: enrichedOrder.discount_reason_details || null,
                        address: finalAddress || null,
                        governorate: enrichedOrder.governorate || null,
                        deposit: enrichedOrder.deposit || 0,
                        deposit_receiver_id: (enrichedOrder.deposit && enrichedOrder.deposit > 0) ? (enrichedOrder.depositReceiverId || stateRef.current.currentUser?.id || null) : null,
                        deposit_status: enrichedOrder.depositStatus || 'confirmed',
                        shipping_fee: enrichedOrder.shipping_fee || 0,
                        created_by: enrichedOrder.createdBy || null,
                        updated_by: enrichedOrder.updatedBy || null,
                        shopify_order_id: enrichedOrder.shopifyOrderId || null,
                        source: enrichedOrder.source || 'manual',
                        payment_method: enrichedOrder.paymentMethod || null
                    }).eq('id', enrichedOrder.id);

                    if (orderError) {
                        console.error("Supabase Error updating order:", orderError);
                        showToast(`فشل تعديل الطلب في قاعدة البيانات: ${orderError.message}`, "error");
                        await loadSupabaseData();
                        return;
                    }

                    // Fetch pre-existing order items directly from DB for delta calculations to prevent stale state issues
                    let dbOrderItems = [];
                    try {
                        const { data: fetchedDbItems, error: fetchItemsErr } = await supabase
                            .from('order_items')
                            .select('*')
                            .eq('order_id', enrichedOrder.id);
                        if (!fetchItemsErr && fetchedDbItems) {
                            dbOrderItems = fetchedDbItems;
                        }
                    } catch (e) {
                        console.error("Failed to fetch order items from DB in editOrder:", e);
                    }

                    const { error: deleteItemsError } = await supabase.from('order_items').delete().eq('order_id', enrichedOrder.id);
                    if (deleteItemsError) {
                        console.error("Supabase Error deleting old order items:", deleteItemsError);
                        showToast(`فشل تحديث أصناف الطلب: ${deleteItemsError.message}`, "error");
                        await loadSupabaseData();
                        return;
                    }

                    if (enrichedOrder.items && enrichedOrder.items.length > 0) {
                        const items = enrichedOrder.items.map(item => {
                            const rawPrice = parseFloat(item.price) || 0;
                            const qty = parseInt(item.quantity) || 1;
                            
                            return {
                                order_id: enrichedOrder.id,
                                variant_sku: item.variantSku || item.variant_sku || item.sku,
                                quantity: qty,
                                price: rawPrice, // Keep item-level price separate (do not mix with global order-level discount)
                                cost_at_time_of_sale: item.costAtTimeOfSale || item.cost_at_time_of_sale || 0,
                                product_name: item.productName || null,
                                variant_name: item.variantName || null
                            };
                        });
                        const { error: insertItemsError } = await supabase.from('order_items').insert(items);
                        if (insertItemsError) {
                            console.error("Supabase Error inserting new order items:", insertItemsError);
                            showToast(`فشل إدخال الأصناف الجديدة للطلب: ${insertItemsError.message}`, "error");
                            await loadSupabaseData();
                            return;
                        }
                    }

                    // Trigger deposit assignment email if deposit is pending, receiver is another admin, and it's a new assignment
                    const isNewAssignment = enrichedOrder.depositReceiverId && (!oldOrder || oldOrder.depositReceiverId !== enrichedOrder.depositReceiverId || oldOrder.deposit !== enrichedOrder.deposit);
                    if (enrichedOrder.deposit > 0 && isNewAssignment && enrichedOrder.depositReceiverId !== state.currentUser?.id) {
                        const targetAdmin = (state.users || []).find(u => u.id === enrichedOrder.depositReceiverId);
                        if (targetAdmin && targetAdmin.email) {
                            sendAdminNotification("deposit_assignment", targetAdmin.email, {
                                amount: enrichedOrder.deposit,
                                clientName: enrichedOrder.client,
                                orderId: enrichedOrder.id,
                                creatorName: state.currentUser?.name || enrichedOrder.createdBy || "أدمن"
                            });
                        }
                    }

                    // Calculate deltas and update variant stock atomically in the database
                    const oldSKUList = (dbOrderItems && dbOrderItems.length > 0 ? dbOrderItems : (oldOrderState ? oldOrderState.items : [])).map(i => ({
                        sku: i.variantSku || i.variant_sku || i.sku,
                        quantity: i.quantity || 0
                    }));
                    const newSKUList = enrichedOrder.items.map(i => ({
                        sku: i.variantSku || i.variant_sku || i.sku,
                        quantity: i.quantity || 0
                    }));

                    const oldDeducted = oldOrderState ? isDeductedStatus(oldOrderState.status, oldOrderState) : false;
                    const newDeducted = isDeductedStatus(enrichedOrder.status, enrichedOrder);

                    const allSKUs = Array.from(new Set([
                        ...oldSKUList.map(item => item.sku),
                        ...newSKUList.map(item => item.sku)
                    ]));

                    const deltas = [];

                    for (const sku of allSKUs) {
                        const oldItem = oldSKUList.find(i => i.sku === sku);
                        const newItem = newSKUList.find(i => i.sku === sku);

                        const oldQty = oldItem ? oldItem.quantity : 0;
                        const newQty = newItem ? newItem.quantity : 0;

                        let delta = 0;

                        if (oldDeducted && newDeducted) {
                            delta = oldQty - newQty;
                        } else if (oldDeducted && !newDeducted) {
                            delta = oldQty;
                        } else if (!oldDeducted && newDeducted) {
                            delta = -newQty;
                        }

                        if (delta !== 0) {
                            deltas.push({ sku, delta });
                        }
                    }

                    for (const { sku, delta } of deltas) {
                        await adjustStockAtomically(sku, delta);
                    }

                    // Delta-based DB ledger: insert adjustment entries for changes (keep old entries intact)
                    try {
                        if (isDeductedStatus(enrichedOrder.status, enrichedOrder)) {
                            // Build old and new quantity maps from DB items and new items
                            const oldDbMap = {};
                            (dbOrderItems || []).forEach(i => {
                                const sk = i.variant_sku || i.variantSku || i.sku;
                                if (sk) oldDbMap[sk] = (oldDbMap[sk] || 0) + (parseInt(i.quantity) || 0);
                            });
                            const newDbMap = {};
                            (enrichedOrder.items || []).forEach(i => {
                                const sk = i.variantSku || i.variant_sku || i.sku;
                                if (sk) newDbMap[sk] = (newDbMap[sk] || 0) + (parseInt(i.quantity) || 0);
                            });

                            const allEditSkus = new Set([...Object.keys(oldDbMap), ...Object.keys(newDbMap)]);
                            const ledgerDeltaEntries = [];
                            const editNow = new Date().toISOString();

                            for (const sku of allEditSkus) {
                                const oldQ = oldDbMap[sku] || 0;
                                const newQ = newDbMap[sku] || 0;
                                const qDelta = oldQ - newQ; // positive = returned, negative = more deducted

                                if (qDelta === 0) continue;

                                const { data: vData } = await supabase.from('product_variants').select('product_id, stock_sulur, average_cost').eq('sku', sku).single();
                                if (vData) {
                                    const uCost = vData.average_cost || 0;
                                    const tCost = uCost * Math.abs(qDelta);

                                    let editNote = '';
                                    if (oldQ === 0) {
                                        editNote = `تعديل أوردر: تم إضافة منتج جديد (كمية: ${newQ})`;
                                    } else if (newQ === 0) {
                                        editNote = `تعديل أوردر: تم حذف المنتج (كمية سابقة: ${oldQ})`;
                                    } else {
                                        editNote = `تعديل أوردر: الكمية تغيرت من ${oldQ} إلى ${newQ}`;
                                    }

                                    ledgerDeltaEntries.push({
                                        order_id: enrichedOrder.id,
                                        date: editNow,
                                        product_id: vData.product_id,
                                        variant_sku: sku,
                                        warehouse: enrichedOrder.warehouse || 'Sulur',
                                        type: 'Edit Adjustment',
                                        quantity: qDelta,
                                        unit_cost: uCost,
                                        total_cost: tCost,
                                        balance_after: vData.stock_sulur,
                                        notes: editNote
                                    });
                                }
                            }

                            if (ledgerDeltaEntries.length > 0) {
                                await supabase.from('stock_ledger').insert(ledgerDeltaEntries);
                            }
                        }
                    } catch (ledgerErr) {
                        console.error("Failed to insert delta stock ledger entries inside editOrder:", ledgerErr);
                    }
                    await loadSupabaseData();
                } catch (e) {
                    console.error("Supabase Error:", e);
                    await loadSupabaseData();
                }
            })();
        }
    };

    // Suppliers CRUD Actions
    const addSupplier = (supplier) => {
        setState(prev => ({
            ...prev,
            suppliers: [supplier, ...prev.suppliers]
        }));
        logActivity("supplier", `Registered new supplier partner '${supplier.name}'.`);
        showToast(`Supplier '${supplier.name}' registered.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('suppliers').insert([{
                        id: supplier.id,
                        name: supplier.name,
                        contact: supplier.contact,
                        phone: supplier.phone,
                        debt: supplier.debt || 0,
                        paid: supplier.paid || 0
                    }]);
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const recordSupplierPayment = (supplierId, amount) => {
        let updatedSup = null;
        setState(prev => {
            const suppliers = prev.suppliers.map(s => {
                if (s.id === supplierId) {
                    const pay = Math.min(s.debt, amount);
                    updatedSup = {
                        ...s,
                        paid: s.paid + pay,
                        debt: Math.max(0, s.debt - pay)
                    };
                    return updatedSup;
                }
                return s;
            });
            return { ...prev, suppliers };
        });
        const sup = state.suppliers.find(s => s.id === supplierId);
        if (sup) {
            logActivity("supplier", `Paid ${state.storeSettings.currency}${amount} to ${sup.name}.`);
            showToast(`Recorded payment of ${state.storeSettings.currency}${amount} to ${sup.name}.`);
        }

        if (supabase) {
            (async () => {
                try {
                    if (!updatedSup) {
                        const { data } = await supabase.from('suppliers').select('*').eq('id', supplierId).single();
                        if (data) {
                            const pay = Math.min(data.debt, amount);
                            updatedSup = {
                                paid: parseFloat(data.paid) + pay,
                                debt: Math.max(0, parseFloat(data.debt) - pay)
                            };
                        }
                    }
                    if (updatedSup) {
                        await supabase.from('suppliers').update({
                            paid: updatedSup.paid,
                            debt: updatedSup.debt
                        }).eq('id', supplierId);
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    // Waste Logging
    const recordWaste = (waste) => {
        setState(prev => {
            let products = prev.products.map(p => {
                const hasVar = p.variants.some(v => v.sku === waste.variantSku);
                if (hasVar) {
                    return {
                        ...p,
                        variants: p.variants.map(v => {
                            if (v.sku === waste.variantSku) {
                                const stock = { ...v.stock };
                                stock[waste.warehouse] = Math.max(0, (stock[waste.warehouse] || 0) - waste.quantity);
                                return { ...v, stock };
                            }
                            return v;
                        })
                    };
                }
                return p;
            });

            const prod = products.find(p => p.variants.some(v => v.sku === waste.variantSku));
            let newLedger = prev.stockLedger || [];
            if (prod) {
                const vr = prod.variants.find(v => v.sku === waste.variantSku);
                const currentBal = vr ? (vr.stock[waste.warehouse] || 0) : 0;
                const uCost = vr ? (vr.averageCost || vr.wholesalePrice || 0) : 0;
                newLedger = [{
                    date: waste.date || new Date().toISOString(),
                    productId: prod.id,
                    variantSku: waste.variantSku,
                    warehouse: waste.warehouse,
                    type: "Waste",
                    quantity: -waste.quantity,
                    unitCost: uCost,
                    totalCost: uCost * waste.quantity,
                    balanceAfter: currentBal
                }, ...newLedger];
            }

            return {
                ...prev,
                products,
                wastes: [waste, ...prev.wastes],
                stockLedger: newLedger
            };
        });
        logActivity("stock", `Waste Log: ${waste.quantity} units of ${waste.variantSku} flagged as waste (${waste.warehouse}).`);
        showToast(`Waste logged and deducted from stock.`);

        if (supabase) {
            (async () => {
                try {
                    const newStock = await adjustStockAtomically(waste.variantSku, -waste.quantity);
                    const { data: vData } = await supabase.from('product_variants').select('product_id, average_cost').eq('sku', waste.variantSku).single();
                    if (vData) {
                        const uCost = parseFloat(vData.average_cost) || 0;
                        
                        await supabase.from('wastes').insert([{
                            date: waste.date || new Date().toISOString(),
                            product_id: vData.product_id,
                            variant_sku: waste.variantSku,
                            quantity: waste.quantity,
                            reason: waste.reason || "Damaged/Spoiled"
                        }]);

                        await supabase.from('stock_ledger').insert([{
                            date: waste.date || new Date().toISOString(),
                            product_id: vData.product_id,
                            variant_sku: waste.variantSku,
                            warehouse: waste.warehouse || 'Sulur',
                            type: 'Waste',
                            quantity: -waste.quantity,
                            unit_cost: uCost,
                            total_cost: uCost * waste.quantity,
                            balance_after: newStock
                        }]);
                    }
                } catch (e) {
                    console.error("Supabase Error in recordWaste:", e);
                }
            })();
        }
    };

    const deleteWaste = async (wasteId, variantSku, quantity, warehouse = 'Sulur') => {
        setState(prev => {
            let products = prev.products.map(p => {
                const hasVar = p.variants.some(v => v.sku === variantSku);
                if (hasVar) {
                    return {
                        ...p,
                        variants: p.variants.map(v => {
                            if (v.sku === variantSku) {
                                const stock = { ...v.stock };
                                stock[warehouse] = (stock[warehouse] || 0) + quantity;
                                return { ...v, stock };
                            }
                            return v;
                        })
                    };
                }
                return p;
            });

            return {
                ...prev,
                products,
                wastes: prev.wastes.filter(w => w.id !== wasteId)
            };
        });

        if (supabase) {
            try {
                if (wasteId) await supabase.from('wastes').delete().eq('id', wasteId);
                const newStock = await adjustStockAtomically(variantSku, quantity);
                const { data: vData } = await supabase.from('product_variants').select('product_id, average_cost').eq('sku', variantSku).single();
                if (vData) {
                    const uCost = parseFloat(vData.average_cost) || 0;

                    await supabase.from('stock_ledger').insert([{
                        date: new Date().toISOString(),
                        product_id: vData.product_id,
                        variant_sku: variantSku,
                        warehouse: warehouse,
                        type: 'Return',
                        quantity: quantity,
                        unit_cost: uCost,
                        total_cost: uCost * quantity,
                        balance_after: newStock
                    }]);
                }
                showToast("تم إلغاء سجل الهالك وإعادة المخزون بنجاح", "success");
            } catch (err) {
                console.error("Error deleting waste:", err);
            }
        }
    };

    // Store Configuration
    const saveStoreConfig = (name, address, currency, adminAvatar) => {
        setState(prev => ({
            ...prev,
            storeSettings: { name, address, currency, adminAvatar: adminAvatar !== undefined ? adminAvatar : prev.storeSettings.adminAvatar }
        }));
        logActivity("stock", `Updated configurations. Base currency: ${currency}.`);
        showToast("Store settings saved successfully.");
    };

    const saveUserAvatar = async (userId, base64) => {
        if (!userId) return;
        
        setState(p => {
            const updatedUsers = (p.users || []).map(u => u.id === userId ? { ...u, avatar: base64 } : u);
            const updatedCurrentUser = p.currentUser && p.currentUser.id === userId 
                ? { ...p.currentUser, avatar: base64 } 
                : p.currentUser;

            return {
                ...p,
                userAvatars: { ...p.userAvatars, [userId]: base64 },
                users: updatedUsers,
                currentUser: updatedCurrentUser
            };
        });

        if (supabase) {
            try {
                const { error } = await supabase
                    .from('user_profiles')
                    .upsert({ 
                        id: userId, 
                        avatar: base64,
                        name: state.currentUser?.name || 'Admin User',
                        role: state.currentUser?.role || 'Staff'
                    }, { onConflict: 'id' });

                if (error) {
                    console.error("Failed to save user profile avatar to Supabase:", error);
                } else {
                    console.log(`User avatar saved to Supabase for ${userId}`);
                }
            } catch (err) {
                console.error("Error saving user avatar:", err);
            }
        }
    };

    const restoreStoreData = async (restoredState) => {
        if (!restoredState.products || !restoredState.suppliers || !restoredState.orders) {
            showToast("Invalid backup file format.", "error");
            return;
        }

        try {
            showToast("Starting database restore... Please wait.", "info");

            const tablesToClear = [
                { name: 'order_items', col: 'order_id' },
                { name: 'purchase_items', col: 'po_id' },
                { name: 'stock_ledger', col: 'id' },
                { name: 'wastes', col: 'id' },
                { name: 'orders', col: 'id' },
                { name: 'purchase_orders', col: 'id' },
                { name: 'product_variants', col: 'product_id' },
                { name: 'products', col: 'id' },
                { name: 'suppliers', col: 'id' },
                { name: 'customers', col: 'id' },
                { name: 'coupons', col: 'id' },
                { name: 'telegram_mappings', col: 'id' }
            ];

            for (const table of tablesToClear) {
                await supabase.from(table.name).delete().not(table.col, 'is', null);
            }

            const batchInsert = async (table, data) => {
                const batchSize = 500;
                for (let i = 0; i < data.length; i += batchSize) {
                    const batch = data.slice(i, i + batchSize);
                    const { error } = await supabase.from(table).insert(batch);
                    if (error) throw new Error(`Error inserting into ${table}: ${error.message}`);
                }
            };

            const products = [];
            const productVariants = [];
            restoredState.products.forEach(p => {
                products.push({
                    id: p.id,
                    name: p.name,
                    category: p.category,
                    unit: p.unit,
                    image: p.image,
                    created_date: p.createdDate,
                    created_by: p.createdBy,
                    description: p.description,
                    shopify_id: p.shopify_id,
                    shopify_collection_ids: p.shopifyCollectionIds,
                    status: p.status
                });
                
                if (p.variants) {
                    p.variants.forEach(v => {
                        productVariants.push({
                            product_id: p.id,
                            sku: v.sku,
                            name: v.name,
                            barcode: v.barcode,
                            wholesale_price: v.wholesalePrice,
                            retail_price: v.retailPrice,
                            reorder_limit: v.reorderLimit,
                            stock_sulur: v.stock?.Sulur || 0,
                            shopify_id: v.shopify_id,
                            average_cost: v.averageCost,
                            is_active: v.is_active !== false
                        });
                    });
                }
            });

            const suppliers = (restoredState.suppliers || []).map(s => ({
                id: s.id,
                name: s.name,
                contact: s.contact,
                phone: s.phone,
                debt: s.debt,
                paid: s.paid,
                created_by: s.createdBy,
                created_at: s.createdAt
            }));

            const customers = (restoredState.customers || []).map(c => ({
                id: c.id,
                name: c.name,
                phone: c.phone,
                email: c.email,
                address: c.address,
                governorate: c.governorate,
                notes: c.notes,
                is_spam: c.is_spam,
                total_purchases: c.total_purchases,
                orders_count: c.orders_count,
                customer_type: c.customer_type,
                created_at: c.created_at
            }));

            const coupons = (restoredState.coupons || []).map(c => ({
                id: c.id,
                code: c.code,
                name: c.name,
                discount_type: c.discount_type,
                discount_value: c.discount_value,
                is_active: c.is_active,
                usage_limit: c.usage_limit,
                min_order_value: c.min_order_value,
                expiry_date: c.expiry_date,
                created_at: c.created_at
            }));

            const orders = [];
            const orderItems = [];
            (restoredState.orders || []).forEach(o => {
                orders.push({
                    id: o.id,
                    client: o.client,
                    date: o.date,
                    warehouse: o.warehouse,
                    status: o.status,
                    total_value: o.totalValue,
                    address: o.address,
                    governorate: o.governorate,
                    deposit: o.deposit,
                    deposit_receiver_id: o.depositReceiverId,
                    deposit_status: o.depositStatus,
                    deposit_refund_status: o.depositRefundStatus,
                    deposit_refund_screenshot: o.depositRefundScreenshot,
                    deposit_refund_proof_url: o.depositRefundScreenshot,
                    shipping_fee: o.shipping_fee,
                    created_by: o.createdBy,
                    updated_by: o.updatedBy,
                    shopify_order_id: o.shopifyOrderId,
                    source: o.source,
                    payment_method: o.paymentMethod,
                    customer_id: o.customer_id,
                    discount_type: o.discount_type,
                    discount_value: o.discount_value,
                    applied_coupon_code: o.applied_coupon_code,
                    discount_reason: o.discount_reason,
                    discount_reason_details: o.discount_reason_details,
                    created_at: o.createdAt
                });
                if (o.items) {
                    o.items.forEach(i => {
                        orderItems.push({
                            order_id: o.id,
                            variant_sku: i.variantSku,
                            quantity: i.quantity,
                            price: i.price,
                            cost_at_time_of_sale: i.costAtTimeOfSale,
                            product_name: i.productName,
                            variant_name: i.variantName
                        });
                    });
                }
            });

            const purchaseOrders = [];
            const purchaseItems = [];
            (restoredState.purchaseOrders || []).forEach(po => {
                purchaseOrders.push({
                    id: po.id,
                    supplier_id: po.supplierId,
                    date: po.date,
                    warehouse: po.warehouse,
                    total_cost: po.totalCost,
                    created_by: po.createdBy,
                    created_at: po.createdAt
                });
                if (po.items) {
                    po.items.forEach(i => {
                        purchaseItems.push({
                            po_id: po.id,
                            variant_sku: i.variantSku,
                            quantity: i.quantity,
                            cost: i.cost
                        });
                    });
                }
            });

            const stockLedger = (restoredState.stockLedger || []).map(l => ({
                id: l.id,
                date: l.date,
                product_id: l.productId,
                variant_sku: l.variantSku,
                warehouse: l.warehouse,
                type: l.type,
                quantity: l.quantity,
                balance_after: l.balanceAfter,
                order_id: l.orderId,
                unit_cost: l.unitCost,
                total_cost: l.totalCost,
                notes: l.notes,
                created_at: l.created_at
            }));

            const wastes = (restoredState.wastes || []).map(w => ({
                id: w.rawId || w.id,
                date: w.date,
                variant_sku: w.variantSku,
                quantity: w.quantity,
                created_at: w.createdAt
            }));

            if (products.length) await batchInsert('products', products);
            if (productVariants.length) await batchInsert('product_variants', productVariants);
            if (suppliers.length) await batchInsert('suppliers', suppliers);
            if (customers.length) await batchInsert('customers', customers);
            if (coupons.length) await batchInsert('coupons', coupons);
            if (orders.length) await batchInsert('orders', orders);
            if (orderItems.length) await batchInsert('order_items', orderItems);
            if (purchaseOrders.length) await batchInsert('purchase_orders', purchaseOrders);
            if (purchaseItems.length) await batchInsert('purchase_items', purchaseItems);
            if (stockLedger.length) await batchInsert('stock_ledger', stockLedger);
            if (wastes.length) await batchInsert('wastes', wastes);

            await loadSupabaseData();
            
            logActivity("auth", "Database restored from file backup.");
            showToast("Database restored successfully!");
            setCurrentView("dashboard");
        } catch (error) {
            console.error("Restore error:", error);
            showToast(`Restore failed: ${error.message}`, "error");
        }
    };

    const recordStockAdjustment = (productId, variantSku, warehouse, type, quantity, reason) => {
        setState(prev => {
            const products = prev.products.map(p => {
                if (p.id === productId) {
                    const variants = p.variants.map(v => {
                        if (v.sku === variantSku) {
                            const stock = { ...v.stock };
                            const amt = parseInt(quantity) || 0;
                            stock[warehouse] = Math.max(0, (stock[warehouse] || 0) + (type === 'increase' ? amt : -amt));
                            return { ...v, stock };
                        }
                        return v;
                    });
                    const adjLog = {
                        date: new Date().toISOString(),
                        variantSku,
                        warehouse,
                        type,
                        quantity: parseInt(quantity) || 0,
                        reason: reason || "Manual Audit Correction"
                    };
                    const adjustments = p.adjustments ? [adjLog, ...p.adjustments] : [adjLog];
                    return { ...p, variants, adjustments };
                }
                return p;
            });

            const prod = products.find(p => p.id === productId);
            let newLedger = prev.stockLedger || [];
            if (prod) {
                const vr = prod.variants.find(v => v.sku === variantSku);
                const currentBal = vr ? (vr.stock[warehouse] || 0) : 0;
                const adminName = prev.currentUser?.name || 'الأدمن';
                newLedger = [{
                    date: new Date().toISOString(),
                    productId: prod.id,
                    variantSku: variantSku,
                    warehouse: warehouse,
                    type: "Correction",
                    quantity: type === 'increase' ? parseInt(quantity) : -parseInt(quantity),
                    balanceAfter: currentBal,
                    notes: `مُعدل بواسطة: ${adminName}${reason ? ' - ' + reason : ''}`
                }, ...newLedger];
            }

            return { ...prev, products, stockLedger: newLedger };
        });
        const prod = state.products.find(p => p.id === productId);
        const name = prod ? prod.name : productId;
        logActivity("stock", `Manual Stock Adjustment for ${name} (${variantSku}): ${type === 'increase' ? '+' : '-'}${quantity} units at ${warehouse} branch. Reason: ${reason}`);
        showToast(`Stock adjusted successfully.`);

        if (supabase) {
            (async () => {
                try {
                    const amt = parseInt(quantity) || 0;
                    const delta = type === 'increase' ? amt : -amt;
                    const newStock = await adjustStockAtomically(variantSku, delta);

                    await supabase.from('stock_ledger').insert([{
                        date: new Date().toISOString(),
                        product_id: productId,
                        variant_sku: variantSku,
                        warehouse: warehouse,
                        type: 'Correction',
                        quantity: delta,
                        balance_after: newStock,
                        notes: `مُعدل بواسطة: ${state.currentUser?.name || 'الأدمن'}${reason ? ' - ' + reason : ''}`
                    }]);
                } catch (e) {
                    console.error("Supabase Error in recordStockAdjustment:", e);
                }
            })();
        }
    };

    const restockVariant = (productId, variantSku, quantity, unitCost, warehouse = 'Sulur', notes = '') => {
        const amt = parseInt(quantity) || 0;
        const cost = parseFloat(unitCost) || 0;
        
        setState(prev => {
            let products = [...prev.products];
            let newLedger = prev.stockLedger || [];
            
            const prodIndex = products.findIndex(p => p.id === productId);
            if (prodIndex > -1) {
                const prod = { ...products[prodIndex] };
                const variants = prod.variants.map(v => {
                    if (v.sku === variantSku) {
                        const stock = { ...v.stock };
                        const oldStock = stock[warehouse] || 0;
                        const newStock = oldStock + amt;
                        stock[warehouse] = newStock;
                        
                        // Calculate new average cost
                        const oldAvgCost = v.averageCost || v.wholesalePrice || 0;
                        let newAvgCost = oldAvgCost;
                        
                        if (newStock > 0) {
                            newAvgCost = ((oldStock * oldAvgCost) + (amt * cost)) / newStock;
                        }
                        
                        return { 
                            ...v, 
                            stock, 
                            averageCost: newAvgCost 
                        };
                    }
                    return v;
                });
                
                prod.variants = variants;
                products[prodIndex] = prod;
                
                const vr = variants.find(v => v.sku === variantSku);
                const currentBal = vr ? (vr.stock[warehouse] || 0) : 0;
                
                newLedger = [{
                    date: new Date().toISOString(),
                    productId: prod.id,
                    variantSku: variantSku,
                    warehouse: warehouse,
                    type: "Restock",
                    quantity: amt,
                    balanceAfter: currentBal,
                    unitCost: cost,
                    totalCost: cost * amt,
                    notes: notes
                }, ...newLedger];
            }
            
            return { ...prev, products, stockLedger: newLedger };
        });
        
        showToast(`تم إضافة المخزون للمنتج ${variantSku}`);
        logActivity("inventory", `Restocked ${quantity} units of ${variantSku}`);
        
        if (supabase) {
            (async () => {
                try {
                    const amtNum = parseInt(quantity) || 0;
                    const costNum = parseFloat(unitCost) || 0;
                    
                    const result = await adjustStockAndCostAtomically(variantSku, amtNum, costNum);
                    if (result) {
                        await supabase.from('stock_ledger').insert([{
                            date: new Date().toISOString(),
                            product_id: productId,
                            variant_sku: variantSku,
                            warehouse: warehouse,
                            type: 'Restock',
                            quantity: amtNum,
                            balance_after: result.newStock,
                            unit_cost: costNum,
                            total_cost: costNum * amtNum,
                            notes: notes
                        }]);
                    }
                } catch (e) {
                    console.error("Supabase Error in restockVariant:", e);
                }
            })();
        }
    };

    const recordPurchaseOrder = (purchaseOrder) => {
        setState(prev => {
            let products = [...prev.products];
            purchaseOrder.items.forEach(item => {
                products = products.map(p => {
                    const hasVar = p.variants.some(v => v.sku === item.variantSku);
                    if (hasVar) {
                        const updatedBatches = [...(p.batches || [])];
                        updatedBatches.push({
                            batchId: `B-PUR-${purchaseOrder.id}-${Math.floor(10 + Math.random()*90)}`,
                            variantSku: item.variantSku,
                            expiryDate: item.expiryDate || "2027-12-31",
                            quantity: item.quantity,
                            warehouse: purchaseOrder.warehouse
                        });
                        return {
                            ...p,
                            variants: p.variants.map(v => {
                                if (v.sku === item.variantSku) {
                                    const stock = { ...v.stock };
                                    const currentStock = stock[purchaseOrder.warehouse] || 0;
                                    const currentAvgCost = v.averageCost || v.wholesalePrice || 0;
                                    const purchaseUnitCost = item.cost || 0;
                                    
                                    let newAvgCost = currentAvgCost;
                                    if (currentStock <= 0) {
                                        newAvgCost = purchaseUnitCost;
                                    } else {
                                        newAvgCost = ((currentStock * currentAvgCost) + (item.quantity * purchaseUnitCost)) / (currentStock + item.quantity);
                                    }
                                    
                                    stock[purchaseOrder.warehouse] = currentStock + item.quantity;
                                    return { 
                                        ...v, 
                                        stock, 
                                        averageCost: newAvgCost 
                                    };
                                }
                                return v;
                            }),
                            batches: updatedBatches
                        };
                    }
                    return p;
                });
            });

            const suppliers = prev.suppliers.map(s => {
                if (s.id === purchaseOrder.supplierId) {
                    return {
                        ...s,
                        debt: s.debt + purchaseOrder.totalCost
                    };
                }
                return s;
            });

            let newLedger = prev.stockLedger || [];
            purchaseOrder.items.forEach(item => {
                const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                if (prod) {
                    const vr = prod.variants.find(v => v.sku === item.variantSku);
                    const currentBal = vr ? (vr.stock[purchaseOrder.warehouse] || 0) : 0;
                    newLedger = [{
                        date: purchaseOrder.date,
                        productId: prod.id,
                        variantSku: item.variantSku,
                        warehouse: purchaseOrder.warehouse,
                        type: "Purchase",
                        quantity: item.quantity,
                        balanceAfter: currentBal
                    }, ...newLedger];
                }
            });

            const purchaseOrders = [purchaseOrder, ...(prev.purchaseOrders || [])];

            return {
                ...prev,
                products,
                suppliers,
                purchaseOrders,
                stockLedger: newLedger
            };
        });

        const supplier = state.suppliers.find(s => s.id === purchaseOrder.supplierId);
        logActivity("stock", `Purchase Order ${purchaseOrder.id} logged from ${supplier ? supplier.name : purchaseOrder.supplierId} - Total: EGP ${purchaseOrder.totalCost}`);
        showToast(`Purchase Order recorded.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('purchase_orders').insert([{
                        id: purchaseOrder.id,
                        supplier_id: purchaseOrder.supplierId,
                        date: purchaseOrder.date,
                        total_cost: purchaseOrder.totalCost,
                        warehouse: purchaseOrder.warehouse || 'Sulur'
                    }]);

                    if (purchaseOrder.items && purchaseOrder.items.length > 0) {
                        const items = purchaseOrder.items.map(item => ({
                            po_id: purchaseOrder.id,
                            variant_sku: item.variantSku,
                            quantity: item.quantity,
                            cost: item.cost
                        }));
                        await supabase.from('purchase_items').insert(items);
                    }

                    for (const item of purchaseOrder.items) {
                        const amtNum = parseInt(item.quantity) || 0;
                        const costNum = parseFloat(item.cost) || 0;

                        const result = await adjustStockAndCostAtomically(item.variantSku, amtNum, costNum);
                        if (result) {
                            await supabase.from('stock_ledger').insert([{
                                date: purchaseOrder.date,
                                product_id: result.productId,
                                variant_sku: item.variantSku,
                                warehouse: purchaseOrder.warehouse || 'Sulur',
                                type: 'Purchase',
                                quantity: amtNum,
                                balance_after: result.newStock
                            }]);
                        }
                    }

                    await supabase.rpc('increment_supplier_debt', { 
                        p_supplier_id: purchaseOrder.supplierId, 
                        p_amount: purchaseOrder.totalCost 
                    });
                } catch (e) {
                    console.error("Supabase Error in recordPurchaseOrder:", e);
                }
            })();
        }
    };

    const adjustStockAtomically = async (sku, delta) => {
        if (!supabase || !sku) return;
        try {
            // Call the database function to adjust the stock atomically
            const { error: rpcErr } = await supabase.rpc('adjust_variant_stock', { p_sku: sku, p_delta: delta });
            if (rpcErr) throw rpcErr;

            // Fetch the updated stock quantity and details from the database
            const { data: updatedVariant, error: fetchErr } = await supabase
                .from('product_variants')
                .select('stock_sulur, average_cost, wholesale_price')
                .eq('sku', sku)
                .single();

            if (fetchErr || !updatedVariant) throw fetchErr || new Error("Variant not found after adjustment");

            const newStockVal = updatedVariant.stock_sulur;

            // Update the local React state with the correct stock
            setState(prev => {
                const products = prev.products.map(p => {
                    const hasVar = p.variants.some(v => v.sku === sku);
                    if (hasVar) {
                        return {
                            ...p,
                            variants: p.variants.map(v => {
                                if (v.sku === sku) {
                                    const stock = { ...v.stock };
                                    stock['Sulur'] = newStockVal;
                                    return { ...v, stock };
                                }
                                return v;
                            })
                        };
                    }
                    return p;
                });

                return { ...prev, products };
            });

            // Trigger the Shopify inventory sync
            await syncVariantStockToShopify(sku);

            return newStockVal;
        } catch (err) {
            console.error(`Failed atomic stock adjustment for SKU ${sku}:`, err);
            showToast(`فشل تحديث مخزون الصنف ${sku}: ${err.message}`, "error");
        }
    };

    const adjustStockAndCostAtomically = async (sku, delta, cost) => {
        if (!supabase || !sku) return;
        try {
            const { data, error } = await supabase.rpc('adjust_variant_stock_with_cost', {
                p_sku: sku,
                p_delta: delta,
                p_cost: cost
            });
            if (error || !data || !data.success) throw error || new Error(data?.error || "Adjustment failed");

            const newStockVal = data.new_stock;
            const newCostVal = data.new_cost;

            // Update the local React state with the correct stock and cost
            setState(prev => {
                const products = prev.products.map(p => {
                    const hasVar = p.variants.some(v => v.sku === sku);
                    if (hasVar) {
                        return {
                            ...p,
                            variants: p.variants.map(v => {
                                if (v.sku === sku) {
                                    const stock = { ...v.stock };
                                    stock['Sulur'] = newStockVal;
                                    return { 
                                        ...v, 
                                        stock,
                                        averageCost: newCostVal
                                    };
                                }
                                return v;
                            })
                        };
                    }
                    return p;
                });

                return { ...prev, products };
            });

            // Trigger the Shopify inventory sync
            await syncVariantStockToShopify(sku);

            return { newStock: newStockVal, newCost: newCostVal, productId: data.product_id };
        } catch (err) {
            console.error(`Failed atomic stock/cost adjustment for SKU ${sku}:`, err);
            showToast(`فشل تحديث مخزون/تكلفة الصنف ${sku}: ${err.message}`, "error");
        }
    };

    const deductOrderStock = async (targetOrder) => {
        if (!targetOrder || !targetOrder.items || targetOrder.items.length === 0) return;
        
        if (supabase) {
            try {
                const { data: existingLedger } = await supabase
                    .from('stock_ledger')
                    .select('id')
                    .eq('order_id', targetOrder.id)
                    .limit(1);

                if (existingLedger && existingLedger.length > 0) {
                    console.log(`Stock was already deducted for order ${targetOrder.id}. Skipping.`);
                    return;
                }

                for (const item of targetOrder.items) {
                    const itemSku = item.variant_sku || item.variantSku || item.sku;
                    if (!itemSku) continue;
                    
                    const newStock = await adjustStockAtomically(itemSku, -item.quantity);

                    const { data: vData } = await supabase.from('product_variants').select('product_id, average_cost').eq('sku', itemSku).single();
                    if (vData) {
                        const uCost = item.costAtTimeOfSale || item.cost_at_time_of_sale || vData.average_cost || 0;
                        const tCost = uCost * Math.abs(item.quantity);

                        await supabase.from('stock_ledger').insert([{
                            order_id: targetOrder.id,
                            date: new Date().toISOString(),
                            product_id: vData.product_id,
                            variant_sku: itemSku,
                            warehouse: targetOrder.warehouse || 'Sulur',
                            type: 'Sale',
                            quantity: -item.quantity,
                            unit_cost: uCost,
                            total_cost: tCost,
                            balance_after: newStock !== undefined ? newStock : 0
                        }]);
                    }
                }
            } catch (err) {
                console.error("Error in deductOrderStock DB sync:", err);
            }
        }
    };

    const fetchMissingOrderItems = async (orderId) => {
        if (!supabase || !orderId) return;
        try {
            const { data: itemsData, error } = await supabase
                .from('order_items')
                .select('*')
                .eq('order_id', orderId);

            if (error) {
                console.error("Error fetching missing order items:", error);
                return;
            }

            const mappedItems = (itemsData || []).map(oi => ({
                variantSku: oi.variant_sku,
                quantity: parseInt(oi.quantity) || 0,
                price: parseFloat(oi.price) || 0,
                costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0,
                productName: oi.product_name || null,
                variantName: oi.variant_name || null
            }));
            setState(prev => ({
                ...prev,
                orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, items: mappedItems } : o)
            }));
        } catch (e) {
            console.error("Exception in fetchMissingOrderItems:", e);
        }
    };

    const approveOrderWithBosta = async (orderId, bostaMetadata, depositAmount = 0, depositReceiverId = null, depositStatus = 'confirmed') => {
        if (!supabase) {
            showToast("قاعدة البيانات غير متصلة.", "error");
            return false;
        }

        const targetOrder = (state.orders || []).find(o => o.id === orderId);
        const wasAlreadyReviewed = targetOrder ? (targetOrder.is_reviewed || targetOrder.isReviewed) : false;
        const isShopifyOrder = targetOrder ? (targetOrder.source === 'shopify') : false;

        try {
            showToast(language === 'ar' ? "جاري إنشاء الشحنة وتوليد البوليصة في بوسطة..." : "Creating shipment and air waybill in Bosta...", "info");
            
            // Invoke the create-bosta-delivery Edge Function
            const { data, error } = await supabase.functions.invoke('create-bosta-delivery', {
                body: { orderId, bostaMetadata, depositAmount }
            });

            if (error || !data || !data.success) {
                console.error("Bosta delivery creation failed:", error || data);
                let errMsg = "Unknown error";
                if (error && error.context) {
                    try {
                        const errBody = await error.context.json();
                        errMsg = errBody.error || errBody.message || error.message;
                    } catch (e) {
                        errMsg = error.message;
                    }
                } else {
                    errMsg = data?.error || (language === 'ar' ? "خطأ غير معروف" : "Unknown error");
                }
                if (errMsg.includes("بالفعل") || errMsg.includes("already")) {
                    showToast(language === 'ar' ? "تم التعديل في السيستم وبوسطة بنجاح ✅" : "Order is already linked with Bosta ✅", "success");
                    return true;
                }
                showToast(language === 'ar' ? `فشل ربط بوسطة: ${errMsg}` : `Bosta Sync Failed: ${errMsg}`, "error");
                return false;
            }

            // Success! Deduct stock now.
            if (targetOrder && !wasAlreadyReviewed) {
                // Ensure order items are loaded from database synchronously if they are missing/empty in state
                if (!targetOrder.items || targetOrder.items.length === 0) {
                    try {
                        const { data: dbItems } = await supabase.from('order_items').select('*').eq('order_id', orderId);
                        if (dbItems && dbItems.length > 0) {
                            targetOrder.items = dbItems.map(oi => ({
                                variantSku: oi.variant_sku,
                                quantity: parseInt(oi.quantity) || 0,
                                price: parseFloat(oi.price) || 0,
                                costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0,
                                productName: oi.product_name || null,
                                variantName: oi.variant_name || null
                            }));
                        }
                    } catch (e) {
                        console.error("Error loading order items synchronously in approveOrderWithBosta:", e);
                    }
                }

                await deductOrderStock(targetOrder);
            }

            // Build updated address object ensuring is_reviewed: true is persisted
            let finalAddressStr = data.updatedAddress || targetOrder?.address || '';
            try {
                let parsed;
                if (typeof finalAddressStr === 'string' && finalAddressStr.trim().startsWith('{')) {
                    parsed = JSON.parse(finalAddressStr);
                } else {
                    parsed = { detailAddress: finalAddressStr };
                }
                parsed.isReviewed = true;
                parsed.is_reviewed = true;
                finalAddressStr = JSON.stringify(parsed);
            } catch(e) {
                console.error("Error setting isReviewed on address JSON in approveOrderWithBosta:", e);
            }

            const updatePayload = {
                deposit: depositAmount,
                deposit_receiver_id: depositReceiverId,
                deposit_status: depositStatus,
                status: 'Pending',
                address: finalAddressStr
            };

            // Only set created_by if it's currently empty or set to the webhook default
            if (!targetOrder?.createdBy || targetOrder?.createdBy === 'Shopify Webhook') {
                updatePayload.created_by = state.currentUser?.name || 'الآدمن';
            }

            const { error: dbUpdateErr } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (dbUpdateErr) {
                console.error("Database update failed in approveOrderWithBosta:", dbUpdateErr);
                throw new Error(dbUpdateErr.message);
            }

            // Update local state first (deposit + address + status) immediately
            setState(prev => ({
                ...prev,
                orders: (prev.orders || []).map(o => o.id === orderId ? {
                    ...o,
                    status: 'Pending',
                    is_reviewed: true,
                    isReviewed: true,
                    address: finalAddressStr,
                    deposit: depositAmount,
                    depositReceiverId: depositReceiverId,
                    depositStatus: depositStatus,
                    ...((!o.createdBy || o.createdBy === 'Shopify Webhook') && { createdBy: state.currentUser?.name || 'الآدمن' })
                } : o)
            }));

            // Keep status as 'Pending' in DB and state so admin tracks it manually in OrdersList
            updateOrderStatus(orderId, 'Pending', finalAddressStr);
            
            // Trigger deposit assignment email if deposit is pending and receiver is another admin
            if (depositAmount > 0 && depositStatus === 'pending' && depositReceiverId && depositReceiverId !== state.currentUser?.id) {
                const targetAdmin = (state.users || []).find(u => u.id === depositReceiverId);
                if (targetAdmin && targetAdmin.email) {
                    sendAdminNotification("deposit_assignment", targetAdmin.email, {
                        amount: depositAmount,
                        clientName: targetOrder?.client || "عميل شوبيفاي",
                        orderId: orderId,
                        creatorName: state.currentUser?.name || "أدمن"
                    });
                }
            }
            
            showToast(
                language === 'ar' 
                    ? `تمت الموافقة وتوليد البوليصة رقم: ${data.trackingNumber} بنجاح!` 
                    : `Order approved! Waybill #${data.trackingNumber} created successfully!`, 
                "success"
            );
            await loadSupabaseData();
            return true;
            
        } catch (err) {
            console.error("approveOrderWithBosta exception:", err);
            showToast(language === 'ar' ? `خطأ في النظام: ${err.message}` : `System Error: ${err.message}`, "error");
            return false;
        }
    };

    // Update deposit status (confirm or reject)
    const updateDepositStatus = async (orderId, status) => {
        if (!supabase) return;
        
        try {
            if (status === 'unconfirmed') {
                const { error } = await supabase.from('orders').update({ deposit_status: 'unconfirmed' }).eq('id', orderId);
                if (error) throw error;
                
                setState(prev => ({
                    ...prev,
                    orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: 'unconfirmed' } : o)
                }));
                showToast("تم تسجيل عدم استلام العربون", "success");
                logActivity("order", `Order ${orderId} deposit status updated to unconfirmed.`);
                return;
            }

            if (status === 'confirmed') {
                const { data: orderDb } = await supabase.from('orders').select('*').eq('id', orderId).single();
                if (!orderDb) {
                    showToast("لم يتم العثور على الطلب", "error");
                    return;
                }

                if (orderDb.status.toLowerCase() === 'cancelled') {
                    const { error } = await supabase.from('orders').update({ 
                        deposit_status: 'confirmed', 
                        deposit_refund_status: 'awaiting_return' 
                    }).eq('id', orderId);
                    if (error) throw error;

                    setState(prev => ({
                        ...prev,
                        orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: 'confirmed', depositRefundStatus: 'awaiting_return' } : o)
                    }));
                    showToast("تم تأكيد استلام العربون", "success");
                    showToast("تم تأكيد الاستلام، وبما أن الطلب ملغى فلن يُرسل لشركة الشحن. يُرجى التوجه لقائمة المرتجعات لإرجاع العربون.", "info");
                    logActivity("order", `Order ${orderId} deposit status updated to confirmed (Cancelled order).`);
                    return;
                }

                if (orderDb.status === 'Pending') {
                    const addrObj = orderDb.address ? JSON.parse(orderDb.address) : {};
                    // Only auto-dispatch to Bosta if Bosta was enabled (syncWithBosta !== false) and city code exists
                    if (addrObj && addrObj.bostaCityCode && addrObj.syncWithBosta !== false) {
                        // If Bosta waybill is already created, just confirm the deposit directly without invoking Bosta again
                        if (addrObj.bostaTrackingNumber) {
                            const { error } = await supabase.from('orders').update({ deposit_status: 'confirmed' }).eq('id', orderId);
                            if (error) throw error;
                            
                            setState(prev => ({
                                ...prev,
                                orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: 'confirmed' } : o)
                            }));
                            showToast("تم تأكيد استلام العربون (الشحنة مسجلة مسبقاً في بوسطة)", "success");
                            logActivity("order", `Order ${orderId} deposit status updated to confirmed (Bosta waybill already existed).`);
                            return;
                        }

                        const bostaMetadata = {
                            customerName: orderDb.client,
                            customerPhone: addrObj.phone || '',
                            customerSecondPhone: addrObj.secondPhone || '',
                            customerAddress: addrObj.detailAddress || orderDb.address || '',
                            governorate: orderDb.governorate || '',
                            bostaCityCode: addrObj.bostaCityCode,
                            bostaCityName: addrObj.bostaCityName,
                            bostaDistrictId: addrObj.bostaDistrictId,
                            bostaDistrictName: addrObj.bostaDistrictName,
                            bostaZoneId: addrObj.bostaZoneId,
                            allowToOpenPackage: addrObj.allowToOpenPackage || false
                        };
                        
                        // Process Bosta sync first before marking as confirmed in database
                        const success = await approveOrderWithBosta(orderId, bostaMetadata, parseFloat(orderDb.deposit) || 0, orderDb.deposit_receiver_id, 'confirmed');
                        if (!success) {
                            // Keep in pending list so admin can retry
                            return;
                        }
                    } else {
                        // Bosta sync was OFF: approve order locally on system without dispatching to Bosta
                        const { error } = await supabase.from('orders').update({ deposit_status: 'confirmed' }).eq('id', orderId);
                        if (error) throw error;
                        
                        await updateOrderStatus(orderId, 'Completed');
                        setState(prev => ({
                            ...prev,
                            orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: 'confirmed' } : o)
                        }));
                        showToast("تم تأكيد استلام العربون", "success");
                        showToast("تم تأكيد العربون واعتماد الطلب على السيستم بنجاح (بدون إرسال لبوسطة).", "success");
                    }
                    logActivity("order", `Order ${orderId} deposit status updated to confirmed.`);
                }
            }
        } catch (err) {
            console.error("Error updating deposit status:", err);
            showToast("حدث خطأ أثناء تحديث حالة العربون", "error");
        }
    };

    // Helper to upload or encode screenshot proof safely with zero bucket crashes
    const uploadScreenshotProof = async (file, orderId, prefix = '') => {
        if (!file) return null;

        // 1. Try uploading to candidate storage buckets if Supabase is connected
        if (supabase && supabase.storage) {
            const candidateBuckets = ['order-attachments', 'product-images', 'receipts', 'public', 'images', 'avatars'];
            const ext = file.name ? file.name.split('.').pop() : 'png';
            const filePath = `deposit-refunds/${orderId}${prefix ? '-' + prefix : ''}-${Date.now()}.${ext}`;

            for (const bucketName of candidateBuckets) {
                try {
                    const { error: uploadErr } = await supabase.storage
                        .from(bucketName)
                        .upload(filePath, file, { upsert: true });

                    if (!uploadErr) {
                        const { data: urlData } = supabase.storage
                            .from(bucketName)
                            .getPublicUrl(filePath);
                        if (urlData?.publicUrl) {
                            return urlData.publicUrl;
                        }
                    }
                } catch (bErr) {
                    // Ignore and try next candidate bucket
                }
            }
        }

        // 2. Fallback: Convert file directly to Base64 Data URL (100% client-side, zero bucket required)
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(file);
        });
    };

    // Confirm that a deposit was returned to the customer after order cancellation.
    // Accepts a screenshot file or image as proof, alongside refundAmount and refundType.
    const confirmDepositRefund = async (orderId, screenshotFile, refundAmount = null, refundType = null) => {
        if (!supabase) {
            showToast('الاتصال بالسيرفر غير متاح.', 'error');
            return false;
        }
        try {
            showToast('جاري حِفظ الإثبات وتأكيد الإعادة...', 'info');
            
            let screenshotUrl = null;
            if (screenshotFile) {
                screenshotUrl = await uploadScreenshotProof(screenshotFile, orderId);
            }

            // Update local state immediately
            setState(prev => ({
                ...prev,
                orders: (prev.orders || []).map(o => o.id === orderId ? {
                    ...o,
                    depositStatus: 'settled',
                    depositRefundStatus: 'returned',
                    depositRefundAmount: refundAmount !== null ? parseFloat(refundAmount) : null,
                    depositRefundType: refundType,
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o),
                deletedOrdersWithDeposits: (prev.deletedOrdersWithDeposits || []).map(o => o.id === orderId ? {
                    ...o,
                    depositStatus: 'settled',
                    depositRefundStatus: 'returned',
                    depositRefundAmount: refundAmount !== null ? parseFloat(refundAmount) : null,
                    depositRefundType: refundType,
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o)
            }));

            // Persist to DB
            const updatePayload = {
                deposit_status: 'settled',
                deposit_refund_status: 'returned',
                deposit_refund_amount: refundAmount !== null ? parseFloat(refundAmount) : null,
                deposit_refund_type: refundType
            };
            if (screenshotUrl) {
                updatePayload.deposit_refund_screenshot = screenshotUrl;
                updatePayload.deposit_refund_proof_url = screenshotUrl;
            }

            const { error: dbErr } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (dbErr) {
                // Retry with standard columns if composite error (columns might not exist yet in DB)
                await supabase.from('orders').update({
                    deposit_status: 'settled',
                    deposit_refund_status: 'returned',
                    deposit_refund_proof_url: screenshotUrl
                }).eq('id', orderId);
            }

            logActivity('order', `Deposit refund of ${state.storeSettings.currency}${refundAmount || 0} (${refundType || 'unknown'}) confirmed for cancelled order ${orderId} with screenshot proof.`);
            showToast('تم تأكيد إعادة العربون وتسوية العهدة بنجاح ✅', 'success');
            return true;
        } catch (err) {
            console.error('confirmDepositRefund error:', err);
            showToast(`حدث خطأ: ${err.message}`, 'error');
            return false;
        }
    };

    // Shortcut: Confirm deposit receipt AND refund return in one click (for orders cancelled while deposit was pending)
    const confirmDepositAndRefund = async (orderId, screenshotFile, refundAmount = null, refundType = null) => {
        if (!supabase) {
            showToast('الاتصال بالسيرفر غير متاح.', 'error');
            return false;
        }
        try {
            showToast('جاري حِفظ الإثبات والتأكيد...', 'info');
            
            let screenshotUrl = null;
            if (screenshotFile) {
                screenshotUrl = await uploadScreenshotProof(screenshotFile, orderId, 'shortcut');
            }

            // Update local state immediately
            setState(prev => ({
                ...prev,
                orders: (prev.orders || []).map(o => o.id === orderId ? {
                    ...o,
                    depositStatus: 'settled',
                    depositRefundStatus: 'returned',
                    depositRefundAmount: refundAmount !== null ? parseFloat(refundAmount) : null,
                    depositRefundType: refundType,
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o),
                deletedOrdersWithDeposits: (prev.deletedOrdersWithDeposits || []).map(o => o.id === orderId ? {
                    ...o,
                    depositStatus: 'settled',
                    depositRefundStatus: 'returned',
                    depositRefundAmount: refundAmount !== null ? parseFloat(refundAmount) : null,
                    depositRefundType: refundType,
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o)
            }));

            // Persist to DB
            const updatePayload = {
                deposit_status: 'settled',
                deposit_refund_status: 'returned',
                deposit_refund_amount: refundAmount !== null ? parseFloat(refundAmount) : null,
                deposit_refund_type: refundType
            };
            if (screenshotUrl) {
                updatePayload.deposit_refund_screenshot = screenshotUrl;
                updatePayload.deposit_refund_proof_url = screenshotUrl;
            }

            const { error: dbErr } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (dbErr) {
                await supabase.from('orders').update({
                    deposit_status: 'confirmed',
                    deposit_refund_status: 'returned',
                    deposit_refund_proof_url: screenshotUrl
                }).eq('id', orderId);
            }

            logActivity('order', `Shortcut confirmed deposit receipt and refund of ${state.storeSettings.currency}${refundAmount || 0} (${refundType || 'unknown'}) for cancelled order ${orderId}.`);
            showToast('تم تأكيد استلام وإعادة العربون بنجاح ✅', 'success');
            return true;
        } catch (err) {
            console.error('confirmDepositAndRefund error:', err);
            showToast(`حدث خطأ: ${err.message}`, 'error');
        }
    };

    const syncBostaStatus = async (orderId, trackingNumber, silent = false) => {
        if (!supabase) {
            if (!silent) showToast("الاتصال بالسيرفر غير متاح.", "error");
            return null;
        }

        try {
            const currentOrder = (state.orders || []).find(o => o.id === orderId);
            if (currentOrder && (currentOrder.status === 'Cancelled' || currentOrder.status === 'Rejected')) {
                console.log(`Order ${orderId} is already Cancelled or Rejected. Skipping Bosta sync.`);
                return null;
            }

            if (!silent) showToast(language === 'ar' ? "جاري تحديث حالة التوصيل من بوسطة..." : "Syncing delivery status from Bosta...", "info");
            
            const { data, error } = await supabase.functions.invoke('sync-bosta-status', {
                body: { trackingNumber, orderId }
            });

            if (error || !data || !data.success) {
                console.error("Bosta sync failed:", error || data);
                const errMsg = data?.error || error?.message || "خطأ غير معروف";
                if (!silent) showToast(`فشل تحديث الحالة: ${errMsg}`, "error");
                return null;
            }

            let statusChanged = false;
            // Update local state with the new address and status
            setState(prev => {
                const order = prev.orders.find(o => o.id === orderId);
                if (!order) return prev;
                
                let products = [...prev.products];
                const oldStatus = order.status;
                const newStatus = data.newStatus;
                if (oldStatus !== newStatus) {
                    statusChanged = true;
                }
                const orderTotal = order.totalValue;
                const customerId = order.customer_id;
                
                const wasDeducted = oldStatus === "Completed" || oldStatus === "Partially Delivered" || oldStatus === "Shipped";
                const isDeducted = newStatus === "Completed" || newStatus === "Partially Delivered" || newStatus === "Shipped";
                
                // 1. Local stock adjustment
                if (!wasDeducted && isDeducted) {
                    order.items.forEach(item => {
                        products = products.map(p => {
                            const hasVar = p.variants.some(v => v.sku === item.variantSku);
                            if (hasVar) {
                                return {
                                    ...p,
                                    variants: p.variants.map(v => {
                                        if (v.sku === item.variantSku) {
                                            const stock = { ...v.stock };
                                            const wh = order.warehouse || "Sulur";
                                            stock[wh] = Math.max(0, (stock[wh] || 0) - item.quantity);
                                            return { ...v, stock };
                                        }
                                        return v;
                                    })
                                };
                            }
                            return p;
                        });
                    });
                } else if (wasDeducted && !isDeducted) {
                    order.items.forEach(item => {
                        products = products.map(p => {
                            const hasVar = p.variants.some(v => v.sku === item.variantSku);
                            if (hasVar) {
                                return {
                                    ...p,
                                    variants: p.variants.map(v => {
                                        if (v.sku === item.variantSku) {
                                            const stock = { ...v.stock };
                                            const wh = order.warehouse || "Sulur";
                                            stock[wh] = (stock[wh] || 0) + item.quantity;
                                            return { ...v, stock };
                                        }
                                        return v;
                                    })
                                };
                            }
                            return p;
                        });
                    });
                }

                // 2. Local stock ledger adjustment
                let newLedger = prev.stockLedger || [];
                if (!wasDeducted && isDeducted) {
                    order.items.forEach(item => {
                        const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                        if (prod) {
                            const vr = prod.variants.find(v => v.sku === item.variantSku);
                            const currentBal = vr ? (vr.stock[order.warehouse || "Sulur"] || 0) : 0;
                            newLedger = [{
                                date: new Date().toISOString(),
                                productId: prod.id,
                                variantSku: item.variantSku,
                                warehouse: order.warehouse || "Sulur",
                                type: "Sale",
                                quantity: -item.quantity,
                                balanceAfter: currentBal
                            }, ...newLedger];
                        }
                    });
                } else if (wasDeducted && !isDeducted) {
                    order.items.forEach(item => {
                        const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                        if (prod) {
                            const vr = prod.variants.find(v => v.sku === item.variantSku);
                            const currentBal = vr ? (vr.stock[order.warehouse || "Sulur"] || 0) : 0;
                            newLedger = [{
                                date: new Date().toISOString(),
                                productId: prod.id,
                                variantSku: item.variantSku,
                                warehouse: order.warehouse || "Sulur",
                                type: "Return",
                                quantity: item.quantity,
                                balanceAfter: currentBal
                            }, ...newLedger];
                        }
                    });
                }

                // 3. Local customer stats adjustment
                let updatedCustomers = prev.customers || [];
                if (customerId) {
                    let valueChange = 0;
                    let countChange = 0;
                    if (oldStatus !== "Completed" && newStatus === "Completed") {
                        valueChange = orderTotal;
                        countChange = 1;
                    } else if (oldStatus === "Completed" && newStatus !== "Completed") {
                        valueChange = -orderTotal;
                        countChange = -1;
                    }

                    if (valueChange !== 0 || countChange !== 0) {
                        let thresholdPurchases = prev.storeSettings?.vipThresholdPurchases || 5000;
                        let thresholdOrders = prev.storeSettings?.vipThresholdOrders || 10;
                        updatedCustomers = prev.customers.map(c => {
                            if (c.id === customerId) {
                                const newTotal = parseFloat(c.total_purchases || 0) + valueChange;
                                const newCount = parseInt(c.orders_count || 0) + countChange;
                                let newType = c.customer_type;
                                if (c.customer_type === 'Regular' && (newTotal >= thresholdPurchases || newCount >= thresholdOrders)) {
                                    newType = 'VIP';
                                }
                                return { ...c, total_purchases: newTotal, orders_count: newCount, customer_type: newType };
                            }
                            return c;
                        });
                    }
                }

                return { 
                    ...prev, 
                    products,
                    stockLedger: newLedger,
                    customers: updatedCustomers,
                    orders: prev.orders.map(o => {
                        if (o.id === orderId) {
                            const updatedOrder = {
                                ...o,
                                address: typeof data.updatedAddress === 'string' ? data.updatedAddress : JSON.stringify(data.updatedAddress),
                                status: newStatus
                            };
                            return updatedOrder;
                        }
                        return o;
                    })
                };
            });

            if (data.deleted) {
                showToast(`تم حذف الشحنة من بوسطة - الأوردر أصبح ملغي`, "warning");
            } else {
                // Only show toast if not silent, or if the status actually changed
                if (!silent || statusChanged) {
                    showToast(`تم تحديث الحالة: ${data.newStateName}`, "success");
                }
            }

            return data;
        } catch (err) {
            console.error("syncBostaStatus exception:", err);
            showToast(`خطأ: ${err.message}`, "error");
            return null;
        }
    };
    const syncProductsFromShopify = async () => {
        if (!supabase) return false;
        try {
            showToast("جاري ربط واستيراد المنتجات مع شوبيفاي، برجاء الانتظار...");
            const { data, error } = await supabase.functions.invoke('swift-processor', {
                body: { action: 'fetch_all_products' }
            });
            
            if (error) throw error;
            if (data?.success && data.products) {
                const shopifyProducts = data.products;
                let linkedProductsCount = 0;
                let addedProductsCount = 0;
                let addedVariantsCount = 0;
                
                // Fetch local catalog items to map them
                const { data: dbProducts } = await supabase.from('products').select('*');
                const { data: dbVariants } = await supabase.from('product_variants').select('*');

                const localProducts = dbProducts || [];
                const localVariants = dbVariants || [];

                // Maps for matching
                const localVariantsBySku = {};
                localVariants.forEach(v => {
                    if (v.sku) localVariantsBySku[v.sku.trim().toLowerCase()] = v;
                });

                const localProductsByName = {};
                localProducts.forEach(p => {
                    if (p.name) localProductsByName[p.name.trim().toLowerCase()] = p;
                });

                // Fetch collects to map collection IDs
                let productToCollections = {};
                try {
                    const { data: collectsData } = await supabase.functions.invoke('swift-processor', {
                        body: { action: 'fetch_collects' }
                    });
                    if (collectsData?.success && collectsData.collects) {
                        for (const c of collectsData.collects) {
                            const pIdStr = String(c.product_id);
                            if (!productToCollections[pIdStr]) {
                                productToCollections[pIdStr] = [];
                            }
                            productToCollections[pIdStr].push(String(c.collection_id));
                        }
                    }
                } catch (e) {
                    console.error("Failed to fetch collects during sync:", e);
                }

                for (const sp of shopifyProducts) {
                    const shopifyProductId = String(sp.id);
                    
                    // Skip digital products (TikTok Coins, PUBG UC, etc.)
                    const titleLower = (sp.title || '').toLowerCase();
                    const productTypeLower = (sp.product_type || '').toLowerCase();
                    const isDigitalProduct = ['tiktok', 'pubg', 'coins', 'uc', 'top-up', 'top up', 'bundle', 'prime plus'].some(kw => 
                        titleLower.includes(kw) || productTypeLower.includes(kw)
                    );
                    if (isDigitalProduct) continue;

                    // Check if already linked
                    const alreadyLinkedProduct = localProducts.find(p => p.shopify_id === shopifyProductId);
                    if (alreadyLinkedProduct) {
                        let imagesArray = [];
                        if (sp.images && sp.images.length > 0) {
                            imagesArray = sp.images.map(img => (img.src || '').split('?')[0]);
                        }
                        const tagsStr = sp.tags || '';
                        const tagsArray = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
                        let finalDescription = sp.body_html || '';

                        // Update product in DB
                        await supabase.from('products').update({
                            name: deduplicateProductName(sp.title || alreadyLinkedProduct.name),
                            category: sp.product_type || 'Uncategorized',
                            image: JSON.stringify({
                                images: imagesArray,
                                vendor: sp.vendor || '',
                                tags: tagsArray.join(', '),
                                status: sp.status === 'active' ? 'Active' : 'Draft'
                            }),
                            description: finalDescription,
                            shopify_collection_ids: productToCollections[shopifyProductId] || []
                        }).eq('id', alreadyLinkedProduct.id);

                        // Update variants
                        const localProdVars = localVariants.filter(v => v.product_id === alreadyLinkedProduct.id);
                        for (const sv of (sp.variants || [])) {
                            let variantName = cleanVariantName(sp.title, sv.title) || 'Standard Option';
                            let sku = sv.sku;

                            const matchedVar = localProdVars.find(lv => String(lv.shopify_id) === String(sv.id) || (sku && lv.sku.toLowerCase() === sku.trim().toLowerCase()));
                            if (matchedVar) {
                                await supabase.from('product_variants').update({
                                    name: variantName,
                                    barcode: sv.barcode || '',
                                    retail_price: parseFloat(sv.price) || 0,
                                    shopify_id: String(sv.id)
                                }).eq('sku', matchedVar.sku);
                            } else {
                                if (!sku) {
                                    sku = `SKU-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
                                }
                                await supabase.from('product_variants').insert([{
                                    product_id: alreadyLinkedProduct.id,
                                    name: variantName,
                                    sku: sku,
                                    barcode: sv.barcode || '',
                                    retail_price: parseFloat(sv.price) || 0,
                                    wholesale_price: 0,
                                    stock_sulur: 0,
                                    shopify_id: String(sv.id)
                                }]);
                                addedVariantsCount++;
                            }
                        }
                        linkedProductsCount++;
                        continue;
                    }

                    // Match logic
                    let matchedProduct = null;
                    const matchedVariantsMap = []; // [{ local: localVar, shopify: sv }]

                    // Match Method 1: SKU Match (Highest Priority)
                    for (const sv of (sp.variants || [])) {
                        if (sv.sku) {
                            const localVar = localVariantsBySku[sv.sku.trim().toLowerCase()];
                            if (localVar) {
                                matchedProduct = localProducts.find(p => p.id === localVar.product_id);
                                matchedVariantsMap.push({ local: localVar, shopify: sv });
                            }
                        }
                    }

                    // Match Method 2: Name Match (Fallback)
                    if (!matchedProduct && sp.title) {
                        const localProd = localProductsByName[sp.title.trim().toLowerCase()];
                        if (localProd) {
                            matchedProduct = localProd;
                            const localProdVars = localVariants.filter(v => v.product_id === localProd.id);
                            for (const sv of (sp.variants || [])) {
                                let svTitle = sv.title;
                                if (svTitle === 'Default Title') svTitle = 'Standard Option';
                                
                                const matchedVar = localProdVars.find(lv => lv.name.trim().toLowerCase() === svTitle.trim().toLowerCase());
                                if (matchedVar) {
                                    matchedVariantsMap.push({ local: matchedVar, shopify: sv });
                                }
                            }
                        }
                    }

                    if (matchedProduct) {
                        // Update product shopify_id
                        await supabase.from('products').update({ 
                            shopify_id: shopifyProductId,
                            shopify_collection_ids: productToCollections[shopifyProductId] || []
                        }).eq('id', matchedProduct.id);

                        // Update matched variants shopify_id
                        for (const map of matchedVariantsMap) {
                            await supabase.from('product_variants').update({ 
                                shopify_id: String(map.shopify.id) 
                            }).eq('id', map.local.id);
                        }
                        linkedProductsCount++;
                    } else {
                        // Parse first image and strip query parameters like ?v=...
                        let imageUrl = '';
                        let imagesArray = [];
                        if (sp.images && sp.images.length > 0) {
                            imageUrl = (sp.images[0].src || '').split('?')[0];
                            imagesArray = sp.images.map(img => (img.src || '').split('?')[0]);
                        }

                        // Extract collections and tags
                        const tagsStr = sp.tags || '';
                        const tagsArray = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
                        
                        // Construct description (pure body_html without appending Vendor/Tags text into description)
                        let finalDescription = sp.body_html || '';

                        // Insert Product
                        const newProductId = crypto.randomUUID();
                        const newProduct = {
                            id: newProductId,
                            name: sp.title || 'بدون اسم',
                            category: sp.product_type || 'Uncategorized',
                            shopify_id: shopifyProductId,
                            image: JSON.stringify({
                                images: imagesArray,
                                vendor: sp.vendor || '',
                                tags: tagsArray.join(', '),
                                status: sp.status === 'active' ? 'Active' : 'Draft'
                            }),
                            description: finalDescription,
                            shopify_collection_ids: productToCollections[shopifyProductId] || [] 
                        };

                        const { error: prodError } = await supabase.from('products').insert([newProduct]);
                        if (prodError) {
                            console.error("Error inserting synced product:", prodError);
                            continue;
                        }
                        addedProductsCount++;

                        // Insert Variants
                        const variantsToInsert = [];
                        for (const sv of (sp.variants || [])) {
                            let sku = sv.sku;
                            if (!sku) {
                                sku = `SKU-${Math.random().toString(36).substring(2,8).toUpperCase()}`;
                            }
                            
                            let variantName = cleanVariantName(sp.title, sv.title) || 'Standard Option';

                            variantsToInsert.push({
                                product_id: newProductId,
                                name: variantName,
                                sku: sku,
                                barcode: sv.barcode || '',
                                retail_price: parseFloat(sv.price) || 0,
                                wholesale_price: 0,
                                stock_sulur: 0,
                                shopify_id: String(sv.id)
                            });
                        }

                        if (variantsToInsert.length > 0) {
                            const { error: varError } = await supabase.from('product_variants').insert(variantsToInsert);
                            if (!varError) {
                                addedVariantsCount += variantsToInsert.length;
                            } else {
                                console.error("Error inserting synced variants:", varError);
                            }
                        }
                    }
                }
                
                showToast(`اكتملت المزامنة: تم ربط ${linkedProductsCount} منتج قائم، واستيراد ${addedProductsCount} منتج جديد مع ${addedVariantsCount} صنف فرعي.`);
                
                // Refresh local state using the same structured mapper from loadProducts
                const { data: freshProducts } = await supabase.from('products').select('*');
                const { data: freshVariants } = await supabase.from('product_variants').select('*');
                
                const mappedProducts = (freshProducts || []).map(p => {
                    const pVars = (freshVariants || []).filter(v => v.product_id === p.id).map(v => ({
                        sku: v.sku,
                        name: v.name,
                        barcode: v.barcode,
                        wholesalePrice: parseFloat(v.wholesale_price) || 0,
                        retailPrice: parseFloat(v.retail_price) || 0,
                        reorderLimit: parseInt(v.reorder_limit) || 0,
                        stock: { Sulur: parseInt(v.stock_sulur) || 0 },
                        shopify_id: v.shopify_id || null,
                        averageCost: parseFloat(v.average_cost) || parseFloat(v.wholesale_price) || 0,
                        is_active: v.is_active !== false
                    }));

                    let parsedImageStr = p.image;
                    let parsedImages = [];
                    let parsedVendor = '';
                    let parsedTags = '';
                    let parsedStatus = p.status || 'active';

                    try {
                        if (p.image && p.image.startsWith('{') && p.image.includes('"images"')) {
                            const obj = JSON.parse(p.image);
                            parsedImages = obj.images || [];
                            parsedVendor = obj.vendor || '';
                            parsedTags = obj.tags || '';
                            if (obj.status) parsedStatus = obj.status;
                            parsedImageStr = JSON.stringify(parsedImages);
                        } else if (p.image && p.image.startsWith('[')) {
                            parsedImageStr = p.image;
                            parsedImages = JSON.parse(p.image);
                        }
                    } catch (e) {}

                    return {
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        unit: p.unit,
                        image: parsedImageStr,
                        images: parsedImages,
                        vendor: parsedVendor,
                        tags: parsedTags,
                        createdDate: p.created_date,
                        createdBy: p.created_by,
                        description: p.description,
                        shopify_id: p.shopify_id || null,
                        shopifyCollectionIds: p.shopify_collection_ids || [],
                        status: parsedStatus,
                        variants: pVars
                    };
                });

                setState(prev => ({
                    ...prev,
                    products: mappedProducts
                }));
                return true;
            } else {
                throw new Error("Invalid response from Shopify sync");
            }
        } catch (e) {
            console.error("Shopify Sync Error:", e);
            showToast(`فشل استيراد المنتجات: ${e.message}`, "error");
            return false;
        }
    };

    const syncShopifyCollections = async () => {
        if (!supabase) return false;
        try {
            const { data, error } = await supabase.functions.invoke('swift-processor', {
                body: { action: 'fetch_collections' }
            });
            if (error || !data || !data.success) {
                showToast(error ? error.message : (data ? data.error : "Unknown error"), "error");
                return false;
            }

            const collectionsList = data.collections || [];
            
            // Insert/Upsert collections to local Supabase shopify_collections table
            for (const col of collectionsList) {
                // Skip digital collections
                const titleLower = (col.title || '').toLowerCase();
                const isDigitalCol = ['tiktok', 'pubg', 'coins', 'uc', 'top-up', 'top up'].some(kw => titleLower.includes(kw));
                if (isDigitalCol) continue;

                await supabase.from('shopify_collections').upsert({
                    id: col.id,
                    title: col.title,
                    handle: col.handle,
                    updated_at: new Date().toISOString()
                });
            }

            // Fetch the updated list from database to ensure state matches DB
            const { data: dbCollections } = await supabase.from('shopify_collections').select('*');
            setState(prev => ({
                ...prev,
                collections: dbCollections || []
            }));
            showToast("تم تحديث المجموعات من شوبيفاي بنجاح", "success");
            return true;
        } catch (err) {
            console.error("Collections sync error:", err);
            showToast("حدث خطأ أثناء مزامنة المجموعات: " + err.message, "error");
            return false;
        }
    };

    const syncVariantStockToShopify = async (variantSku, fallbackShopifyId = null) => {
        if (!supabase || !variantSku) return;
        try {
            const { data: variant } = await supabase
                .from('product_variants')
                .select('shopify_id, product_id, stock_sulur, retail_price')
                .ilike('sku', variantSku.trim())
                .maybeSingle();

            let targetShopifyId = variant?.shopify_id || fallbackShopifyId;

            if (!targetShopifyId && variant?.product_id) {
                const { data: prod } = await supabase
                    .from('products')
                    .select('shopify_id')
                    .eq('id', variant.product_id)
                    .maybeSingle();
                targetShopifyId = prod?.shopify_id || null;
            }

            if (targetShopifyId) {
                console.log(`Syncing stock for SKU ${variantSku} (Shopify ID: ${targetShopifyId}) -> stock: ${variant?.stock_sulur}, price: ${variant?.retail_price}`);
                const res = await supabase.functions.invoke('swift-processor', {
                    body: {
                        action: 'update_stock',
                        shopify_variant_id: targetShopifyId,
                        stock: variant ? variant.stock_sulur : 0,
                        price: variant ? variant.retail_price : undefined
                    }
                });
                console.log("Shopify stock sync result:", res);
                return res;
            } else {
                console.warn(`No shopify_id found for variant SKU: ${variantSku}`);
            }
        } catch (e) {
            console.error("Failed to sync variant stock to Shopify:", e);
        }
    };

    const adjustVariantStockOnShopify = async (variantSku, adjustment) => {
        if (!supabase || !variantSku) return;
        try {
            const { data: variant } = await supabase
                .from('product_variants')
                .select('shopify_id')
                .ilike('sku', variantSku.trim())
                .maybeSingle();

            if (variant && variant.shopify_id) {
                console.log(`Adjusting stock for SKU ${variantSku} on Shopify: ${adjustment}`);
                await supabase.functions.invoke('swift-processor', {
                    body: {
                        action: 'adjust_stock',
                        shopify_variant_id: variant.shopify_id,
                        adjustment: adjustment
                    }
                });
            }
        } catch (e) {
            console.error("Failed to adjust variant stock to Shopify:", e);
        }
    };

    const refreshProductsAndLedger = async () => {
        if (!supabase) return;
        try {
            const { data: dbVariants } = await supabase.from('product_variants').select('product_id, sku, stock_sulur, stock_singanallur, average_cost, wholesale_price, retail_price');
            if (!dbVariants || dbVariants.length === 0) return;
            
            setState(prev => {
                const updatedProducts = (prev.products || []).map(prod => {
                    const matchingVars = dbVariants.filter(v => String(v.product_id) === String(prod.id));
                    if (matchingVars.length === 0) return prod;
                    
                    return {
                        ...prod,
                        variants: (prod.variants || []).map(vr => {
                            const dbVar = dbVariants.find(v => v.sku === vr.sku);
                            if (!dbVar) return vr;
                            return {
                                ...vr,
                                stock: {
                                    Sulur: dbVar.stock_sulur !== undefined ? dbVar.stock_sulur : (vr.stock?.Sulur || 0),
                                    Singanallur: dbVar.stock_singanallur !== undefined ? dbVar.stock_singanallur : (vr.stock?.Singanallur || 0)
                                },
                                averageCost: dbVar.average_cost !== undefined ? dbVar.average_cost : vr.averageCost,
                                wholesalePrice: dbVar.wholesale_price !== undefined ? dbVar.wholesale_price : vr.wholesalePrice,
                                retailPrice: dbVar.retail_price !== undefined ? dbVar.retail_price : vr.retailPrice
                            };
                        })
                    };
                });
                return { ...prev, products: updatedProducts };
            });
        } catch (e) {
            console.error("Silent background stock refresh failed gracefully:", e);
        }
    };

    useEffect(() => {
        let lastHiddenTime = 0;
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenTime = Date.now();
            } else if (document.visibilityState === 'visible') {
                if (Date.now() - lastHiddenTime > 3000) {
                    refreshProductsAndLedger();
                }
            }
        };

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    const saveShippingFees = async (newFees) => {
        try {
            localStorage.setItem('octabot_shipping_fees_v2', JSON.stringify(newFees));
        } catch(e) {}
        setState(prev => ({ ...prev, shippingFees: newFees }));

        if (supabase) {
            try {
                await supabase
                    .from('user_profiles')
                    .upsert({ 
                        id: 'system_shipping_fees', 
                        name: 'System Shipping Fees Config',
                        role: 'SystemConfig',
                        avatar: JSON.stringify(newFees)
                    }, { onConflict: 'id' });
            } catch (err) {
                console.error("Error saving shipping fees to Supabase DB:", err);
            }
        }

        showToast("تم حفظ وتعميم أسعار الشحن للمحافظات بنجاح على جميع الأدمنز ✅", "success");
    };

    return (
        <AppContext.Provider value={{
            state,
            setState,
            supabase,
            currentView,
            setCurrentView,
            toast,
            restockVariant,
            syncVariantStockToShopify,
            refreshProductsAndLedger,
            showToast,
            shopifyNotification,
            setShopifyNotification,
            approveOrderWithBosta,
            deductOrderStock,
            fetchMissingOrderItems,
            syncBostaStatus,
            saveShippingFees,
            authLogin,
            authSignup,
            updateUserPermissions,
            updateUserTelegramChatId,
            toggleUserStatus,
            deleteUser,
            authLogout,
            addProduct,
            editProduct,
            syncShopifyCollections,
            syncProductsFromShopify,
            deleteProduct,
            deleteMultipleProducts,
            deleteProductsLocalOnly,
            updateDepositStatus,
            confirmDepositRefund,
            confirmDepositAndRefund,
            updateOrderProperties,
            settleAdminsCustody,
            addOrder,
            editOrder,
            updateOrderStatus,
            deleteOrder,
            addSupplier,
            recordSupplierPayment,
            recordPurchaseOrder,
            recordWaste,
            deleteWaste,
            recordStockAdjustment,
            saveStoreConfig,
            saveUserAvatar,
            addCustomer,
            editCustomer,
            deleteCustomer,
            setCustomerSpam,
            getOrCreateCustomer,
            addCoupon,
            editCoupon,
            deleteCoupon,
            validateCoupon,
            applyCouponUsage,
            checkLiveCouponAvailability,
            addInfluencer,
            editInfluencer,
            deleteInfluencer,
            restoreStoreData,
            logActivity,
            searchOrdersDatabase,
            searchCustomersDatabase,
            isDeductedStatus,
            language,
            setLanguage,
            theme,
            setTheme,
            refreshData: loadSupabaseData,
            t,
            showConfirm,
            showAlert
        }}>
            {children}

            {confirmModal.isOpen && (
                <div style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0, 0, 0, 0.65)',
                    backdropFilter: 'blur(8px)',
                    WebkitBackdropFilter: 'blur(8px)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 99999,
                    animation: 'fadeIn 0.2s ease-out'
                }} onClick={confirmModal.onCancel || closeConfirmModal}>
                    <div className="glass-card" style={{
                        width: '420px',
                        maxWidth: '95%',
                        background: 'rgba(18, 18, 22, 0.85)',
                        border: '1px solid var(--glass-border)',
                        borderRadius: '12px',
                        boxShadow: '0 20px 50px rgba(0,0,0,0.6)',
                        padding: '24px',
                        textAlign: 'center',
                        animation: 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)'
                    }} onClick={(e) => e.stopPropagation()}>
                        <div style={{
                            width: '56px',
                            height: '56px',
                            borderRadius: '50%',
                            background: confirmModal.type === 'confirm' ? 'rgba(212, 175, 55, 0.1)' : 'rgba(231, 76, 60, 0.1)',
                            border: `1px solid ${confirmModal.type === 'confirm' ? 'rgba(212, 175, 55, 0.25)' : 'rgba(231, 76, 60, 0.25)'}`,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 16px auto',
                            fontSize: '24px',
                            color: confirmModal.type === 'confirm' ? 'var(--gold-primary)' : '#e74c3c'
                        }}>
                            {confirmModal.type === 'confirm' ? (
                                <i className="fa-solid fa-circle-question"></i>
                            ) : (
                                <i className="fa-solid fa-circle-exclamation"></i>
                            )}
                        </div>
                        <h3 style={{
                            fontSize: '18px',
                            fontWeight: 'bold',
                            color: 'var(--text-primary)',
                            marginBottom: '12px'
                        }}>
                            {confirmModal.title}
                        </h3>
                        <p style={{
                            fontSize: '14px',
                            color: 'var(--text-secondary)',
                            lineHeight: '1.6',
                            marginBottom: '24px',
                            whiteSpace: 'pre-line'
                        }}>
                            {confirmModal.message}
                        </p>
                        {confirmModal.showSpamToggle && (
                            <div 
                                onClick={() => toggleSpamFlag(!confirmSpamToggle)}
                                style={{
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '12px',
                                    marginTop: '-12px',
                                    marginBottom: '20px',
                                    background: confirmSpamToggle ? 'rgba(239, 68, 68, 0.15)' : 'rgba(239, 68, 68, 0.05)',
                                    border: confirmSpamToggle ? '1px solid rgba(239, 68, 68, 0.5)' : '1px solid rgba(239, 68, 68, 0.15)',
                                    padding: '12px 16px',
                                    borderRadius: '10px',
                                    cursor: 'pointer',
                                    userSelect: 'none',
                                    transition: 'all 0.25s ease'
                                }}
                            >
                                {/* Toggle Switch */}
                                <div style={{
                                    width: '44px',
                                    height: '24px',
                                    borderRadius: '12px',
                                    background: confirmSpamToggle 
                                        ? 'linear-gradient(135deg, #ef4444, #dc2626)' 
                                        : 'rgba(255,255,255,0.1)',
                                    border: confirmSpamToggle ? 'none' : '1px solid rgba(255,255,255,0.2)',
                                    position: 'relative',
                                    transition: 'all 0.25s ease',
                                    flexShrink: 0,
                                    boxShadow: confirmSpamToggle ? '0 0 12px rgba(239, 68, 68, 0.4)' : 'none'
                                }}>
                                    <div style={{
                                        width: '18px',
                                        height: '18px',
                                        borderRadius: '50%',
                                        background: '#fff',
                                        position: 'absolute',
                                        top: '3px',
                                        left: confirmSpamToggle ? '23px' : '3px',
                                        transition: 'left 0.25s ease',
                                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)'
                                    }} />
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <i className="fa-solid fa-ban" style={{ 
                                        fontSize: '14px', 
                                        color: confirmSpamToggle ? '#ef4444' : 'var(--text-muted)',
                                        transition: 'color 0.25s ease'
                                    }} />
                                    <span style={{ 
                                        fontSize: '13px', 
                                        color: confirmSpamToggle ? '#ef4444' : 'var(--text-secondary)', 
                                        fontWeight: 600,
                                        transition: 'color 0.25s ease'
                                    }}>
                                        تعيين كعميل مزعج (سبام)
                                    </span>
                                </div>
                            </div>
                        )}
                        <div style={{
                            display: 'flex',
                            gap: '12px',
                            justifyContent: 'center'
                        }}>
                            {confirmModal.type === 'confirm' && (
                                <button 
                                    className="btn btn-secondary"
                                    onClick={confirmModal.onCancel || closeConfirmModal}
                                    style={{
                                        padding: '8px 24px',
                                        fontSize: '13px',
                                        borderRadius: '6px',
                                        background: 'var(--glass-bg)',
                                        border: '1px solid var(--glass-border)',
                                        color: 'var(--text-primary)',
                                        cursor: 'pointer',
                                        minWidth: '100px'
                                    }}
                                >
                                    {language === 'ar' ? 'إلغاء' : 'Cancel'}
                                </button>
                            )}
                            <button 
                                className="btn"
                                onClick={() => {
                                    if (confirmModal.onConfirm) {
                                        confirmModal.onConfirm(confirmSpamToggleRef.current);
                                    } else {
                                        closeConfirmModal();
                                    }
                                }}
                                style={{
                                    padding: '8px 24px',
                                    fontSize: '13px',
                                    borderRadius: '6px',
                                    background: confirmModal.type === 'confirm' ? 'var(--gold-gradient)' : 'linear-gradient(135deg, #e74c3c, #c0392b)',
                                    color: confirmModal.type === 'confirm' ? '#000' : '#fff',
                                    border: 'none',
                                    fontWeight: 'bold',
                                    cursor: 'pointer',
                                    minWidth: '100px',
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                                }}
                            >
                                {language === 'ar' ? 'موافق' : 'OK'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </AppContext.Provider>
    );
};

const translations = {
    en: {
        dashboard: "Dashboard",
        inventory: "Inventory",
        reports: "Reports",
        suppliers: "Suppliers",
        orders: "Orders",
        manageStore: "Manage Store",
        settings: "Settings",
        logout: "Log Out",
        welcomeBack: "Welcome back",
        searchPlaceholder: "Search product, supplier, order...",
        noNotifications: "No new notifications",
        overallInventory: "Overall Inventory",
        categories: "Product Type",
        totalProducts: "Total Products",
        topSelling: "Top Selling",
        lowStocks: "Low Stocks",
        revenue: "Revenue",
        cost: "Cost",
        notInStock: "Not in stock",
        ordered: "Ordered",
        products: "Products",
        addProduct: "Add Product",
        filters: "Filters",
        downloadAll: "Download all",
        buyingPrice: "Buying Price",
        quantity: "Quantity",
        thresholdValue: "Threshold Value",
        expiryDate: "Expiry Date",
        availability: "Availability",
        actions: "Actions",
        previous: "Previous",
        next: "Next",
        page: "Page",
        of: "of",
        newProduct: "New Product",
        productName: "Product Name",
        productId: "Product ID",
        unit: "Unit",
        discard: "Discard",
        overview: "Overview",
        totalProfit: "Total Profit",
        sales: "Sales",
        netPurchaseValue: "Net purchase value",
        netSalesValue: "Net sales value",
        momProfit: "MoM Profit",
        yoyProfit: "YoY Profit",
        bestSellingCategory: "Best selling category",
        bestSellingProduct: "Best selling product",
        profitAndRevenue: "Profit & Revenue",
        weekly: "Weekly",
        seeAll: "See All",
        inStock: "In-stock",
        outOfStock: "Out of stock",
        partialOutOfStock: "Partially Out of Stock",
        lowStock: "Low stock",
        packets: "Packets",
        units: "Units",
        brandName: "a5tabot dashboard",
        totalActiveSuppliers: "Total Active Suppliers",
        outstandingLiabilities: "Outstanding Liabilities",
        totalPaidAssets: "Total Paid Assets",
        productVarietiesRange: "Product Varieties Range",
        catalogItems: "catalog items",
        liabilityOutstanding: "Liability Outstanding",
        clearedLedger: "Cleared Ledger",
        payDebt: "Pay Debt",
        databaseMaintenance: "Database Backups & Exports",
        backupDescription: "Generate complete offline copies of your stock registries, transaction records, and activities lists. You can restore your data at any time from a JSON backup file.",
        downloadBackup: "Download JSON Database Backup",
        uploadBackup: "Upload JSON Database Restore",
        downloadCSV: "Download Catalog CSV Report",
        purchases: "Purchases",
        adjustments: "Adjustments",
        history: "History",
        fifoQueue: "FIFO Inventory Queue",
        noFifoBatches: "No active FIFO batches logged.",
        nextToDispatch: "Next to Dispatch (FIFO #1)",
        batchFifo: "Batch FIFO #",
        remainingQty: "Remaining Quantity",
        recordStockAdjustment: "Record Stock Adjustment",
        selectOptionVariant: "Select Option/Variant",
        adjustmentType: "Adjustment Type",
        adjustmentQuantity: "Adjustment Quantity",
        reasonJustification: "Reason / Justification",
        applyStockCorrection: "Apply Stock Correction",
        correctionAuditLogs: "Correction & Audit logs",
        noStockCorrections: "No stock corrections logged yet.",
        increase: "Increase (+)",
        decrease: "Decrease (-)",
        notSpecified: "Not Specified",
        supplierDetails: "Supplier Details",
        stockLocations: "Stock Locations",
        openingStock: "Opening Stock",
        onTheWay: "On the way",
        noRecords: "No records logged for this section under this tab.",
        chooseVariant: "-- Choose Variant --",
        orderTotal: "Estimated Order Total",
        orderedItems: "Ordered Items List",
        addItem: "Add Item",
        recordOrder: "Record Sales Order Transaction",
        customerName: "Buyer Client Name",
        fulfillmentWarehouse: "Fulfillment Warehouse Station",
        orderStatus: "Order Transaction Status",
        salesOverview: "Sales Overview",
        inventorySummary: "Inventory Summary",
        purchaseOverview: "Purchase Overview",
        productSummary: "Product Summary",
        totalProfit: "Total Profit",
        purchaseValue: "Net Purchase Value",
        salesValue: "Net Sales Value",
        momProfit: "MoM Profit",
        yoyProfit: "YoY Profit",
        bestSellingCategory: "Best Selling Category",
        turnover: "Turnover",
        increase: "Increase By",
        seeAll: "See All",
        profitAndRevenue: "Profit & Revenue",
        bestSellingProduct: "Best Selling Product",
        profit: "Profit",
        quantityInHand: "Quantity in Hand",
        toBeReceived: "To be received",
        purchase: "Purchase",
        cancel: "Cancel",
        return: "Return",
        numberOfSuppliers: "Number of Suppliers",
        numberOfCategories: "Number of Categories",
        topSellingStock: "Top Selling Stock",
        lowQuantityStock: "Low Quantity Stock",
        supplierName: "Supplier Name",
        contact: "Contact",
        status: "Status",
        email: "Email",
        phone: "Phone",
        paid: "Paid",
        debt: "Debt",
        addSupplier: "Add Supplier",
        registerNewSupplier: "Register New Supplier Profile",
        editSupplier: "Edit Supplier Profile",
        contactEmail: "Contact Email",
        contactPhone: "Contact Phone",
        paidBalance: "Paid Balance",
        outstandingDebt: "Outstanding Liability Debt",
        recordedCashPaid: "Recorded Cash Paid",
        orderId: "Order ID",
        date: "Date",
        customer: "Customer",
        total: "Total",
        payment: "Payment",
        newOrder: "New Order",
        save: "Save",
        cancelOrder: "Cancel Order",
        storeSettings: "Store Settings",
        storeName: "Store Name",
        currency: "Currency",
        saveSettings: "Save Settings",
        last7days: "Last 7 days",
        orderSummary: "Order Summary",
        salesAndPurchase: "Sales & Purchase",
        details: "Details",
        edit: "Edit",
        delete: "Delete",
        unitPrice: "Unit Price",
        wholesalePrice: "Wholesale Price",
        retailPrice: "Retail Price",
        reorderLimit: "Reorder Limit",
        barcode: "Barcode",
        description: "Description",
        allCategories: "All Categories",
        allWarehouses: "All Warehouses",
        inSulur: "Main Warehouse",
        addVariant: "Add Variant",
        addVariantOption: "Add Variant Option",
        productVariants: "Product Option Variants",
        optionName: "Option Name",
        limit: "Limit",
        electronics: "Electronics",
        mobileAccessories: "Mobile Accessories",
        accessories: "Accessories",
        piece: "Piece",
        variants: "Variants",
        stock: "Stock",
        processStockReturn: "Process Stock Return",
        returnItemSku: "Return Item SKU",
        quantityToReturn: "Quantity to Return",
        itemCondition: "Item Condition Classification",
        restockable: "Restockable (FIFO)",
        damagedWaste: "Damaged / Waste Loss",
        noProducts: "No products found.",
        noOrders: "No orders found.",
        noSuppliers: "No suppliers found.",
        completed: "Completed",
        pending: "Pending",
        draft: "Draft",
        paid: "Paid",
        cancelled: "Cancelled",
        partiallydelivered: "Partially Delivered",
        allOrderStatuses: "All Order Statuses",
        inspect: "Inspect",
        createdDate: "Creation Date",
        supabaseTasks: "Project Notes",
        remaining: "Remaining",
        stockHealthy: "All stock levels healthy!",
        outOfStock: "Out of Stock",
        partialOutOfStock: "Partially Out of Stock",
        lowStock: "Low Stock",
        noItemsSold: "No items sold yet.",
        left: "left",
        name: "Name",
        price: "Price",
        soldQuantity: "Sold Quantity",
        remainingQuantity: "Remaining Quantity",
        stockLedger: "Stock Ledger",
        purchaseOrders: "Purchase Orders",
        runway: "Runway (Days)",
        printLabel: "Print Barcode Label",
        recordPurchaseOrder: "Record Purchase Order",
        markup: "Markup",
        margin: "Margin",
        profitMargin: "Profit Margin",
        
        recordPurchaseOrder: "Record Purchase Order",
        markup: "Markup",
        margin: "Margin",
        profitMargin: "Profit Margin",
        expiry: "Expiry",
        customersList: "Customers",
        totalCustomers: "Total Customers",
        vipCustomers: "VIP Customers",
        addCustomer: "Add Customer",
        customerName: "Customer Name",
        customerType: "Type",
        totalPurchases: "Total Purchases",
        ordersCount: "Orders",
        editCustomer: "Edit Customer",
        regular: "Regular",
        vip: "VIP",
        governorate: "Governorate"

    },
    ar: {
        dashboard: "لوحة التحكم",
        inventory: "المستودع",
        reports: "التقارير",
        suppliers: "الموردين",
        orders: "المبيعات",
        manageStore: "إدارة المتجر",
        settings: "الإعدادات",
        logout: "تسجيل الخروج",
        welcomeBack: "مرحباً بك مجدداً",
        searchPlaceholder: "ابحث عن منتج، مورد، مبيعات...",
        noNotifications: "لا توجد تنبيهات جديدة",
        overallInventory: "حالة المخزن العامة",
        categories: "نوع المنتج (Type)",
        totalProducts: "إجمالي المنتجات",
        topSelling: "الأكثر مبيعاً",
        lowStocks: "مخزون منخفض",
        revenue: "الإيرادات",
        cost: "التكلفة",
        notInStock: "غير متوفر",
        ordered: "طلب شراء",
        products: "المنتجات",
        addProduct: "إضافة منتج",
        filters: "التصفيات",
        downloadAll: "تحميل الكل",
        buyingPrice: "سعر الشراء",
        quantity: "الكمية",
        thresholdValue: "الحد الأدنى",
        expiryDate: "تاريخ الانتهاء",
        availability: "الحالة",
        actions: "إجراءات",
        previous: "السابق",
        next: "التالي",
        page: "صفحة",
        of: "من",
        newProduct: "منتج جديد",
        productName: "اسم المنتج",
        productId: "كود المنتج",
        unit: "الوحدة",
        discard: "تجاهل",
        overview: "نظرة عامة",
        totalProfit: "إجمالي الأرباح",
        sales: "المبيعات",
        netPurchaseValue: "صافي المشتريات",
        netSalesValue: "صافي المبيعات",
        momProfit: "الربح الشهري",
        yoyProfit: "الربح السنوي",
        bestSellingCategory: "الأقسام الأكثر مبيعاً",
        bestSellingProduct: "المنتجات الأكثر مبيعاً",
        profitAndRevenue: "الربح والإيرادات",
        weekly: "أسبوعي",
        seeAll: "عرض الكل",
        inStock: "متوفر",
        outOfStock: "نفذ المخزن",
        partialOutOfStock: "نفذ مخزون جزئي",
        lowStock: "مخزون منخفض",
        packets: "علبة",
        units: "وحدة",
        brandName: "متجر أخطبوط",
        totalActiveSuppliers: "إجمالي الموردين النشطين",
        outstandingLiabilities: "المستحقات المعلقة",
        totalPaidAssets: "إجمالي المدفوعات",
        productVarietiesRange: "تنوع المنتجات",
        catalogItems: "أصناف",
        liabilityOutstanding: "مستحقات معلقة",
        clearedLedger: "حساب مصفى",
        payDebt: "دفع المستحق",
        databaseMaintenance: "نسخ احتياطي واستعادة البيانات",
        backupDescription: "قم بإنشاء نسخ احتياطية كاملة من سجلات المنتجات، الطلبات، والأنشطة للعمل بدون اتصال. يمكنك استعادة بياناتك في أي وقت من ملف النسخة الاحتياطية.",
        downloadBackup: "تحميل نسخة JSON الاحتياطية",
        uploadBackup: "رفع واستعادة ملف JSON",
        downloadCSV: "تحميل تقرير الأصناف CSV",
        purchases: "المشتريات",
        adjustments: "التسويات",
        history: "السجل",
        fifoQueue: "طابور سحب الشحنات (FIFO)",
        noFifoBatches: "لا توجد شحنات نشطة مسجلة حالياً.",
        nextToDispatch: "الشحنة التالية للصرف (الأقدم أولاً) 🚨",
        batchFifo: "شحنة واردة رقم #",
        remainingQty: "الكمية المتبقية",
        recordStockAdjustment: "تسجيل تسوية مخزنية (تعديل رصيد)",
        selectOptionVariant: "اختر المنتج / الصنف الفرعي",
        adjustmentType: "نوع التسوية (تعديل بالزيادة أو النقصان)",
        adjustmentQuantity: "الكمية المراد تسويتها",
        reasonJustification: "سبب التسوية / التبرير",
        applyStockCorrection: "تطبيق تسوية المخزون",
        correctionAuditLogs: "سجل عمليات تسوية المخزون والمراجعة",
        noStockCorrections: "لم يتم تسجيل أي عمليات تسوية مخزنية بعد.",
        increase: "زيادة رصيد (+)",
        decrease: "عجز / نقصان رصيد (-)",
        notSpecified: "غير محدد",
        supplierDetails: "تفاصيل المورد",
        stockLocations: "مواقع المخزون",
        openingStock: "الرصيد الافتتاحي",
        onTheWay: "في الطريق",
        noRecords: "لا توجد سجلات مضافة لهذا القسم تحت هذا التبويب.",
        chooseVariant: "-- اختر الصنف --",
        orderTotal: "إجمالي قيمة الطلب",
        orderedItems: "قائمة المنتجات المطلوبة",
        addItem: "إضافة منتج",
        recordOrder: "تسجيل معاملة طلب مبيعات",
        customerName: "اسم العميل المشتري",
        fulfillmentWarehouse: "مستودع الشحن والتسليم",
        orderStatus: "حالة معاملة الطلب",
        salesOverview: "نظرة عامة على المبيعات",
        inventorySummary: "ملخص المستودع",
        purchaseOverview: "نظرة عامة على المشتريات",
        productSummary: "ملخص المنتجات",
        totalProfit: "إجمالي الأرباح",
        purchaseValue: "صافي قيمة المشتريات",
        salesValue: "صافي قيمة المبيعات",
        momProfit: "أرباح الشهر الماضي مقارنة بالماضي",
        yoyProfit: "أرباح السنة مقارنة بالماضي",
        bestSellingCategory: "الأقسام الأكثر مبيعاً",
        turnover: "حجم المبيعات",
        increase: "الزيادة",
        seeAll: "عرض الكل",
        profitAndRevenue: "الأرباح والإيرادات",
        bestSellingProduct: "المنتجات الأكثر مبيعاً",
        profit: "الأرباح",
        quantityInHand: "الكمية المتوفرة",
        toBeReceived: "بانتظار الاستلام",
        purchase: "المشتريات",
        cancel: "الملغاة",
        return: "المرتجعة",
        numberOfSuppliers: "عدد الموردين",
        numberOfCategories: "عدد الأقسام",
        topSellingStock: "المنتجات الأكثر مبيعاً",
        lowQuantityStock: "منتجات منخفضة الكمية",
        supplierName: "اسم المورد",
        contact: "الاتصال",
        status: "الحالة",
        email: "البريد الإلكتروني",
        phone: "الهاتف",
        paid: "المدفوع",
        debt: "المستحق",
        addSupplier: "إضافة مورد",
        registerNewSupplier: "تسجيل ملف مورد جديد",
        editSupplier: "تعديل ملف المورد",
        contactEmail: "البريد الإلكتروني للاتصال",
        contactPhone: "رقم هاتف الاتصال",
        paidBalance: "الرصيد المدفوع",
        outstandingDebt: "الالتزامات المالية المستحقة",
        recordedCashPaid: "المبلغ النقدي المسجل المدفوع",
        orderId: "رقم الطلب",
        date: "التاريخ",
        customer: "العميل",
        total: "الإجمالي",
        payment: "الدفع",
        newOrder: "طلب جديد",
        save: "حفظ",
        cancelOrder: "إلغاء الطلب",
        storeSettings: "إعدادات المتجر",
        storeName: "اسم المتجر",
        currency: "العملة",
        saveSettings: "حفظ الإعدادات",
        last7days: "آخر 7 أيام",
        orderSummary: "ملخص الطلبات",
        salesAndPurchase: "المبيعات والمشتريات",
        details: "التفاصيل",
        edit: "تعديل",
        delete: "حذف",
        unitPrice: "سعر الوحدة",
        wholesalePrice: "سعر الجملة",
        retailPrice: "سعر التجزئة",
        reorderLimit: "حد إعادة الطلب",
        barcode: "باركود",
        description: "الوصف",
        allCategories: "كل الأقسام",
        allWarehouses: "كل المستودعات",
        inSulur: "المستودع الرئيسي",
        inSinganallur: "سينجانالور",
        addVariant: "إضافة نوع",
        addVariantOption: "إضافة خيار بديل",
        productVariants: "خيارات بدائل المنتج",
        optionName: "اسم الخيار",
        limit: "الحد",
        electronics: "إلكترونيات",
        mobileAccessories: "إكسسوارات موبايل",
        accessories: "إكسسوارات",
        piece: "قطعة",
        variants: "الأنواع",
        stock: "المخزون",
        processStockReturn: "معالجة مرتجع المخزون",
        returnItemSku: "رمز صنف المرتجع (SKU)",
        quantityToReturn: "الكمية المرتجعة",
        itemCondition: "تصنيف حالة المنتج",
        restockable: "قابل لإعادة البيع (FIFO)",
        damagedWaste: "تالف / فاقد هدر",
        noProducts: "لم يتم العثور على منتجات.",
        noOrders: "لم يتم العثور على طلبات.",
        noSuppliers: "لم يتم العثور على موردين.",
        completed: "مكتمل",
        pending: "قيد الانتظار",
        draft: "مسودة",
        paid: "مدفوع",
        cancelled: "ملغي",
        partiallydelivered: "تسليم جزئي",
        allOrderStatuses: "كل حالات الطلبات",
        inspect: "معاينة",
        createdDate: "تاريخ الإنشاء",
        supabaseTasks: "ملاحظات المشروع",
        remaining: "المتبقي",
        stockHealthy: "كل مستويات المخزون سليمة!",
        outOfStock: "نفد من المخزن",
        partialOutOfStock: "نفذ مخزون جزئي",
        lowStock: "مخزون منخفض",
        noItemsSold: "لم يتم بيع أي منتجات بعد.",
        left: "متبقي",
        name: "الاسم",
        price: "السعر",
        soldQuantity: "الكمية المباعة",
        remainingQuantity: "الكمية المتبقية",
        stockLedger: "سجل حركة المخزون",
        purchaseOrders: "أوامر الشراء والتوريد",
        runway: "أيام بقاء المخزون",
        printLabel: "طباعة ملصق الباركود",
        recordPurchaseOrder: "تسجيل فاتورة توريد",
        markup: "الربح المضاف",
        margin: "الهامش",
        profitMargin: "هامش الربح",
        
        recordPurchaseOrder: "تسجيل فاتورة مشتريات",
        markup: "الهامش الكلي",
        margin: "الربح",
        profitMargin: "نسبة الربح",
        expiry: "تاريخ الصلاحية",
        customersList: "العملاء",
        totalCustomers: "إجمالي العملاء",
        vipCustomers: "عملاء VIP المميزين",
        addCustomer: "إضافة عميل",
        customerName: "اسم العميل",
        customerType: "فئة العميل",
        totalPurchases: "إجمالي المشتريات",
        ordersCount: "عدد الطلبات",
        editCustomer: "تعديل عميل",
        regular: "عادي",
        vip: "مميز (VIP)",
        governorate: "المحافظة"

    }
};
