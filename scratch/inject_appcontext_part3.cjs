const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/context/AppContext.jsx');
let content = fs.readFileSync(file, 'utf-8');

const startIndex = content.indexOf('// Orders CRUD Actions');
const endIndex = content.indexOf('// Suppliers CRUD Actions');

const newOrdersCode = `// Orders CRUD Actions
    const addOrder = async (order) => {
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

        // Trigger customer stats update if completed
        if (order.status === "Completed" && order.customer_id) {
            updateCustomerStats(order.customer_id, order.totalValue, 1);
        }

        logActivity("order", \`New Order \${order.id} registered.\`);
        showToast(\`Order \${order.id} recorded.\`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').insert([{
                        id: order.id,
                        client: order.client,
                        customer_id: order.customer_id || null,
                        date: order.date,
                        warehouse: order.warehouse || 'Sulur',
                        status: order.status,
                        total_value: order.totalValue,
                        discount_type: order.discount_type || null,
                        discount_value: order.discount_value || 0,
                        applied_coupon_code: order.applied_coupon_code || null,
                        address: order.address || null,
                        governorate: order.governorate || null,
                        deposit: order.deposit || 0,
                        shipping_fee: order.shipping_fee || 0,
                        created_by: order.createdBy || null
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
        let orderTotal = 0;
        let customerId = null;
        
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            if (!order) return prev;
            
            let products = [...prev.products];
            oldStatus = order.status;
            orderTotal = order.totalValue;
            customerId = order.customer_id;
            
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
                            date: new Date().toISOString().split('T')[0],
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
                            date: new Date().toISOString().split('T')[0],
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

        // Trigger customer stats update if transitioning to/from Completed
        if (oldStatus !== "Completed" && newStatus === "Completed" && customerId) {
            updateCustomerStats(customerId, orderTotal, 1);
        } else if (oldStatus === "Completed" && newStatus !== "Completed" && customerId) {
            updateCustomerStats(customerId, -orderTotal, -1);
        }

        logActivity("order", \`Order \${orderId} status changed to \${newStatus}.\`);
        showToast(\`Order status updated to \${newStatus}.\`);

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
                                        date: new Date().toISOString().split('T')[0],
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
                                        date: new Date().toISOString().split('T')[0],
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
        let orderTotal = 0;
        let customerId = null;
        let status = null;
        
        setState(prev => {
            const order = prev.orders.find(o => o.id === orderId);
            if(order) {
                orderTotal = order.totalValue;
                customerId = order.customer_id;
                status = order.status;
            }
            return {
                ...prev,
                orders: prev.orders.filter(o => o.id !== orderId)
            }
        });

        // Trigger customer stats update if deleting a completed order
        if (status === "Completed" && customerId) {
            updateCustomerStats(customerId, -orderTotal, -1);
        }

        logActivity("order", \`Order \${orderId} removed from records.\`);
        showToast(\`Order \${orderId} deleted.\`);

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

    const editOrder = (updatedOrder) => {
        let oldOrder = null;
        let requiresCustomerUpdate = false;
        let customerStatsDiff = { value: 0, count: 0 };
        
        setState(prev => {
            oldOrder = prev.orders.find(o => o.id === updatedOrder.id);
            if (!oldOrder) return prev;

            let products = [...prev.products];

            // Revert old stock changes if deducted
            const oldDeducted = oldOrder.status === "Completed" || oldOrder.status === "Partially Delivered";
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
            const newDeducted = updatedOrder.status === "Completed" || updatedOrder.status === "Partially Delivered";
            if (newDeducted) {
                updatedOrder.items.forEach(item => {
                    products = products.map(p => {
                        const hasVar = p.variants.some(v => v.sku === item.variantSku);
                        if (hasVar) {
                            return {
                                ...p,
                                variants: p.variants.map(v => {
                                    if (v.sku === item.variantSku) {
                                        const stock = { ...v.stock };
                                        const wh = updatedOrder.warehouse || "Sulur";
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

            // Check if customer stats need update (only if modifying a Completed order's total or changing status)
            if (oldOrder.status === "Completed" && updatedOrder.status === "Completed") {
                if (oldOrder.totalValue !== updatedOrder.totalValue) {
                    requiresCustomerUpdate = true;
                    customerStatsDiff.value = updatedOrder.totalValue - oldOrder.totalValue;
                }
            } else if (oldOrder.status !== "Completed" && updatedOrder.status === "Completed") {
                requiresCustomerUpdate = true;
                customerStatsDiff.value = updatedOrder.totalValue;
                customerStatsDiff.count = 1;
            } else if (oldOrder.status === "Completed" && updatedOrder.status !== "Completed") {
                requiresCustomerUpdate = true;
                customerStatsDiff.value = -oldOrder.totalValue;
                customerStatsDiff.count = -1;
            }

            const newOrders = prev.orders.map(o => o.id === updatedOrder.id ? updatedOrder : o);

            return {
                ...prev,
                products,
                orders: newOrders
            };
        });

        if (requiresCustomerUpdate && updatedOrder.customer_id) {
            updateCustomerStats(updatedOrder.customer_id, customerStatsDiff.value, customerStatsDiff.count);
        }

        logActivity("order", \`Order \${updatedOrder.id} updated.\`);
        showToast(\`Order \${updatedOrder.id} updated.\`);

        if (supabase) {
            (async () => {
                try {
                    await supabase.from('orders').update({
                        client: updatedOrder.client,
                        customer_id: updatedOrder.customer_id || null,
                        date: updatedOrder.date,
                        warehouse: updatedOrder.warehouse || 'Sulur',
                        status: updatedOrder.status,
                        total_value: updatedOrder.totalValue,
                        discount_type: updatedOrder.discount_type || null,
                        discount_value: updatedOrder.discount_value || 0,
                        applied_coupon_code: updatedOrder.applied_coupon_code || null,
                        address: updatedOrder.address || null,
                        governorate: updatedOrder.governorate || null,
                        deposit: updatedOrder.deposit || 0,
                        shipping_fee: updatedOrder.shipping_fee || 0,
                        created_by: updatedOrder.createdBy || null
                    }).eq('id', updatedOrder.id);

                    await supabase.from('order_items').delete().eq('order_id', updatedOrder.id);
                    if (updatedOrder.items && updatedOrder.items.length > 0) {
                        const items = updatedOrder.items.map(item => ({
                            order_id: updatedOrder.id,
                            variant_sku: item.variantSku,
                            quantity: item.quantity,
                            price: item.price
                        }));
                        await supabase.from('order_items').insert(items);
                    }

                    // Sync databases stock variants
                    setTimeout(async () => {
                        const oldSKUs = (oldOrder ? oldOrder.items : []).map(i => i.variantSku);
                        const newSKUs = updatedOrder.items.map(i => i.variantSku);
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
                        }
                    }, 500);

                } catch (e) {
                    console.error("Supabase Error:", e);
                }
            })();
        }
    };

    `;

content = content.substring(0, startIndex) + newOrdersCode + content.substring(endIndex);

fs.writeFileSync(file, content);
console.log("AppContext Part 3 updated successfully!");
