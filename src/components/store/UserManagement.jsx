import React, { useContext, useState } from 'react';
import { AppContext } from '../../context/AppContext';

const PERMISSIONS_LIST = [
    { id: 'view_dashboard', label: 'رؤية الإحصائيات والأرباح' },
    { id: 'manage_inventory', label: 'إدارة المنتجات والمخزون' },
    { id: 'manage_orders', label: 'إدارة المبيعات والطلبات' },
    { id: 'manage_suppliers', label: 'إدارة الموردين والمشتريات' },
    { id: 'manage_customers', label: 'إدارة العملاء والولاء' },
    { id: 'view_reports', label: 'رؤية وتصدير التقارير' },
    { id: 'manage_settings', label: 'الوصول لإعدادات المتجر' }
];

export default function UserManagement() {
    const { state, authSignup, toggleUserStatus, deleteUser, updateUserPermissions, t } = useContext(AppContext);
    
    if (!state.currentUser || !['Admin', 'SuperAdmin'].includes(state.currentUser.role)) {
        return null;
    }

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [role, setRole] = useState('Staff');
    const [selectedPermissions, setSelectedPermissions] = useState([]);
    const [loading, setLoading] = useState(false);

    const [editingUserId, setEditingUserId] = useState(null);
    const [editingPermissions, setEditingPermissions] = useState([]);

    const handleTogglePermission = (permId, isEditing = false) => {
        if (isEditing) {
            setEditingPermissions(prev => 
                prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
            );
        } else {
            setSelectedPermissions(prev => 
                prev.includes(permId) ? prev.filter(p => p !== permId) : [...prev, permId]
            );
        }
    };

    const handleCreateUser = async (e) => {
        e.preventDefault();
        setLoading(true);
        const success = await authSignup(name, email, password, role, selectedPermissions);
        setLoading(false);
        if (success) {
            setName('');
            setEmail('');
            setPassword('');
            setRole('Staff');
            setSelectedPermissions([]);
            setIsFormOpen(false);
        }
    };

    const handleSavePermissions = async (userId) => {
        setLoading(true);
        const success = await updateUserPermissions(userId, editingPermissions);
        setLoading(false);
        if (success) {
            setEditingUserId(null);
        }
    };

    const handleToggleStatus = async (id, currentStatus) => {
        if(window.confirm(`هل أنت متأكد من ${currentStatus ? 'إيقاف' : 'تفعيل'} هذا الحساب؟`)) {
            await toggleUserStatus(id, !currentStatus);
        }
    };

    const handleDelete = async (id) => {
        if(window.confirm('هل أنت متأكد من حذف هذا الحساب نهائياً؟ لا يمكن التراجع عن هذا الإجراء.')) {
            await deleteUser(id);
        }
    };

    const usersList = (state.users || []).filter(u => {
        if (state.currentUser.role === 'SuperAdmin') return true;
        return u.role === 'Staff';
    });

    return (
        <div className="glass-card dashboard-widget" style={{ padding: '24px', marginTop: '24px' }}>
            <div className="widget-header" style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3>إدارة المستخدمين والصلاحيات</h3>
                <button className="btn btn-primary" onClick={() => setIsFormOpen(!isFormOpen)}>
                    <i className="fa-solid fa-user-plus"></i> إضافة موظف جديد
                </button>
            </div>

            {isFormOpen && (
                <div style={{ background: 'rgba(0,0,0,0.1)', padding: '20px', borderRadius: '8px', marginBottom: '20px' }}>
                    <form onSubmit={handleCreateUser} style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="form-group" style={{ flex: '1 1 200px' }}>
                            <label className="form-label">الاسم</label>
                            <input type="text" className="form-input" required value={name} onChange={e => setName(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 200px' }}>
                            <label className="form-label">البريد الإلكتروني</label>
                            <input type="email" className="form-input" required value={email} onChange={e => setEmail(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 200px' }}>
                            <label className="form-label">كلمة المرور (6 أحرف على الأقل)</label>
                            <input type="password" className="form-input" required minLength={6} value={password} onChange={e => setPassword(e.target.value)} />
                        </div>
                        <div className="form-group" style={{ flex: '1 1 150px' }}>
                            <label className="form-label">المسمى الوظيفي</label>
                            <select className="form-select" value={role} onChange={e => setRole(e.target.value)}>
                                <option value="Staff">موظف (Staff)</option>
                                {state.currentUser.role === 'SuperAdmin' && <option value="Admin">مدير (Admin)</option>}
                            </select>
                        </div>
                        
                        <div style={{ flex: '1 1 100%' }}>
                            <label className="form-label" style={{ marginBottom: '12px', display: 'block', fontWeight: 'bold' }}>الصلاحيات المخصصة:</label>
                            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                {PERMISSIONS_LIST.map(p => {
                                    const isSelected = selectedPermissions.includes(p.id);
                                    return (
                                        <div 
                                            key={p.id} 
                                            onClick={() => handleTogglePermission(p.id)}
                                            style={{ 
                                                padding: '8px 16px', 
                                                borderRadius: '20px', 
                                                border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                background: isSelected ? 'var(--primary-color)' : 'transparent',
                                                color: isSelected ? 'white' : 'var(--text-color)',
                                                cursor: 'pointer',
                                                transition: 'all 0.2s',
                                                fontSize: '13px',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                                userSelect: 'none'
                                            }}
                                        >
                                            <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
                                            {p.label}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        <div style={{ flex: '1 1 100%', display: 'flex', justifyContent: 'flex-end' }}>
                            <button type="submit" className="btn btn-primary" disabled={loading}>
                                {loading ? 'جاري الإضافة...' : 'حفظ'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            <div className="table-responsive">
                <table className="custom-table">
                    <thead>
                        <tr>
                            <th>الموظف</th>
                            <th>المنصب</th>
                            <th>الصلاحيات</th>
                            <th>الحالة</th>
                            <th style={{ textAlign: 'center' }}>الإجراءات</th>
                        </tr>
                    </thead>
                    <tbody>
                        {usersList.length === 0 ? (
                            <tr><td colSpan="5" style={{textAlign: 'center'}}>لا يوجد موظفين حالياً</td></tr>
                        ) : (
                            usersList.map(u => (
                                <tr key={u.id}>
                                    <td>
                                        <div style={{ fontWeight: 'bold' }}>{u.name}</div>
                                        <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{u.email}</div>
                                    </td>
                                    <td>
                                        <span className={`status-badge ${u.role === 'SuperAdmin' ? 'status-completed' : u.role === 'Admin' ? 'status-processing' : 'status-pending'}`}>
                                            {u.role}
                                        </span>
                                    </td>
                                    <td>
                                        {u.role === 'SuperAdmin' ? (
                                            <span style={{ fontSize: '12px', color: 'var(--primary-color)' }}>كافة الصلاحيات</span>
                                        ) : editingUserId === u.id ? (
                                            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                                                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                                                    {PERMISSIONS_LIST.map(p => {
                                                        const isSelected = editingPermissions.includes(p.id);
                                                        return (
                                                            <div 
                                                                key={p.id} 
                                                                onClick={() => handleTogglePermission(p.id, true)}
                                                                style={{ 
                                                                    padding: '4px 10px', 
                                                                    borderRadius: '12px', 
                                                                    border: `1px solid ${isSelected ? 'var(--primary-color)' : 'var(--border-color)'}`,
                                                                    background: isSelected ? 'var(--primary-color)' : 'transparent',
                                                                    color: isSelected ? 'white' : 'var(--text-color)',
                                                                    cursor: 'pointer',
                                                                    fontSize: '11px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '4px',
                                                                    userSelect: 'none'
                                                                }}
                                                            >
                                                                <i className={`fa-solid ${isSelected ? 'fa-check' : 'fa-plus'}`}></i>
                                                                {p.label}
                                                            </div>
                                                        );
                                                    })}
                                                </div>
                                                <div style={{ marginTop: '5px', display: 'flex', gap: '5px' }}>
                                                    <button className="btn btn-primary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => handleSavePermissions(u.id)} disabled={loading}>حفظ</button>
                                                    <button className="btn btn-secondary" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={() => setEditingUserId(null)}>إلغاء</button>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
                                                {(u.permissions || []).length === 0 ? (
                                                    <span style={{ fontSize: '12px', color: '#999' }}>لا توجد صلاحيات</span>
                                                ) : (
                                                    (u.permissions || []).map(pid => {
                                                        const p = PERMISSIONS_LIST.find(x => x.id === pid);
                                                        return p ? <span key={pid} className="status-badge" style={{ background: 'rgba(255,255,255,0.1)', color: 'var(--text-color)', fontSize: '11px', padding: '2px 6px' }}>{p.label}</span> : null;
                                                    })
                                                )}
                                                {u.id !== state.currentUser.id && (
                                                    <button 
                                                        className="btn btn-secondary" 
                                                        style={{ padding: '2px 6px', fontSize: '11px', border: 'none', background: 'transparent' }} 
                                                        onClick={() => { setEditingUserId(u.id); setEditingPermissions(u.permissions || []); }}
                                                    >
                                                        <i className="fa-solid fa-pen"></i> تعديل
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </td>
                                    <td>
                                        <span className={`status-badge ${u.is_active ? 'status-completed' : 'status-cancelled'}`}>
                                            {u.is_active ? 'نشط' : 'موقوف'}
                                        </span>
                                    </td>
                                    <td style={{ textAlign: 'center' }}>
                                        {u.id !== state.currentUser.id && u.role !== 'SuperAdmin' && (
                                            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center' }}>
                                                <button 
                                                    className="btn btn-secondary" 
                                                    style={{ padding: '6px 12px' }}
                                                    onClick={() => handleToggleStatus(u.id, u.is_active)}
                                                    title={u.is_active ? 'إيقاف الحساب' : 'تفعيل الحساب'}
                                                >
                                                    <i className={`fa-solid ${u.is_active ? 'fa-ban' : 'fa-check'}`}></i>
                                                </button>
                                                <button 
                                                    className="btn btn-danger" 
                                                    style={{ padding: '6px 12px' }}
                                                    onClick={() => handleDelete(u.id)}
                                                    title="حذف نهائي"
                                                >
                                                    <i className="fa-solid fa-trash"></i>
                                                </button>
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
