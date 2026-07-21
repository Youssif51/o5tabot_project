/**
 * Utility functions for product name formatting and display
 */

export const formatProductDisplayName = (productName, variantName) => {
    let pName = (productName || '').trim();
    let vName = (variantName || '').trim();

    if (!pName) return vName || '';
    if (!vName) return pName;

    const defaultTerms = ['default title', 'standard option', 'standard', 'default', 'أساسي', 'اساسي', 'أساسى'];

    // Strip out (أساسي) or (Default Title) from pName if present
    pName = pName.replace(/\s*\((أساسي|اساسي|Default Title|Standard Option)\)\s*/gi, '').trim();

    // Recursively strip pName and parentheses from vName
    let prevVName = '';
    while (vName && vName !== prevVName) {
        prevVName = vName;
        vName = vName.trim();
        if (pName && vName.toLowerCase().startsWith(pName.toLowerCase())) {
            vName = vName.slice(pName.length).trim();
        }
        vName = vName.replace(/^[\s\(\)]+|[\s\(\)]+$/g, '').trim();
    }

    if (!vName || defaultTerms.includes(vName.toLowerCase()) || vName.toLowerCase() === pName.toLowerCase()) {
        return pName;
    }

    return `${pName} (${vName})`;
};
