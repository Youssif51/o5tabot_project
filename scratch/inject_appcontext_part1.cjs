const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/context/AppContext.jsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Update initialState
content = content.replace(
    /stockLedger: \[\],/,
    `stockLedger: [],\n    customers: [],\n    coupons: [],\n    users: [],`
);
content = content.replace(
    /currentUser: \{\s*name: "sfsf",\s*role: "Store Manager",\s*avatar: "S"\s*\}/,
    `currentUser: null`
);

// 2. Add VIP settings
content = content.replace(
    /storeSettings: \{\s*name: "o5taboad store",\s*address: "Egypt",\s*currency: "EGP"\s*\}/,
    `storeSettings: { name: "o5taboad store", address: "Egypt", currency: "EGP", vipThresholdPurchases: 5000, vipThresholdOrders: 10 }`
);

// 3. Update loadSupabaseData
content = content.replace(
    /\{ data: wastes, error: wErr \}/,
    `{ data: wastes, error: wErr },
                    { data: customers, error: cErr },
                    { data: coupons, error: couErr },
                    { data: users, error: uErr }`
);
content = content.replace(
    /supabase\.from\('wastes'\)\.select\('\*'\)/,
    `supabase.from('wastes').select('*'),
                    supabase.from('customers').select('*'),
                    supabase.from('coupons').select('*'),
                    supabase.from('user_profiles').select('*')`
);
content = content.replace(
    /if \(pErr \|\| vErr \|\| sErr \|\| oErr \|\| oiErr \|\| poErr \|\| poiErr \|\| lErr \|\| wErr\) \{/,
    `if (pErr || vErr || sErr || oErr || oiErr || poErr || poiErr || lErr || wErr || cErr || couErr || uErr) {`
);
content = content.replace(
    /wastes: mappedWastes,/,
    `wastes: mappedWastes,
                    customers: customers || [],
                    coupons: coupons || [],
                    users: users || [],`
);

// 4. Update authLogin, authSignup, authLogout
const authCode = `    useEffect(() => {
        if (!supabase) return;
        const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
            if (session?.user) {
                const { data: profile } = await supabase.from('user_profiles').select('*').eq('id', session.user.id).single();
                if (profile && !profile.is_active) {
                    await supabase.auth.signOut();
                    setState(prev => ({ ...prev, currentUser: null }));
                    showToast("Your account is deactivated.", "error");
                    return;
                }
                setState(prev => ({
                    ...prev,
                    currentUser: {
                        id: session.user.id,
                        email: session.user.email,
                        name: profile ? profile.name : session.user.email.split('@')[0],
                        role: profile ? profile.role : 'Staff',
                        avatar: (profile ? profile.name : session.user.email).substring(0, 1).toUpperCase()
                    }
                }));
            } else {
                setState(prev => ({ ...prev, currentUser: null }));
            }
        });
        return () => subscription?.unsubscribe();
    }, []);

    const authLogin = async (email, password) => {
        if (!supabase) return false;
        const { data, error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
            showToast(error.message, "error");
            return false;
        }
        logActivity("auth", \`User signed in.\`);
        showToast(\`Welcome back!\`);
        setCurrentView("dashboard");
        return true;
    };

    const authSignup = async (name, email, password, role) => {
        if (!supabase) return false;
        const { data, error } = await supabase.rpc('create_user_account', {
            p_email: email,
            p_password: password,
            p_name: name,
            p_role: role
        });
        if (error || (data && data.error)) {
            showToast(error ? error.message : data.error, "error");
            return false;
        }
        logActivity("auth", \`New \${role} account created for \${name}.\`);
        showToast(\`Account created successfully!\`);
        
        // Refresh users list
        const { data: users } = await supabase.from('user_profiles').select('*');
        setState(prev => ({ ...prev, users: users || [] }));
        
        return true;
    };

    const authLogout = async () => {
        if (supabase) await supabase.auth.signOut();
        setState(prev => ({ ...prev, currentUser: null }));
        showToast("Logged out successfully.");
    };`;

const authRegex = /const authLogin = \(username\) => \{[\s\S]*?showToast\("Logged out successfully\."\);\s*\};/m;
content = content.replace(authRegex, authCode);

fs.writeFileSync(file, content);
console.log("AppContext Part 1 updated successfully!");
