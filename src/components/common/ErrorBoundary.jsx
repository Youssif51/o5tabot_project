import React from 'react';

export default class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error("ErrorBoundary caught an error:", error, errorInfo);
        
        // Auto-recover from chunk / dynamic import load errors (e.g. after fresh deployments)
        const errMsg = String(error?.message || '');
        if (
            errMsg.includes('dynamically imported module') ||
            errMsg.includes('Loading chunk') ||
            errMsg.includes('Failed to fetch') ||
            errMsg.includes('Importing a module script failed')
        ) {
            const lastReload = sessionStorage.getItem('last_chunk_reload');
            const now = Date.now();
            if (!lastReload || now - parseInt(lastReload) > 10000) {
                sessionStorage.setItem('last_chunk_reload', String(now));
                window.location.reload();
            }
        }
    }

    handleHardReset = () => {
        try {
            localStorage.removeItem('octabot_state');
            sessionStorage.clear();
        } catch (e) {}
        window.location.href = window.location.pathname + (window.location.search ? '' : '?t=' + Date.now());
    };

    render() {
        if (this.state.hasError) {
            return (
                <div style={{
                    minHeight: '100vh',
                    width: '100%',
                    background: '#0d1117',
                    color: '#e6edf3',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '24px',
                    fontFamily: 'Cairo, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
                    direction: 'rtl',
                    textAlign: 'center'
                }}>
                    <div style={{
                        maxWidth: '460px',
                        width: '100%',
                        background: 'rgba(22, 27, 34, 0.95)',
                        border: '1px solid rgba(240, 185, 11, 0.25)',
                        boxShadow: '0 20px 40px rgba(0,0,0,0.6), 0 0 20px rgba(240, 185, 11, 0.1)',
                        borderRadius: '20px',
                        padding: '32px 24px',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '16px'
                    }}>
                        <div style={{
                            width: '64px',
                            height: '64px',
                            borderRadius: '50%',
                            background: 'rgba(240, 185, 11, 0.15)',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '28px',
                            color: '#f0b90b',
                            marginBottom: '4px'
                        }}>
                            <i className="fa-solid fa-arrows-rotate"></i>
                        </div>

                        <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#fff' }}>
                            تحديث في النظام
                        </h2>

                        <p style={{ margin: 0, fontSize: '13.5px', color: '#8b949e', lineHeight: 1.6 }}>
                            تم رصد تحديث في ملفات الموقع أو البيانات المحفوظة. يرجى الضغط أدناه لتحديث الصفحة ومزامنة أحدث نسخة فوراً.
                        </p>

                        {this.state.error?.message && (
                            <div style={{
                                width: '100%',
                                padding: '8px 12px',
                                background: 'rgba(239, 68, 68, 0.1)',
                                border: '1px solid rgba(239, 68, 68, 0.25)',
                                borderRadius: '8px',
                                fontSize: '11px',
                                color: '#fca5a5',
                                textAlign: 'left',
                                direction: 'ltr',
                                wordBreak: 'break-word',
                                fontFamily: 'monospace',
                                maxHeight: '80px',
                                overflowY: 'auto'
                            }}>
                                {this.state.error.message}
                            </div>
                        )}

                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', width: '100%', marginTop: '8px' }}>
                            <button
                                onClick={this.handleHardReset}
                                style={{
                                    width: '100%',
                                    background: 'linear-gradient(135deg, #f0b90b, #d49b00)',
                                    color: '#000',
                                    border: 'none',
                                    padding: '12px 18px',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontWeight: 700,
                                    cursor: 'pointer',
                                    boxShadow: '0 4px 14px rgba(240, 185, 11, 0.35)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '8px',
                                    transition: 'all 0.2s ease'
                                }}
                            >
                                <i className="fa-solid fa-rotate-right"></i>
                                تحديث ومزامنة النظام الآن
                            </button>
                        </div>
                    </div>
                </div>
            );
        }

        return this.props.children;
    }
}
