import { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import imageCompression from 'browser-image-compression';
import { t } from '../i18n';
import { getSuggestions } from '../chatSuggestions';

const API = import.meta.env.VITE_API_URL ?? 'http://localhost:5000';
const CHIPS_PER_VIEW = 4;

function ChatTab({ language }) {
  const L = t(language);
  const S = getSuggestions(language);
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [image, setImage] = useState(null);
  const [imagePreview, setImagePreview] = useState(null);
  const [sending, setSending] = useState(false);
  const [listening, setListening] = useState(false);
  const [loadingAudioId, setLoadingAudioId] = useState(null);
  const [playingId, setPlayingId] = useState(null);
  const [suggestionOffset, setSuggestionOffset] = useState(0);

  const inputMethodRef = useRef('text');
  const audioRef = useRef(null);
  const audioCacheRef = useRef({});
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, sending]);

  // Rotate through the hardcoded pool, CHIPS_PER_VIEW at a time — no API call.
  const visibleSuggestions = Array.from({ length: CHIPS_PER_VIEW }, (_, i) =>
    S.items[(suggestionOffset + i) % S.items.length]
  );
  const showMoreSuggestions = () =>
    setSuggestionOffset((o) => (o + CHIPS_PER_VIEW) % S.items.length);

  const handleImageChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setImage(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImage(null);
    setImagePreview(null);
  };

  const handleVoiceInput = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert('Voice input needs Chrome. Please switch browser.');
      return;
    }
    const recognition = new SR();
    recognition.lang = language;
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.onstart = () => setListening(true);
    recognition.onend = () => setListening(false);
    recognition.onerror = (e) => {
      console.error('Speech error:', e.error);
      setListening(false);
    };
    recognition.onresult = (e) => {
      setInput(e.results[0][0].transcript);
      inputMethodRef.current = 'voice';
    };
    recognition.start();
  };

  const speakText = async (text, msgId) => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    if (audioCacheRef.current[msgId]) {
      const cached = audioCacheRef.current[msgId];
      audioRef.current = cached;
      cached.onended = () => setPlayingId(null);
      await cached.play();
      setPlayingId(msgId);
      return;
    }
    setLoadingAudioId(msgId);
    try {
      const res = await axios.post(`${API}/api/speak`, { text }, { responseType: 'blob' });
      const audio = new Audio(URL.createObjectURL(res.data));
      audioCacheRef.current[msgId] = audio;
      audioRef.current = audio;
      audio.onended = () => setPlayingId(null);
      audio.onerror = () => setPlayingId(null);
      await audio.play();
      setPlayingId(msgId);
    } catch (err) {
      console.error('Speak error:', err.message || err);
    } finally {
      setLoadingAudioId(null);
    }
  };

  const toggleAudio = (text, msgId) => {
    if (loadingAudioId === msgId) return; // already fetching this message's audio — ignore repeat clicks
    const audio = audioCacheRef.current[msgId];
    if (!audio) return speakText(text, msgId);
    if (audio.paused) {
      audio.play();
      setPlayingId(msgId);
    } else {
      audio.pause();
      setPlayingId(null);
    }
  };

  // overrideText is used by suggestion chips; otherwise the typed input is sent.
  const handleSend = async (overrideText) => {
    const fromChip = typeof overrideText === 'string';
    const text = fromChip ? overrideText : input;
    if (!text.trim() && !image) return;
    const wasVoice = !fromChip && inputMethodRef.current === 'voice';
    const userMsg = {
      id: Date.now(),
      role: 'user',
      content: text.trim() || L.sentPhoto,
      imagePreview,
    };
    const historyForApi = messages.map((m) => ({ role: m.role, content: m.content }));

    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setSending(true);
    const imageToSend = image;
    clearImage();
    inputMethodRef.current = 'text';

    try {
      const formData = new FormData();
      formData.append('message', userMsg.content === L.sentPhoto ? '' : userMsg.content);
      formData.append('history', JSON.stringify(historyForApi));
      formData.append('language', language);
      if (imageToSend) {
        const compressed = await imageCompression(imageToSend, {
          maxSizeMB: 1, maxWidthOrHeight: 1280, useWebWorker: true,
        });
        formData.append('image', compressed, imageToSend.name);
      }
      const res = await axios.post(`${API}/api/chat`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const botMsg = { id: Date.now() + 1, role: 'assistant', content: res.data.reply };
      setMessages((prev) => [...prev, botMsg]);
      if (wasVoice) speakText(res.data.reply, botMsg.id);
    } catch (err) {
      console.error('Send error:', err.message);
      setMessages((prev) => [...prev, { id: Date.now() + 2, role: 'assistant', content: L.error }]);
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex flex-col h-full">
      <main className="flex-1 overflow-y-auto p-3 sm:p-4">
        <div className="max-w-3xl lg:max-w-4xl mx-auto w-full space-y-3">
          {messages.length === 0 && (
            <div className="mt-6 sm:mt-10">
              <p className="text-center text-gray-500 text-sm sm:text-base">{L.empty}</p>

              <div className="mt-5">
                <p className="text-xs text-gray-400 uppercase text-center mb-2">{S.title}</p>
                <div className="flex flex-wrap justify-center gap-2">
                  {visibleSuggestions.map((s) => (
                    <button
                      key={s}
                      onClick={() => handleSend(s)}
                      disabled={sending}
                      className="text-left text-sm text-green-700 bg-white border border-green-600 rounded-2xl px-3 py-2 hover:bg-green-50 active:bg-green-100 disabled:opacity-50 max-w-full break-words"
                    >
                      {s}
                    </button>
                  ))}
                </div>
                <div className="text-center mt-3">
                  <button
                    onClick={showMoreSuggestions}
                    className="text-xs text-green-700 underline"
                  >
                    🔄 {S.more}
                  </button>
                </div>
              </div>
            </div>
          )}

          {messages.map((m) => (
            <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] sm:max-w-[75%] rounded-2xl px-3 sm:px-4 py-2 shadow break-words ${m.role === 'user' ? 'bg-green-600 text-white' : 'bg-white text-gray-800'}`}>
                {m.imagePreview && <img src={m.imagePreview} alt="upload" className="rounded-lg mb-2 max-h-48 max-w-full" />}
                <p className="whitespace-pre-wrap text-sm sm:text-base">{m.content}</p>
                {m.role === 'assistant' && (
                  <button
                    onClick={() => toggleAudio(m.content, m.id)}
                    disabled={loadingAudioId === m.id}
                    className="mt-2 text-sm text-green-700 disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {loadingAudioId === m.id ? '🔄' : playingId === m.id ? `⏸️ ${L.pause}` : `▶️ ${L.listen}`}
                  </button>
                )}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="bg-white rounded-2xl px-4 py-2 shadow text-gray-500 text-sm">{L.thinking}</div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </main>

      <footer className="bg-white border-t p-2 sm:p-3">
        <div className="max-w-3xl lg:max-w-4xl mx-auto w-full">
          {imagePreview && (
            <div className="flex items-center gap-2 mb-2">
              <img src={imagePreview} alt="preview" className="h-14 w-14 object-cover rounded" />
              <button onClick={clearImage} className="text-red-600 text-sm">{L.remove}</button>
            </div>
          )}
          <div className="flex items-center gap-1.5 sm:gap-2">
            <label className="cursor-pointer text-xl sm:text-2xl flex-shrink-0" title={L.photo}>
              📷<input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            <button
              onClick={handleVoiceInput}
              className={`text-xl sm:text-2xl flex-shrink-0 ${listening ? 'animate-pulse' : ''}`}
              title={L.speak}
            >
              {listening ? '🔴' : '🎤'}
            </button>
            <input
              type="text" value={input}
              onChange={(e) => { setInput(e.target.value); inputMethodRef.current = 'text'; }}
              onKeyDown={handleKeyDown} placeholder={L.placeholder}
              className="flex-1 min-w-0 border border-gray-300 rounded-full px-3 sm:px-4 py-2 text-sm sm:text-base focus:outline-none focus:ring-2 focus:ring-green-500"
            />
            <button
              onClick={() => handleSend()}
              disabled={sending}
              className="flex-shrink-0 bg-green-600 text-white px-3 sm:px-5 py-2 rounded-full text-sm sm:text-base hover:bg-green-700 disabled:opacity-50"
            >
              {L.send}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default ChatTab;
