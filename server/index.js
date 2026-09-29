require("dotenv").config();
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const wav = require("wav");
const { Writable } = require("stream");
const { GoogleGenAI } = require("@google/genai");

const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore, FieldValue } = require("firebase-admin/firestore");

const { getCropRecommendations } = require("./utils/cropRecommendation");

const app = express();
app.use(cors());
app.use(express.json({ limit: "10mb" }));

const LANGUAGE_NAMES = {
  "en-IN": "English",
  "hi-IN": "Hindi",
  "bn-IN": "Bengali",
  "te-IN": "Telugu",
  "mr-IN": "Marathi",
  "ta-IN": "Tamil",
  "gu-IN": "Gujarati",
  "kn-IN": "Kannada",
  "ml-IN": "Malayalam",
  "pa-IN": "Punjabi",
  "or-IN": "Odia",
  "as-IN": "Assamese",
};

const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT
  ? JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)
  : require("./serviceAccountKey.json");
  
initializeApp({
  credential: cert(serviceAccount),
});
const db = getFirestore();

const upload = multer({ storage: multer.memoryStorage() });
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function generateWithRetry(params, retries = 2, delayMs = 1500) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await ai.models.generateContent(params);
    } catch (err) {
      const is503 =
        err.message?.includes("UNAVAILABLE") || err.message?.includes("503");
      if (is503 && attempt < retries) {
        console.log(
          `Model overloaded, retrying in ${delayMs}ms... (attempt ${attempt + 1})`,
        );
        await new Promise((r) => setTimeout(r, delayMs));
        delayMs *= 2; // back off longer each retry
      } else {
        throw err;
      }
    }
  }
}

const SYSTEM_PROMPT = `You are KisanSathi, a friendly agricultural advisor for small and marginal farmers in India.

Rules:
- Reply in the SAME language the farmer used. If they write in Hindi, reply in Hindi. Bengali, reply in Bengali. And so on.
- Keep answers under 120 words. Short, practical, simple words. No jargon.
- Prefer low-cost and locally available solutions first, then chemical options.
- If details are missing (crop name, crop age, region), ask ONE short follow-up question instead of guessing.
- If an image is not a plant or crop, say so politely and ask for a clear plant photo.
- Remember earlier messages in the conversation and stay consistent with them.`;

app.get("/api/health", (req, res) => {
  res.json({ status: "Server is running" });
});

app.post("/api/chat", upload.single("image"), async (req, res) => {
  const languageName = LANGUAGE_NAMES[req.body.language] || "English";
  try {
    const message = req.body.message || "";
    let history = [];

    try {
      history = JSON.parse(req.body.history || "[]");
    } catch {
      history = [];
    }

    if (!message && !req.file) {
      return res.status(400).json({ error: "Message or image is required" });
    }

    // Keep only the last 10 turns to stay light on free-tier quota
    const trimmedHistory = history.slice(-10).map((m) => ({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: m.content }],
    }));

    const currentParts = [];
    if (message) currentParts.push({ text: message });

    if (req.file) {
      currentParts.push({
        inlineData: {
          mimeType: req.file.mimetype,
          data: req.file.buffer.toString("base64"),
        },
      });
      if (!message) {
        currentParts.unshift({
          text: `Look at this plant photo and tell me what problem it has and how to treat it. Respond in ${languageName}.`,
        });
      }
    }

    const contents = [...trimmedHistory, { role: "user", parts: currentParts }];

    const response = await generateWithRetry({
      model: "gemini-3.6-flash",
      contents,
      config: { systemInstruction: SYSTEM_PROMPT },
    });

    res.json({ reply: response.text });
  } catch (err) {
    console.error("Chat error:", err.message);
    res.status(500).json({ error: "Something went wrong. Please try again." });
  }
});

