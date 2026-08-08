import React, { useEffect, useState, useRef } from 'react';

/**
 * TopProgressBar Component
 * Provides a modern, high-tech glowing laser progress bar across the top of the screen
 * during section transitions (similar to YouTube / GitHub / Shopify Admin).
 */
export default function TopProgressBar({ currentView }) {
    const [progress, setProgress] = useState(0);
    const [visible, setVisible] = useState(false);
    const isFirstRender = useRef(true);

    const triggerLoading = () => {
        setVisible(true);
        setProgress(20);

        const t1 = setTimeout(() => setProgress(75), 80);
        const t2 = setTimeout(() => setProgress(100), 220);
        const t3 = setTimeout(() => {
            setVisible(false);
            setTimeout(() => setProgress(0), 250);
        }, 450);

        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
        };
    };

    // Trigger on currentView transition
    useEffect(() => {
        if (isFirstRender.current) {
            isFirstRender.current = false;
            return;
        }
        const cleanup = triggerLoading();
        return cleanup;
    }, [currentView]);

    // Also allow global custom event triggering: window.dispatchEvent(new CustomEvent('app:top-loading'))
    useEffect(() => {
        const handleGlobalTrigger = () => triggerLoading();
        window.addEventListener('app:top-loading', handleGlobalTrigger);
        return () => window.removeEventListener('app:top-loading', handleGlobalTrigger);
    }, []);

    if (!visible && progress === 0) return null;

    return (
        <div 
            style={{
                position: 'fixed',
                top: 0,
                left: 0,
                right: 0,
                height: '3px',
                zIndex: 999999,
                pointerEvents: 'none',
                backgroundColor: 'transparent',
                overflow: 'hidden'
            }}
        >
            <div 
                style={{
                    height: '100%',
                    width: `${progress}%`,
                    background: 'linear-gradient(90deg, #10b981 0%, #06b6d4 50%, #6366f1 100%)',
                    boxShadow: '0 0 12px #10b981, 0 0 6px #06b6d4, 0 0 20px rgba(16, 185, 129, 0.8)',
                    borderRadius: '0 3px 3px 0',
                    transition: progress === 100 
                        ? 'width 0.15s ease-out, opacity 0.25s ease-in' 
                        : 'width 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
                    opacity: visible ? 1 : 0
                }}
            />
            {/* Leading Glow Head Dot */}
            {visible && progress < 100 && (
                <div 
                    style={{
                        position: 'absolute',
                        top: '-1px',
                        left: `calc(${progress}% - 5px)`,
                        width: '10px',
                        height: '5px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        boxShadow: '0 0 14px 4px #10b981, 0 0 22px 6px #06b6d4',
                        transition: 'left 0.25s cubic-bezier(0.4, 0, 0.2, 1)'
                    }}
                />
            )}
        </div>
    );
}
