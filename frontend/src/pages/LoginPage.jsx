import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import logo from '../assets/dapp-architects-website-logo.png';
import dentalBg from '../assets/dentalchain.jpg';
import show from '../assets/show.png';
import hide from '../assets/hide.png';

const CREDENTIAL_GROUPS = [
  {
    label: '⚙ Platform',
    color: '#94a3b8',
    users: [
      ['admin@dentalchain.com',            'Admin@1234',      'Administrator'],
    ],
  },
  {
    label: '🏛 Regulatory',
    color: '#3b82f6',
    users: [
      ['j.whitfield@fda.hhs.gov',          'FDA@1234',        'FDA / Regulatory'],
      ['l.brooks@smiledentalgroup.com',     'Linda@1234',      'Infection Control'],
      ['r.nguyen@advancedimplantcenter.com','Robert@1234',     'Infection Control'],
    ],
  },
  {
    label: '🏭 Manufacturers',
    color: '#10b981',
    users: [
      ['compliance@nobelbiocare.com',       'Nobel@1234',      'Nobel Biocare'],
      ['compliance@straumann.com',          'Straumann@1234',  'Straumann'],
      ['compliance@zimmerbiomet.com',       'Zimmer@1234',     'Zimmer Biomet'],
      ['compliance@biohorizons.com',        'BioH@1234',       'BioHorizons'],
    ],
  },
  {
    label: '🚚 Distributors',
    color: '#06b6d4',
    users: [
      ['m.webb@henryschein.com',            'Schein@1234',     'Henry Schein Rep'],
      ['s.kowalski@patterson.com',          'Patterson@1234',  'Patterson Rep'],
    ],
  },
  {
    label: '🦷 Smile Dental Group',
    color: '#f59e0b',
    users: [
      ['s.johnson@smiledentalgroup.com',    'DrJ@1234',        'Dentist'],
      ['m.garcia@smiledentalgroup.com',     'Maria@1234',      'Dental Assistant'],
    ],
  },
  {
    label: '🦷 Advanced Implant Center',
    color: '#a78bfa',
    users: [
      ['m.chen@advancedimplantcenter.com',  'DrC@1234',        'Dentist'],
      ['j.park@advancedimplantcenter.com',  'James@1234',      'Dental Assistant'],
    ],
  },
];

const STATS = [
  { label: 'Devices Tracked',  value: '840+'   },
  { label: 'Practices',        value: '28'      },
  { label: 'Implant Records',  value: '5,200+' },
];

const COMPLIANCE_TAGS = ['FDA UDI', 'ISO 13485', 'HIPAA', '21 CFR Part 830', 'EU MDR'];

