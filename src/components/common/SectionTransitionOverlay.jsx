import React, { useEffect, useRef } from 'react';
import lottie from 'lottie-web';
import octaplyAnimation from '../../assets/octaply_animation.json';

const SectionTransitionOverlay = ({ isVisible, message = 'جاري جلب أحدث البيانات الحية...' }) => {
    const containerRef = useRef(null);
    const animRef = useRef(null);

    useEffect(() => {
        if (isVisible && containerRef.current) {
            try {
                animRef.current = lottie.loadAnimation({
                    container: containerRef.current,
                    renderer: 'svg',
                    loop: true,
                    autoplay: true,
                    animationData: octaplyAnimation
                });
            } catch(e) {
                console.warn("Lottie render error:", e);
            }
        }

        return () => {
            if (animRef.current) {
                try {
                    animRef.current.destroy();
                } catch(e) {}
                animRef.current = null;
            }
        };
    }, [isVisible]);

    if (!isVisible) return null;

    return (
        <div style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 999999,
            backgroundColor: 'rgba(8, 12, 22, 0.55)',
            backdropFilter: 'blur(12px)',
            WebkitBackdropFilter: 'blur(12px)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            pointerEvents: 'all'
        }}>
            {/* Ambient Floating Layer */}
            <div style={{
                position: 'relative',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center'
            }}>
                {/* Soft Radial Gold Glow */}
                <div style={{
                    position: 'absolute',
                    width: '260px',
                    height: '260px',
                    borderRadius: '50%',
                    background: 'radial-gradient(circle, rgba(245, 158, 11, 0.18) 0%, rgba(245, 158, 11, 0.04) 45%, transparent 70%)',
                    filter: 'blur(20px)',
                    animation: 'pulseGlow 2s ease-in-out infinite alternate',
                    pointerEvents: 'none'
                }}></div>

                {/* Floating Lottie Vector Animation */}
                <div ref={containerRef} style={{
                    width: '160px',
                    height: '160px',
                    position: 'relative',
                    zIndex: 2,
                    filter: 'drop-shadow(0 10px 25px rgba(245, 158, 11, 0.25))'
                }} />

                {/* Floating Pill Message */}
                <div style={{
                    position: 'relative',
                    zIndex: 2,
                    marginTop: '16px',
                    padding: '8px 22px',
                    borderRadius: '30px',
                    background: 'rgba(255, 255, 255, 0.05)',
                    border: '1px solid rgba(245, 158, 11, 0.25)',
                    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.25)',
                    fontSize: '13.5px',
                    fontWeight: '600',
                    color: 'var(--gold-primary, #f59e0b)',
                    letterSpacing: '0.4px',
                    textAlign: 'center',
                    backdropFilter: 'blur(6px)',
                    WebkitBackdropFilter: 'blur(6px)'
                }}>
                    {message}
                </div>
            </div>

            <style>{`
                @keyframes pulseGlow {
                    0% { transform: scale(0.9); opacity: 0.6; }
                    100% { transform: scale(1.15); opacity: 1; }
                }
            `}</style>
        </div>
    );
};

export default React.memo(SectionTransitionOverlay);
