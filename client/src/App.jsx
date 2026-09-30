import { useEffect, useState } from 'react';
import { languageOptions, t } from './i18n';
import HomeTab from './components/HomeTab';
import DiagnoseTab from './components/DiagnoseTab';
import CommunityTab from './components/CommunityTab';
import ChatTab from './components/ChatTab';
import Dashboard from './components/Dashboard';
import SignInModal from './components/SignInModal';
import { auth, loginWithGoogle, logout, onAuthChange } from './firebase';
import HistoryTab from './components/HistoryTab';

function App() {
  const [language, setLanguage] = useState('en-IN');
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'app'
  const [tab, setTab] = useState('home');
  const [showSignIn, setShowSignIn] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const L = t(language);
  const [user, setUser] = useState(null);

  const tabs = [
    { id: 'home', label: L.tabHome, icon: '🏠' },
    { id: 'diagnose', label: L.tabDiagnose, icon: '🔍' },
    { id: 'community', label: L.tabCommunity, icon: '🌐' },
    { id: 'ask', label: L.tabAsk, icon: '💬' },
    ...(user ? [{ id: 'history', label: L.tabHistory, icon: '📋' }] : []),
  ];

  useEffect(() => {
    const unsubscribe = onAuthChange((u) => setUser(u));
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (user) setShowSignIn(false);
  }, [user]);

  const enterTab = (id) => {
    setTab(id);
    setView('app');
  };

  const initial = user?.displayName?.trim()?.charAt(0)?.toUpperCase() || 'U';

  return (
    <div className="flex flex-col h-[100dvh] bg-green-50">
      <header className="bg-green-700 text-white px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between shadow gap-2">
        <h1
          className="text-lg sm:text-xl font-bold cursor-pointer whitespace-nowrap flex-shrink-0"
          onClick={() => setView('dashboard')}
          title="Back to overview"
        >
          🌾 KisanSathi
        </h1>

        <div className="flex items-center gap-2 sm:gap-3 flex-shrink min-w-0">
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="text-green-900 rounded px-2 py-1 text-xs sm:text-sm bg-white flex-shrink-0 max-w-[6.5rem] sm:max-w-none"
          >
            {languageOptions.map((o) => <option key={o.code} value={o.code}>{o.label}</option>)}
          </select>

          {user ? (
            <div className="relative flex-shrink-0">
              <button
                onClick={() => setShowUserMenu((v) => !v)}
                className="w-8 h-8 rounded-full bg-white text-green-700 font-bold text-sm flex items-center justify-center"
                title={user.displayName}
              >
                {initial}
              </button>

              {showUserMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                  <div className="absolute right-0 mt-2 bg-white text-gray-700 rounded-lg shadow-lg py-2 w-44 z-50">
                    <p className="px-3 py-1 text-sm font-medium truncate">{user.displayName}</p>
                    <button
                      onClick={() => { logout(); setShowUserMenu(false); }}
                      className="w-full text-left px-3 py-1.5 text-sm text-red-600 hover:bg-gray-50"
                    >
                      {L.logout}
                    </button>
                  </div>
                </>
              )}
            </div>
          ) : (
            <button
              onClick={() => setShowSignIn(true)}
              className="text-xs sm:text-sm bg-white text-green-700 px-2 sm:px-3 py-1 rounded-full flex-shrink-0 whitespace-nowrap"
            >
              {L.signIn}
            </button>
          )}
        </div>
      </header>

      {/* Desktop top nav — mobile keeps the bottom nav instead (see below) */}
      {view === 'app' && (
        <nav className="hidden md:flex bg-white border-b justify-center gap-2 px-4 py-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex items-center gap-2 text-sm px-4 py-2 rounded-full transition-colors ${
                tab === tb.id ? 'bg-green-600 text-white font-semibold' : 'text-gray-600 hover:bg-green-50'
              }`}
            >
              <span className="text-lg">{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </nav>
      )}

      <div className="flex-1 overflow-hidden">
        {view === 'dashboard' && (
          <Dashboard user={user} language={language} onEnterTab={enterTab} onSignInRequest={() => setShowSignIn(true)} />
        )}

        {view === 'app' && (
          <>
            {tab === 'home' && <HomeTab language={language} />}
            {tab === 'history' && <HistoryTab user={user} language={language} />}
            {tab === 'diagnose' && <DiagnoseTab language={language} user={user} />}
            {tab === 'community' && <CommunityTab language={language} />}
            {tab === 'ask' && <ChatTab language={language} user={user} />}
          </>
        )}
      </div>

      {view === 'app' && (
        <nav className="md:hidden bg-white border-t flex justify-around py-2">
          {tabs.map((tb) => (
            <button
              key={tb.id}
              onClick={() => setTab(tb.id)}
              className={`flex flex-col items-center text-xs px-3 py-1 rounded ${tab === tb.id ? 'text-green-700 font-semibold' : 'text-gray-500'}`}
            >
              <span className="text-xl">{tb.icon}</span>
              {tb.label}
            </button>
          ))}
        </nav>
      )}

      {showSignIn && (
        <SignInModal language={language} onClose={() => setShowSignIn(false)} onSignIn={loginWithGoogle} />
      )}
    </div>
  );
}

export default App;
