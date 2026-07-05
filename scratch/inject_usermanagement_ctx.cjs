const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/context/AppContext.jsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add toggleUserStatus and deleteUser functions
const functionsToAdd = `
    const toggleUserStatus = async (userId, isActive) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('toggle_user_active', {
            p_user_id: userId,
            p_active: isActive
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).map(u => u.id === userId ? { ...u, is_active: isActive } : u)
        }));
        showToast("User status updated");
        return true;
    };

    const deleteUser = async (userId) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('delete_user_account', {
            p_user_id: userId
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        
        setState(prev => ({
            ...prev,
            users: (prev.users || []).filter(u => u.id !== userId)
        }));
        showToast("User deleted successfully");
        return true;
    };
`;

content = content.replace(
    /const authSignup = async \(name, email, password, role\) => \{/,
    `${functionsToAdd}\n    const authSignup = async (name, email, password, role) => {`
);

// 2. Add authSignup success state update
// Replace return true in authSignup with updating state.users
const authSignupSuccess = `
        setState(prev => ({
            ...prev,
            users: [...(prev.users || []), {
                id: data.user_id,
                name: name,
                email: email,
                role: role,
                is_active: true
            }]
        }));
        showToast("User created successfully!");
        return true;
`;

content = content.replace(
    /showToast\("Account created successfully"\);\s*return true;/,
    authSignupSuccess
);

// 3. Export new functions
content = content.replace(
    /authSignup,/,
    `authSignup,\n            toggleUserStatus,\n            deleteUser,`
);

fs.writeFileSync(file, content);
console.log("AppContext updated successfully!");
