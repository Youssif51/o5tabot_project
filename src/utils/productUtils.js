/**
 * Utility functions for product name formatting and display
 */

export const deduplicateProductName = (name) => {
    if (!name) return '';
    let cleanName = name.trim();
    
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

export const formatProductDisplayName = (productName, variantName) => {
    let pName = deduplicateProductName(productName || '');
    let vName = (variantName || '').trim();

    if (!pName) return vName || '';
    if (!vName) return pName;

    const defaultTerms = ['default title', 'standard option', 'standard', 'default', 'أساسي', 'اساسي', 'أساسى'];

    // Strip out (أساسي) or (Default Title) from pName if present
    pName = pName.replace(/\s*\((أساسي|اساسي|Default Title|Standard Option)\)\s*/gi, '').trim();

    // Base product name without trailing digits/spaces for flexible matching
    const basePName = pName.replace(/\s*\d+$/, '').trim();

    // Recursively strip pName and basePName and parentheses from vName
    let prevVName = '';
    while (vName && vName !== prevVName) {
        prevVName = vName;
        vName = vName.trim();
        if (pName && vName.toLowerCase().startsWith(pName.toLowerCase())) {
            vName = vName.slice(pName.length).trim();
        } else if (basePName && vName.toLowerCase().startsWith(basePName.toLowerCase())) {
            vName = vName.slice(basePName.length).trim();
        }
        vName = vName.replace(/^[\s\(\)\-]+|[\s\(\)\-]+$/g, '').trim();
    }

    if (!vName || defaultTerms.includes(vName.toLowerCase()) || vName.toLowerCase() === pName.toLowerCase() || vName.toLowerCase() === basePName.toLowerCase()) {
        return pName;
    }

    // If the product name ALREADY contains the variant name completely, don't append it again
    if (pName.toLowerCase().includes(vName.toLowerCase())) {
        return pName;
    }

    return `${pName} - ${vName}`;
};
