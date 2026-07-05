const fs = require('fs');

function updateRecordOrderModal(filePath) {
    let content = fs.readFileSync(filePath, 'utf8');

    // 1. Add getOrCreateCustomer to useContext
    content = content.replace(
        /const \{ state, addOrder, editOrder, showToast, t, validateCoupon \} = useContext\(AppContext\);/,
        'const { state, addOrder, editOrder, showToast, t, validateCoupon, getOrCreateCustomer } = useContext(AppContext);'
    );

    // 2. Make handleSaveOrder async
    content = content.replace(
        /const handleSaveOrder = \(isDraftSave\) => \{/,
        'const handleSaveOrder = async (isDraftSave) => {'
    );

    // 3. Right before creating newOrderObj, fetch or create customer if not in draft or if we want to always track
    const targetCode = 'const newOrderObj = {';
    const replacementCode = `
        // Ensure we have a valid customer_id in DB
        let finalCustomerId = customerId;
        if (!finalCustomerId) {
            finalCustomerId = await getOrCreateCustomer(phone, client, governorate);
            setCustomerId(finalCustomerId); // update local state as well
        }

        const newOrderObj = {`;
    
    content = content.replace(targetCode, replacementCode);

    // 4. Update the newOrderObj creation to use finalCustomerId
    content = content.replace(
        /customer_id:\s*customerId,/,
        'customer_id: finalCustomerId,'
    );

    fs.writeFileSync(filePath, content);
    console.log('Updated RecordOrderModal.jsx');
}

updateRecordOrderModal('src/components/orders/RecordOrderModal.jsx');
