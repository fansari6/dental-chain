import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { api } from '../api/client';
import logo from '../assets/dapp-architects-website-logo.png';

const HEADER_HEIGHT = 81; // px — must match the actual header height below

const NAV = [
  { path:'/dashboard',           label:'Dashboard',            icon:'⬡', roles:null },
  { path:'/government',          label:'FDA / Regulatory',     icon:'🏛', roles:['government'] },
  { path:'/manufacturer',        label:'Manufacturer',         icon:'🏭', roles:['manufacturer'] },
  { path:'/distributor',         label:'Distributor / Rep',    icon:'🚚', roles:['distributor'] },
  { path:'/supply-chain',        label:'Supply Chain',         icon:'📦', roles:['supply_chain'] },
  { path:'/nurse',               label:'OR Nurse',             icon:'🩺', roles:['nurse','supply_chain'] },
  { path:'/infection-prevention',label:'Infection Prevention', icon:'🔬', roles:['infection_prevention','government'] },
  { path:'/surgeon', label:'Surgeon Portal', icon:'🔪', roles:['surgeon'] },
  { path:'/bulk-import',         label:'Bulk Import',          icon:'📥', roles:['admin','supply_chain'] },
  { path:'/admin',               label:'Admin',                icon:'⚙',  roles:['admin'] },
  { path:'/cases',               label:'OR Schedule',          icon:'📅', roles:['nurse','supply_chain','surgeon'] },
  { path:'/notifications',       label:'Notifications',        icon:'📧', roles:['admin'] },
  { path:'/analytics',           label:'Analytics',            icon:'📊', roles:['admin'] },
  { path:'/onboarding',          label:'Onboarding',           icon:'🏥', roles:['admin'] },
  { path:'/audit',               label:'Audit Trail',          icon:'📜', roles:['admin','government'] },
  { path:'/compliance',          label:'UDI Compliance',       icon:'📊', roles:['government','infection_prevention','admin','nurse','supply_chain'] },
  { path:'/history',             label:'Blockchain History',   icon:'📋', roles:null },
  { path:'/verify',              label:'Verify Device',        icon:'🔍', roles:null },
];

const ROLE_COLORS = {
  government:           'var(--accent-blue)',
  manufacturer:         'var(--accent-green)',
  distributor:          'var(--accent-cyan)',
  supply_chain:         'var(--accent-purple)',
  nurse:                'var(--accent-amber)',
  infection_prevention: 'var(--accent-red)',
  surgeon:              'var(--accent-blue)',
  admin:                'var(--text-muted)',
};

const ROLE_LABELS = {
  government:           'FDA / Regulatory',
  manufacturer:         'Manufacturer',
  distributor:          'Distributor / Rep',
  supply_chain:         'Supply Chain',
  nurse:                'OR Nurse',
  infection_prevention: 'Infection Prevention',
  admin:                'Administrator',
  surgeon:              'Surgeon',
};

// ── Designer Block font face ──────────────────────────────────────
const fontFaceStyle = `
  @font-face {
    font-family: 'DesignerBlock';
    src: url('/DESIB___.TTF') format('truetype');
    font-weight: normal;
    font-style: normal;
    font-display: swap;
  }
`;

// ── Role guard ────────────────────────────────────────────────────
export function RequireRole({ roles, children }) {
  const { user } = useAuth();
  if (!user) return null;
  if (roles && !roles.includes(user.role)) {
    return (
      <div style={{padding:40, textAlign:'center'}}>
        <div style={{fontSize:48, marginBottom:16}}>🔒</div>
        <div style={{fontSize:18, color:'var(--text-secondary)'}}>
          Access restricted — <strong>{user.role}</strong> role cannot view this page.
        </div>
      </div>
    );
  }
  return children;
}

