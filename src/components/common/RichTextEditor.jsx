import React, { useRef, useEffect, useState } from 'react';

export default function RichTextEditor({ value, onChange, placeholder }) {
    const editorRef = useRef(null);
    const dropdownRef = useRef(null);
    const [showHeadingDropdown, setShowHeadingDropdown] = useState(false);

    // Sync value from prop to editor innerHTML
    useEffect(() => {
        if (editorRef.current && editorRef.current.innerHTML !== value) {
            editorRef.current.innerHTML = value || '';
        }
    }, [value]);

    // Close dropdown on click outside
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setShowHeadingDropdown(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleInput = () => {
        if (editorRef.current) {
            onChange(editorRef.current.innerHTML);
        }
    };

    const execCommand = (command, val = null) => {
        document.execCommand(command, false, val);
        handleInput();
    };

    const handleHeadingSelect = (tag) => {
        execCommand('formatBlock', `<${tag}>`);
        setShowHeadingDropdown(false);
    };

    const handlePaste = (e) => {
        e.preventDefault();
        const html = e.clipboardData.getData('text/html');
        const text = e.clipboardData.getData('text/plain');

        if (html) {
            try {
                const parser = new DOMParser();
                const doc = parser.parseFromString(html, 'text/html');
                
                // Recursively clean all elements, removing design bloat
                const cleanNode = (node) => {
                    if (node.nodeType === Node.ELEMENT_NODE) {
                        const attrs = Array.from(node.attributes);
                        attrs.forEach(attr => {
                            if (attr.name !== 'href' && attr.name !== 'src') {
                                node.removeAttribute(attr.name);
                            }
                        });
                        Array.from(node.childNodes).forEach(cleanNode);
                    }
                };

                cleanNode(doc.body);
                const cleanedHtml = doc.body.innerHTML;
                document.execCommand('insertHTML', false, cleanedHtml);
                return;
            } catch (err) {
                console.error("Failed to sanitize pasted HTML, pasting plain text:", err);
            }
        }
        
        if (text) {
            document.execCommand('insertText', false, text);
        }
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

    const headingOptions = [
        { label: 'Paragraph', tag: 'p', style: { fontSize: '13px', fontWeight: 'normal', color: 'var(--text-primary)' } },
        { label: 'Heading 1', tag: 'h1', style: { fontSize: '18px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Heading 2', tag: 'h2', style: { fontSize: '16px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Heading 3', tag: 'h3', style: { fontSize: '14px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Heading 4', tag: 'h4', style: { fontSize: '13px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Heading 5', tag: 'h5', style: { fontSize: '12.5px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Heading 6', tag: 'h6', style: { fontSize: '12px', fontWeight: 'bold', margin: '4px 0', color: '#fff' } },
        { label: 'Blockquote', tag: 'blockquote', style: { fontSize: '13px', fontStyle: 'italic', borderLeft: '3px solid var(--gold-primary)', paddingLeft: '8px', color: 'var(--text-secondary)' } }
    ];

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
                {/* Heading selector dropdown */}
                <div ref={dropdownRef} style={{ position: 'relative' }}>
                    <button 
                        type="button" 
                        onClick={() => setShowHeadingDropdown(prev => !prev)}
                        style={{
                            ...btnStyle,
                            width: 'auto',
                            minWidth: '120px',
                            justifyContent: 'space-between',
                            gap: '8px',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '4px',
                            background: 'rgba(255,255,255,0.03)'
                        }}
                    >
                        <span>العناوين / الفقرة</span>
                        <i className={`fa-solid fa-chevron-${showHeadingDropdown ? 'up' : 'down'}`} style={{ fontSize: '10px' }}></i>
                    </button>
                    {showHeadingDropdown && (
                        <div style={{
                            position: 'absolute',
                            top: '100%',
                            left: 0,
                            marginTop: '4px',
                            background: '#1a1a1f',
                            border: '1px solid var(--glass-border)',
                            borderRadius: '6px',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
                            zIndex: 1000,
                            minWidth: '180px',
                            padding: '6px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '2px'
                        }}>
                            {headingOptions.map((opt) => (
                                <button
                                    key={opt.tag}
                                    type="button"
                                    onClick={() => handleHeadingSelect(opt.tag)}
                                    style={{
                                        background: 'transparent',
                                        border: 'none',
                                        padding: '8px 12px',
                                        borderRadius: '4px',
                                        cursor: 'pointer',
                                        textAlign: 'left',
                                        display: 'block',
                                        width: '100%',
                                        transition: 'background 0.2s',
                                        ...opt.style
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                >
                                    {opt.label}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <div style={{ width: '1px', height: '18px', background: 'var(--glass-border)', margin: '0 4px' }}></div>

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
                onPaste={handlePaste}
                className="rich-text-editor-content"
                dir="auto"
                style={{
                    padding: '12px',
                    minHeight: '150px',
                    maxHeight: '300px',
                    overflowY: 'auto',
                    outline: 'none',
                    color: 'var(--text-primary)',
                    fontFamily: 'inherit',
                    fontSize: '13px',
                    lineHeight: '1.6'
                }}
                placeholder={placeholder}
            />
        </div>
    );
}
