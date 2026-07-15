const fs = require('fs');
const path = require('path');

function walk(dir) {
    let results = [];
    const list = fs.readdirSync(dir);
    list.forEach(file => {
        file = path.join(dir, file);
        const stat = fs.statSync(file);
        if (stat && stat.isDirectory()) {
            results = results.concat(walk(file));
        } else if (file.endsWith('.jsx')) {
            results.push(file);
        }
    });
    return results;
}

const files = walk('src');
let count = 0;
files.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Replace {currency}{something} with {currency} {something}
    content = content.replace(/\{currency\}\{/g, '{currency} {');
    
    // Replace ${currency}${something} with ${currency} ${something}
    content = content.replace(/\$\{currency\}\$\{/g, '${currency} ${');
    
    if (content !== original) {
        fs.writeFileSync(file, content, 'utf8');
        console.log('Updated: ' + file);
        count++;
    }
});

console.log('Total files updated: ' + count);
