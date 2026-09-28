import { useState, useEffect } from 'react';
import axios from 'axios';
import { t } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

function AdvisorySkeleton() {
  return (
    <div className="bg-white rounded-xl shadow p-4 w-full max-w-md sm:max-w-lg space-y-4 animate-pulse">
      <div className="space-y-1">
        <div className="h-3 w-24 bg-gray-200 rounded" />
        <div className="h-4 w-32 bg-gray-300 rounded" />
      </div>
      <div className="space-y-2">
        <div className="h-3 w-40 bg-gray-200 rounded" />
        <div className="flex flex-wrap gap-2">
          <div className="h-7 w-20 bg-gray-200 rounded-full" />
          <div className="h-7 w-24 bg-gray-200 rounded-full" />
          <div className="h-7 w-16 bg-gray-200 rounded-full" />
        </div>
      </div>
      <div className="h-3 w-48 bg-gray-100 rounded" />
    </div>
  );
}

async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
  const data = await res.json();
  const address = data.address || {};
  const district = address.county || address.state_district || address.city_district || address.city || '';
  const state = address.state || '';
  return { district, state };
}

function HomeTab({ language }) {
  const L = t(language);
  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [manualInput, setManualInput] = useState('');
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [coords, setCoords] = useState(null);

  const [openCrop, setOpenCrop] = useState(null);
  const [explanations, setExplanations] = useState({});
  const [explainingCrop, setExplainingCrop] = useState(null);

  const detectLocation = () => {
    setLocationError('');
    setLocating(true);

    if (!navigator.geolocation) {
      setLocationError(L.locationNotSupported);
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { district: d, state: s } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (d) {
            setDistrict(d);
            setState(s);
            setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
          } else {
            setLocationError(L.couldNotDetectDistrict);
          }
        } catch {
          setLocationError(L.couldNotDetectLocation);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocationError(L.locationPermissionDenied);
        setLocating(false);
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  useEffect(() => {
    if (!district) return;
    setLoading(true);
    setError('');
    setExplanations({});
    setOpenCrop(null);
    axios
      .get(`${API}/api/district/crops`, { params: { district, state, lat: coords?.lat, lon: coords?.lon } })
      .then((res) => setData(res.data))
      .catch(() => {
        setError(L.couldNotLoadCrops);
        setData(null);
      })
      .finally(() => setLoading(false));
  }, [district, state]);

  const handleManualSubmit = () => {
    if (!manualInput.trim()) return;
    setDistrict(manualInput.trim());
    setState('');
    setManualInput('');
  };

  const handleExplain = async (crop) => {
    if (openCrop === crop) {
      setOpenCrop(null);
      return;
    }
    setOpenCrop(crop);
    if (explanations[crop]) return;

    setExplainingCrop(crop);
    try {
      const res = await axios.post(`${API}/api/district/explain`, {
        crop,
        district,
        state,
        language,
        matchLevel: data.matchLevel,
        matchedDistrict: data.matchedDistrict,
        temperature: data.liveData?.temperature,
        humidity: data.liveData?.humidity,
        rainfall: data.liveData?.rainfall,
      });
      setExplanations((prev) => ({ ...prev, [crop]: res.data.explanation }));
    } catch {
      setExplanations((prev) => ({ ...prev, [crop]: L.error }));
    } finally {
      setExplainingCrop(null);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto h-full flex flex-col items-center sm:items-start">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl">
        <h2 className="text-lg sm:text-xl font-bold text-green-800 mb-1">{L.localizedAdvisoryTitle}</h2>
        <p className="text-sm text-gray-500 mb-4">
          {district
            ? L.showingAdvisoryFor.replace('{location}', district + (state ? `, ${state}` : ''))
            : L.detectingLocation}
        </p>

        {locating && <p className="text-gray-400 mb-3 text-sm">{L.detectingLocation}</p>}
        {locationError && <p className="text-amber-600 text-sm mb-3">{locationError}</p>}

        <div className="flex flex-col sm:flex-row gap-2 mb-4">
          <input
            type="text"
            value={manualInput}
            onChange={(e) => setManualInput(e.target.value)}
            placeholder={L.manualDistrictPlaceholder}
            className="flex-1 border rounded-lg px-3 py-2 text-sm sm:text-base"
          />
          <div className="flex gap-2">
            <button onClick={handleManualSubmit} className="flex-1 sm:flex-none bg-gray-200 px-3 py-2 rounded-lg text-sm">
              {L.setBtn}
            </button>
            <button onClick={detectLocation} className="flex-1 sm:flex-none bg-green-100 text-green-800 px-3 py-2 rounded-lg text-sm">
              📍
            </button>
          </div>
        </div>

        {loading && <AdvisorySkeleton />}
        {error && !loading && <p className="text-red-600 text-sm">{error}</p>}

        {data && !loading && (
          <div className="bg-white rounded-xl shadow p-4 space-y-3">
            <div>
              <span className="text-xs text-gray-500 uppercase">{L.currentSeason}</span>
              <p className="font-semibold">{data.season}</p>
            </div>

            {data.matchLevel === 'state' && (
              <p className="text-xs text-amber-600">
                {L.stateFallbackNote.replace('{state}', data.matchedState || state)}
              </p>
            )}

            <div>
              <span className="text-xs text-gray-500 uppercase">{L.recommendedCrops}</span>
              <p className="text-xs text-gray-400 mb-1">{L.tapCropHint}</p>
              <div className="flex flex-wrap gap-2 mt-1">
                {data.recommendedCrops.map((c) => (
                  <button
                    key={c}
                    onClick={() => handleExplain(c)}
                    className={`text-sm px-3 py-1 rounded-full transition-colors ${
                      openCrop === c
                        ? 'bg-green-600 text-white'
                        : 'bg-green-100 text-green-800 hover:bg-green-200'
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {openCrop && (
              <div className="pt-2 border-t">
                {explainingCrop === openCrop ? (
                  <div className="space-y-2 animate-pulse">
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-5/6 bg-gray-200 rounded" />
                    <div className="h-3 w-2/3 bg-gray-200 rounded" />
                  </div>
                ) : (
                  <p className="text-sm text-gray-600">{explanations[openCrop]}</p>
                )}
              </div>
            )}

            {data.liveData && (
              <p className="text-xs text-gray-400 pt-2">
                {L.liveDataLabel
                  .replace('{temp}', data.liveData.temperature)
                  .replace('{humidity}', data.liveData.humidity)
                  .replace('{rainfall}', data.liveData.rainfall)}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default HomeTab;