// ── Layout ────────────────────────────────────────────────────────
export function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const [showPwdModal, setShowPwdModal] = useState(false);
  const [pwdForm,      setPwdForm]      = useState({current:'', next:'', confirm:''});
  const [pwdMsg,       setPwdMsg]       = useState(null);
  const [pwdBusy,      setPwdBusy]      = useState(false);
  const [ccVersion,    setCcVersion]    = useState('implant …');

  useEffect(() => {
    fetch('/api/chaincode-version')
      .then(r => r.json())
      .then(d => setCcVersion(d.label || `implant ${d.version}`))
      .catch(() => setCcVersion('implant'));
  }, []);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const handleChangePassword = async () => {
    if (pwdForm.next !== pwdForm.confirm) {
      setPwdMsg({ type:'error', text:'Passwords do not match' }); return;
    }
    if (pwdForm.next.length < 8) {
      setPwdMsg({ type:'error', text:'Password must be at least 8 characters' }); return;
    }
    setPwdBusy(true); setPwdMsg(null);
    try {
      await api.changePassword({ currentPassword:pwdForm.current, newPassword:pwdForm.next });
      setPwdMsg({ type:'success', text:'Password changed successfully' });
      setTimeout(() => {
        setShowPwdModal(false);
        setPwdForm({current:'', next:'', confirm:''});
        setPwdMsg(null);
      }, 1500);
    } catch (err) { setPwdMsg({ type:'error', text:err.message }); }
    finally { setPwdBusy(false); }
  };

  const closePwdModal = () => {
    setShowPwdModal(false);
    setPwdForm({current:'', next:'', confirm:''});
    setPwdMsg(null);
  };

  const visibleNav  = NAV.filter(n => !n.roles || n.roles.includes(user?.role));
  const roleColor   = ROLE_COLORS[user?.role] || 'var(--accent-blue)';
  const roleLabel   = ROLE_LABELS[user?.role] || user?.role;

  return (
    <div style={{display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg-primary)'}}>

      {/* ── FONT FACE INJECTION ── */}
      <style>{fontFaceStyle}</style>

      {/* ── CHANGE PASSWORD MODAL — rendered at root level ── */}
      {showPwdModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.6)',zIndex:1000,
          display:'flex',alignItems:'center',justifyContent:'center'}}
          onClick={closePwdModal}>
          <div style={{background:'var(--bg-card)',border:'1px solid var(--border)',
            borderRadius:'var(--radius-lg)',padding:28,width:360,
            boxShadow:'var(--shadow-card)'}}
            onClick={e=>e.stopPropagation()}>
            <div style={{fontSize:15,fontWeight:700,marginBottom:16}}>🔐 Change Password</div>
            {pwdMsg && (
              <div className={`alert alert-${pwdMsg.type}`} style={{marginBottom:12}}>
                {pwdMsg.type==='error'?'⚠':'✓'} {pwdMsg.text}
              </div>
            )}
            <div className="form-group" style={{marginBottom:12}}>
              <label>Current Password</label>
              <input type="password" value={pwdForm.current}
                onChange={e=>setPwdForm(f=>({...f,current:e.target.value}))}
                placeholder="Enter current password"/>
            </div>
            <div className="form-group" style={{marginBottom:12}}>
              <label>New Password</label>
              <input type="password" value={pwdForm.next}
                onChange={e=>setPwdForm(f=>({...f,next:e.target.value}))}
                placeholder="Min. 8 characters"/>
            </div>
            <div className="form-group" style={{marginBottom:16}}>
              <label>Confirm New Password</label>
              <input type="password" value={pwdForm.confirm}
                onChange={e=>setPwdForm(f=>({...f,confirm:e.target.value}))}
                placeholder="Repeat new password"/>
            </div>
            <div style={{display:'flex',gap:8}}>
              <button className="btn btn-primary" style={{flex:1}} disabled={pwdBusy}
                onClick={handleChangePassword}>
                {pwdBusy
                  ? <><span className="spinner" style={{width:14,height:14}}/> Saving…</>
                  : 'Change Password'}
              </button>
              <button className="btn btn-ghost" onClick={closePwdModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ── HEADER ── */}
      <header style={{
        height: HEADER_HEIGHT,
        background: 'var(--bg-card)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        gap: 16,
        position: 'sticky',
        top: 0,
        zIndex: 100,
        flexShrink: 0,
      }}>

        {/* ── LOGO ── */}
        <div style={{
          fontFamily: "'DesignerBlock', var(--font-mono), monospace",
          fontSize: 26,
          lineHeight: 1,
          userSelect: 'none',
          letterSpacing: '2px',
        }}>
          <span style={{
            color: '#ff8000',
          }}>
            Implant
          </span>
          <span style={{
            color: 'transparent',
            WebkitTextStroke: '1.5px #ff8000',
            textStroke: '1.5px #ff8000',
          }}>
            Chain
          </span>
        </div>

        <div style={{flex:1}}/>

        {/* User info pill */}
        <div style={{display:'flex',alignItems:'center',gap:12,padding:'6px 14px',
          background:'var(--bg-secondary)',borderRadius:'var(--radius-md)',
          border:'1px solid var(--border)'}}>
          <div style={{width:30,height:30,borderRadius:'50%',background:roleColor,
            display:'flex',alignItems:'center',justifyContent:'center',
            fontSize:13,fontWeight:700,color:'#fff',flexShrink:0}}>
            {user?.username?.[0]?.toUpperCase()}
          </div>
          <div style={{display:'flex',flexDirection:'column',gap:4}}>
            <div style={{fontSize:13,fontWeight:600,color:'var(--text-primary)',lineHeight:1}}>
              {user?.username}
            </div>
            <div style={{fontSize:11,color:roleColor,lineHeight:1}}>
              {roleLabel}
            </div>
          </div>
        </div>

        <div style={{width:1,height:32,background:'var(--border)',margin:'0 4px'}}/>

        {/* Change Password button */}
        <button onClick={()=>setShowPwdModal(true)}
          style={{padding:'7px 14px',fontSize:13,fontWeight:500,
            background:'transparent',border:'1px solid var(--border)',
            borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',
            cursor:'pointer',display:'flex',alignItems:'center',gap:6}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-blue)';e.currentTarget.style.color='var(--accent-blue)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}>
          🔐 Password
        </button>

        {/* Sign out */}
        <button onClick={handleLogout}
          style={{padding:'7px 16px',fontSize:13,fontWeight:500,
            background:'transparent',border:'1px solid var(--border)',
            borderRadius:'var(--radius-sm)',color:'var(--text-secondary)',
            cursor:'pointer',display:'flex',alignItems:'center',gap:6,transition:'all 0.15s'}}
          onMouseEnter={e=>{e.currentTarget.style.borderColor='var(--accent-red)';e.currentTarget.style.color='var(--accent-red)';}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor='var(--border)';e.currentTarget.style.color='var(--text-secondary)';}}>
          ⏻ Sign Out
        </button>

        <img src={logo} alt="DApp Architects"
          style={{height:60, objectFit:'contain', borderRadius:8}}/>
      </header>

      {/* ── BODY ── */}
      <div style={{display:'flex', flex:1, alignItems:'stretch'}}>

        {/* Sidebar */}
        <aside style={{
          width: 210,
          background: 'var(--bg-card)',
          borderRight: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          flexShrink: 0,
          position: 'sticky',
          top: HEADER_HEIGHT,
          height: `calc(100vh - ${HEADER_HEIGHT}px)`,
          overflowY: 'auto',
        }}>
          {/* Role pill */}
          <div style={{margin:'12px 10px 8px',padding:'8px 12px',
            background:`${roleColor}15`,borderRadius:'var(--radius-sm)',
            border:`1px solid ${roleColor}30`}}>
            <div style={{fontSize:11,color:roleColor,fontWeight:600}}>{roleLabel}</div>
            <div style={{fontSize:11,color:'var(--text-muted)',fontFamily:'var(--font-mono)',marginTop:1}}>
              {user?.username}
            </div>
          </div>

          {/* Nav links */}
          <nav style={{flex:1, padding:'4px 8px 16px'}}>
            {visibleNav.map(n=>(
              <NavLink key={n.path} to={n.path}
                style={({isActive})=>({
                  display:'flex', alignItems:'center', gap:10,
                  padding:'8px 10px', borderRadius:'var(--radius-sm)',
                  marginBottom:2, textDecoration:'none', fontSize:13,
                  background:isActive?'rgba(99,179,237,0.1)':'transparent',
                  color:isActive?'var(--accent-cyan)':'var(--text-secondary)',
                  fontWeight:isActive?600:400,
                  borderLeft:isActive?'2px solid var(--accent-cyan)':'2px solid transparent',
                })}>
                <span style={{fontSize:15}}>{n.icon}</span>
                {n.label}
              </NavLink>
            ))}
          </nav>

          {/* Fabric status footer */}
          <div style={{padding:'10px 12px',borderTop:'1px solid var(--border)',
            fontSize:10,color:'var(--text-muted)',fontFamily:'var(--font-mono)'}}>
            <div style={{display:'flex',alignItems:'center',gap:5,marginBottom:2}}>
              <div style={{width:6,height:6,borderRadius:'50%',background:'var(--accent-green)'}}/>
              Fabric connected
            </div>
            <div>{ccVersion} · mychannel</div>
          </div>
        </aside>

        {/* Main content */}
        <main style={{flex:1, padding:'24px 32px', overflowY:'auto', maxWidth:1400}}>
          <Outlet/>
        </main>
      </div>

      {/* Copyright footer */}
      <div style={{padding:'10px 24px',borderTop:'1px solid var(--border)',
        background:'var(--bg-card)',fontSize:11,color:'var(--text-muted)',
        textAlign:'center',fontFamily:'var(--font-mono)',flexShrink:0}}>
        © 2026–2027 DApp Architects, LLC · All rights reserved
      </div>
    </div>
  );
}
