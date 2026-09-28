import { t } from '../i18n';

function Dashboard({ user, language, onEnterTab, onSignInRequest }) {
  const L = t(language);

  const features = [
    { id: 'home', icon: '🏠', title: L.tabHome, desc: L.featureHomeDesc },
    { id: 'diagnose', icon: '🔍', title: L.tabDiagnose, desc: L.featureDiagnoseDesc },
    { id: 'community', icon: '🌐', title: L.tabCommunity, desc: L.featureCommunityDesc },
    { id: 'ask', icon: '💬', title: L.tabAsk, desc: L.featureAskDesc },
    { id: 'history', icon: '📋', title: L.tabHistory, desc: L.featureHistoryDesc, needsAuth: true },
  ];

  const handleOpen = (feature) => {
    if (feature.needsAuth && !user) {
      onSignInRequest();
      return;
    }
    onEnterTab(feature.id);
  };

  return (
    <div className="overflow-y-auto h-full bg-green-50">
      <div className="bg-green-700 text-white px-4 py-10 text-center">
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">🌾 KisanSathi</h1>
        <p className="text-green-100 text-sm sm:text-base max-w-md mx-auto mb-6">
          {L.heroTagline}
        </p>
        <button
          onClick={() => onEnterTab('home')}
          className="bg-white text-green-700 font-semibold px-6 py-2 rounded-full shadow hover:bg-green-50"
        >
          {L.getStarted}
        </button>
      </div>

      <div className="px-4 pt-4">
        <div className="max-w-md mx-auto bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg p-3">
          {L.signInOptionalNote}
        </div>
      </div>

      <div className="px-4 py-6 space-y-3 max-w-md mx-auto">
        {features.map((f) => (
          <div key={f.id} className="bg-white rounded-xl shadow p-4 flex gap-3 items-start">
            <span className="text-2xl">{f.icon}</span>
            <div className="flex-1">
              <h3 className="font-semibold text-gray-800">{f.title}</h3>
              <p className="text-sm text-gray-500 mb-2">{f.desc}</p>
              <button
                onClick={() => handleOpen(f)}
                className="text-sm text-green-700 border border-green-700 rounded-full px-3 py-1"
              >
                {f.needsAuth && !user ? L.signInToOpen : L.openBtn}
              </button>
            </div>
          </div>
        ))}
      </div>

      <div className="px-4 pb-6 max-w-md mx-auto">
        <div className="bg-white rounded-xl shadow p-4">
          <h3 className="font-semibold text-gray-700 mb-2">{L.seeItInAction}</h3>
          <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center border-2 border-dashed border-gray-300">
            <span className="text-gray-400 text-sm">{L.demoComingSoon}</span>
          </div>
        </div>
      </div>

      <footer className="bg-white border-t px-4 py-6 text-center text-sm text-gray-500">
        <p className="font-medium text-gray-700">{L.builtByFounder.replace('{name}', 'Debraj')}</p>
        <p className="text-xs text-gray-400 mt-1">Made for Code for Communities 2 (Hack2Skill)</p>
      </footer>
    </div>
  );
}

export default Dashboard;
