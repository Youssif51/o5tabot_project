import { supabase } from '../utils/supabase';
import React, { createContext, useState, useEffect } from 'react';

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
    activities: [],
    storeSettings: {
        name: "o5taboad store",
        address: "Egypt",
        currency: "EGP"
    },
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
                    { data: wastes, error: wErr }
                ] = await Promise.all([
                    supabase.from('products').select('*'),
                    supabase.from('product_variants').select('*'),
                    supabase.from('suppliers').select('*'),
                    supabase.from('orders').select('*'),
                    supabase.from('order_items').select('*'),
                    supabase.from('purchase_orders').select('*'),
                    supabase.from('purchase_items').select('*'),
                    supabase.from('stock_ledger').select('*'),
                    supabase.from('wastes').select('*')
                ]);

                if (pErr || vErr || sErr || oErr || oiErr || poErr || poiErr || lErr || wErr) {
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
                        stock: { Sulur: parseInt(v.stock_sulur) || 0 }
                    }));
                    return {
                        id: p.id,
                        name: p.name,
                        category: p.category,
                        unit: p.unit,
                        image: p.image,
                        createdDate: p.created_date,
                        description: p.description,
                        variants: pVars
                    };
                });

                const mappedSuppliers = (suppliers || []).map(s => ({
                    id: s.id,
                    name: s.name,
                    contact: s.contact,
                    phone: s.phone,
                    debt: parseFloat(s.debt) || 0,
                    paid: parseFloat(s.paid) || 0
                }));

                const mappedOrders = (orders || []).map(o => {
                    const items = (orderItems || []).filter(oi => oi.order_id === o.id).map(oi => ({
                        variantSku: oi.variant_sku,
                        quantity: parseInt(oi.quantity) || 0,
                        price: parseFloat(oi.price) || 0
                    }));
                    return {
                        id: o.id,
                        client: o.client,
                        date: o.date,
                        warehouse: o.warehouse,
                        status: o.status,
                        totalValue: parseFloat(o.total_value) || 0,
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

                setState(prev => ({
                    ...prev,
                    products: mappedProducts,
                    suppliers: mappedSuppliers,
                    orders: mappedOrders,
                    purchaseOrders: mappedPurchaseOrders,
                    wastes: mappedWastes,
                    stockLedger: mappedLedger
                }));
            } catch (err) {
                console.error("Supabase load error:", err);
            }
        };
        loadSupabaseData();
    }, []);

    const [currentView, setCurrentView] = useState("dashboard");
    const [toast, setToast] = useState({ visible: false, message: "", type: "success" });
    const [language, setLanguage] = useState(() => localStorage.getItem("octabot_lang") || "en");
    const [theme, setTheme] = useState(() => localStorage.getItem("octabot_theme") || "dark");

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

    const authLogin = (username) => {
        const namePart = username.includes("@") ? username.split("@")[0] : username;
        const user = {
            name: namePart || "sfsf",
            role: "Store Manager",
            avatar: (namePart ? namePart.substring(0, 1).toUpperCase() : "A")
        };
        setState(prev => ({ ...prev, currentUser: user }));
        logActivity("auth", `User '${user.name}' signed in.`);
        showToast(`Welcome back, ${user.name}!`);
        setCurrentView("dashboard");
    };

    const authSignup = (storeName, email) => {
        const namePart = email.split("@")[0] || "Manager";
        const user = {
            name: namePart,
            role: "Octabot Admin",
            avatar: (storeName ? storeName.substring(0, 1).toUpperCase() : "O")
        };
        setState(prev => ({
            ...prev,
            currentUser: user,
            storeSettings: { ...prev.storeSettings, name: storeName }
        }));
        logActivity("auth", `Registered store and workspace for ${storeName}.`);
        showToast(`Store '${storeName}' Registered Successfully!`);
        setCurrentView("dashboard");
    };

    const authLogout = () => {
        setState(prev => ({ ...prev, currentUser: null }));
        showToast("Logged out successfully.");
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
                    await supabase.from('products').insert([{
                        id: product.id,
                        name: product.name,
                        category: product.category,
                        unit: product.unit,
                        image: product.image,
                        created_date: product.createdDate,
                        description: product.description
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
                            stock_sulur: v.stock.Sulur || 0
                        }));
                        await supabase.from('product_variants').insert(vars);
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
                    await supabase.from('products').update({
                        name: updatedProduct.name,
                        category: updatedProduct.category,
                        unit: updatedProduct.unit,
                        image: updatedProduct.image,
                        description: updatedProduct.description
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
                                stock_sulur: v.stock.Sulur || 0
                            });
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
                    await supabase.from('products').delete().eq('id', productId);
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    const deleteMultipleProducts = (productIds) => {
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => !productIds.includes(p.id))
        }));
        logActivity("stock", `${productIds.length} products deleted in bulk.`);
        showToast(`${productIds.length} products deleted.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('products').delete().in('id', productIds);
                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    // Orders CRUD Actions
    const addOrder = (order) => {
        setState(prev => {
            let products = [...prev.products];
            if (order.status === "Completed" || order.status === "Partially Delivered") {
                order.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        if (stock[order.warehouse] !== undefined) {
                                            stock[order.warehouse] = Math.max(0, stock[order.warehouse] - item.quantity);
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
            if (order.status === "Completed" || order.status === "Partially Delivered") {
                order.items.forEach(item => {
                    const prod = products.find(p => p.variants.some(v => v.sku === item.variantSku));
                    if (prod) {
                        const vr = prod.variants.find(v => v.sku === item.variantSku);
                        const currentBal = vr ? (vr.stock[order.warehouse] || 0) : 0;
                        newLedger = [{
                            date: order.date,
                            productId: prod.id,
                            variantSku: item.variantSku,
                            warehouse: order.warehouse,
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
                orders: [order, ...prev.orders]
            };
        });
        logActivity("order", `New Order ${order.id} registered for ${order.client}.`);
        showToast(`Order ${order.id} recorded.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').insert([{
                        id: order.id,
                        client: order.client,
                        date: order.date,
                        warehouse: order.warehouse || 'Sulur',
                        status: order.status,
                        total_value: order.totalValue
                    }]);

                    if (order.items && order.items.length > 0) {
                        const items = order.items.map(item => ({
                            order_id: order.id,
                            variant_sku: item.variantSku,
                            quantity: item.quantity,
                            price: item.price
                        }));
                        await supabase.from('order_items').insert(items);
                    }

                    if (order.status === "Completed" || order.status === "Partially Delivered") {
                        for (const item of order.items) {
                            const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variantSku).single();
                            if (vData) {
                                const newStock = Math.max(0, vData.stock_sulur - item.quantity);
                                await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variantSku);
                                
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

    const updateOrderStatus = (orderId, newStatus) => {
        let oldStatus = "";
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            if (!order) return prev;
            
            let products = [...prev.products];
            oldStatus = order.status;
            
            const wasDeducted = oldStatus === "Completed" || oldStatus === "Partially Delivered";
            const isDeducted = newStatus === "Completed" || newStatus === "Partially Delivered";
            
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
                            date: new Date().toISOString().substring(0, 10),
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
                            date: new Date().toISOString().substring(0, 10),
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
                orders: prev.orders.map(o => o.id === orderId ? { ...o, status: newStatus } : o)
            };
        });
        logActivity("order", `Order ${orderId} status changed to ${newStatus}.`);
        showToast(`Order status updated to ${newStatus}.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').update({ status: newStatus }).eq('id', orderId);
                    
                    const { data: order } = await supabase.from('orders').select('*').eq('id', orderId).single();
                    const { data: items } = await supabase.from('order_items').select('*').eq('order_id', orderId);
                    
                    if (order && items && items.length > 0) {
                        const wasDeducted = oldStatus === "Completed" || oldStatus === "Partially Delivered";
                        const isDeducted = newStatus === "Completed" || newStatus === "Partially Delivered";
                        
                        if (!wasDeducted && isDeducted) {
                            for (const item of items) {
                                const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variant_sku).single();
                                if (vData) {
                                    const newStock = Math.max(0, vData.stock_sulur - item.quantity);
                                    await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variant_sku);
                                    
                                    await supabase.from('stock_ledger').insert([{
                                        date: new Date().toISOString().substring(0, 10),
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
                                    
                                    await supabase.from('stock_ledger').insert([{
                                        date: new Date().toISOString().substring(0, 10),
                                        product_id: vData.product_id,
                                        variant_sku: item.variant_sku,
                                        warehouse: order.warehouse || 'Sulur',
                                        type: 'Return',
                                        quantity: item.quantity,
                                        balance_after: newStock
                                    }]);
                                }
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
        setState(prev => ({
            ...prev,
            orders: prev.orders.filter(o => o.id !== orderId)
        }));
        logActivity("order", `Order ${orderId} removed from records.`);
        showToast(`Order ${orderId} deleted.`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').delete().eq('id', orderId);
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
    const saveStoreConfig = (name, address, currency) => {
        setState(prev => ({
            ...prev,
            storeSettings: { name, address, currency }
        }));
        logActivity("stock", `Updated configurations. Base currency: ${currency}.`);
        showToast("Store settings saved successfully.");
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
                        date: new Date().toISOString().substring(0, 10),
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
                    date: new Date().toISOString().substring(0, 10),
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
                        
                        await supabase.from('stock_ledger').insert([{
                            date: new Date().toISOString().substring(0, 10),
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
                                    stock[purchaseOrder.warehouse] = (stock[purchaseOrder.warehouse] || 0) + item.quantity;
                                    return { ...v, stock };
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
                        const { data: vData } = await supabase.from('product_variants').select('stock_sulur, product_id').eq('sku', item.variantSku).single();
                        if (vData) {
                            const newStock = vData.stock_sulur + item.quantity;
                            await supabase.from('product_variants').update({ stock_sulur: newStock }).eq('sku', item.variantSku);
                            
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

    return (
        <AppContext.Provider value={{
            state,
            currentView,
            setCurrentView,
            toast,
            showToast,
            authLogin,
            authSignup,
            authLogout,
            addProduct,
            editProduct,
            deleteProduct,
            deleteMultipleProducts,
            addOrder,
            updateOrderStatus,
            deleteOrder,
            addSupplier,
            recordSupplierPayment,
            recordPurchaseOrder,
            recordWaste,
            recordStockAdjustment,
            saveStoreConfig,
            restoreStoreData,
            logActivity,
            language,
            setLanguage,
            theme,
            setTheme,
            t
        }}>
            {children}
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
        inSulur: "Bosta",
        inSinganallur: "Singanallur",
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
        supabaseTasks: "Supabase Tasks",
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
        expiry: "Expiry"
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
        inSulur: "بوسطة",
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
        supabaseTasks: "المهام السحابية",
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
        expiry: "تاريخ الصلاحية"
    }
};
