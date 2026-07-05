const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/orders/RecordOrderModal.jsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add context variables
content = content.replace(
    /const \{ state, addOrder, editOrder, showToast, t \} = useContext\(AppContext\);/,
    `const { state, addOrder, editOrder, showToast, t, validateCoupon } = useContext(AppContext);`
);

// 2. Add new states
content = content.replace(
    /const \[client, setClient\] = useState\(''\);/,
    `const [client, setClient] = useState('');\n    const [customerId, setCustomerId] = useState(null);\n    const [couponCode, setCouponCode] = useState('');\n    const [couponValid, setCouponValid] = useState(false);\n    const [couponDiscountValue, setCouponDiscountValue] = useState(0);\n    const [couponDiscountType, setCouponDiscountType] = useState('');`
);

// 3. Update parseAddressData
content = content.replace(
    /let customerCode = 'CUS-0000';/,
    `let customerCode = 'CUS-0000';\n        let appliedCoupon = '';`
);
content = content.replace(
    /customerCode = parsed\.customerCode \|\| 'CUS-0000';/,
    `customerCode = parsed.customerCode || 'CUS-0000';\n                appliedCoupon = parsed.appliedCoupon || '';`
);
content = content.replace(
    /return \{ detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode \};/,
    `return { detailAddress, phone, vatEnabled, orderDiscountPercent, customerCode, appliedCoupon };`
);

// 4. Update useEffect reset
content = content.replace(
    /setOrderDiscountPercent\(parsed\.orderDiscountPercent \|\| ''\);/,
    `setOrderDiscountPercent(parsed.orderDiscountPercent || '');\n                    setCouponCode(parsed.appliedCoupon || '');\n                    setCustomerId(order.customer_id || null);`
);

content = content.replace(
    /setDeposit\(''\);\s*}/,
    `setDeposit('');\n                setCustomerId(null);\n                setCouponCode('');\n                setCouponValid(false);\n                setCouponDiscountValue(0);\n                setCouponDiscountType('');\n            }`
);

// 5. Update existingCustomers logic to use state.customers
content = content.replace(
    /const existingCustomers = Array\.from\(new Set\(\(state\.orders \|\| \[\]\)\.map\(o => o\.client\)\)\)\.filter\(Boolean\);/,
    `const existingCustomers = state.customers ? state.customers.map(c => c.name) : Array.from(new Set((state.orders || []).map(o => o.client))).filter(Boolean);`
);

// 6. Update handleSelectCustomer to load from customers if available
content = content.replace(
    /const lastOrder = \(state\.orders \|\| \[\]\)\.find\(o => o\.client === name\);/,
    `const cust = state.customers?.find(c => c.name === name);\n        if (cust) {\n            setCustomerId(cust.id);\n            setPhone(cust.phone || '');\n            setGovernorate(cust.governorate || '');\n            setAddress(cust.address || '');\n        } else {\n            setCustomerId(null);\n        }\n        const lastOrder = (state.orders || []).find(o => o.client === name);`
);

// 7. Update Financial Math to apply coupon
content = content.replace(
    /const orderDiscountAmount = totalProductsSubtotal \* \(orderDiscountPercentVal \/ 100\);/,
    `let couponDisc = 0;\n    if (couponValid) {\n        if (couponDiscountType === 'Percentage') {\n            couponDisc = totalProductsSubtotal * (couponDiscountValue / 100);\n        } else {\n            couponDisc = couponDiscountValue;\n        }\n    }\n    const orderDiscountAmount = (totalProductsSubtotal * (orderDiscountPercentVal / 100)) + couponDisc;`
);

// 8. Add Coupon UI in Step 3
content = content.replace(
    /(\s*)<div className="form-group">\s*<label className="form-label">سعر الشحن \(\{currency\}\)<\/label>/,
    `$1<div className="form-group">\n                                    <label className="form-label">كود الخصم (كوبون)</label>\n                                    <div style={{ display: 'flex', gap: '8px' }}>\n                                        <input \n                                            type="text" \n                                            className="form-input" \n                                            value={couponCode}\n                                            onChange={(e) => setCouponCode(e.target.value.toUpperCase())}\n                                            placeholder="أدخل كود الخصم"\n                                        />\n                                        <button \n                                            type="button"\n                                            className="btn btn-secondary"\n                                            onClick={async () => {\n                                                if(!couponCode) return;\n                                                const res = await validateCoupon(couponCode, totalProductsSubtotal);\n                                                if (res.valid) {\n                                                    setCouponValid(true);\n                                                    setCouponDiscountValue(res.discount_value);\n                                                    setCouponDiscountType(res.discount_type);\n                                                    showToast("تم تطبيق الكوبون بنجاح", "success");\n                                                } else {\n                                                    setCouponValid(false);\n                                                    setCouponDiscountValue(0);\n                                                    showToast(res.message || "كوبون غير صالح", "error");\n                                                }\n                                            }}\n                                        >\n                                            تطبيق\n                                        </button>\n                                    </div>\n                                    {couponValid && <div style={{ fontSize: '11px', color: 'var(--color-success)', marginTop: '4px' }}>خصم: {couponDiscountValue} {couponDiscountType === 'Percentage' ? '%' : currency}</div>}\n                                </div>\n$1<div className="form-group">\n                                    <label className="form-label">سعر الشحن ({currency})</label>`
);

// 9. Update handleSaveOrder
content = content.replace(
    /totalValue: finalOrderTotal,/,
    `totalValue: finalOrderTotal,\n            customer_id: customerId,\n            discount_type: couponValid ? couponDiscountType : null,\n            discount_value: couponValid ? couponDiscountValue : 0,\n            applied_coupon_code: couponValid ? couponCode : null,`
);
content = content.replace(
    /customerCode: customerCode/,
    `customerCode: customerCode,\n                appliedCoupon: couponValid ? couponCode : ''`
);

fs.writeFileSync(file, content);
console.log("RecordOrderModal updated successfully!");
