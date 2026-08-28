import { useContext } from 'react';
import { AppContext } from '../context/AppContext';

export default function usePermissions() {
    const { state } = useContext(AppContext);
    const role = state.currentUser?.role || 'Staff';

    return {
        role,
        isSuperAdmin: role === 'SuperAdmin',
        isAdmin: role === 'Admin' || role === 'SuperAdmin',
        isStaff: role === 'Staff',

        // ── Operational Permissions ──
        canCreateOrder: true,
        canEditPrice: role !== 'Staff',
        canApplyManualDiscount: role !== 'Staff',
        canApplyCoupon: true,
        canDeleteOrder: role !== 'Staff',
        canCancelOrder: true,
        canViewInventory: role === 'SuperAdmin' || role === 'Admin' || (state.currentUser?.permissions || []).includes('view_inventory') || (state.currentUser?.permissions || []).includes('manage_inventory'),
        canManageInventory: role === 'SuperAdmin' || role === 'Admin' || (state.currentUser?.permissions || []).includes('manage_inventory'),
        canAddProduct: role === 'SuperAdmin' || role === 'Admin' || (state.currentUser?.permissions || []).includes('view_inventory') || (state.currentUser?.permissions || []).includes('manage_inventory'),
        canAdjustStock: role === 'SuperAdmin' || role === 'Admin' || (state.currentUser?.permissions || []).includes('manage_inventory'),
        canReceivePurchase: true,
        canViewReports: role !== 'Staff',

        // ── Customer Management ──
        canViewCustomers: true,
        canManageCustomers: role !== 'Staff',

        // ── Coupon Management ──
        canManageCoupons: role !== 'Staff',

        // ── User Management ──
        canManageUsers: role !== 'Staff',
        canViewUsers: role !== 'Staff',
        canCreateAdmin: role === 'SuperAdmin',
        canDeleteAdmin: role === 'SuperAdmin',
        canCreateStaff: role !== 'Staff',
        canDeleteStaff: role !== 'Staff',
    };
}
