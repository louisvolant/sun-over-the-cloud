// routes/search_api.js

const express = require('express');
const axios = require('axios');
const router = express.Router();
const OPEN_METEO_GEOCODING_API = 'https://geocoding-api.open-meteo.com/v1/search';
const { getLocationSearch, saveLocationSearch } = require('../dao/searchDao');

// Route for geocoding search powered by Open-Meteo
router.get('/search', async (req, res) => {
    const param_lang = req.query.lang || 'en';
    const city = req.query.city;
    if (!city) {
        return res.status(400).send({ error: "City parameter is required" });
    }

    try {
        // Check if data already exists in MongoAtlas
        const existingData = await getLocationSearch(city, param_lang);
        if (existingData) {
            return res.json(existingData.data);
        }

        const response = await axios.get(OPEN_METEO_GEOCODING_API, {
            params: {
                name: city,
                count: 5,
                language: param_lang,
                format: 'json',
            },
        });

        const rawResults = response.data?.results || [];
        const formattedLocations = rawResults.map((item) => ({
            name: item.name,
            lat: item.latitude,
            lon: item.longitude,
            country: item.country_code,
            state: item.admin1,
            location_name: item.admin1 ? `${item.name}, ${item.admin1}` : item.name,
        }));

        // Save the new data to MongoDB
        await saveLocationSearch(city, param_lang, formattedLocations);

        res.json(formattedLocations);
    } catch (error) {
        console.error("Error fetching location data from Open-Meteo:", error.response ? error.response.data : error.message);
        res.status(500).send({ error: "Failed to fetch location data" });
    }
});

module.exports = router;

