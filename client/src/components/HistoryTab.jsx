import { useState, useEffect } from 'react';
import axios from 'axios';
import { t } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

function HistorySkeleton() {
  return (
    <div className="space-y-2 animate-pulse">
      {[0, 1, 2].map((i) => (
        <div key={i} className="bg-white rounded-lg shadow p-3 space-y-2">
          <div className="flex justify-between gap-2">
            <div className="h-4 w-32 bg-gray-300 rounded" />
            <div className="h-3 w-16 bg-gray-200 rounded" />
          </div>
          <div className="h-3 w-20 bg-gray-200 rounded" />
          <div className="h-3 w-full bg-gray-100 rounded" />
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ user, language }) {
  const L = t(language);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    setError('');
    axios
      .get(`${API}/api/history/${user.uid}`)
      .then((res) => setHistory(res.data))
      .catch(() => setError(L.couldNotLoadHistory))
      .finally(() => setLoading(false));
  }, [user?.uid]);

  if (!user) {
    return <p className="p-4 sm:p-6 text-gray-500 text-sm sm:text-base">{L.pleaseSignIn}</p>;
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto h-full flex flex-col items-center sm:items-start">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
        <h2 className="text-lg sm:text-xl font-bold text-green-800 mb-4">{L.historyTitle}</h2>

        {loading && <HistorySkeleton />}
        {error && !loading && <p className="text-red-600 text-sm">{error}</p>}
        {!loading && !error && history.length === 0 && (
          <p className="text-gray-500 text-sm sm:text-base">{L.noHistoryYet}</p>
        )}

        {!loading && (
          <div className="space-y-2">
            {history.map((h, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-3">
                <div className="flex justify-between items-start gap-2">
                  <span className="font-medium min-w-0 break-words">{h.disease}</span>
                  <span className="text-xs text-gray-400 flex-shrink-0 text-right max-w-[45%] break-words">
                    {h.district}
                  </span>
                </div>
                <p className="text-sm text-gray-600 mt-1 break-words">{h.crop}</p>
                {h.treatment && (
                  <p className="text-sm text-gray-500 mt-1 break-words">{h.treatment}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default HistoryTab;
