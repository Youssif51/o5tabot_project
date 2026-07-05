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
        canAdjustStock: role !== 'Staff',
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
