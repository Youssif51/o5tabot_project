const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/store/StoreSettings.jsx');
let content = fs.readFileSync(file, 'utf-8');

// Import UserManagement
content = content.replace(
    /import \{ AppContext \} from '\.\.\/\.\.\/context\/AppContext';/,
    `import { AppContext } from '../../context/AppContext';\nimport UserManagement from './UserManagement';`
);

// Add UserManagement to the render
content = content.replace(
    /<\/div>\s*<\/div>\s*\)\;\s*\}\s*$/,
    `</div>\n            <UserManagement />\n        </div>\n    );\n}`
);

fs.writeFileSync(file, content);
console.log("StoreSettings updated with UserManagement!");
