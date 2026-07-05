const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/store/UserManagement.jsx');
let content = fs.readFileSync(file, 'utf-8');

// Fix escaped backticks and dollars in JSX
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(file, content);
console.log("UserManagement.jsx syntax fixed!");
