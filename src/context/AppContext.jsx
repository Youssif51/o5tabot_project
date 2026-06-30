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
                    parsed.products.some(p => p.variants && p.variants.some(v => v.sku === "MJ-CTC-35")) &&
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
    };

    const editProduct = (updatedProduct) => {
        setState(prev => ({
            ...prev,
            products: prev.products.map(p => p.id === updatedProduct.id ? updatedProduct : p)
        }));
        logActivity("stock", `Product '${updatedProduct.name}' details were updated.`);
        showToast(`Product '${updatedProduct.name}' updated.`);
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
    };

    const deleteMultipleProducts = (productIds) => {
        setState(prev => ({
            ...prev,
            products: prev.products.filter(p => !productIds.includes(p.id))
        }));
        logActivity("stock", `${productIds.length} products deleted in bulk.`);
        showToast(`${productIds.length} products deleted.`);
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
    };

    const updateOrderStatus = (orderId, newStatus) => {
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            if (!order) return prev;
            
            let products = [...prev.products];
            const oldStatus = order.status;
            
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
    };

    const deleteOrder = (orderId) => {
        setState(prev => ({
            ...prev,
            orders: prev.orders.filter(o => o.id !== orderId)
        }));
        logActivity("order", `Order ${orderId} removed from records.`);
        showToast(`Order ${orderId} deleted.`);
    };

    // Suppliers CRUD Actions
    const addSupplier = (supplier) => {
        setState(prev => ({
            ...prev,
            suppliers: [supplier, ...prev.suppliers]
        }));
        logActivity("supplier", `Registered new supplier partner '${supplier.name}'.`);
        showToast(`Supplier '${supplier.name}' registered.`);
    };

    const recordSupplierPayment = (supplierId, amount) => {
        setState(prev => {
            const suppliers = prev.suppliers.map(s => {
                if (s.id === supplierId) {
                    const pay = Math.min(s.debt, amount);
                    return {
                        ...s,
                        paid: s.paid + pay,
                        debt: Math.max(0, s.debt - pay)
                    };
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
