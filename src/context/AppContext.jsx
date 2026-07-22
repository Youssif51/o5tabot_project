import { formatProductDisplayName } from '../utils/productUtils';
import { supabase } from '../utils/supabase';
import { getLocalDateString } from '../utils/dateUtils';
import React, { createContext, useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';

export const AppContext = createContext();

const defaultSuppliers = [];

const defaultProducts = [];

const defaultOrders = [];

const defaultStockLedger = [];

const defaultActivities = [];

    const initialState = {
        products: [],
        suppliers: [],
        orders: [],
        purchaseOrders: [],
        wastes: [],
        stockLedger: [],
        customers: [],
        coupons: [],
        users: [],
        activities: [],
        collections: [],
        storeSettings: { name: "o5taboad store", address: "Egypt", currency: "EGP", vipThresholdPurchases: 5000, vipThresholdOrders: 10 },
        userAvatars: {},
        influencers: [],
        currentUser: null
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
                    Array.isArray(parsed.activities) &&
                    parsed.storeSettings) {
                    return parsed;
                }
            }
        } catch (e) {
            console.error("Failed to parse localStorage state:", e);
        }
        return initialState;
    });

        // Fetch WMS ERP records from Supabase on load
    useEffect(() => {
        const loadSupabaseData = async () => {
            if (!supabase) return;
            if (!state.currentUser) return;
            try {
                const [
                    { data: products, error: pErr },
                    { data: variants, error: vErr },
                    { data: suppliers, error: sErr },
                    { data: orders, error: oErr },
                    { data: orderItems, error: oiErr },
                    { data: purchaseOrders, error: poErr },
                    { data: purchaseItems, error: poiErr },
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
                    supabase.from('orders').select('*'),
                    supabase.from('order_items').select('*'),
                    supabase.from('purchase_orders').select('*'),
                    supabase.from('purchase_items').select('*'),
                    supabase.from('stock_ledger').select('*'),
                    supabase.from('wastes').select('*'),
                    supabase.from('customers').select('*'),
                    supabase.from('coupons').select('*'),
                    supabase.from('user_profiles').select('*'),
                    supabase.from('shopify_collections').select('*')
                ]);

                if (pErr || vErr || sErr || oErr || oiErr || poErr || poiErr || lErr || wErr || cErr || couErr || uErr || colErr) {
                    console.warn("Could not retrieve all Supabase tables, using local state instead.");
                    return;
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
                        averageCost: parseFloat(v.average_cost) || parseFloat(v.wholesale_price) || 0
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
                    createdBy: s.created_by
                }));

                const mappedOrders = (orders || []).map(o => {
                    const items = (orderItems || []).filter(oi => oi.order_id === o.id).map(oi => ({
                        variantSku: oi.variant_sku,
                        quantity: parseInt(oi.quantity) || 0,
                        price: parseFloat(oi.price) || 0,
                        costAtTimeOfSale: parseFloat(oi.cost_at_time_of_sale) || parseFloat(oi.wholesale_price) || 0
                    }));
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
                        shipping_fee: parseFloat(o.shipping_fee) || 0,
                        createdBy: o.created_by,
                        shopifyOrderId: o.shopify_order_id || null,
                        source: o.source || 'manual',
                        paymentMethod: o.payment_method || null,
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
                        warehouse: po.warehouse,
                        totalCost: parseFloat(po.total_cost) || 0,
                        createdBy: po.created_by,
                        items
                    };
                });

                const mappedWastes = (wastes || []).map(w => ({
                    id: `WST-${w.id}`,
                    date: w.date,
                    variantSku: w.variant_sku,
                    quantity: parseInt(w.quantity) || 0,
                    warehouse: "Sulur",
                    cost: 0,
                    reporter: "sfsf"
                }));

                const mappedLedger = (ledger || []).map(l => ({
                    date: l.date,
                    productId: l.product_id,
                    variantSku: l.variant_sku,
                    warehouse: l.warehouse,
                    type: l.type,
                    quantity: parseInt(l.quantity) || 0,
                    balanceAfter: parseInt(l.balance_after) || 0
                }));

                // Sort products: newest first
                mappedProducts.sort((a, b) => {
                    const dateA = a.createdDate || '';
                    const dateB = b.createdDate || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort orders: newest first
                mappedOrders.sort((a, b) => {
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort purchase orders: newest first
                mappedPurchaseOrders.sort((a, b) => {
                    const dateA = a.date || '';
                    const dateB = b.date || '';
                    if (dateA !== dateB) return dateB.localeCompare(dateA);
                    return (b.id || '').localeCompare(a.id || '');
                });

                // Sort wastes: newest first
                mappedWastes.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                // Sort stock ledger logs: newest first
                mappedLedger.sort((a, b) => (b.date || '').localeCompare(a.date || ''));

                const loadedUserAvatars = {};
                (users || []).forEach(u => {
                    if (u.avatar) {
                        loadedUserAvatars[u.id] = u.avatar;
                    }
                });

                setState(prev => ({
                    ...prev,
                    products: mappedProducts,
                    suppliers: mappedSuppliers,
                    orders: mappedOrders,
                    purchaseOrders: mappedPurchaseOrders,
                    wastes: mappedWastes,
                    customers: customers || [],
                    coupons: coupons || [],
                    users: users || [],
                    userAvatars: { ...prev.userAvatars, ...loadedUserAvatars },
                    stockLedger: mappedLedger,
                    collections: collections || []
                }));
            } catch (err) {
                console.error("Supabase load error:", err);
            }
        };
        loadSupabaseData();
    }, [state.currentUser?.id]);


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
    const [language, setLanguage] = useState(() => localStorage.getItem("octabot_lang") || "en");
    const [theme, setTheme] = useState(() => localStorage.getItem("octabot_theme") || "dark");

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
                        // Wait 1.5 seconds to allow Edge Function to finish inserting order items
                        await new Promise(resolve => setTimeout(resolve, 1500));

                        const { data: orderItems, error: itemsErr } = await supabase
                            .from('order_items')
                            .select('*')
                            .eq('order_id', newOrder.id);

                        if (itemsErr) {
                            console.error("Failed to fetch order items for realtime order:", itemsErr);
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
                            shopifyOrderId: newOrder.shopify_order_id || null,
                            source: newOrder.source || 'manual',
                            paymentMethod: newOrder.payment_method || null,
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

                        // Reload customers list in background
                        const { data: customersList } = await supabase.from('customers').select('*');
                        if (customersList) {
                            setState(curr => ({ ...curr, customers: customersList }));
                        }

                        // Play sound and trigger popup notification only if it was actually added
                        if (added) {
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
                    setState(prev => {
                        const existing = prev.orders.find(o => o.id === updatedOrder.id);
                        if (!existing) return prev;

                        const isDowngrade = (existing.status !== 'Pending' && updatedOrder.status === 'Pending');
                        const newStatus = isDowngrade ? existing.status : updatedOrder.status;

                        return {
                            ...prev,
                            orders: prev.orders.map(o => o.id === updatedOrder.id ? {
                                ...o,
                                status: newStatus,
                                address: updatedOrder.address || o.address,
                                deposit: parseFloat(updatedOrder.deposit) || 0,
                                depositReceiverId: updatedOrder.deposit_receiver_id || null,
                                depositStatus: updatedOrder.deposit_status || 'confirmed'
                            } : o)
                        };
                    });
                }
            )
            .subscribe((status, err) => {
                console.log(`Supabase Realtime orders channel status: ${status}`, err || '');
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

        return () => {
            console.log("Cleaning up Supabase Realtime channels...");
            supabase.removeChannel(ordersChannel);
            supabase.removeChannel(customersChannel);
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
        
        // Refresh users list
        const { data: users } = await supabase.from('user_profiles').select('*');
        setState(prev => ({ ...prev, users: users || [] }));
        
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
        let customer = state.customers.find(c => c.phone === phone);
        if (customer) return customer.id;
        
        const newCustomer = {
            id: crypto.randomUUID(),
            name: name || "Unknown",
            phone,
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
                        const newTotal = parseFloat(c.total_purchases || 0) + parseFloat(valueChange);
                        const newCount = parseInt(c.orders_count || 0) + parseInt(countChange);
                        let newType = c.customer_type;
                        if (c.customer_type === 'Regular' && (newTotal >= thresholdPurchases || newCount >= thresholdOrders)) {
                            newType = 'VIP';
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
                
                const newTotal = parseFloat(cData.total_purchases || 0) + parseFloat(valueChange);
                const newCount = parseInt(cData.orders_count || 0) + parseInt(countChange);
                let newType = cData.customer_type;
                if (cData.customer_type === 'Regular' && (newTotal >= thresholdPurchases || newCount >= thresholdOrders)) {
                    newType = 'VIP';
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
        setState(prev => ({ ...prev, influencers: [influencer, ...(prev.influencers || [])] }));
        showToast(`Influencer '${influencer.name}' added successfully.`);
    };

    const editInfluencer = async (updatedInfluencer) => {
        setState(prev => ({
            ...prev,
            influencers: (prev.influencers || []).map(inf => inf.id === updatedInfluencer.id ? updatedInfluencer : inf)
        }));
        showToast(`Influencer '${updatedInfluencer.name}' updated successfully.`);
    };

    const deleteInfluencer = async (id) => {
        setState(prev => ({
            ...prev,
            influencers: (prev.influencers || []).filter(inf => inf.id !== id)
        }));
        showToast("Influencer deleted successfully.");
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
        const coupon = state.coupons.find(c => c.code === code && c.is_active);
        if (!coupon) return { valid: false, error: "Invalid or inactive coupon." };
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return { valid: false, error: "Coupon expired." };
        if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) return { valid: false, error: "Usage limit reached." };
        if (coupon.min_order_value && cartTotal < coupon.min_order_value) return { valid: false, error: `Minimum order value is ${coupon.min_order_value}.` };
        return { valid: true, coupon };
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
                            average_cost: v.averageCost || v.wholesalePrice || 0
                        }));
                        await supabase.from('product_variants').insert(vars);
                    }
                    
                    // Sync to Shopify using Edge Function
                    try {
                        console.log("Syncing to Shopify...");
                        const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('swift-processor', {
                            body: {
                                ...product,
                                collection_ids: product.shopifyCollectionIds || []
                            }
                        });
                        
                        if (shopifyError) {
                            console.error("Failed to sync to Shopify:", shopifyError);
                            showToast("تم حفظ المنتج محلياً ولكن فشل رفعه لشوبيفاي", "warning");
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
                            }
                        }
                    } catch (err) {
                        console.error("Shopify invoke error:", err);
                    }
                    
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const editProduct = (updatedProduct) => {
        setState(prev => ({
            ...prev,
            products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
        }));
        logActivity("stock", `Product '${updatedProduct.name}' details were updated.`);
        showToast(`Product '${updatedProduct.name}' updated.`);

        if (supabase) {
            (async () => {
                try {
                    let finalImageStr = updatedProduct.image;
                    try {
                        let baseImages = updatedProduct.images || [];
                        if ((!baseImages || baseImages.length === 0) && updatedProduct.image) {
                            if (updatedProduct.image.startsWith('[')) {
                                baseImages = JSON.parse(updatedProduct.image);
                            } else {
                                baseImages = [updatedProduct.image];
                            }
                        }
                        finalImageStr = JSON.stringify({
                            images: baseImages,
                            vendor: updatedProduct.vendor || '',
                            tags: updatedProduct.tags || '',
                            status: updatedProduct.status || 'Active'
                        });
                    } catch(e) {
                        finalImageStr = updatedProduct.image;
                    }

                    await supabase.from('products').update({
                        name: updatedProduct.name,
                        category: updatedProduct.category,
                        unit: updatedProduct.unit,
                        image: finalImageStr,
                        description: updatedProduct.description,
                        shopify_collection_ids: updatedProduct.shopifyCollectionIds || []
                    }).eq('id', updatedProduct.id);

                    if (updatedProduct.variants) {
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
                                average_cost: v.averageCost || v.wholesalePrice || 0
                            });
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
                                images: baseImages,
                                action: 'update',
                                collection_ids: updatedProduct.shopifyCollectionIds || []
                            };
                            const { data: shopifyData, error: shopifyError } = await supabase.functions.invoke('swift-processor', {
                                body: shopifyUpdatePayload
                            });
                            
                            if (shopifyError) {
                                console.error("Failed to sync update to Shopify:", shopifyError);
                            } else {
                                console.log("Shopify update success:", shopifyData);
                                
                                const finalShopifyImages = shopifyData?.images || [];
                                
                                setState(prevState => {
                                    const updatedProducts = prevState.products.map(p => {
                                        if (p.id === updatedProduct.id) {
                                            const updatedVariants = p.variants.map(v => {
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
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => p.id !== productId)
        }));
        if (prod) {
            logActivity("stock", `Product '${prod.name}' was deleted.`);
            showToast(`Product '${prod.name}' removed.`);
        }

        if (supabase) {
            (async () => {
                try {
                    // Sync delete to Shopify
                    if (prod && prod.shopify_id) {
                        try {
                            console.log(`Deleting product ${prod.name} (${prod.shopify_id}) from Shopify...`);
                            const { data, error } = await supabase.functions.invoke('swift-processor', {
                                body: { action: 'delete', shopify_id: prod.shopify_id }
                            });
                            if (error) {
                                console.error("Failed to delete product from Shopify:", error);
                                showToast("فشل حذف المنتج من شوبيفاي", "warning");
                            } else {
                                console.log("Shopify delete success:", data);
                            }
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
    };

    const settleAdminsCustody = async (adminId, orderIds) => {
        setState(prev => ({
            ...prev,
            orders: (prev.orders || []).map(o => orderIds.includes(o.id) ? { ...o, depositStatus: 'settled' } : o)
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

    const isDeductedStatus = (st) => st && st !== 'Draft' && st !== 'Cancelled';

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
            if (isDeductedStatus(enrichedOrder.status)) {
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
            if (isDeductedStatus(enrichedOrder.status)) {
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
            (async () => {
                try {
                    await supabase.from('orders').insert([{
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
                        address: enrichedOrder.address || null,
                        governorate: enrichedOrder.governorate || null,
                        deposit: enrichedOrder.deposit || 0,
                        deposit_receiver_id: enrichedOrder.depositReceiverId || null,
                        deposit_status: enrichedOrder.depositStatus || 'confirmed',
                        shipping_fee: enrichedOrder.shipping_fee || 0,
                        created_by: enrichedOrder.createdBy || null,
                        shopify_order_id: enrichedOrder.shopifyOrderId || null,
                        source: enrichedOrder.source || 'manual',
                        payment_method: enrichedOrder.paymentMethod || null
                    }]);

                    if (enrichedOrder.items && enrichedOrder.items.length > 0) {
                        const items = enrichedOrder.items.map(item => ({
                            order_id: enrichedOrder.id,
                            variant_sku: item.variantSku,
                            quantity: item.quantity,
                            price: item.price,
                            cost_at_time_of_sale: item.costAtTimeOfSale
                        }));
                        await supabase.from('order_items').insert(items);
                    }

                    if (isDeductedStatus(enrichedOrder.status)) {
                        for (const item of enrichedOrder.items) {
                            const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variantSku).single();
                            if (vData) {
                                const newStock = Math.max(0, vData.stock_sulur - item.quantity);
                                await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variantSku);
                                syncVariantStockToShopify(item.variantSku);
                                
                                await supabase.from('stock_ledger').insert([{
                                    date: order.date,
                                    product_id: vData.product_id,
                                    variant_sku: item.variantSku,
                                    warehouse: order.warehouse || 'Sulur',
                                    type: 'Sale',
                                    quantity: -item.quantity,
                                    balance_after: newStock
                                }]);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const updateOrderStatus = async (orderId, newStatus, newAddress = null) => {
        const order = state.orders.find(o => o.id === orderId);
        if (!order) return;
        
        let addressObj = null;
        try {
            addressObj = order.address ? JSON.parse(order.address) : null;
        } catch(e) {}

        let updatedAddressStr = newAddress ? (typeof newAddress === 'string' ? newAddress : JSON.stringify(newAddress)) : order.address;

        if (newStatus === 'Cancelled' && addressObj && addressObj.bostaDeliveryId) {
            if (addressObj.bostaStateCode === 45 || addressObj.bostaStateName?.includes("توصيل") || addressObj.bostaStateName?.includes("Delivered")) {
                showAlert("لا يمكن إلغاء الأوردر آلياً لأنه قيد التوصيل (Out for Delivery). يرجى التواصل مع خدمة عملاء بوسطة.", "error");
                return;
            }
            try {
                showToast("جاري إلغاء الشحنة في بوسطة...", "info");
                const { data: { session } } = await supabase.auth.getSession();
                const res = await fetch('https://skvwhgcclmvejmpsgkes.supabase.co/functions/v1/manage-bosta-delivery', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${session?.access_token}`
                    },
                    body: JSON.stringify({ action: 'cancel', bostaDeliveryId: addressObj.bostaDeliveryId })
                });
                if (!res.ok) {
                    const resData = await res.json().catch(() => ({}));
                    showAlert(`فشل إلغاء الشحنة في بوسطة: ${resData.error || res.statusText}`, "error");
                    return;
                }
                addressObj.bostaStateName = "Cancelled";
                addressObj.bostaStateCode = 49;
                updatedAddressStr = JSON.stringify(addressObj);
                showToast("تم إلغاء الشحنة في بوسطة بنجاح", "success");
            } catch (e) {
                showAlert("حدث خطأ أثناء التواصل مع بوسطة لإلغاء الشحنة.", "error");
                return;
            }
        }

        let oldStatus = "";
        let orderTotal = 0;
        let customerId = null;
        
        setState(prev => {
            const currentOrder = prev.orders.find(o => o.id === orderId);
            if (!currentOrder) return prev;
            
            let products = [...prev.products];
            oldStatus = currentOrder.status;
            orderTotal = order.totalValue;
            customerId = order.customer_id;
            
            const wasDeducted = isDeductedStatus(oldStatus);
            const isDeducted = isDeductedStatus(newStatus);
            
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

            return {
                ...prev,
                products,
                stockLedger: newLedger,
                orders: prev.orders.map(o => {
                    if (o.id === orderId) {
                        const updatedOrder = { 
                            ...o, 
                            status: newStatus,
                            address: updatedAddressStr
                        };
                        // Flag deposit refund needed if order was cancelled with a collected deposit
                        if (
                            newStatus === 'Cancelled' &&
                            parseFloat(o.deposit) > 0 &&
                            o.depositReceiverId &&
                            (o.depositStatus === 'confirmed' || o.depositStatus === 'received')
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
            (async () => {
                try {
                    const dbUpdate = { 
                        status: newStatus,
                        address: updatedAddressStr
                    };
                    // Flag deposit refund needed if order was cancelled with a collected deposit
                    const curOrder = (state.orders || []).find(o => o.id === orderId);
                    if (
                        newStatus === 'Cancelled' &&
                        curOrder &&
                        parseFloat(curOrder.deposit) > 0 &&
                        curOrder.depositReceiverId &&
                        (curOrder.depositStatus === 'confirmed' || curOrder.depositStatus === 'received')
                    ) {
                        dbUpdate.deposit_refund_status = 'awaiting_return';
                    }
                    await supabase.from('orders').update(dbUpdate).eq('id', orderId);
                    
                    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
                    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
                    
                    if (order && items && items.length > 0) {
                        const wasDeducted = isDeductedStatus(oldStatus);
                        const isDeducted = isDeductedStatus(newStatus);
                        
                        if (!wasDeducted && isDeducted) {
                            for (const item of items) {
                                const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variant_sku).single();
                                if (vData) {
                                    const newStock = Math.max(0, vData.stock_sulur - item.quantity);
                                    await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variant_sku);
                                    syncVariantStockToShopify(item.variant_sku);
                                    
                                    await supabase.from('stock_ledger').insert([{
                                        date: new Date().toISOString(),
                                        product_id: vData.product_id,
                                        variant_sku: item.variant_sku,
                                        warehouse: order.warehouse || 'Sulur',
                                        type: 'Sale',
                                        quantity: -item.quantity,
                                        balance_after: newStock
                                    }]);
                                }
                            }
                        } else if (wasDeducted && !isDeducted) {
                            for (const item of items) {
                                const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variant_sku).single();
                                if (vData) {
                                    const newStock = vData.stock_sulur + item.quantity;
                                    await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variant_sku);
                                    syncVariantStockToShopify(item.variant_sku);
                                    
                                    await supabase.from('stock_ledger').insert([{
                                        date: new Date().toISOString(),
                                        product_id: vData.product_id,
                                        variant_sku: item.variant_sku,
                                        warehouse: order.warehouse || 'Sulur',
                                        type: 'Return',
                                        quantity: item.quantity,
                                        balance_after: newStock
                                    }]);
                                }
                            }
                        } else if (newStatus === 'Cancelled') {
                            for (const item of items) {
                                adjustVariantStockOnShopify(item.variant_sku, item.quantity);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const deleteOrder = (orderId) => {
        let orderTotal = 0;
        let customerId = null;
        let status = null;
        let deletedOrderItems = [];
        let orderWarehouse = 'Sulur';
        
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            let products = [...prev.products];
            if (order) {
                orderTotal = order.totalValue;
                customerId = order.customer_id;
                status = order.status;
                deletedOrderItems = order.items || [];
                orderWarehouse = order.warehouse || 'Sulur';

                if (isDeductedStatus(status)) {
                    deletedOrderItems.forEach(item => {
                        products = products.map(p => {
                            const hasVar = p.variants.some(v => v.sku === item.variantSku);
                            if (hasVar) {
                                return {
                                    ...p,
                                    variants: p.variants.map(v => {
                                        if (v.sku === item.variantSku) {
                                            const stock = { ...v.stock };
                                            const wh = orderWarehouse;
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
            }
            return {
                ...prev,
                products,
                orders: prev.orders.filter(o => o.id !== orderId)
            };
        });

        // Trigger customer stats update if deleting a completed order
        if (status === "Completed" && customerId) {
            updateCustomerStats(customerId, -orderTotal, -1);
        }

        logActivity("order", `Order ${orderId} removed from records.`);
        showToast(`Order ${orderId} deleted.`);

        if (supabase) {
            (async () => {
                try {
                    if (isDeductedStatus(status) && deletedOrderItems.length > 0) {
                        for (const item of deletedOrderItems) {
                            const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variantSku).single();
                            if (vData) {
                                const newStock = vData.stock_sulur + item.quantity;
                                await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variantSku);
                                syncVariantStockToShopify(item.variantSku);
                                
                                await supabase.from('stock_ledger').insert([{
                                    date: new Date().toISOString(),
                                    product_id: vData.product_id,
                                    variant_sku: item.variantSku,
                                    warehouse: orderWarehouse,
                                    type: 'Return',
                                    quantity: item.quantity,
                                    balance_after: newStock
                                }]);
                            }
                        }
                    }
                    await supabase.from('orders').delete().eq('id', orderId);
                } catch (e) {
                    console.error("Supabase Error during order deletion:", e);
                }
            })();
        }
    };

    const editOrder = async (updatedOrder) => {
        let oldOrder = null;
        let requiresCustomerUpdate = false;
        let customerStatsDiff = { value: 0, count: 0 };
        
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
        const enrichedOrder = { ...updatedOrder, items: enrichedItems };
        
        setState(prev => {
            oldOrder = prev.orders.find(o => o.id === enrichedOrder.id);
            if (!oldOrder) return prev;

            let products = [...prev.products];

            // Revert old stock changes if deducted
            const oldDeducted = isDeductedStatus(oldOrder.status);
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
            const newDeducted = isDeductedStatus(enrichedOrder.status);
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

            // Clean up ledger and generate new ledger entries
            let newLedger = (prev.stockLedger || []).filter(entry => entry.productId !== (oldOrder ? oldOrder.id : ''));
            if (isDeductedStatus(enrichedOrder.status)) {
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
                orders: newOrders
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
                const shippingFee = parseFloat(enrichedOrder.shipping_fee) || 0;
                const depositAmount = parseFloat(enrichedOrder.deposit) || 0;
                const codAmount = Math.max(0, orderTotal - depositAmount);
                const netProductsTotal = Math.max(0, orderTotal - shippingFee);
                const productValueAmount = netProductsTotal < 1000 ? netProductsTotal + 100 : netProductsTotal;
                
                const totalQty = enrichedOrder.items.reduce((sum, item) => sum + (item.quantity || 0), 0);
                const itemsDescription = enrichedOrder.items.map(item => {
                    const prodName = item.productName || item.variantSku;
                    const optName = item.variantName || '';
                    const displayName = formatProductDisplayName(prodName, optName);
                    return `${item.quantity}x ${displayName}`;
                }).join(", ").substring(0, 120);

                const fullName = (enrichedOrder.client || "").trim();
                const nameParts = fullName.split(/\s+/);
                const firstName = nameParts[0] || "العميل";
                const lastName = nameParts.slice(1).join(" ") || ".";

                const bostaPayload = {
                    cod: codAmount,
                    dropOffAddress: {
                        city: addressObj.bostaCityName,
                        districtId: addressObj.bostaDistrictId,
                        zoneId: addressObj.bostaZoneId,
                        firstLine: addressObj.detailAddress || addressObj.bostaCityName
                    },
                    specs: {
                        packageType: "Small",
                        packageDetails: {
                            itemsCount: totalQty,
                            description: itemsDescription
                        }
                    },
                    goodsInfo: {
                        amount: productValueAmount
                    },
                    receiver: {
                        firstName: firstName,
                        lastName: lastName,
                        phone: addressObj.phone,
                        ...(addressObj.secondPhone && { secondPhone: addressObj.secondPhone.replace(/\D/g, '') })
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
                    showToast("تم تحديث الشحنة في بوسطة بنجاح", "success");
                }
            } catch (e) {
                showAlert("حدث خطأ أثناء التواصل مع بوسطة لتحديث الشحنة.", "warning");
            }
        }

        logActivity("order", `Order ${enrichedOrder.id} updated.`);
        showToast(`Order ${enrichedOrder.id} updated.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').update({
                        client: enrichedOrder.client,
                        customer_id: enrichedOrder.customer_id || null,
                        date: enrichedOrder.date,
                        warehouse: enrichedOrder.warehouse || 'Sulur',
                        status: enrichedOrder.status,
                        total_value: enrichedOrder.totalValue,
                        discount_type: enrichedOrder.discount_type || null,
                        discount_value: enrichedOrder.discount_value || 0,
                        applied_coupon_code: enrichedOrder.applied_coupon_code || null,
                        address: enrichedOrder.address || null,
                        governorate: enrichedOrder.governorate || null,
                        deposit: enrichedOrder.deposit || 0,
                        deposit_receiver_id: enrichedOrder.depositReceiverId || null,
                        deposit_status: enrichedOrder.depositStatus || 'confirmed',
                        shipping_fee: enrichedOrder.shipping_fee || 0,
                        created_by: enrichedOrder.createdBy || null,
                        shopify_order_id: enrichedOrder.shopifyOrderId || null,
                        source: enrichedOrder.source || 'manual',
                        payment_method: enrichedOrder.paymentMethod || null
                    }).eq('id', enrichedOrder.id);

                    await supabase.from('order_items').delete().eq('order_id', enrichedOrder.id);
                    if (enrichedOrder.items && enrichedOrder.items.length > 0) {
                        const items = enrichedOrder.items.map(item => ({
                            order_id: enrichedOrder.id,
                            variant_sku: item.variantSku,
                            quantity: item.quantity,
                            price: item.price,
                            cost_at_time_of_sale: item.costAtTimeOfSale
                        }));
                        await supabase.from('order_items').insert(items);
                    }

                    // Sync databases stock variants
                    setTimeout(async () => {
                        const oldSKUs = (oldOrder ? oldOrder.items : []).map(i => i.variantSku);
                        const newSKUs = enrichedOrder.items.map(i => i.variantSku);
                        const allSKUs = Array.from(new Set([...oldSKUs, ...newSKUs]));
                        
                        for (const sku of allSKUs) {
                            let stockQty = 0;
                            setState(currState => {
                                const prod = currState.products.find(p => p.variants.some(v => v.sku === sku));
                                if (prod) {
                                    const vr = prod.variants.find(v => v.sku === sku);
                                    if (vr) stockQty = vr.stock?.['Sulur'] || 0;
                                }
                                return currState;
                            });
                            await supabase.from('product_variants').update({ stock_sulur: stockQty }).eq('sku', sku);
                            syncVariantStockToShopify(sku);
                        }
                    }, 500);

                } catch (e) {
                    console.error("Supabase Error:", e);
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
                newLedger = [{
                    date: waste.date,
                    productId: prod.id,
                    variantSku: waste.variantSku,
                    warehouse: waste.warehouse,
                    type: "Waste",
                    quantity: -waste.quantity,
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
                    const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', waste.variantSku).single();
                    if (vData) {
                        const newStock = Math.max(0, vData.stock_sulur - waste.quantity);
                        await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', waste.variantSku);
                        syncVariantStockToShopify(waste.variantSku);
                        
                        await supabase.from('wastes').insert([{
                            date: waste.date,
                            product_id: vData.product_id,
                            variant_sku: waste.variantSku,
                            quantity: waste.quantity,
                            reason: waste.reason || "Damaged/Spoiled"
                        }]);

                        await supabase.from('stock_ledger').insert([{
                            date: waste.date,
                            product_id: vData.product_id,
                            variant_sku: waste.variantSku,
                            warehouse: waste.warehouse || 'Sulur',
                            type: 'Waste',
                            quantity: -waste.quantity,
                            balance_after: newStock
                        }]);
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
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

    const restoreStoreData = (restoredState) => {
        if (restoredState.products && restoredState.suppliers && restoredState.orders) {
            setState(restoredState);
            logActivity("auth", "Database restored from file backup.");
            showToast("Database restored successfully!");
            setCurrentView("dashboard");
        } else {
            showToast("Invalid backup file format.", "error");
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
                newLedger = [{
                    date: new Date().toISOString(),
                    productId: prod.id,
                    variantSku: variantSku,
                    warehouse: warehouse,
                    type: "Correction",
                    quantity: type === 'increase' ? parseInt(quantity) : -parseInt(quantity),
                    balanceAfter: currentBal
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
                    const { data: vData } = await supabase.from('product_variants').select('stock_sulur').eq('sku', variantSku).single();
                    if (vData) {
                        const amt = parseInt(quantity) || 0;
                        const newStock = Math.max(0, vData.stock_sulur + (type === 'increase' ? amt : -amt));
                        await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', variantSku);
                        syncVariantStockToShopify(variantSku);
                        
                        await supabase.from('stock_ledger').insert([{
                            date: new Date().toISOString(),
                            product_id: productId,
                            variant_sku: variantSku,
                            warehouse: warehouse,
                            type: 'Correction',
                            quantity: type === 'increase' ? amt : -amt,
                            balance_after: newStock
                        }]);
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
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
                    const { data: vData } = await supabase.from('product_variants').select('stock_sulur, average_cost, wholesale_price').eq('sku', variantSku).single();
                    if (vData) {
                        const amtNum = parseInt(quantity) || 0;
                        const costNum = parseFloat(unitCost) || 0;
                        const oldStock = vData.stock_sulur || 0;
                        const newStock = oldStock + amtNum;
                        
                        const oldAvgCost = vData.average_cost || vData.wholesale_price || 0;
                        let newAvgCost = oldAvgCost;
                        
                        if (newStock > 0) {
                            newAvgCost = ((oldStock * oldAvgCost) + (amtNum * costNum)) / newStock;
                        }
                        
                        await supabase.from('product_variants').update({ 
                            stock_sulur: newStock,
                            average_cost: newAvgCost
                        }).eq('sku', variantSku);
                        
                        syncVariantStockToShopify(variantSku);
                        
                        await supabase.from('stock_ledger').insert([{
                            date: new Date().toISOString(),
                            product_id: productId,
                            variant_sku: variantSku,
                            warehouse: warehouse,
                            type: 'Restock',
                            quantity: amtNum,
                            balance_after: newStock,
                            unit_cost: costNum,
                            total_cost: costNum * amtNum,
                            notes: notes
                        }]);
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
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
                        const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id, average_cost, wholesale_price').eq('sku', item.variantSku).single();
                        if (vData) {
                            const currentStock = vData.stock_sulur || 0;
                            const currentAvgCost = parseFloat(vData.average_cost) || parseFloat(vData.wholesale_price) || 0;
                            const newQty = item.quantity || 0;
                            const purchaseUnitCost = parseFloat(item.cost) || 0;
                            
                            let newAvgCost = currentAvgCost;
                            if (currentStock <= 0) {
                                newAvgCost = purchaseUnitCost;
                            } else {
                                newAvgCost = ((currentStock * currentAvgCost) + (newQty * purchaseUnitCost)) / (currentStock + newQty);
                            }

                            const newStock = currentStock + newQty;
                            await supabase.from('product_variants').update({ 
                                stock_sulur: newStock,
                                average_cost: newAvgCost
                            }).eq('sku', item.variantSku);
                            
                            await supabase.from('stock_ledger').insert([{
                                date: purchaseOrder.date,
                                product_id: vData.product_id,
                                variant_sku: item.variantSku,
                                warehouse: purchaseOrder.warehouse || 'Sulur',
                                type: 'Purchase',
                                quantity: item.quantity,
                                balance_after: newStock
                            }]);
                        }
                    }

                    const { data: sData } = await supabase.from('suppliers').select('debt').eq('id', purchaseOrder.supplierId).single();
                    if (sData) {
                        const newDebt = parseFloat(sData.debt) + purchaseOrder.totalCost;
                        await supabase.from('suppliers').update({ debt: newDebt }).eq('id', purchaseOrder.supplierId);
                    }
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const approveOrderWithBosta = async (orderId, bostaMetadata, depositAmount = 0, depositReceiverId = null, depositStatus = 'confirmed') => {
        if (!supabase) {
            showToast("قاعدة البيانات غير متصلة.", "error");
            return;
        }

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
                showToast(language === 'ar' ? `فشل ربط بوسطة: ${errMsg}` : `Bosta Sync Failed: ${errMsg}`, "error");
                return;
            }

            // Update deposit details in local database
            await supabase.from('orders').update({
                deposit: depositAmount,
                deposit_receiver_id: depositReceiverId,
                deposit_status: depositStatus
            }).eq('id', orderId);

            // Update local state first (deposit + address + status) immediately to avoid any race condition
            // where Realtime events could flash 'Pending' status on the UI.
            setState(prev => ({
                ...prev,
                orders: (prev.orders || []).map(o => o.id === orderId ? {
                    ...o,
                    status: 'Shipped',
                    address: data.updatedAddress || o.address,
                    deposit: depositAmount,
                    depositReceiverId: depositReceiverId,
                    depositStatus: depositStatus
                } : o)
            }));

            // The Edge Function has already updated the order address with Bosta tracking code in DB.
            // Now, we update status to 'Shipped' in DB, which deducts stock and records WAC.
            updateOrderStatus(orderId, 'Shipped', data.updatedAddress);
            
            showToast(
                language === 'ar' 
                    ? `تمت الموافقة وتوليد البوليصة رقم: ${data.trackingNumber} بنجاح!` 
                    : `Order approved! Waybill #${data.trackingNumber} created successfully!`, 
                "success"
            );
            
        } catch (err) {
            console.error("approveOrderWithBosta exception:", err);
            showToast(language === 'ar' ? `خطأ في النظام: ${err.message}` : `System Error: ${err.message}`, "error");
        }
    };

    // Update deposit status (confirm or reject)
    const updateDepositStatus = async (orderId, status) => {
        setState(prev => ({
            ...prev,
            orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: status } : o)
        }));
        if (supabase) {
            try {
                const { error } = await supabase.from('orders').update({ deposit_status: status }).eq('id', orderId);
                if (error) throw error;
                showToast(status === 'confirmed' ? "تم تأكيد استلام العربون" : "تم تسجيل عدم استلام العربون", "success");
                logActivity("order", `Order ${orderId} deposit status updated to ${status}.`);

                if (status === 'confirmed') {
                    const { data: orderDb } = await supabase.from('orders').select('*').eq('id', orderId).single();
                    if (orderDb) {
                        if (orderDb.status.toLowerCase() === 'cancelled') {
                            await supabase.from('orders').update({ deposit_refund_status: 'awaiting_return' }).eq('id', orderId);
                            setState(prev => ({
                                ...prev,
                                orders: (prev.orders || []).map(o => o.id === orderId ? { ...o, depositStatus: 'confirmed', depositRefundStatus: 'awaiting_return' } : o)
                            }));
                            showToast("تم تأكيد الاستلام، وبما أن الطلب ملغى فلن يُرسل لشركة الشحن. يُرجى التوجه لقائمة المرتجعات لإرجاع العربون.", "info");
                        } else if (orderDb.status === 'Pending') {
                            try {
                                const addrObj = orderDb.address ? JSON.parse(orderDb.address) : {};
                                // Only auto-dispatch to Bosta if Bosta was enabled (syncWithBosta !== false) and city code exists
                                if (addrObj && addrObj.bostaCityCode && addrObj.syncWithBosta !== false) {
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
                                    await approveOrderWithBosta(orderId, bostaMetadata, parseFloat(orderDb.deposit) || 0, orderDb.deposit_receiver_id, 'confirmed');
                                } else {
                                    // Bosta sync was OFF: approve order locally on system without dispatching to Bosta
                                    updateOrderStatus(orderId, 'Completed');
                                    showToast("تم تأكيد العربون واعتماد الطلب على السيستم بنجاح (بدون إرسال لبوسطة).", "success");
                                }
                            } catch (e) {
                                console.error("Failed to process confirmed deposit order:", e);
                            }
                        }
                    }
                }
            } catch (err) {
                console.error("Error updating deposit status:", err);
                showToast("حدث خطأ أثناء تحديث حالة العربون", "error");
            }
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
    // Accepts a screenshot file or image as proof.
    const confirmDepositRefund = async (orderId, screenshotFile) => {
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
                    depositRefundStatus: 'returned',
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o)
            }));

            // Persist to DB
            const updatePayload = {
                deposit_refund_status: 'returned'
            };
            if (screenshotUrl) {
                updatePayload.deposit_refund_screenshot = screenshotUrl;
                updatePayload.deposit_refund_proof_url = screenshotUrl;
            }

            const { error: dbErr } = await supabase.from('orders').update(updatePayload).eq('id', orderId);
            if (dbErr) {
                // Retry with standard column if composite error
                await supabase.from('orders').update({
                    deposit_refund_status: 'returned',
                    deposit_refund_proof_url: screenshotUrl
                }).eq('id', orderId);
            }

            logActivity('order', `Deposit refund confirmed for cancelled order ${orderId} with screenshot proof.`);
            showToast('تم تأكيد إعادة العربون بنجاح ✅', 'success');
            return true;
        } catch (err) {
            console.error('confirmDepositRefund error:', err);
            showToast(`حدث خطأ: ${err.message}`, 'error');
            return false;
        }
    };

    // Shortcut: Confirm deposit receipt AND refund return in one click (for orders cancelled while deposit was pending)
    const confirmDepositAndRefund = async (orderId, screenshotFile) => {
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
                    depositStatus: 'confirmed',
                    depositRefundStatus: 'returned',
                    depositRefundScreenshot: screenshotUrl || o.depositRefundScreenshot
                } : o)
            }));

            // Persist to DB
            const updatePayload = {
                deposit_status: 'confirmed',
                deposit_refund_status: 'returned'
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

            logActivity('order', `Shortcut confirmed deposit receipt and refund return for cancelled order ${orderId}.`);
            showToast('تم تأكيد استلام وإعادة العربون بنجاح ✅', 'success');
            return true;
        } catch (err) {
            console.error('confirmDepositAndRefund error:', err);
            showToast(`حدث خطأ: ${err.message}`, 'error');
        }
    };

    const syncBostaStatus = async (orderId, trackingNumber) => {
        if (!supabase) {
            showToast("الاتصال بالسيرفر غير متاح.", "error");
            return null;
        }

        try {
            showToast(language === 'ar' ? "جاري تحديث حالة التوصيل من بوسطة..." : "Syncing delivery status from Bosta...", "info");
            
            const { data, error } = await supabase.functions.invoke('sync-bosta-status', {
                body: { trackingNumber, orderId }
            });

            if (error || !data || !data.success) {
                console.error("Bosta sync failed:", error || data);
                const errMsg = data?.error || error?.message || "خطأ غير معروف";
                showToast(`فشل تحديث الحالة: ${errMsg}`, "error");
                return null;
            }

            // Update local state with the new address and status
            setState(prev => {
                const order = prev.orders.find(o => o.id === orderId);
                if (!order) return prev;
                
                let products = [...prev.products];
                const oldStatus = order.status;
                const newStatus = data.newStatus;
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
                showToast(`تم تحديث الحالة: ${data.newStateName}`, "success");
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
                    const alreadyLinked = localProducts.some(p => p.shopify_id === shopifyProductId);
                    if (alreadyLinked) continue;

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
                            
                            let variantName = sv.title;
                            if (variantName === 'Default Title') variantName = 'Standard Option';

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
                        averageCost: parseFloat(v.average_cost) || parseFloat(v.wholesale_price) || 0
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

    const syncVariantStockToShopify = async (variantSku) => {
        if (!supabase) return;
        try {
            const { data: variant } = await supabase
                .from('product_variants')
                .select('shopify_id, stock_sulur')
                .eq('sku', variantSku)
                .single();

            if (variant && variant.shopify_id) {
                console.log(`Syncing stock for SKU ${variantSku} to Shopify: ${variant.stock_sulur}`);
                await supabase.functions.invoke('swift-processor', {
                    body: {
                        action: 'update_stock',
                        shopify_variant_id: variant.shopify_id,
                        stock: variant.stock_sulur
                    }
                });
            }
        } catch (e) {
            console.error("Failed to sync variant stock to Shopify:", e);
        }
    };

    const adjustVariantStockOnShopify = async (variantSku, adjustment) => {
        if (!supabase) return;
        try {
            const { data: variant } = await supabase
                .from('product_variants')
                .select('shopify_id')
                .eq('sku', variantSku)
                .single();

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
    return (
        <AppContext.Provider value={{
            state,
            currentView,
            setCurrentView,
            toast,
            restockVariant,
            showToast,
            shopifyNotification,
            setShopifyNotification,
            approveOrderWithBosta,
            syncBostaStatus,
            authLogin,
            authSignup,
            updateUserPermissions,
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
            addInfluencer,
            editInfluencer,
            deleteInfluencer,
            restoreStoreData,
            logActivity,
            language,
            setLanguage,
            theme,
            setTheme,
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
        categories: "Categories",
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
        lowStock: "Low stock",
        packets: "Packets",
        units: "Units",
        brandName: "o5taboad sror",
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
        categories: "الأقسام",
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
