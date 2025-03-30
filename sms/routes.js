const express = require('express');
const { sendDiscount, saveConsent, getConsent, updateConsent } = require('./apis');

const router = express.Router();

router.post('/send-discount', sendDiscount);
router.post('/save-consent', saveConsent);
router.post('/get-consent', getConsent);
router.post('/update-consent', updateConsent);

module.exports = router;
