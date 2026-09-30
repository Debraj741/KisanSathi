import { useState, useEffect } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { t } from '../i18n';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';

// Kept in English everywhere, regardless of UI language: Community's exact
// Firestore filter depends on this exact string matching what's stored.
const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh', 'Goa',
  'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka', 'Kerala',
  'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram', 'Nagaland',
  'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu', 'Telangana', 'Tripura',
  'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh', 'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi', 'Jammu and Kashmir', 'Ladakh', 'Lakshadweep', 'Puducherry',
];

// Not filtered on anywhere, so translating isn't required — kept in English for simplicity.
const CROP_SUGGESTIONS = [
  'Rice', 'Wheat', 'Maize', 'Tomato', 'Potato', 'Onion', 'Groundnut', 'Mustard',
  'Sugarcane', 'Cotton', 'Soybean', 'Chickpea (Gram)', 'Pigeon Pea (Arhar/Tur)',
  'Green Gram (Moong)', 'Black Gram (Urad)', 'Sunflower', 'Jute', 'Banana',
  'Mango', 'Chilli', 'Brinjal', 'Cabbage', 'Cauliflower', 'Ragi', 'Bajra',
  'Jowar', 'Barley', 'Sesame', 'Coconut',
];

async function reverseGeocode(lat, lon) {
  const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}`);
  const data = await res.json();
  const address = data.address || {};
  const district = address.county || address.state_district || address.city_district || address.city || '';
  const state = address.state || '';
  return { district, state };
}

function DiagnoseTab({ language, user }) {
  const L = t(language);
  const [image, setImage] = useState(null);
  const [preview, setPreview] = useState(null);
  const [crop, setCrop] = useState('');

  const [district, setDistrict] = useState('');
  const [state, setState] = useState('');
  const [locating, setLocating] = useState(true);
  const [locationError, setLocationError] = useState('');
  const [manualMode, setManualMode] = useState(false);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const detectLocation = () => {
    setLocationError('');
    setLocating(true);
    setManualMode(false);

    if (!navigator.geolocation) {
      setLocationError(L.locationNotSupported);
      setManualMode(true);
      setLocating(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { district: d, state: s } = await reverseGeocode(pos.coords.latitude, pos.coords.longitude);
          if (d || s) {
            setDistrict(d);
            setState(s);
          } else {
            setLocationError(L.couldNotDetectLocation);
            setManualMode(true);
          }
        } catch {
          setLocationError(L.couldNotDetectLocation);
          setManualMode(true);
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocationError(L.locationPermissionDenied);
        setManualMode(true);
        setLocating(false);
      }
    );
  };

  useEffect(() => {
    detectLocation();
  }, []);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
    setResult(null);
    setError('');
  };

  const handleDiagnose = async () => {
    if (!image) return;
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const compressed = await imageCompression(image, {
        maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true,
      });
      const formData = new FormData();
      formData.append('image', compressed, image.name);
      formData.append('district', district);
      formData.append('state', state);
      formData.append('crop', crop || 'Unknown');
      formData.append('language', language);
      if (user) {
        formData.append('uid', user.uid);
      }

      const res = await axios.post(`${API}/api/diagnose`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setResult(res.data);
    } catch (err) {
      setError(L.error);
    } finally {
      setLoading(false);
    }
  };

  const confidenceColor = {
    High: 'bg-green-100 text-green-800',
    Medium: 'bg-yellow-100 text-yellow-800',
    Low: 'bg-red-100 text-red-800',
  };

  return (
    <div className="p-3 sm:p-4 md:p-6 overflow-y-auto h-full flex flex-col items-center">
      <div className="w-full max-w-md sm:max-w-lg md:max-w-xl lg:max-w-2xl">
        <h2 className="text-lg sm:text-xl font-bold text-green-800 mb-4">{L.diagnosisTitle}</h2>

        <div className="bg-white rounded-xl shadow p-4 space-y-3">
          <div className="border rounded-lg p-3 space-y-2">
            {locating && <p className="text-sm text-gray-400">{L.detectingLocation}</p>}
            {locationError && <p className="text-sm text-amber-600">{locationError}</p>}

            {!manualMode && (district || state) && (
              <div className="flex items-center justify-between">
                <p className="text-sm">
                  📍 <span className="font-medium">{district ? `${district}, ` : ''}{state}</span>
                </p>
                <button onClick={() => setManualMode(true)} className="text-xs text-green-700 underline">
                  {L.change}
                </button>
              </div>
            )}

            {manualMode && (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  value={district}
                  onChange={(e) => setDistrict(e.target.value)}
                  placeholder={L.districtOptional}
                  className="flex-1 border rounded px-2 py-1 text-sm"
                />
                <select
                  value={state}
                  onChange={(e) => setState(e.target.value)}
                  className="flex-1 border rounded px-2 py-1 text-sm bg-white"
                >
                  <option value="">{L.selectState}</option>
                  {INDIAN_STATES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </select>
                <button onClick={detectLocation} className="text-xs bg-green-100 text-green-800 px-2 rounded whitespace-nowrap">
                  {L.useGps}
                </button>
              </div>
            )}
          </div>

          <input
            list="crop-suggestions"
            value={crop}
            onChange={(e) => setCrop(e.target.value)}
            placeholder={L.cropInputPlaceholder}
            className="w-full border rounded px-2 py-1 text-sm"
          />
          <datalist id="crop-suggestions">
            {CROP_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
          </datalist>

          <input type="file" accept="image/*" onChange={handleImageChange} className="text-sm" />

          {preview && <img src={preview} alt="preview" className="rounded-lg max-h-48 mx-auto" />}

          <button
            onClick={handleDiagnose}
            disabled={!image || loading}
            className="w-full bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 disabled:opacity-50"
          >
            {loading ? L.analyzing : L.diagnoseBtn}
          </button>

          {error && <p className="text-red-600 text-sm">{error}</p>}

          {result && (
            <div className="border-t pt-3 space-y-2">
              {!result.isPlant ? (
                <p className="text-gray-600">{L.notPlantMessage}</p>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{result.disease}</span>
                    <span className={`text-xs px-2 py-1 rounded-full ${confidenceColor[result.confidence] || 'bg-gray-100'}`}>
                      {result.confidence} {L.confidenceLabel}
                    </span>
                  </div>
                  <p className="text-gray-700 text-sm">{result.treatment}</p>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default DiagnoseTab;
