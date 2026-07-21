import React, { useRef, useEffect } from 'react';

export default function RichTextEditor({ value, onChange, placeholder }) {
    const editorRef = useRef(null);

    // Sync value from prop to editor innerHTML
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command, value = null) => {
        document.execCommand(command, false, value);
        handleInput();
    };

    // Styling for toolbar buttons
    const btnStyle = {
        background: 'transparent',
        border: 'none',
        color: 'var(--text-primary)',
        padding: '6px 10px',
        borderRadius: '4px',
        cursor: 'pointer',
        fontSize: '12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'background 0.2s',
        minWidth: '28px',
        height: '28px'
    };

    return (
        <div style={{
            border: '1px solid var(--glass-border)',
            borderRadius: '8px',
            background: 'var(--glass-bg)',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            marginTop: '6px'
        }}>
            {/* Toolbar */}
            <div style={{
                display: 'flex',
                gap: '6px',
                padding: '8px',
                background: 'rgba(0, 0, 0, 0.2)',
                borderBottom: '1px solid var(--glass-border)',
                flexWrap: 'wrap',
                alignItems: 'center'
            }}>
                <button 
                    type="button" 
                    onClick={() => execCommand('bold')} 
                    style={btnStyle} 
                    title="عريض (Bold)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-bold"></i>
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand('italic')} 
                    style={btnStyle} 
                    title="مائل (Italic)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-italic"></i>
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand('underline')} 
                    style={btnStyle} 
                    title="تحته خط (Underline)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-underline"></i>
                </button>
                
                <div style={{ width: '1px', height: '18px', background: 'var(--glass-border)', margin: '0 4px' }}></div>
                
                <button 
                    type="button" 
                    onClick={() => execCommand('insertUnorderedList')} 
                    style={btnStyle} 
                    title="قائمة نقطية (Bullet List)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-list-ul"></i>
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand('insertOrderedList')} 
                    style={btnStyle} 
                    title="قائمة رقمية (Numbered List)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-list-ol"></i>
                </button>
                
                <div style={{ width: '1px', height: '18px', background: 'var(--glass-border)', margin: '0 4px' }}></div>
                
                <button 
                    type="button" 
                    onClick={() => execCommand('justifyRight')} 
                    style={btnStyle} 
                    title="محاذاة لليمين"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-align-right"></i>
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand('justifyCenter')} 
                    style={btnStyle} 
                    title="محاذاة للوسط"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-align-center"></i>
                </button>
                <button 
                    type="button" 
                    onClick={() => execCommand('justifyLeft')} 
                    style={btnStyle} 
                    title="محاذاة لليسار"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-align-left"></i>
                </button>
                
                <div style={{ width: '1px', height: '18px', background: 'var(--glass-border)', margin: '0 4px' }}></div>
                
                <button 
                    type="button" 
                    onClick={() => execCommand('removeFormat')} 
                    style={btnStyle} 
                    title="مسح التنسيق (Clear Format)"
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                    <i className="fa-solid fa-eraser"></i>
                </button>
            </div>

            {/* Editable Area */}
            <div 
                ref={editorRef}
                contentEditable
                onInput={handleInput}
                style={{
                    padding: '12px',
                    minHeight: '150px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    lineHeight: '1.6',
                    textAlign: 'right', // RTL
                    direction: 'rtl'
                }}
                placeholder={placeholder}
            />
        </div>
    );
}
