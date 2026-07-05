const fs = require('fs');

const cssToAdd = `
/* --- Customer Profile Drawer Animations & Layout --- */

.drawer-backdrop {
    position: fixed;
    top: 0; left: 0; right: 0; bottom: 0;
    background: rgba(0, 0, 0, 0.6);
    backdrop-filter: blur(4px);
    z-index: 1040;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.3s ease, visibility 0.3s ease;
}
.drawer-backdrop.visible {
    opacity: 1;
    visibility: visible;
}

.profile-drawer {
    position: fixed;
    top: 0; bottom: 0; left: 0;
    width: 400px;
    max-width: 90vw;
    background: var(--bg-secondary);
    border-right: 1px solid var(--glass-border);
    box-shadow: 10px 0 30px rgba(0,0,0,0.5);
    z-index: 1050;
    transform: translateX(-100%);
    transition: transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    display: flex;
    flex-direction: column;
    overflow-y: auto;
}
.profile-drawer.open {
    transform: translateX(0);
}

.drawer-header {
    position: relative;
    padding: 30px 24px;
    background: linear-gradient(135deg, rgba(212, 175, 55, 0.1) 0%, rgba(0,0,0,0) 100%);
    border-bottom: 1px solid var(--glass-border);
}
.drawer-header .close-btn {
    position: absolute;
    top: 16px; left: 16px;
    background: transparent;
    border: none;
    color: var(--text-muted);
    font-size: 20px;
    cursor: pointer;
    transition: color 0.2s ease;
}
.drawer-header .close-btn:hover {
    color: var(--color-danger);
}
.customer-header-info {
    display: flex;
    align-items: center;
    gap: 16px;
}
.customer-avatar {
    width: 60px; height: 60px;
    border-radius: 50%;
    background: var(--gold-primary);
    color: #000;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 28px;
    box-shadow: 0 4px 15px rgba(212, 175, 55, 0.3);
}
.customer-details-head h2 {
    margin: 0;
    font-size: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}
.customer-details-head .vip-icon {
    color: var(--gold-primary);
    font-size: 14px;
}
.phone-line {
    margin: 4px 0 0;
    color: var(--text-secondary);
    font-family: monospace;
    font-size: 14px;
}

.drawer-stats {
    display: flex;
    padding: 20px 24px;
    gap: 16px;
    border-bottom: 1px solid var(--glass-border);
    background: rgba(0,0,0,0.1);
}
.stat-box {
    flex: 1;
    background: var(--glass-bg);
    border: 1px solid var(--glass-border);
    border-radius: 8px;
    padding: 12px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.stat-label {
    font-size: 12px;
    color: var(--text-muted);
}
.stat-value {
    font-size: 16px;
}

.drawer-body {
    padding: 24px;
    flex: 1;
}
.section-title {
    font-size: 16px;
    color: var(--gold-primary);
    margin-bottom: 20px;
    display: flex;
    align-items: center;
    gap: 8px;
}

/* Timeline */
.order-timeline {
    display: flex;
    flex-direction: column;
    gap: 20px;
    position: relative;
}
.order-timeline::before {
    content: '';
    position: absolute;
    top: 0; bottom: 0; right: 11px;
    width: 2px;
    background: var(--glass-border);
}

.timeline-item {
    position: relative;
    padding-right: 36px;
}
.timeline-dot {
    position: absolute;
    right: 5px; top: 8px;
    width: 14px; height: 14px;
    border-radius: 50%;
    background: var(--gold-primary);
    border: 3px solid var(--bg-secondary);
    z-index: 1;
}

.timeline-content {
    padding: 16px;
    border-radius: 8px;
}
.timeline-header {
    display: flex;
    justify-content: space-between;
    margin-bottom: 8px;
    border-bottom: 1px dashed var(--glass-border);
    padding-bottom: 8px;
}
.order-id {
    font-family: monospace;
    color: var(--gold-primary);
    font-weight: 600;
}
.order-date {
    font-size: 12px;
    color: var(--text-muted);
}
.order-items-preview {
    font-size: 13px;
    margin-bottom: 12px;
    line-height: 1.4;
}

.financial-breakdown {
    background: rgba(0,0,0,0.15);
    padding: 10px;
    border-radius: 6px;
    margin-bottom: 12px;
    font-size: 13px;
    display: flex;
    flex-direction: column;
    gap: 4px;
}
.fin-row {
    display: flex;
    justify-content: space-between;
}

.shipping-status-banner {
    display: flex;
    align-items: center;
}
.shipping-status-banner .badge {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 12px;
    font-size: 11px;
}

.empty-history {
    text-align: center;
    padding: 40px 20px;
    color: var(--text-muted);
}
.empty-history i {
    font-size: 32px;
    margin-bottom: 12px;
    opacity: 0.5;
}
`;

let content = fs.readFileSync('src/assets/style.css', 'utf8');
if (!content.includes('.drawer-backdrop')) {
    content += '\n' + cssToAdd;
    fs.writeFileSync('src/assets/style.css', content);
    console.log('Appended Drawer CSS');
} else {
    console.log('Drawer CSS already present');
}
