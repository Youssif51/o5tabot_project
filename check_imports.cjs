const fs = require('fs');
const path = require('path');

const files = [
    'd:/Work/o5tabot_project/o5tabot_project/src/context/AppContext.jsx',
    'd:/Work/o5tabot_project/o5tabot_project/src/components/orders/OrdersList.jsx',
    'd:/Work/o5tabot_project/o5tabot_project/src/components/orders/RecordOrderModal.jsx',
    'd:/Work/o5tabot_project/o5tabot_project/src/components/orders/ShopifyPendingList.jsx',
    'd:/Work/o5tabot_project/o5tabot_project/src/components/inventory/ProductInfo.jsx',
    'd:/Work/o5tabot_project/o5tabot_project/src/components/customers/CustomerProfileDrawer.jsx'
];

files.forEach(f => {
    const code = fs.readFileSync(f, 'utf8');
    const firstLine = code.split('\n')[0];
    console.log(`${f}:\n  ${firstLine}`);
});
