const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/context/AppContext.jsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Update authSignup to take permissions
content = content.replace(
    /const authSignup = async \(name, email, password, role\) => \{/,
    `const authSignup = async (name, email, password, role, permissions = []) => {`
);

content = content.replace(
    /p_role: role/,
    `p_role: role,\n            p_permissions: permissions`
);

content = content.replace(
    /role: role,\n\s*is_active: true/,
    `role: role,\n                is_active: true,\n                permissions: permissions`
);

// 2. Add updateUserPermissions function
const newFunc = `
    const updateUserPermissions = async (userId, permissions) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('update_user_permissions', {
            p_user_id: userId,
            p_permissions: permissions
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === userId ? { ...u, permissions: permissions } : u)
        }));
        showToast("Permissions updated successfully");
        return true;
    };
`;

content = content.replace(
    /const authSignup = async/,
    `${newFunc}\n    const authSignup = async`
);

// 3. Export updateUserPermissions
content = content.replace(
    /authSignup,/,
    `authSignup,\n            updateUserPermissions,`
);

// 4. Update currentUser on login to include permissions
content = content.replace(
    /role: profile \? profile\.role : 'Staff'/,
    `role: profile ? profile.role : 'Staff',\n                        permissions: profile ? (profile.permissions || []) : []`
);


fs.writeFileSync(file, content);
console.log("AppContext updated successfully with permissions!");
