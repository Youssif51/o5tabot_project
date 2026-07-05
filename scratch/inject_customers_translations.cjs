const fs = require('fs');
const path = require('path');

const ctxFile = path.join(__dirname, '../src/context/AppContext.jsx');
let ctxContent = fs.readFileSync(ctxFile, 'utf8');

// 1. Add translations
const enRepl = `
        recordPurchaseOrder: "Record Purchase Order",
        markup: "Markup",
        margin: "Margin",
        profitMargin: "Profit Margin",
        expiry: "Expiry",
        customersList: "Customers",
        totalCustomers: "Total Customers",
        vipCustomers: "VIP Customers",
        addCustomer: "Add Customer",
        customerName: "Customer Name",
        customerType: "Type",
        totalPurchases: "Total Purchases",
        ordersCount: "Orders",
        editCustomer: "Edit Customer",
        regular: "Regular",
        vip: "VIP",
        governorate: "Governorate"
`;
const arRepl = `
        recordPurchaseOrder: "تسجيل فاتورة مشتريات",
        markup: "الهامش الكلي",
        margin: "الربح",
        profitMargin: "نسبة الربح",
        expiry: "تاريخ الصلاحية",
        customersList: "العملاء",
        totalCustomers: "إجمالي العملاء",
        vipCustomers: "عملاء VIP المميزين",
        addCustomer: "إضافة عميل",
        customerName: "اسم العميل",
        customerType: "فئة العميل",
        totalPurchases: "إجمالي المشتريات",
        ordersCount: "عدد الطلبات",
        editCustomer: "تعديل عميل",
        regular: "عادي",
        vip: "مميز (VIP)",
        governorate: "المحافظة"
`;

if (!ctxContent.includes('customersList:')) {
    ctxContent = ctxContent.replace(
        /expiry: "Expiry"/g, 
        enRepl
    );
    ctxContent = ctxContent.replace(
        /expiry: "تاريخ الصلاحية"/g, 
        arRepl
    );
}

fs.writeFileSync(ctxFile, ctxContent);
console.log("AppContext updated with customer translations.");
