import React, { useState, useEffect, useContext } from 'react';
import { supabase } from '../../utils/supabase';
import { AppContext } from '../../context/AppContext';

export default function SupabaseTodos() {
    const { t, showToast } = useContext(AppContext);
    const [todos, setTodos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [newTodoName, setNewTodoName] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Render warning if Supabase credentials are not configured
    if (!supabase) {
        return (
            <div id="supabase-todos-view" className="view-pane active">
                <div className="glass-card" style={{ padding: '40px', textAlign: 'center', border: '2px dashed var(--color-danger)', marginTop: '24px' }}>
                    <i className="fa-solid fa-triangle-exclamation" style={{ fontSize: '48px', color: 'var(--color-danger)', marginBottom: '16px' }}></i>
                    <h3 style={{ color: '#fff', marginBottom: '12px' }}>اتصال Supabase غير مهيأ / Supabase Not Configured</h3>
                    <p style={{ color: 'var(--text-secondary)', maxWidth: '600px', margin: '0 auto 20px', lineHeight: 1.6, fontSize: '14px' }}>
                        يرجى إضافة المتغيرات البيئية <code style={{ color: 'var(--gold-primary)' }}>VITE_SUPABASE_URL</code> و <code style={{ color: 'var(--gold-primary)' }}>VITE_SUPABASE_PUBLISHABLE_KEY</code> في لوحة تحكم Vercel (Project Settings &gt; Environment Variables) ثم قم بإعادة بناء المشروع (Redeploy).
                    </p>
                </div>
            </div>
        );
    }

    // Fetch todos on load
    const fetchTodos = async () => {
        setLoading(true);
        try {
            const { data, error } = await supabase
                .from('todos')
                .select('*')
                .order('id', { ascending: true });

            if (error) throw error;
            setTodos(data || []);
        } catch (err) {
            console.error('Error fetching todos:', err.message);
            showToast(`Supabase Error: ${err.message}`, 'error');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchTodos();
    }, []);

    // Add new todo
    const handleAddTodo = async (e) => {
        e.preventDefault();
        if (!newTodoName.trim()) return;

        setIsSubmitting(true);
        try {
            // Supabase schema usually uses 'name' or 'title', 'is_completed' or 'completed'
            const { data, error } = await supabase
                .from('todos')
                .insert([{ name: newTodoName.trim() }])
                .select();

            if (error) throw error;
            showToast('Task added successfully to Supabase!');
            setNewTodoName('');
            fetchTodos();
        } catch (err) {
            console.error('Error adding todo:', err.message);
            showToast(`Failed to add task: ${err.message}`, 'error');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Toggle completed status
    const handleToggleTodo = async (todo) => {
        try {
            // Try updating both standard field names 'is_completed' and 'completed' to be safe
            const updatedCompleted = !todo.is_completed;
            const { error } = await supabase
                .from('todos')
                .update({ 
                    is_completed: updatedCompleted,
                    completed: updatedCompleted 
                })
                .eq('id', todo.id);

            if (error) throw error;
            showToast('Task status updated!');
            setTodos(todos.map(t => t.id === todo.id ? { ...t, is_completed: updatedCompleted, completed: updatedCompleted } : t));
        } catch (err) {
            console.error('Error toggling status:', err.message);
            showToast(`Failed to update status: ${err.message}`, 'error');
        }
    };

    // Delete todo
    const handleDeleteTodo = async (id) => {
        if (!window.confirm('Delete this task permanently from Supabase?')) return;
        try {
            const { error } = await supabase
                .from('todos')
                .delete()
                .eq('id', id);

            if (error) throw error;
            showToast('Task deleted from Supabase!');
            setTodos(todos.filter(t => t.id !== id));
        } catch (err) {
            console.error('Error deleting todo:', err.message);
            showToast(`Failed to delete task: ${err.message}`, 'error');
        }
    };

    return (
        <div id="supabase-todos-view" className="view-pane active">
            <div className="page-header">
                <div className="page-title-group">
                    <h2>{t('supabaseTasks')}</h2>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>
                        Live cloud database connection with Supabase Table: <code style={{ color: 'var(--gold-primary)', background: 'rgba(255,255,255,0.05)', padding: '2px 6px', borderRadius: '4px', fontFamily: 'monospace' }}>todos</code>
                    </p>
                </div>
                <div className="page-actions">
                    <button className="btn btn-secondary" onClick={fetchTodos} disabled={loading}>
                        <i className={`fa-solid fa-rotate ${loading ? 'fa-spin' : ''}`} style={{ marginRight: '6px' }}></i>
                        Sync Now
                    </button>
                </div>
            </div>

            <div className="dashboard-grid grid-2-1" style={{ marginTop: '24px', alignItems: 'start' }}>
                
                {/* Left side: Tasks List */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        <h3 style={{ margin: 0, color: '#fff', fontSize: '15px' }}>Task Queue</h3>
                        <span className="badge badge-in" style={{ fontSize: '11px' }}>{todos.length} Total</span>
                    </div>

                    {loading ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)' }}>
                            <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '24px', marginBottom: '12px', color: 'var(--gold-primary)' }}></i>
                            <p>Loading cloud database records...</p>
                        </div>
                    ) : todos.length === 0 ? (
                        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-muted)', border: '2px dashed var(--glass-border)', borderRadius: '8px' }}>
                            <i className="fa-solid fa-cloud-arrow-up" style={{ fontSize: '32px', marginBottom: '12px', color: 'var(--text-secondary)' }}></i>
                            <p>No task entries found in Supabase.</p>
                            <p style={{ fontSize: '11px', marginTop: '6px' }}>Add a new task using the entry form to get started.</p>
                        </div>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            {todos.map(todo => {
                                const isDone = todo.is_completed || todo.completed;
                                return (
                                    <div 
                                        key={todo.id} 
                                        style={{ 
                                            display: 'flex', 
                                            justifyContent: 'space-between', 
                                            alignItems: 'center', 
                                            padding: '14px 18px', 
                                            background: isDone ? 'rgba(255,255,255,0.01)' : 'rgba(255,255,255,0.03)', 
                                            borderRadius: '8px',
                                            border: '1px solid var(--glass-border)',
                                            transition: 'all 0.2s'
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                                            <input 
                                                type="checkbox" 
                                                checked={!!isDone} 
                                                onChange={() => handleToggleTodo(todo)}
                                                style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--gold-primary)' }}
                                            />
                                            <span style={{ 
                                                fontSize: '14px', 
                                                color: isDone ? 'var(--text-muted)' : '#fff',
                                                textDecoration: isDone ? 'line-through' : 'none',
                                                fontWeight: isDone ? 400 : 500
                                            }}>
                                                {todo.name}
                                            </span>
                                        </div>
                                        
                                        <button 
                                            className="action-btn-circle" 
                                            onClick={() => handleDeleteTodo(todo.id)}
                                            style={{ border: 'none', background: 'rgba(255,75,75,0.1)', color: 'var(--color-danger)', width: '28px', height: '28px' }}
                                        >
                                            <i className="fa-solid fa-trash" style={{ fontSize: '11px' }}></i>
                                        </button>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Right side: Add Task Form */}
                <div className="glass-card" style={{ padding: '24px' }}>
                    <h3 style={{ fontSize: '15px', color: '#fff', marginBottom: '18px', borderBottom: '1px solid var(--glass-border)', paddingBottom: '10px' }}>
                        Create Task Entry
                    </h3>
                    <form onSubmit={handleAddTodo}>
                        <div className="form-group">
                            <label className="form-label" style={{ fontWeight: 600 }}>Task Name / Description*</label>
                            <input 
                                type="text" 
                                className="form-input" 
                                placeholder="e.g. Audit warehouse stock inventory"
                                value={newTodoName}
                                onChange={(e) => setNewTodoName(e.target.value)}
                                required 
                            />
                        </div>
                        <button 
                            type="submit" 
                            className="btn btn-primary" 
                            disabled={isSubmitting || !newTodoName.trim()}
                            style={{ width: '100%', marginTop: '16px', padding: '10px 0' }}
                        >
                            {isSubmitting ? (
                                <><i className="fa-solid fa-spinner fa-spin" style={{ marginRight: '6px' }}></i> Adding...</>
                            ) : (
                                <><i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '6px' }}></i> Push to Cloud</>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
}
