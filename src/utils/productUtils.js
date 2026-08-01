/**
 * Utility functions for product name formatting and display
 */

export const deduplicateProductName = (name) => {
    if (!name) return '';
    let cleanName = name.trim();

    // Strip out (أساسي) or (اساسي) or (أساسى) or (اساسيه) or (Default Title) or (Standard Option) from name
    cleanName = cleanName.replace(/\s*\((أساسي|اساسي|أساسى|اساسيه|Default Title|Standard Option)\)\s*/gi, '').trim();
    
    // Check if it's split by hyphen "Product - Product"
    const parts = cleanName.split(/\s+-\s+/);
    if (parts.length === 2 && parts[0].trim().toLowerCase() === parts[1].trim().toLowerCase()) {
        return parts[0].trim();
    }
    
    // Check if it's exactly duplicated "Product A Product A"
    const words = cleanName.split(/\s+/);
    if (words.length > 1 && words.length % 2 === 0) {
        const halfLen = words.length / 2;
        const firstHalf = words.slice(0, halfLen).join(' ');
        const secondHalf = words.slice(halfLen).join(' ');
        if (firstHalf.toLowerCase() === secondHalf.toLowerCase()) {
            return firstHalf;
        }
    }
    
    return cleanName;
};

export const cleanVariantName = (productName, variantName) => {
    let pName = deduplicateProductName(productName || '');
    let vName = (variantName || '').trim();

    if (!vName) return '';

    const defaultTerms = ['default title', 'standard option', 'standard', 'default', 'أساسي', 'اساسي', 'أساسى', 'أساسيه', 'اساسيه'];

    // Strip default terms completely
    if (defaultTerms.includes(vName.toLowerCase())) {
        return '';
    }

    // Strip out default terms or product name if present
    pName = pName.replace(/\s*\((أساسي|اساسي|أساسى|اساسيه|Default Title|Standard Option)\)\s*/gi, '').trim();

    const basePName = pName.replace(/\s*\d+$/, '').trim();

    let prevVName = '';
    while (vName && vName !== prevVName) {
        prevVName = vName;
        vName = vName.trim();
        if (pName && vName.toLowerCase().startsWith(pName.toLowerCase())) {
            vName = vName.slice(pName.length).trim();
        } else if (basePName && vName.toLowerCase().startsWith(basePName.toLowerCase())) {
            vName = vName.slice(basePName.length).trim();
        }
        
        // Clean leading/trailing spaces, hyphens, slashes, or other separators
        vName = vName.replace(/^[-\s/|\\#@#_]+|[-\s/|\\#@#_]+$/g, '').trim();
        
        // Safe parenthesis stripping
        if (vName.startsWith('(') && vName.endsWith(')')) {
            vName = vName.slice(1, -1).trim();
        }
    }

    if (!vName || defaultTerms.includes(vName.toLowerCase()) || vName.toLowerCase() === pName.toLowerCase() || vName.toLowerCase() === basePName.toLowerCase()) {
        return '';
    }

    return vName;
};

export const formatProductDisplayName = (productName, variantName) => {
    let pName = deduplicateProductName(productName || '');
    let vName = cleanVariantName(pName, variantName);

    if (!vName) return pName;
    return `${pName} - ${vName}`;
};

export const normalizePhone = (phone) => {
    if (!phone) return '';
    let clean = String(phone).replace(/[^\d+]/g, '').trim();
    if (clean.startsWith('+20')) {
        clean = '0' + clean.slice(3);
    } else if (clean.startsWith('0020')) {
        clean = '0' + clean.slice(4);
    } else if (clean.startsWith('20') && clean.length === 12) {
        clean = '0' + clean.slice(2);
    }
    return clean;
};

