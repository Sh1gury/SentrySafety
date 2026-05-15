// ============ MAIN APP ============

const DEFAULT_CONFIG = {
  privacy: {
    mask_pii: true,
    entities_to_mask: ['PERSON', 'EMAIL', 'PHONE', 'IBAN', 'CREDIT_CARD'],
  },
  security: {
    block_injections: true,
    max_decompression_ratio: 100,
    strip_macros: true,
  },
  integrity: {
    check_autophagy: false,
  },
};

function App() {
  // page = 'login' | 'register' | 'scan' | 'logs' | 'dashboard'
  const [page, setPage] = useState('login');
  const [user, setUser] = useState(null);
  const [config, setConfig] = useState(DEFAULT_CONFIG);
  const [scans, setScans] = useState(() => seedScans());

  function handleAuth(email) {
    setUser(email);
    setPage('scan');
  }

  function logout() {
    setUser(null);
    setPage('login');
  }

  function addScan(s) {
    setScans(prev => [s, ...prev]);
  }

  if (!user) {
    return (
      <AuthPage
        mode={page === 'register' ? 'register' : 'login'}
        onSwitch={mode => setPage(mode)}
        onSubmit={handleAuth}
      />
    );
  }

  return (
    <div className="app-shell">
      <TopNav page={page} onNav={setPage} userEmail={user} onLogout={logout} />
      {page === 'scan' && (
        <ScanPage
          config={config}
          setConfig={setConfig}
          scans={scans}
          addScan={addScan}
        />
      )}
      {page === 'logs' && <LogsPage scans={scans} />}
      {page === 'dashboard' && <DashboardPage scans={scans} />}
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(<App />);
