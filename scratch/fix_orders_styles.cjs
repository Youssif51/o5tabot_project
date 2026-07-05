const fs = require('fs');

function fixFile(filePath) {
    if (!fs.existsSync(filePath)) return;
    let content = fs.readFileSync(filePath, 'utf8');

    // Replace hardcoded backgrounds
    content = content.replace(/background:\s*'#121212'/g, "background: 'var(--bg-primary)'");
    content = content.replace(/background:\s*'#1a1a1a'/g, "background: 'var(--bg-secondary)'");
    content = content.replace(/background:\s*'rgba\(25, 25, 30, 0.99\)'/g, "background: 'var(--bg-secondary)'");
    
    // Replace rgba variants for glass effects
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.01\)/g, "var(--glass-bg)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.02\)/g, "var(--glass-bg)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.03\)/g, "var(--glass-bg-hover)");
    
    // Replace border rgba colors
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.04\)/g, "var(--glass-border)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.05\)/g, "var(--glass-border)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.06\)/g, "var(--glass-border)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.08\)/g, "var(--glass-border-hover)");
    content = content.replace(/rgba\(255,\s*255,\s*255,\s*0\.1\)/g, "var(--glass-border-hover)");

    // Replace texts
    content = content.replace(/color:\s*'#fff'/g, "color: 'var(--text-primary)'");
    content = content.replace(/color:\s*'#000'/g, "color: 'var(--text-primary)'"); // Gold button text can stay black or use variable? I'll let gold text be.
    content = content.replace(/color:\s*'rgba\(255,\s*255,\s*255,\s*0\.75\)'/g, "color: 'var(--text-primary)'");
    content = content.replace(/color:\s*'rgba\(255,\s*255,\s*255,\s*0\.6\)'/g, "color: 'var(--text-secondary)'");
    content = content.replace(/color:\s*'rgba\(255,\s*255,\s*255,\s*0\.5\)'/g, "color: 'var(--text-secondary)'");
    content = content.replace(/color:\s*'rgba\(255,\s*255,\s*255,\s*0\.4\)'/g, "color: 'var(--text-muted)'");
    
    content = content.replace(/background:\s*'rgba\(0, 0, 0, 0\.2\)'/g, "background: 'var(--glass-bg)'");
    
    // Specific gold button text in RecordOrderModal/OrdersList
    content = content.replace(/background:\s*'var\(--gold-primary\)',\s*color:\s*'var\(--text-primary\)'/g, "background: 'var(--gold-primary)', color: '#000'");

    fs.writeFileSync(filePath, content);
    console.log('Fixed styles in ' + filePath);
}

fixFile('src/components/orders/OrdersList.jsx');
fixFile('src/components/orders/RecordOrderModal.jsx');
