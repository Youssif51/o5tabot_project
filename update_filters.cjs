const fs = require('fs');
const file = 'd:/Work/o5tabot_project/o5tabot_project/src/components/orders/OrdersList.jsx';
let content = fs.readFileSync(file, 'utf8');
const startIdx = content.indexOf('{/* 6. FILTER BAR */}');
const endIdx = content.indexOf('{/* 3. TABLE / CARD VIEW COMPONENT */}');

if (startIdx === -1 || endIdx === -1) {
    console.error('Could not find boundaries');
    process.exit(1);
}

const newFilterBar = `{/* 6. FILTER BAR */}
            <div className="glass-card filter-bar" style={{ padding: '16px', marginBottom: '24px', background: 'var(--glass-bg)', border: '1px solid var(--glass-border)', borderRadius: '12px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                    
                    {/* Top Row: Search & Export */}
                    <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="search-input-wrapper" style={{ flex: '1', minWidth: '250px', position: 'relative' }}>
                            <i className="fa-solid fa-magnifying-glass search-icon" style={{ position: 'absolute', right: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }}></i>
                            <input 
                                type="text" 
                                placeholder="ابحث برقم الطلب أو العميل..."
                                value={globalSearch || ''}
                                onChange={(e) => { setGlobalSearch(e.target.value); setCurrentPage(1); }}
                                style={{ width: '100%', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', padding: '10px 14px 10px 40px', borderRadius: '8px', fontSize: '14px' }}
                            />
                        </div>
                        <button 
                            onClick={handleExportCSV} 
                            className="btn btn-success" 
                            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', borderRadius: '8px', fontSize: '14px', fontWeight: 'bold' }}
                        >
                            <i className="fa-solid fa-file-excel"></i> تصدير Excel
                        </button>
                    </div>

                    {/* Bottom Row: Filters */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
                        
                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '180px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={deliveryStatusFilter} 
                            onChange={(e) => { setDeliveryStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات التوصيل</option>
                            <option value="Draft" style={{ background: 'var(--bg-secondary)' }}>مسودة</option>
                            <option value="Pending" style={{ background: 'var(--bg-secondary)' }}>قيد الانتظار</option>
                            <option value="10" style={{ background: 'var(--bg-secondary)' }}>طلب استلام جديد</option>
                            <option value="20" style={{ background: 'var(--bg-secondary)' }}>اتحدد مندوب</option>
                            <option value="21" style={{ background: 'var(--bg-secondary)' }}>المندوب استلم الشحنة</option>
                            <option value="24" style={{ background: 'var(--bg-secondary)' }}>وصلت مخزن بوسطة</option>
                            <option value="30" style={{ background: 'var(--bg-secondary)' }}>في الطريق بين الفروع</option>
                            <option value="41" style={{ background: 'var(--bg-secondary)' }}>خرجت للتوصيل للعميل</option>
                            <option value="45" style={{ background: 'var(--bg-secondary)' }}>تم التسليم بنجاح</option>
                            <option value="47" style={{ background: 'var(--bg-secondary)' }}>تعذر التوصيل (مشكلة)</option>
                            <option value="49" style={{ background: 'var(--bg-secondary)' }}>ملغي في بوسطة</option>
                            <option value="48" style={{ background: 'var(--bg-secondary)' }}>فشل التوصيل نهائياً</option>
                            <option value="100" style={{ background: 'var(--bg-secondary)' }}>شحنة مفقودة</option>
                            <option value="101" style={{ background: 'var(--bg-secondary)' }}>شحنة تالفة</option>
                        </select>

                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={sourceFilter} 
                            onChange={(e) => { setSourceFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل المصادر</option>
                            <option value="shopify" style={{ background: 'var(--bg-secondary)' }}>طلبات شوبيفاي</option>
                            <option value="manual" style={{ background: 'var(--bg-secondary)' }}>طلبات يدوية</option>
                        </select>

                        <select 
                            className="form-select" 
                            style={{ flex: '1', minWidth: '150px', backgroundColor: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--glass-border)', borderRadius: '8px', padding: '10px' }} 
                            value={paymentStatusFilter} 
                            onChange={(e) => { setPaymentStatusFilter(e.target.value); setCurrentPage(1); }}
                        >
                            <option value="all" style={{ background: 'var(--bg-secondary)' }}>كل حالات الدفع</option>
                            <option value="غير مدفوع" style={{ background: 'var(--bg-secondary)' }}>غير مدفوع</option>
                            <option value="مدفوع جزئي" style={{ background: 'var(--bg-secondary)' }}>مدفوع جزئي</option>
                            <option value="مدفوع" style={{ background: 'var(--bg-secondary)' }}>مدفوع</option>
                        </select>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>من:</span>
                            <input 
                                type="date" 
                                value={startDate} 
                                onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }} 
                            />
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'var(--bg-secondary)', padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--glass-border)' }}>
                            <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>إلى:</span>
                            <input 
                                type="date" 
                                value={endDate} 
                                onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }} 
                                style={{ background: 'transparent', border: 'none', color: 'var(--text-primary)', fontSize: '13px', outline: 'none', colorScheme: 'dark' }} 
                            />
                        </div>

                        {(startDate || endDate) && (
                            <button 
                                className="btn" 
                                onClick={() => { setStartDate(''); setEndDate(''); setCurrentPage(1); }} 
                                style={{ padding: '9px 12px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px', border: '1px solid rgba(231,76,60,0.3)', background: 'rgba(231,76,60,0.1)', color: '#e74c3c', borderRadius: '8px', cursor: 'pointer' }}
                            >
                                <i className="fa-solid fa-xmark"></i> مسح التواريخ
                            </button>
                        )}
                    </div>
                </div>
            </div>

            `;

content = content.slice(0, startIdx) + newFilterBar + content.slice(endIdx);
fs.writeFileSync(file, content);
console.log('Successfully replaced the filter bar!');
