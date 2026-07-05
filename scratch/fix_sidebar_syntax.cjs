const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/common/Sidebar.jsx');
let content = fs.readFileSync(file, 'utf-8');

// Fix escaped backticks and dollars in JSX
content = content.replace(/\\`/g, '`');
content = content.replace(/\\\$/g, '$');

fs.writeFileSync(file, content);
console.log("Sidebar.jsx syntax fixed!");
