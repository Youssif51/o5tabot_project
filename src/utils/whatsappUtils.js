/**
 * WhatsApp Link and Message Generator for Octabot Store
 */

export const generateWhatsAppLink = (phoneStr, ord = null, getProductNameBySku = null) => {
    if (!phoneStr) return '';
    
    // Normalize phone number
    const strVal = String(phoneStr || '');
    let clean = strVal.replace(/\D/g, '');
    if (clean.startsWith('01') && clean.length === 11) {
        clean = '2' + clean;
    } else if (clean.startsWith('1') && clean.length === 10) {
        clean = '20' + clean;
    } else if (clean.startsWith('201') && clean.length === 12) {
        // already has 20 prefix
    }

    if (!clean) return '';

    if (!ord) {
        return `https://wa.me/${clean}`;
    }

    const systemId = ord.id || '';
    const total = parseFloat(ord.totalValue || ord.total_value) || 0;
    const status = ord.status || 'Pending';

    let messageText = '';

    if (status === 'Shipped') {
        messageText = `مساء الخير من متجر أخطبوط.
بخصوص طلبك رقم *#${systemId}*:
الطلب خرج مع شركة الشحن وحالياً في طريقه لحضرتك.
لو عندك أي استفسار أو للتنسيق مع مندوب التوصيل إحنا في خدمتك دائماً!`;
    } else if (status === 'Completed' || status === 'Delivered') {
        messageText = `مساء الخير من متجر أخطبوط.
بخصوص طلبك رقم *#${systemId}*:
الطلب تم توصيله لحضرتك، وحابين نتطمن إن كل حاجة تمام ونالت إعجابك!`;
    } else if (status === 'Cancelled' || status === 'Rejected') {
        messageText = `مساء الخير من متجر أخطبوط.
بخصوص طلبك رقم *#${systemId}*:
حابين نتواصل مع حضرتك بخصوص طلبك، ولو في أي استفسار إحنا في الخدمة.`;
    } else {
        // Default / Pending - Model 3 (مباشر وسريع ونقي بدون إيموجيز معقدة)
        const items = ord.items || [];
        const itemsList = items.map(item => {
            const name = getProductNameBySku 
                ? getProductNameBySku(item.variantSku || item.variant_sku || item.sku, item.productName || item.product_name, item.variantName || item.variant_name) 
                : (item.productName || item.product_name || item.variantSku || item.sku || 'منتج');
            const price = parseFloat(item.price) || 0;
            const qty = parseInt(item.quantity) || 1;
            const qtyText = qty > 1 ? ` (الكمية: ${qty})` : '';
            return `- ${name} (${price} ج)${qtyText}`;
        }).join('\n');

        const itemsBlock = itemsList ? `${itemsList}\n` : '';

        messageText = `مساء الخير من متجر أخطبوط.
بخصوص طلبك رقم *#${systemId}*:
${itemsBlock}*المبلغ المطلوب:* ${total} ج

لتأكيد الحجز:
1- عربون *50 ج* والباقي عند الاستلام.
2- أو دفع المبلغ بالكامل.

طرق الدفع: InstaPay / فودافون كاش.
نبدأ نجهز لحضرتك؟`;
    }

    return `https://wa.me/${clean}?text=${encodeURIComponent(messageText)}`;
};