export default function LoginPage() {
  const { login }   = useAuth();
  const navigate    = useNavigate();
  const [form,      setForm]      = useState({ username: '', password: '' });
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showPwd,   setShowPwd]   = useState(false);
  const [showCreds, setShowCreds] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      await login(form.username, form.password);
      navigate('/dashboard');
    } catch (err) {
      setError(err.message || 'Invalid credentials');
    } finally {
      setLoading(false);
    }
  };

  const fillCreds = (u, p) => { setForm({ username: u, password: p }); setShowCreds(false); };

  return (
    <>
      <style>{`
        @font-face {
          font-family: 'DesignerBlock';
          src: url('/DESIB___.TTF') format('truetype');
          font-weight: normal;
          font-style: normal;
          font-display: swap;
        }
        .ic-root {
          min-height: 100vh;
          display: flex;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          background: var(--bg-primary, #0f1117);
          color: var(--text-primary, #f1f5f9);
        }
        .ic-left {
          display: none;
          width: 50%;
          flex-direction: column;
          justify-content: space-between;
          padding: 48px;
          border-right: 1px solid rgba(255,128,0,0.12);
          position: relative;
          overflow: hidden;
        }
        @media (min-width: 1024px) { .ic-left { display: flex; } }
        .ic-left::before {
          content: '';
          position: absolute; inset: 0;
          background: linear-gradient(135deg,rgba(10,12,20,0.82) 0%,rgba(10,12,20,0.70) 50%,rgba(10,12,20,0.78) 100%);
          z-index: 0;
          pointer-events: none;
        }
        .ic-logo {
          font-family: 'DesignerBlock', monospace;
          font-size: 38px; line-height: 1;
          letter-spacing: 2.5px; user-select: none;
          position: relative; z-index: 1;
        }
        .ic-logo .s  { color: #ff8000; }
        .ic-logo .o  { color: transparent; -webkit-text-stroke: 1.8px #ff8000; }
        .ic-tagline  {
          font-size: 11px; color: rgba(255,255,255,0.35);
          margin-top: 8px; letter-spacing: 0.05em;
          font-family: 'SF Mono','Fira Code',monospace;
          position: relative; z-index: 1;
        }
        .ic-headline {
          font-size: 34px; font-weight: 800; line-height: 1.25;
          color: rgba(255,255,255,0.9);
          position: relative; z-index: 1;
        }
        .ic-headline em { font-style: normal; color: #ff8000; }
        .ic-sub {
          font-size: 15px; color: rgba(255,255,255,0.4);
          margin-top: 14px; line-height: 1.65; max-width: 380px;
          position: relative; z-index: 1;
        }
        .ic-tags {
          display: flex; flex-wrap: wrap; gap: 6px;
          margin-top: 16px; position: relative; z-index: 1;
        }
        .ic-tag {
          font-size: 10px; padding: 3px 10px; border-radius: 99px;
          background: rgba(14,165,233,0.08); color: rgba(14,165,233,0.7);
          border: 1px solid rgba(255,128,0,0.18);
          font-family: 'SF Mono','Fira Code',monospace; letter-spacing: 0.04em;
        }
        .ic-stats {
          display: grid; grid-template-columns: repeat(3,1fr);
          gap: 12px; position: relative; z-index: 1;
        }
        .ic-stat {
          background: rgba(255,255,255,0.03);
          border: 1px solid rgba(255,128,0,0.14);
          border-radius: 12px; padding: 16px;
        }
        .ic-stat-v {
          font-size: 22px; font-weight: 800; color: #ff8000;
          font-family: 'SF Mono','Fira Code',monospace;
        }
        .ic-stat-l { font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; }
        .ic-dapp   { height: 50px; object-fit: contain; border-radius: 6px; display: block; margin-bottom: 10px; }
        .ic-right {
          width: 100%; display: flex;
          align-items: center; justify-content: center;
          padding: 40px 24px;
        }
        @media (min-width: 1024px) { .ic-right { width: 50%; } }
        .ic-fw  { width: 100%; max-width: 400px; }
        .ic-mob { margin-bottom: 32px; }
        @media (min-width: 1024px) { .ic-mob { display: none; } }
        .ic-h1  { font-size: 28px; font-weight: 800; color: rgba(255,255,255,0.92); }
        .ic-h1s { font-size: 14px; color: rgba(255,255,255,0.38); margin-top: 4px; margin-bottom: 28px; }
        .ic-err {
          display: flex; align-items: center; gap: 10px;
          background: rgba(239,68,68,0.08); border: 1px solid rgba(239,68,68,0.22);
          border-radius: 10px; padding: 12px 14px;
          color: #f87171; font-size: 13px; margin-bottom: 16px;
        }
        .ic-fld  { margin-bottom: 16px; }
        .ic-lbl  { display: block; font-size: 13px; font-weight: 600; color: rgba(255,255,255,0.65); margin-bottom: 6px; }
        .ic-iw   { position: relative; }
        .ic-ico  {
          position: absolute; left: 12px; top: 50%;
          transform: translateY(-50%);
          width: 15px; height: 15px; opacity: 0.3; pointer-events: none;
        }
        .ic-inp  {
          width: 100%; background: rgba(255,255,255,0.04);
          border: 1px solid rgba(255,255,255,0.09); border-radius: 10px;
          padding: 12px 12px 12px 38px;
          font-size: 14px; color: rgba(255,255,255,0.88); outline: none;
          transition: border-color 0.2s, box-shadow 0.2s; font-family: inherit;
        }
        .ic-inp::placeholder { color: rgba(255,255,255,0.18); }
        .ic-inp:focus { border-color: rgba(255,128,0,0.45); box-shadow: 0 0 0 3px rgba(255,128,0,0.07); }
        .ic-pr  { padding-right: 42px; }
        .ic-eye {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; padding: 4px;
          display: flex; align-items: center;
        }
        .ic-btn {
          width: 100%; background: #ff8000; color: #fff;
          border: none; border-radius: 10px; padding: 13px;
          font-size: 15px; font-weight: 700; cursor: pointer;
          transition: background 0.18s, transform 0.1s;
          display: flex; align-items: center; justify-content: center;
          gap: 8px; margin-top: 8px; letter-spacing: 0.02em; font-family: inherit;
        }
        .ic-btn:hover:not(:disabled) { background: #e67300; }
        .ic-btn:active:not(:disabled) { transform: scale(0.99); }
        .ic-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .ic-spin {
          width: 16px; height: 16px;
          border: 2px solid rgba(255,255,255,0.25); border-top-color: #fff;
          border-radius: 50%; animation: sp 0.7s linear infinite;
        }
        @keyframes sp { to { transform: rotate(360deg); } }
        .ic-dc   { margin-top: 20px; padding-top: 18px; border-top: 1px solid rgba(255,255,255,0.07); }
        .ic-dcb  {
          background: none; border: none; cursor: pointer;
          font-size: 12px; color: rgba(255,255,255,0.28);
          width: 100%; display: flex; align-items: center;
          justify-content: space-between; font-family: inherit; transition: color 0.15s;
        }
        .ic-dcb:hover { color: rgba(255,255,255,0.48); }
        .ic-cg   { margin-bottom: 12px; }
        .ic-cgl  {
          font-size: 10px; font-weight: 700; text-transform: uppercase;
          letter-spacing: 0.08em; font-family: 'SF Mono','Fira Code',monospace;
          margin-bottom: 5px; padding-bottom: 4px;
        }
        .ic-cr   {
          display: flex; justify-content: space-between; align-items: center;
          padding: 6px 8px; border-radius: 6px; cursor: pointer;
          font-size: 12px; transition: background 0.12s;
        }
        .ic-cr:hover { background: rgba(255,255,255,0.05); }
        .ic-cu   { font-family: 'SF Mono','Fira Code',monospace; font-weight: 600; color: rgba(255,255,255,0.82); font-size:11px; }
        .ic-cro  { color: rgba(255,255,255,0.32); margin-left: 8px; }
        .ic-cp   { font-family: 'SF Mono','Fira Code',monospace; color: rgba(255,255,255,0.18); font-size: 10px; }
        .ic-ch   { font-size: 10px; color: rgba(255,255,255,0.2); text-align: center; margin-top: 8px; }
        .ic-ft   {
          margin-top: 24px; font-size: 12px; color: rgba(255,255,255,0.22);
          text-align: center; font-family: 'SF Mono','Fira Code',monospace;
        }
        .ic-ft a { color: rgba(255,128,0,0.55); text-decoration: none; transition: color 0.15s; }
        .ic-ft a:hover { color: #ff8000; }
      `}</style>

      <div className="ic-root">

        {/* LEFT */}
        <div className="ic-left" style={{
          backgroundImage: `url(${dentalBg})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          
          
        }}>
          <div style={{position:'relative',zIndex:1}}>
            <img src={logo} alt="DentalChain" className="ic-dapp"/>
            <div className="ic-logo"><span className="s">Dental</span><span className="o">Chain</span></div>
            <div className="ic-tagline">Dental Implant Traceability · Hyperledger Fabric 2.5</div>
          </div>

          <div>
            <h1 className="ic-headline">
              End-to-end traceability for dental implants,<br/>
              for every <em>implant</em>,<br/>
              from factory to patient.
            </h1>
            <p className="ic-sub">
              End-to-end traceability across manufacturers, distributors,
              and hospitals. Instant recall response. FDA-ready audit trail.
            </p>
            <div className="ic-tags">
              {COMPLIANCE_TAGS.map(t => <span key={t} className="ic-tag">{t}</span>)}
            </div>
          </div>

          <div className="ic-stats">
            {STATS.map(s => (
              <div key={s.label} className="ic-stat">
                <div className="ic-stat-v">{s.value}</div>
                <div className="ic-stat-l">{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT */}
        <div className="ic-right">
          <div className="ic-fw">

            <div className="ic-mob">
              <img src={logo} alt="DentalChain" className="ic-dapp"/>
              <div className="ic-logo"><span className="s">Dental</span><span className="o">Chain</span></div>
            </div>

            <div className="ic-h1">Welcome back</div>
            <div className="ic-h1s">Sign in with your work email address</div>

            {error && (
              <div className="ic-err">
                <span style={{fontSize:15}}>⚠</span>{error}
              </div>
            )}

            <form onSubmit={submit}>
              <div className="ic-fld">
                <label className="ic-lbl">Email Address</label>
                <div className="ic-iw">
                  {/* Email icon */}
                  <svg className="ic-ico" viewBox="0 0 20 20" fill="rgba(255,255,255,0.6)">
                    <path d="M2.003 5.884L10 9.882l7.997-3.998A2 2 0 0016 4H4a2 2 0 00-1.997 1.884z"/>
                    <path d="M18 8.118l-8 4-8-4V14a2 2 0 002 2h12a2 2 0 002-2V8.118z"/>
                  </svg>
                  <input className="ic-inp"
                    type="email"
                    placeholder="your@email.com"
                    value={form.username}
                    autoComplete="email"
                    onChange={e => setForm(f => ({...f, username: e.target.value}))}
                    required/>
                </div>
              </div>

              <div className="ic-fld">
                <label className="ic-lbl">Password</label>
                <div className="ic-iw">
                  <svg className="ic-ico" viewBox="0 0 20 20" fill="rgba(255,255,255,0.6)">
                    <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd"/>
                  </svg>
                  <input className="ic-inp ic-pr"
                    type={showPwd ? 'text' : 'password'} placeholder="••••••••"
                    value={form.password} autoComplete="current-password"
                    onChange={e => setForm(f => ({...f, password: e.target.value}))} required/>
                  <button type="button" className="ic-eye" onClick={() => setShowPwd(p => !p)}>
                    <img src={showPwd ? hide : show} alt="toggle"
                      style={{width:15,height:15,filter:'invert(1)',opacity:0.35}}/>
                  </button>
                </div>
              </div>

              <button type="submit" className="ic-btn" disabled={loading}>
                {loading ? <><div className="ic-spin"/> Signing in…</> : 'Sign In →'}
              </button>
            </form>

            <div className="ic-dc">
              <button className="ic-dcb" onClick={() => setShowCreds(s => !s)}>
                <span>Demo Credentials</span>
                <span>{showCreds ? '▲ Hide' : '▼ Show'}</span>
              </button>
              {showCreds && (
                <div style={{marginTop:14}}>
                  {CREDENTIAL_GROUPS.map(g => (
                    <div key={g.label} className="ic-cg">
                      <div className="ic-cgl" style={{color:g.color,borderBottom:`1px solid ${g.color}22`,paddingBottom:4}}>
                        {g.label}
                      </div>
                      {g.users.map(([u,p,r]) => (
                        <div key={u} className="ic-cr" onClick={() => fillCreds(u,p)}>
                          <div><span className="ic-cu">{u}</span><span className="ic-cro">{r}</span></div>
                          <span className="ic-cp">{p}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                  <div className="ic-ch">Click any row to auto-fill credentials</div>
                </div>
              )}
            </div>

            <div className="ic-ft">
              <a href="/verify">Public Device Verification</a>
              &nbsp;·&nbsp;
              <a href="https://dapparchitects.com" target="_blank" rel="noreferrer">dapparchitects.com</a>
              &nbsp;·&nbsp;
              <span>© 2026–2027 DApp Architects, LLC</span>
            </div>

          </div>
        </div>
      </div>
    </>
  );
}
