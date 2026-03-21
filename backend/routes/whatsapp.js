const express = require('express');
const { sendWhatsApp, sendSosAlert } = require('../controllers/whatsapp');

const router = express.Router();

// POST /api/whatsapp/send
router.post('/send', sendWhatsApp);

// POST /api/whatsapp/send-sos
router.post('/send-sos', sendSosAlert);

module.exports = router;
