import { useState, useEffect } from 'react';
import axios from 'axios';
import { t } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const PAGE_SIZE = 10;

// Values kept in English always — Community's Firestore filter is an exact
// match against what Diagnose wrote, so these strings must never be translated.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

function CommunityTab({ language }) {
  const L = t(language);
  const [selectedState, setSelectedState] = useState('');
  const [hotspots, setHotspots] = useState([]);
  const [recent, setRecent] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const fetchData = (targetPage = page) => {
    setLoading(true);
    axios
      .get(`${API}/api/community/hotspots`, {
        params: { state: selectedState || undefined, page: targetPage, pageSize: PAGE_SIZE },
      })
      .then((res) => {
        setHotspots(res.data.hotspots);
        setRecent(res.data.recent);
        setTotalPages(res.data.totalPages);
        setError('');
      })
      .catch(() => setError(L.couldNotLoadCommunity))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setPage(1);
    fetchData(1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedState]);

  const goToPage = (newPage) => {
    if (newPage < 1 || newPage > totalPages) return;
    setPage(newPage);
    fetchData(newPage);
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto h-full flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-green-800">{L.communityTitle}</h2>
            <p className="text-sm text-gray-500">{L.communitySubtitle}</p>
          </div>
          <button
            onClick={() => fetchData(page)}
            className="self-start sm:self-auto text-sm text-green-700 border border-green-700 rounded-full px-3 py-1"
          >
            {L.refresh}
          </button>
        </div>

        <div className="mb-4">
          <label className="text-xs text-gray-500 uppercase block mb-1">{L.filterByState}</label>
          <select
            value={selectedState}
            onChange={(e) => setSelectedState(e.target.value)}
            className="w-full sm:w-64 border rounded-lg px-3 py-2 text-sm bg-white"
          >
            <option value="">{L.allStates}</option>
            {INDIAN_STATES.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {loading && <p className="text-gray-400">{L.loading}</p>}
        {error && <p className="text-red-600">{error}</p>}

        {!loading && !error && hotspots.length === 0 && recent.length === 0 && (
          <p className="text-gray-500">
            {selectedState ? L.noReportsYetForState : L.noReportsYet}
          </p>
        )}

        {!loading && hotspots.length > 0 && (
          <div className="mb-6">
            <h3 className="font-semibold text-gray-700 mb-2">{L.topHotspots}</h3>
            <div className="space-y-2">
              {hotspots.map((h, i) => (
                <div key={i} className="bg-white rounded-lg shadow p-3 flex justify-between items-center">
                  <div>
                    <p className="font-medium">{h.disease}</p>
                    <p className="text-xs text-gray-500">{h.district}</p>
                  </div>
                  <span className="bg-red-100 text-red-700 text-sm font-semibold px-3 py-1 rounded-full whitespace-nowrap">
                    {h.count} {L.reportsLabel}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {!loading && recent.length > 0 && (
          <div>
            <h3 className="font-semibold text-gray-700 mb-2">{L.recentActivity}</h3>
            <div className="space-y-1 text-sm mb-3">
              {recent.map((r, i) => (
                <div key={i} className="bg-white rounded px-3 py-2 shadow-sm flex flex-col sm:flex-row sm:justify-between">
                  <span>{r.disease} — {r.crop}</span>
                  <span className="text-gray-400">{r.district}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between text-sm">
              <button
                onClick={() => goToPage(page - 1)}
                disabled={page <= 1}
                className="px-3 py-1 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {L.prevBtn}
              </button>
              <span className="text-gray-500">
                {L.pageOf.replace('{page}', page).replace('{totalPages}', totalPages)}
              </span>
              <button
                onClick={() => goToPage(page + 1)}
                disabled={page >= totalPages}
                className="px-3 py-1 rounded-lg border disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {L.nextBtn}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default CommunityTab;
