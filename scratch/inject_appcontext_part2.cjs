const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/context/AppContext.jsx');
let content = fs.readFileSync(file, 'utf-8');

const additionalActions = `
    // Customers CRUD Actions
    const addCustomer = async (customer) => {
        if (!supabase) return;
        const newCustomer = { ...customer, id: customer.id || crypto.randomUUID() };
        setState(prev => ({ ...prev, customers: [newCustomer, ...prev.customers] }));
        
        try {
            await supabase.from('customers').insert([newCustomer]);
            showToast(\`Customer '\${newCustomer.name}' added successfully.\`);
        } catch (e) {
            console.error("Supabase Error:", e);
        }
        return newCustomer;
    };

    const editCustomer = async (updatedCustomer) => {
        if (!supabase) return;
        setState(prev => ({
            ...prev,
            customers: prev.customers.map(c => c.id === updatedCustomer.id ? updatedCustomer : c)
        }));
        
        try {
            await supabase.from('customers').update(updatedCustomer).eq('id', updatedCustomer.id);
            showToast(\`Customer '\${updatedCustomer.name}' updated successfully.\`);
        } catch (e) {
            console.error("Supabase Error:", e);
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

    // Coupons CRUD Actions
    const addCoupon = async (coupon) => {
        if (!supabase) return;
        setState(prev => ({ ...prev, coupons: [coupon, ...prev.coupons] }));
        try {
            await supabase.from('coupons').insert([coupon]);
            showToast(\`Coupon '\${coupon.code}' added successfully.\`);
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
            showToast(\`Coupon '\${updatedCoupon.code}' updated successfully.\`);
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
            showToast(\`Coupon deleted.\`);
        } catch (e) {
            console.error("Supabase Error:", e);
        }
    };

    const validateCoupon = (code, cartTotal) => {
        const coupon = state.coupons.find(c => c.code === code && c.is_active);
        if (!coupon) return { valid: false, error: "Invalid or inactive coupon." };
        if (coupon.expiry_date && new Date(coupon.expiry_date) < new Date()) return { valid: false, error: "Coupon expired." };
        if (coupon.usage_limit && coupon.times_used >= coupon.usage_limit) return { valid: false, error: "Usage limit reached." };
        if (coupon.min_order_value && cartTotal < coupon.min_order_value) return { valid: false, error: \`Minimum order value is \${coupon.min_order_value}.\` };
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
`;

content = content.replace(/\s*\/\/\s*Products CRUD Actions/m, additionalActions);

// Also need to add variables to Provider
content = content.replace(
    /saveStoreConfig,/,
    `saveStoreConfig,
            addCustomer,
            editCustomer,
            getOrCreateCustomer,
            addCoupon,
            editCoupon,
            deleteCoupon,
            validateCoupon,
            applyCouponUsage,`
);

fs.writeFileSync(file, content);
console.log("AppContext Part 2 updated successfully!");