app.post("/api/speak", async (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ error: "Text is required" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: ["AUDIO"],
        speechConfig: {
          voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } },
        },
      },
    });

    const audioData = response.candidates[0].content.parts[0].inlineData.data;
    const pcmBuffer = Buffer.from(audioData, "base64");

    const chunks = [];
    const writable = new Writable({
      write(chunk, enc, cb) {
        chunks.push(chunk);
        cb();
      },
    });

    const writer = new wav.Writer({
      channels: 1,
      sampleRate: 24000,
      bitDepth: 16,
    });
    writer.pipe(writable);
    writer.end(pcmBuffer);

    writable.on("finish", () => {
      res.set("Content-Type", "audio/wav");
      res.send(Buffer.concat(chunks));
    });
  } catch (err) {
    console.error("TTS error:", err.message);
    res.status(500).json({ error: "Could not generate speech." });
  }
});

app.post("/api/diagnose", upload.single("image"), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Image is required" });

  const {
    district = "",
    crop = "Unknown",
    state = "",
    language,
    uid,
  } = req.body;
  const languageName = LANGUAGE_NAMES[language] || "English";

  try {
    const base64Image = req.file.buffer.toString("base64");

    const response = await generateWithRetry({
      model: "gemini-3.6-flash",
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `You are an agricultural expert. Look at this plant leaf image. Respond ONLY in this exact JSON format, no extra text:
{
  "isPlant": true or false,
  "diseaseEn": "English disease name, or exactly 'Healthy' or 'Unclear'",
  "diseaseDisplay": "the diseaseEn value translated naturally into ${languageName} — if ${languageName} is English, this must be identical to diseaseEn",
  "confidence": "High/Medium/Low",
  "treatmentEn": "2-3 short practical treatment steps in English, under 60 words",
  "treatmentDisplay": "the treatmentEn steps translated naturally into ${languageName} — if ${languageName} is English, this must be identical to treatmentEn"
}`,
            },
            { inlineData: { mimeType: req.file.mimetype, data: base64Image } },
          ],
        },
      ],
    });

    let result;
    try {
      const cleaned = response.text.replace(/```json|```/g, "").trim();
      result = JSON.parse(cleaned);
    } catch {
      return res
        .status(500)
        .json({ error: "Could not parse diagnosis. Try a clearer photo." });
    }

    const isHealthyOrUnclear =
      result.diseaseEn === "Healthy" || result.diseaseEn === "Unclear";

    if (result.isPlant && !isHealthyOrUnclear) {
      db.collection("reports")
        .add({
          district: district || "Unknown",
          state: state || "Unknown",
          crop,
          disease: result.diseaseEn,
          timestamp: FieldValue.serverTimestamp(),
        })
        .catch((err) => console.error("Firestore write failed:", err.message));
    }

    if (uid && result.isPlant) {
      db.collection("userHistory")
        .add({
          uid,
          district: district || "Unknown",
          state: state || "Unknown",
          crop,
          disease: result.diseaseEn,
          treatment: result.treatmentEn,
          timestamp: FieldValue.serverTimestamp(),
        })
        .catch((err) => console.error("History save failed:", err.message));
    }

    // Frontend keeps reading result.disease / result.treatment as before —
    // it just now receives the display-language versions instead of English.
    res.json({
      isPlant: result.isPlant,
      disease: result.diseaseDisplay,
      confidence: result.confidence,
      treatment: result.treatmentDisplay,
    });
  } catch (err) {
    console.error("Diagnose error:", err.message);
    res
      .status(500)
      .json({ error: "Something went wrong analyzing the image." });
  }
});

