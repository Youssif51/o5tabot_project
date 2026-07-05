const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/App.jsx');
let content = fs.readFileSync(file, 'utf-8');

// 1. Add password state
content = content.replace(
    /const \[loginUsername, setLoginUsername\] = useState\('sfsf'\);/,
    `const [loginEmail, setLoginEmail] = useState('yousif.m.d.2002@gmail.com');\n    const [loginPassword, setLoginPassword] = useState('A5-SFSF');`
);

content = content.replace(
    /const \[signupEmail, setSignupEmail\] = useState\('admin@octabot.com'\);/,
    `const [signupEmail, setSignupEmail] = useState('admin@octabot.com');\n    const [signupPassword, setSignupPassword] = useState('');\n    const [signupName, setSignupName] = useState('');`
);

// 2. Update authLogin call
content = content.replace(
    /authLogin\(loginUsername\)/g,
    `authLogin(loginEmail, loginPassword)`
);

// 3. Update login inputs
content = content.replace(
    /value=\{loginUsername\}\s*onChange=\{\(e\) => setLoginUsername\(e\.target\.value\)\}/,
    `value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)}`
);

content = content.replace(
    /type="password"\s*className="form-input"\s*placeholder="••••••••"\s*required\s*\/>/m,
    `type="password" className="form-input" placeholder="••••••••" value={loginPassword} onChange={(e) => setLoginPassword(e.target.value)} required />`
);

fs.writeFileSync(file, content);
console.log("App.jsx updated successfully!");
