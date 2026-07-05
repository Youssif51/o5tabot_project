const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/orders/OrdersList.jsx');
let content = fs.readFileSync(file, 'utf-8');

// Replace Table Headers
content = content.replace(
    /<th>\{t\('warehouse'\)\}<\/th>/g,
    `<th>المنشئ (بواسطة)</th>`
);

// Replace Table Data
content = content.replace(
    /<td>\{order\.warehouse\}<\/td>/g,
    `<td>{order.createdBy || order.warehouse || '-'}</td>`
);

fs.writeFileSync(file, content);
console.log("OrdersList.jsx updated successfully!");
