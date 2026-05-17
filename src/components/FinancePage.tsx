import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Minus, 
  Calendar as CalendarIcon, 
  DollarSign, 
  Tag, 
  FileText,
  TrendingUp,
  TrendingDown,
  Clock
} from 'lucide-react';
import MainLayout from '../layouts/MainLayout';
import ForgeLoader from './ForgeLoader';
import { financeApi, expenseApi } from '../services/api';

const FinancePage: React.FC = () => {
  const [records, setRecords] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  
  // Form State
  const [formData, setFormData] = useState({
    type: 'INCOME',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    category: '',
    description: ''
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setIsLoading(true);
      const [recRes, catRes] = await Promise.all([
        financeApi.getAll(),
        expenseApi.getAll()
      ]);
      setRecords(recRes.data.data || []);
      setCategories(catRes.data.data || []);
    } catch (err: any) {
      setError('Failed to load finance data');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.amount || (formData.type === 'EXPENSE' && !formData.category)) {
      alert('Please fill all required fields');
      return;
    }

    try {
      setIsSubmitting(true);
      await financeApi.create(formData);
      setFormData({
        type: 'INCOME',
        amount: '',
        date: new Date().toISOString().split('T')[0],
        category: '',
        description: ''
      });
      fetchData();
    } catch (err: any) {
      alert('Failed to save record');
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalIncome = records.filter(r => r.type === 'INCOME').reduce((s, r) => s + (r.amount || 0), 0);
  const totalExpense = records.filter(r => r.type === 'EXPENSE').reduce((s, r) => s + (r.amount || 0), 0);

  if (isLoading) return <ForgeLoader />;

  return (
    <MainLayout>
      <div className="finance-page">
        <header className="page-header">
          <div className="header-title">
            <h1>FINANCE MANAGEMENT</h1>
            <p className="subtitle">MANUAL INCOME & EXPENSE TRACKING</p>
          </div>
        </header>

        <section className="stats-grid">
          <div className="stat-card">
            <div className="stat-icon income"><TrendingUp size={20} /></div>
            <div className="stat-info">
              <label>TOTAL INCOME</label>
              <h3>₹ {totalIncome.toLocaleString()}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon expense"><TrendingDown size={20} /></div>
            <div className="stat-info">
              <label>TOTAL EXPENSE</label>
              <h3>₹ {totalExpense.toLocaleString()}</h3>
            </div>
          </div>
          <div className="stat-card">
            <div className="stat-icon balance"><DollarSign size={20} /></div>
            <div className="stat-info">
              <label>NET BALANCE</label>
              <h3>₹ {(totalIncome - totalExpense).toLocaleString()}</h3>
            </div>
          </div>
        </section>

        <div className="finance-split">
          <div className="split-left">
            <div className="panel entry-panel">
              <div className="panel-header">
                <h2><Plus size={14} /> NEW ENTRY</h2>
              </div>
              <form onSubmit={handleSubmit} className="entry-form">
                <div className="type-toggle">
                  <button 
                    type="button" 
                    className={`toggle-btn income ${formData.type === 'INCOME' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, type: 'INCOME', category: ''})}
                  >
                    INCOME
                  </button>
                  <button 
                    type="button" 
                    className={`toggle-btn expense ${formData.type === 'EXPENSE' ? 'active' : ''}`}
                    onClick={() => setFormData({...formData, type: 'EXPENSE'})}
                  >
                    EXPENSE
                  </button>
                </div>

                <div className="form-group">
                  <label><DollarSign size={12} /> AMOUNT</label>
                  <input 
                    type="number" 
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={(e) => setFormData({...formData, amount: e.target.value})}
                    required
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label><CalendarIcon size={12} /> DATE</label>
                    <input 
                      type="date" 
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      required
                    />
                  </div>
                  {formData.type === 'EXPENSE' && (
                    <div className="form-group">
                      <label><Tag size={12} /> CATEGORY</label>
                      <select 
                        value={formData.category}
                        onChange={(e) => setFormData({...formData, category: e.target.value})}
                        required
                      >
                        <option value="">Select Type</option>
                        {categories.map(cat => (
                          <option key={cat._id} value={cat._id}>{cat.categoryName}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>

                <div className="form-group">
                  <label><FileText size={12} /> DESCRIPTION (OPTIONAL)</label>
                  <textarea 
                    placeholder="Details about this entry..."
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                  />
                </div>

                <button type="submit" className="btn-submit" disabled={isSubmitting}>
                  {isSubmitting ? 'SAVING...' : 'SAVE ENTRY'}
                </button>
              </form>
            </div>
          </div>

          <div className="split-right">
            <div className="panel history-panel">
              <div className="panel-header">
                <h2><Clock size={14} /> RECENT TRANSACTIONS</h2>
              </div>
              <div className="history-list scroll-inside">
                {records.map((rec) => (
                  <div key={rec._id} className={`history-item ${rec.type.toLowerCase()}`}>
                    <div className="hi-left">
                      <div className="hi-icon">
                        {rec.type === 'INCOME' ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                      </div>
                      <div className="hi-info">
                        <span className="hi-type">{rec.type}</span>
                        <span className="hi-date">{new Date(rec.date).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="hi-mid">
                      {rec.category && <span className="hi-cat">{rec.category.categoryName}</span>}
                      <p className="hi-desc">{rec.description || 'No description'}</p>
                    </div>
                    <div className="hi-right">
                      <span className="hi-amount">₹ {rec.amount.toLocaleString()}</span>
                    </div>
                  </div>
                ))}
                {records.length === 0 && <div className="empty-state">No transactions recorded yet.</div>}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        .finance-page { padding: 0; }
        .page-header { margin-bottom: 24px; }
        .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 32px; }
        .stat-card { background: var(--bg-sidebar); border: 1px solid var(--border-main); padding: 24px; display: flex; align-items: center; gap: 16px; }
        .stat-icon { width: 42px; height: 42px; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; }
        .stat-icon.income { color: #10b981; border: 1px solid rgba(16,185,129,0.1); }
        .stat-icon.expense { color: #ef4444; border: 1px solid rgba(239,68,68,0.1); }
        .stat-icon.balance { color: var(--primary); border: 1px solid rgba(249,115,22,0.1); }
        .stat-info label { display: block; font-size: 0.6rem; font-weight: 800; color: var(--text-dim); margin-bottom: 4px; letter-spacing: 0.5px; }
        .stat-info h3 { font-size: 1.3rem; font-weight: 800; color: var(--text-main); }

        .finance-split { display: grid; grid-template-columns: 400px 1fr; gap: 24px; }
        .panel { background: var(--bg-sidebar); border: 1px solid var(--border-main); height: 100%; display: flex; flex-direction: column; }
        .panel-header { padding: 16px 20px; border-bottom: 1px solid var(--border-main); display: flex; align-items: center; gap: 10px; }
        .panel-header h2 { font-size: 0.75rem; font-weight: 800; color: var(--text-main); letter-spacing: 0.5px; display: flex; align-items: center; gap: 8px; }

        .entry-form { padding: 24px; display: flex; flex-direction: column; gap: 20px; }
        .type-toggle { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; background: rgba(0,0,0,0.2); padding: 4px; border: 1px solid var(--border-main); }
        .toggle-btn { background: none; border: none; color: var(--text-dim); padding: 10px; font-size: 0.7rem; font-weight: 800; cursor: pointer; transition: 0.2s; }
        .toggle-btn.income.active { background: #10b981; color: white; }
        .toggle-btn.expense.active { background: #ef4444; color: white; }

        .form-group { display: flex; flex-direction: column; gap: 8px; }
        .form-group label { font-size: 0.6rem; font-weight: 800; color: var(--text-dim); display: flex; align-items: center; gap: 6px; }
        .form-group input, .form-group select, .form-group textarea { background: rgba(0,0,0,0.2); border: 1px solid var(--border-main); padding: 10px 12px; color: var(--text-main); font-size: 0.85rem; outline: none; }
        .form-group input:focus, .form-group select:focus, .form-group textarea:focus { border-color: var(--primary); }
        .form-group textarea { height: 80px; resize: none; }
        .form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        .btn-submit { background: var(--primary); color: white; border: none; padding: 14px; font-weight: 800; font-size: 0.75rem; cursor: pointer; transition: 0.2s; letter-spacing: 1px; }
        .btn-submit:hover { opacity: 0.9; transform: translateY(-1px); }
        .btn-submit:disabled { opacity: 0.5; cursor: not-allowed; }

        .history-list { padding: 12px; max-height: 520px; overflow-y: auto; display: flex; flex-direction: column; gap: 8px; }
        .history-item { padding: 16px; background: rgba(0,0,0,0.15); border: 1px solid var(--border-main); display: grid; grid-template-columns: 140px 1fr 120px; align-items: center; gap: 20px; }
        .history-item.income { border-left: 3px solid #10b981; }
        .history-item.expense { border-left: 3px solid #ef4444; }

        .hi-left { display: flex; align-items: center; gap: 12px; }
        .hi-icon { width: 32px; height: 32px; background: rgba(0,0,0,0.2); display: flex; align-items: center; justify-content: center; }
        .income .hi-icon { color: #10b981; }
        .expense .hi-icon { color: #ef4444; }
        .hi-info { display: flex; flex-direction: column; }
        .hi-type { font-size: 0.65rem; font-weight: 800; }
        .hi-date { font-size: 0.65rem; color: var(--text-dim); font-weight: 600; }

        .hi-mid { display: flex; flex-direction: column; gap: 4px; }
        .hi-cat { font-size: 0.6rem; font-weight: 800; color: var(--primary); text-transform: uppercase; letter-spacing: 0.5px; }
        .hi-desc { font-size: 0.75rem; color: var(--text-dim); }
        .hi-right { text-align: right; }
        .hi-amount { font-size: 0.9rem; font-weight: 800; }
        .income .hi-amount { color: #10b981; }
        .expense .hi-amount { color: #ef4444; }

        .empty-state { padding: 60px; text-align: center; color: var(--text-dim); font-size: 0.8rem; font-weight: 700; }
      `}</style>
    </MainLayout>
  );
};

export default FinancePage;
