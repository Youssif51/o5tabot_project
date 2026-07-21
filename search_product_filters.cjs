const fs = require('fs');
const path = require('path');

function searchFiles(dir) {
    const files = fs.readdirSync(dir);
    for (const f of files) {
        const full = path.join(dir, f);
        const stat = fs.statSync(full);
        if (stat.isDirectory()) {
            searchFiles(full);
        } else if (f.endsWith('.jsx') || f.endsWith('.js')) {
            const code = fs.readFileSync(full, 'utf8');
            const lines = code.split('\n');
            lines.forEach((line, idx) => {
                if (line.includes('productType') || line.includes('product_type') || line.includes('category') || line.includes('Collection') || line.includes('collection') || line.includes('Filter') || line.includes('فلتر')) {
                    if (full.includes('Inventory') || full.includes('Product') || full.includes('RecordOrder')) {
                        console.log(`${full}:${idx + 1}: ${line.trim()}`);
                    }
                }
            });
        }
    }
}

searchFiles('d:/Work/o5tabot_project/o5tabot_project/src');
