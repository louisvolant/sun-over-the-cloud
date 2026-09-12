// routes/onecall_api.js
const express = require('express');
const router = express.Router();
const { fetchMonthSummary } = require('../service/oneCallService');
const { getCurrentWeather } = require('../service/metNorwayService');

// /onecall endpoint powered by MET Norway
router.get('/onecall', async (req, res) => {
  const { lat, lon } = req.query;
  if (!lat || !lon) {
    return res.status(400).json({ error: "Latitude and Longitude parameters are required" });
  }

  console.log(`Fetching /onecall for lat=${lat}, lon=${lon}`);

  try {
    const data = await getCurrentWeather(lat, lon);
    res.json(data);
  } catch (err) {
    console.error('API Error:', err.message);
    res.status(500).json({ error: "Failed to fetch weather data from MET Norway" });
  }
});

// /onecallmonthsummary endpoint powered by Open-Meteo
router.get('/onecallmonthsummary', async (req, res) => {
  const { lat, lon, year, month } = req.query;
  if (!lat || !lon || !year || !month) {
    return res.status(400).send({ error: "Latitude, Longitude, Year, and Month parameters are required" });
  }

  console.log(`Fetching /onecallmonthsummary for lat=${lat}, lon=${lon}, year=${year}, month=${month}`);

  const result = await fetchMonthSummary(lat, lon, parseInt(year), parseInt(month));
  if (result.success) {
    res.json(result.data);
  } else {
    console.error('API Error:', result.error);
    res.status(500).send({ error: "Failed to fetch monthly weather data" });
  }
});

module.exports = router;