app.get("/api/community/hotspots", async (req, res) => {
  try {
    const stateFilter = req.query.state ? String(req.query.state).trim() : null;
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const pageSize = Math.max(
      1,
      Math.min(50, parseInt(req.query.pageSize, 10) || 10),
    );

    let query = db.collection("reports").orderBy("timestamp", "desc");
    if (stateFilter) {
      query = query.where("state", "==", stateFilter);
    }

    // Fetch enough to rank hotspots + paginate without pulling the whole collection.
    // Raise this cap later if a single state's report volume grows past it.
    const snapshot = await query.limit(500).get();

    const reports = snapshot.docs.map((doc) => {
      const d = doc.data();
      return { district: d.district, crop: d.crop, disease: d.disease };
    });

    const counts = {};
    for (const r of reports) {
      const key = `${r.district}|${r.disease}`;
      counts[key] = (counts[key] || 0) + 1;
    }
    const hotspots = Object.entries(counts)
      .map(([key, count]) => {
        const [district, disease] = key.split("|");
        return { district, disease, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    const totalCount = reports.length;
    const totalPages = Math.max(1, Math.ceil(totalCount / pageSize));
    const start = (page - 1) * pageSize;
    const recent = reports.slice(start, start + pageSize);

    res.json({ hotspots, recent, page, pageSize, totalCount, totalPages });
  } catch (err) {
    console.error("Community fetch error:", err.message);
    res.status(500).json({ error: "Could not load community data." });
  }
});

app.get("/api/history/:uid", async (req, res) => {
  const snapshot = await db
    .collection("userHistory")
    .where("uid", "==", req.params.uid)
    .orderBy("timestamp", "desc")
    .limit(20)
    .get();
  res.json(snapshot.docs.map((d) => d.data()));
});

// ROUTE 1 — pure historical data, no Gemini, instant
app.get("/api/district/crops", async (req, res) => {
  const { district, state, lat, lon } = req.query;
  if (!district) return res.status(400).json({ error: "District is required" });

  try {
    let latitude = lat,
      longitude = lon;

    if (!latitude || !longitude) {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(district)}&count=1`,
      );
      const geoData = await geoRes.json();
      if (!geoData.results || geoData.results.length === 0) {
        return res
          .status(404)
          .json({ error: "Could not locate this district for weather data." });
      }
      latitude = geoData.results[0].latitude;
      longitude = geoData.results[0].longitude;
    }

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m,relative_humidity_2m&daily=precipitation_sum&past_days=30&timezone=auto`,
    );
    const weather = await weatherRes.json();
    const temperature = weather.current.temperature_2m;
    const humidity = weather.current.relative_humidity_2m;
    const rainfall = weather.daily.precipitation_sum.reduce(
      (a, b) => a + (b || 0),
      0,
    );

    const result = getCropRecommendations(state || district, district);
    if (result.crops.length === 0) {
      return res
        .status(404)
        .json({ error: "No historical crop data found for this location." });
    }

    res.json({
      season: new Date().toLocaleString("en-IN", { month: "long" }),
      recommendedCrops: result.crops.slice(0, 3).map((c) => c.crop),
      matchLevel: result.matchLevel,
      matchedDistrict: result.matchedDistrict,
      liveData: { temperature, humidity, rainfall: rainfall.toFixed(1) },
    });
  } catch (err) {
    console.error("District crops error:", err.message);
    res
      .status(500)
      .json({ error: "Could not fetch crop data for this location." });
  }
});

// ROUTE 2 — on-demand explanation, called only when farmer taps a crop
app.post("/api/district/explain", async (req, res) => {
  const {
    crop,
    district,
    state,
    language,
    matchLevel,
    matchedDistrict,
    temperature,
    humidity,
    rainfall,
  } = req.body;
  if (!crop || !district)
    return res.status(400).json({ error: "Crop and district are required" });

  try {
    const matchNote =
      matchLevel === "state"
        ? `Note: exact district data wasn't available, so this is based on state-wide historical trends for ${matchedDistrict || state}.`
        : "";

    const languageName = LANGUAGE_NAMES[language] || "English";
    const languageInstruction =
      languageName !== "English"
        ? `\n\nRespond entirely in ${languageName}.`
        : "";

    const prompt = `You are an agricultural advisor. Based on this REAL data for a farmer in ${district}${state ? `, ${state}` : ""}:
- Live temperature: ${temperature}°C
- Live humidity: ${humidity}%
- 30-day rainfall total: ${rainfall}mm
- Crop historically grown in this district/season, ranked by actual farmer land allocation over ~19 years of government data: ${crop}
${matchNote}
 
Write a short (under 80 words), simple, encouraging explanation for the farmer of why ${crop} suits their area and current season. If a note is given above, mention gently that this is a state-level estimate. Keep it practical.${languageInstruction}`;

    const response = await generateWithRetry({
      model: "gemini-3.6-flash",
      contents: prompt,
    });

    res.json({ crop, explanation: response.text });
  } catch (err) {
    console.error("Crop explain error:", err.message);
    res.status(500).json({ error: "Could not generate explanation." });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
