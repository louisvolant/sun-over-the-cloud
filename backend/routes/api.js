// routes/api.js
const express = require('express');
const router = express.Router();

router.use(require('./search_api'));
router.use(require('./forecast_api'));
router.use(require('./onecall_api'));


router.use(require('./login_api'));
router.use(require('./google_oauth_api'));
router.use(require('./password_api'));
router.use(require('./registration_api'));
router.use(require('./favorites_api'));

module.exports = router;