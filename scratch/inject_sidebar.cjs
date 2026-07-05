const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/components/common/Sidebar.jsx');
let content = fs.readFileSync(file, 'utf-8');

// Replace navItems map with a filtered map based on permissions
const filterLogic = `
    const checkPermission = (perm) => {
        if (!state.currentUser) return false;
        if (state.currentUser.role === 'SuperAdmin') return true;
        return (state.currentUser.permissions || []).includes(perm);
    };

    const navItems = [
        { id: 'dashboard', name: t('dashboard'), icon: 'Home.png', perm: 'view_dashboard' },
        { id: 'inventory', name: t('inventory'), icon: 'Inventory.png', perm: 'manage_inventory' },
        { id: 'orders', name: t('orders'), icon: 'Order.png', perm: 'manage_orders' },
        { id: 'suppliers', name: t('suppliers'), icon: 'Suppliers.png', perm: 'manage_suppliers' },
        { id: 'reports', name: t('reports'), icon: 'Report.png', perm: 'view_reports' },
        { id: 'store', name: t('storeSettings'), icon: 'Settings.png', perm: 'manage_settings' }
    ].filter(item => checkPermission(item.perm));

    // Notice: supabaseTasks removed or add it with 'manage_settings'
`;

content = content.replace(
    /const navItems = \[[\s\S]*?\];/,
    filterLogic
);

// We need to fix the Store Settings which is hardcoded in Sidebar.jsx
// Wait, is 'store' hardcoded at the bottom of Sidebar? Let's check Sidebar.jsx
