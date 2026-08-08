import React, { useState } from 'react';
import Modal from './Modal';

export default function CancellationReasonModal({ isOpen, onClose, orderId, onConfirm, showSpamCheckbox = false }) {
    const [selectedPreset, setSelectedPreset] = useState('');
    const [customReason, setCustomReason] = useState('');
    const [flagAsSpam, setFlagAsSpam] = useState(false);

    const presets = [
        "❌ العميل طلب الإلغاء",
        "📞 عدم الرد على الاتصالات",
        "🚫 طلب مكرر (Duplicate)",
        "📦 نفاد مخزون المنتج",
        "📍 العنوان غير دقيق / خارج التغطية",
        "💵 رفض دفع العربون المطلوب",
        "✏️ سبب آخر"
    ];

    const handleSubmit = (e) => {
        e?.preventDefault();
        let finalReason = selectedPreset;
        if (selectedPreset === "✏️ سبب آخر" || !selectedPreset) {
            finalReason = customReason.trim() || "إلغاء يدوي من الأدمن بدون تفاصيل إضافية";
        } else if (customReason.trim()) {
            finalReason = `${selectedPreset} - ${customReason.trim()}`;
        }
        
        onConfirm(finalReason, flagAsSpam);
        // Reset state
        setSelectedPreset('');
        setCustomReason('');
        setFlagAsSpam(false);
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title={`تأكيد سبب إلغاء الطلب #${orderId || ''}`} width="520px">
            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px', direction: 'rtl' }}>
                
                {/* Warning Banner */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', background: 'rgba(239, 68, 68, 0.08)', border: '1px solid rgba(239, 68, 68, 0.2)', padding: '12px 16px', borderRadius: '12px' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(239, 68, 68, 0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444', flexShrink: 0 }}>
                        <i className="fa-solid fa-circle-exclamation" style={{ fontSize: '18px' }}></i>
                    </div>
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>
                        سيتم تغيير حالة الطلب إلى <strong>ملغى/مرفوض</strong> وتوثيق سبب الإلغاء في سجلات الأوردر وسجل النشاطات.
                    </div>
                </div>

                {/* Quick Presets */}
                <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>
                        أسباب الإلغاء السريعة (اختر سبب أو اكتب بالتفصيل):
                    </label>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                        {presets.map((preset, idx) => {
                            const isSelected = selectedPreset === preset;
                            return (
                                <button
                                    key={`preset-${idx}`}
                                    type="button"
                                    onClick={() => {
                                        setSelectedPreset(preset);
                                        if (preset !== "✏️ سبب آخر") setCustomReason('');
                                    }}
                                    style={{
                                        padding: '6px 12px',
                                        fontSize: '0.78rem',
                                        borderRadius: '20px',
                                        border: isSelected ? '1px solid #ef4444' : '1px solid var(--glass-border)',
                                        background: isSelected ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.02)',
                                        color: isSelected ? '#ef4444' : 'var(--text-primary)',
                                        fontWeight: isSelected ? '700' : '500',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease'
                                    }}
                                >
                                    {preset}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Custom Details Textarea */}
                <div>
                    <label style={{ fontSize: '0.82rem', fontWeight: '700', color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                        تفاصيل إضافية / توضيح السبب:
                    </label>
                    <textarea
                        rows="3"
                        value={customReason}
                        onChange={(e) => setCustomReason(e.target.value)}
                        placeholder="اكتب أي ملاحظات أو تفاصيل إضافية هنا..."
                        style={{
                            width: '100%',
                            padding: '10px 12px',
                            fontSize: '0.85rem',
                            borderRadius: '10px',
                            background: 'var(--glass-bg)',
                            color: 'var(--text-primary)',
                            border: '1px solid var(--glass-border)',
                            outline: 'none',
                            resize: 'vertical'
                        }}
                    />
                </div>

                {/* Optional Spam Checkbox */}
                {showSpamCheckbox && (
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '0.84rem', color: '#ef4444', fontWeight: '600', padding: '6px 0' }}>
                        <input
                            type="checkbox"
                            checked={flagAsSpam}
                            onChange={(e) => setFlagAsSpam(e.target.checked)}
                            style={{ accentColor: '#ef4444', width: '16px', height: '16px' }}
                        />
                        <span>🚩 حظر وتصنيف العميل كعميل مزعج (Spam)</span>
                    </label>
                )}

                {/* Modal Buttons */}
                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '8px', paddingTop: '12px', borderTop: '1px solid var(--glass-border)' }}>
                    <button
                        type="button"
                        onClick={onClose}
                        className="btn btn-secondary"
                        style={{ padding: '8px 18px', fontSize: '0.85rem', borderRadius: '8px' }}
                    >
                        تراجع / إلغاء
                    </button>
                    <button
                        type="submit"
                        className="btn"
                        style={{
                            padding: '8px 20px',
                            fontSize: '0.85rem',
                            borderRadius: '8px',
                            background: '#ef4444',
                            color: '#ffffff',
                            fontWeight: '700',
                            border: 'none',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px'
                        }}
                    >
                        <i className="fa-solid fa-trash-can"></i> تأكيد إلغاء الطلب
                    </button>
                </div>

            </form>
        </Modal>
    );
}
