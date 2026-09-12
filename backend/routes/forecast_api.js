// routes/forecast_api.js

const express = require('express');
const router = express.Router();
const { getForecast } = require('../service/metNorwayService');

// Route for forecast powered by MET Norway
router.get('/forecast', async (req, res) => {
    const { lat, lon } = req.query;
    if (!lat || !lon) {
        return res.status(400).send({ error: "Latitude and Longitude parameters are required" });
    }

    try {
        const data = await getForecast(lat, lon);
        res.json(data);
    } catch (error) {
        console.error("Error fetching forecast data from MET Norway:", error.message);
        res.status(500).send({ error: "Failed to fetch forecast data" });
    }
});

module.exports = router;