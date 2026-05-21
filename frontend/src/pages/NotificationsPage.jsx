import { useState, useEffect } from 'react';
import { api } from '../api/client';

const TYPE_CONFIG = {
  TEST:          { badge:'badge-blue',   label:'🧪 Test',           color:'var(--accent-blue)'   },
  RECALL_ALERT:  { badge:'badge-red',    label:'⚠ Recall Alert',   color:'var(--accent-red)'    },
  ADVERSE_EVENT: { badge:'badge-amber',  label:'⚠ Adverse Event',  color:'var(--accent-amber)'  },
  MDR_REMINDER:  { badge:'badge-purple', label:'⏰ MDR Reminder',   color:'var(--accent-purple)' },
  WELCOME:       { badge:'badge-green',  label:'👤 Welcome',        color:'var(--accent-green)'  },
};

export default function NotificationsPage() {
  const [users,       setUsers]       = useState([]);
  const [emailLog,    setEmailLog]    = useState([]);
  const [loading,     setLoading]     = useState(false);
  const [logLoading,  setLogLoading]  = useState(false);
  const [testEmail,   setTestEmail]   = useState('');
  const [testBusy,    setTestBusy]    = useState(false);
  const [testMsg,     setTestMsg]     = useState(null);
  const [editingUser, setEditingUser] = useState(null);
  const [editEmail,   setEditEmail]   = useState('');
  const [editBusy,    setEditBusy]    = useState(false);
  const [editMsg,     setEditMsg]     = useState(null);
  const [search,      setSearch]      = useState('');

  useEffect(() => {
    loadUsers();
    loadLog();
  }, []);

  const loadUsers = async () => {
    setLoading(true);
    try { setUsers(await api.getEmailUsers() || []); } catch {}
    setLoading(false);
  };

  const loadLog = async () => {
    setLogLoading(true);
    try { setEmailLog(await api.getEmailLog() || []); } catch {}
    setLogLoading(false);
  };

  const sendTest = async () => {
    if (!testEmail.trim()) return;
    setTestBusy(true); setTestMsg(null);
    try {
      await api.sendTestEmail(testEmail.trim());
      setTestMsg({ type:'success', text:'Test email sent to ' + testEmail });
      setTestEmail('');
      setTimeout(()=>setTestMsg(null), 4000);
      loadLog();
    } catch (err) { setTestMsg({ type:'error', text: err.message }); }
    finally { setTestBusy(false); }
  };

  const saveEmail = async (username) => {
    setEditBusy(true); setEditMsg(null);
    try {
      await api.setUserEmail(username, editEmail);
      setEditMsg({ type:'success', text:'Email saved for ' + username });
      setTimeout(()=>{ setEditMsg(null); setEditingUser(null); }, 2000);
      loadUsers();
    } catch (err) { setEditMsg({ type:'error', text: err.message }); }
    finally { setEditBusy(false); }
  };

  const filteredUsers = users.filter(u => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (u.username||'').toLowerCase().includes(q) ||
           (u.role||'').toLowerCase().includes(q) ||
           (u.hospital_id||'').toLowerCase().includes(q);
  });

  const usersWithEmail    = users.filter(u => u.email);
  const usersWithoutEmail = users.filter(u => !u.email);

  return (
    <>
      <div className="page-header">
        <h2>📧 Email Notifications</h2>
        <p>Configure user emails and manage notification delivery — powered by SendGrid</p>
      </div>

      {/* Status + Test */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:16 }}>

        {/* Config status */}
        <div className="card">
          <div className="card-header"><span className="card-title">⚙ Configuration</span></div>
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {[
              { label:'Email Provider',    value:'SendGrid',                             ok:true  },
              { label:'From Address',      value:'noreply@implantchain.dapparchitects.com', ok:true },
              { label:'API Key',           value:'Configured via .env',                  ok:true  },
              { label:'Domain Auth',       value:'implantchain.dapparchitects.com',       ok:true  },
            ].map(item=>(
              <div key={item.label} style={{ display:'flex', justifyContent:'space-between',
                padding:'8px 0', borderBottom:'1px solid var(--border)' }}>
                <span style={{ fontSize:12, color:'var(--text-muted)' }}>{item.label}</span>
                <span style={{ fontSize:12, color:item.ok?'var(--accent-green)':'var(--accent-red)',
                  fontWeight:600 }}>{item.ok?'✓':''} {item.value}</span>
              </div>
            ))}
          </div>
          <div style={{ marginTop:12, fontSize:12, color:'var(--text-secondary)', lineHeight:1.6 }}>
            <strong>Active triggers:</strong><br/>
            • Recall Lot → IP Officers<br/>
            • Adverse Event → IP Officers<br/>
            • MDR Deadline (≤7 days) → Daily cron<br/>
            • New User Created → Welcome email
          </div>
        </div>

        {/* Test email */}
        <div className="card">
          <div className="card-header"><span className="card-title">🧪 Test Email</span></div>
          <p style={{ fontSize:12, color:'var(--text-secondary)', marginBottom:16 }}>
            Send a test email to verify SendGrid is working correctly.
          </p>
          {testMsg && (
            <div className={'alert alert-'+testMsg.type} style={{ marginBottom:12 }}>
              {testMsg.type==='error'?'⚠':'✓'} {testMsg.text}
            </div>
          )}
          <div style={{ display:'flex', gap:8 }}>
            <input placeholder="Enter email address to test..."
              value={testEmail} onChange={e=>setTestEmail(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&sendTest()}
              style={{ flex:1 }}/>
            <button className="btn btn-primary" onClick={sendTest}
              disabled={testBusy||!testEmail.trim()}>
              {testBusy?<><span className="spinner" style={{width:14,height:14}}/> Sending…</>:'📧 Send Test'}
            </button>
          </div>
          <div style={{ marginTop:16, padding:'12px 14px', background:'rgba(59,130,246,0.06)',
            borderRadius:'var(--radius-sm)', border:'1px solid rgba(59,130,246,0.2)',
            fontSize:12, color:'var(--text-secondary)' }}>
            <strong>Note:</strong> Notifications only send to users who have an email address set below.
            Set emails for IP officers to activate recall and MDR notifications.
          </div>
        </div>
      </div>

      {/* User email management */}
      <div className="card" style={{ marginBottom:16 }}>
        <div className="card-header">
          <span className="card-title">
            👥 User Email Addresses
            <span className="badge badge-green" style={{ marginLeft:8 }}>{usersWithEmail.length} configured</span>
            {usersWithoutEmail.length > 0 && (
              <span className="badge badge-amber" style={{ marginLeft:4 }}>{usersWithoutEmail.length} missing</span>
            )}
          </span>
          <div style={{ display:'flex', gap:8 }}>
            <input placeholder="🔍 Search users..." value={search}
              onChange={e=>setSearch(e.target.value)} style={{ width:200 }}/>
            <button className="btn btn-ghost btn-sm" onClick={loadUsers}>↻ Refresh</button>
          </div>
        </div>

        {editMsg && (
          <div className={'alert alert-'+editMsg.type} style={{ marginBottom:12 }}>
            {editMsg.type==='error'?'⚠':'✓'} {editMsg.text}
          </div>
        )}

        {loading
          ? <div className="loading-overlay"><span className="spinner"/></div>
          : <div className="table-wrap"><table>
              <thead><tr>
                <th>Username</th><th>Role</th><th>Organization</th><th>Email</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>{filteredUsers.map(u=>(
                <tr key={u.username}>
                  <td style={{ fontFamily:'var(--font-mono)', fontSize:12 }}>{u.username}</td>
                  <td>
                    <span className="badge badge-blue" style={{ fontSize:10 }}>
                      {u.role?.replace(/_/g,' ')}
                    </span>
                  </td>
                  <td style={{ fontSize:11 }}>{u.organization || u.hospital_id || '—'}</td>
                  <td>
                    {editingUser===u.username
                      ? <div style={{ display:'flex', gap:6 }}>
                          <input value={editEmail} onChange={e=>setEditEmail(e.target.value)}
                            placeholder="user@example.com" style={{ flex:1, fontSize:12 }}
                            onKeyDown={e=>e.key==='Enter'&&saveEmail(u.username)}
                            autoFocus/>
                          <button className="btn btn-primary btn-sm" disabled={editBusy}
                            onClick={()=>saveEmail(u.username)}>
                            {editBusy?'…':'Save'}
                          </button>
                          <button className="btn btn-ghost btn-sm"
                            onClick={()=>setEditingUser(null)}>✕</button>
                        </div>
                      : <span style={{ fontFamily:'var(--font-mono)', fontSize:11,
                          color:u.email?'var(--text-primary)':'var(--text-muted)' }}>
                          {u.email||'— not set —'}
                        </span>
                    }
                  </td>
                  <td>
                    <span className={'badge '+(u.email?'badge-green':'badge-amber')} style={{ fontSize:10 }}>
                      {u.email?'✓ Will receive':'⬜ No email'}
                    </span>
                  </td>
                  <td>
                    {editingUser!==u.username && (
                      <button className="btn btn-ghost btn-sm"
                        onClick={()=>{ setEditingUser(u.username); setEditEmail(u.email||''); }}>
                        ✏ Set Email
                      </button>
                    )}
                  </td>
                </tr>
              ))}</tbody>
            </table></div>
        }
      </div>

      {/* Email log */}
      <div className="card">
        <div className="card-header">
          <span className="card-title">
            📋 Email Log
            <span className="badge badge-blue" style={{ marginLeft:8 }}>{emailLog.length}</span>
          </span>
          <button className="btn btn-ghost btn-sm" onClick={loadLog}>↻ Refresh</button>
        </div>
        {logLoading
          ? <div className="loading-overlay"><span className="spinner"/></div>
          : emailLog.length === 0
            ? <div className="empty-state">
                <div className="icon">📧</div>
                <p>No emails sent yet — send a test email to verify your configuration</p>
              </div>
            : <div className="table-wrap"><table>
                <thead><tr>
                  <th>Sent At</th><th>Type</th><th>Subject</th><th>Recipients</th><th>Triggered By</th>
                </tr></thead>
                <tbody>{emailLog.map((e,i)=>{
                  const tc = TYPE_CONFIG[e.type] || { badge:'badge-blue', label:e.type };
                  return (
                    <tr key={e.id||i}>
                      <td style={{ fontSize:11, whiteSpace:'nowrap' }}>
                        {new Date(e.sent_at).toLocaleString()}
                      </td>
                      <td><span className={'badge '+tc.badge} style={{ fontSize:10 }}>{tc.label}</span></td>
                      <td style={{ fontSize:12, maxWidth:300, overflow:'hidden',
                        textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                        title={e.subject}>{e.subject}</td>
                      <td style={{ fontSize:10, fontFamily:'var(--font-mono)',
                        maxWidth:200, overflow:'hidden', textOverflow:'ellipsis' }}>
                        {e.recipients}
                      </td>
                      <td style={{ fontSize:11, color:'var(--text-muted)' }}>{e.triggered_by}</td>
                    </tr>
                  );
                })}</tbody>
              </table></div>
        }
      </div>
    </>
  );
}
