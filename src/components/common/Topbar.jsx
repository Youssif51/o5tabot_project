import React, { useContext } from 'react';
import { AppContext } from '../../context/AppContext';

export default function Topbar({ globalSearch, setGlobalSearch }) {
    const { state, setCurrentView, showToast, language, setLanguage, theme, setTheme, t } = useContext(AppContext);

    if (!state.currentUser) return null;

    return (
        <div className="top-bar">
            <div className="top-bar-search" style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                <img 
                    src="/icons/Search.png" 
                    alt="Search" 
                    style={{ position: 'absolute', left: '14px', width: '18px', height: '18px', objectFit: 'contain', pointerEvents: 'none' }} 
                />
                <input 
                    type="text" 
                    placeholder={t('searchPlaceholder')}
                    value={globalSearch || ''}
                    onChange={(e) => setGlobalSearch(e.target.value)}
                    style={{ paddingLeft: '44px' }}
                />
            </div>
            <div className="top-bar-actions" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                {/* Theme Switch Button */}
                <button 
                    className="top-bar-icon-btn" 
                    onClick={() => setTheme(prev => prev === 'dark' ? 'light' : 'dark')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                    title={theme === 'dark' ? 'Light Mode' : 'Dark Mode'}
                >
                    {theme === 'dark' ? (
                        <i className="fa-solid fa-sun" style={{ color: '#fff', fontSize: '16px' }}></i>
                    ) : (
                        <i className="fa-solid fa-moon" style={{ color: '#121214', fontSize: '16px' }}></i>
                    )}
                </button>

                {/* Language Switch Button */}
                <button 
                    className="btn btn-secondary" 
                    onClick={() => setLanguage(prev => prev === 'en' ? 'ar' : 'en')}
                    style={{ padding: '6px 12px', fontSize: '11px', fontWeight: 700 }}
                >
                    {language === 'en' ? 'العربية' : 'English'}
                </button>

                <div 
                    className="top-bar-icon-btn" 
                    onClick={() => showToast(t('noNotifications'), 'info')}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                >
                    <img 
                        src="/icons/Notification.png" 
                        alt="Notifications" 
                        style={{ width: '20px', height: '20px', objectFit: 'contain' }}
                    />
                    <span className="bell-dot"></span>
                </div>
                <div 
                    className="top-profile-avatar" 
                    onClick={() => setCurrentView('store')}
                >
                    <div className="user-avatar" id="top-avatar-lbl">
                        {state.currentUser.avatar || 'A'}
                    </div>
                </div>
            </div>
        </div>
    );
}
