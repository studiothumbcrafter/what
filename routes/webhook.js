const express = require('express');
const router = express.Router();

// WhatsApp webhook — implemented in Task 9
router.post('/', function (req, res) {
  res.status(501).json({ error: 'WhatsApp webhook not implemented yet' });
});

module.exports = router;
