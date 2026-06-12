/**
 * Telegram Webhook Endpoint — receives all updates from Telegram.
 * Unified handler for VAJI + SFG + VISION BOT.
 *
 * ⚠️ Vercel serverless timeout:
 *    - Hobby plan: 10 seconds
 *    - Pro plan: 60 seconds (configurable up to 300s with maxDuration)
 *
 * For large PDFs, consider using polling mode (node start.js) which
 * avoids the timeout limitation entirely.
 */
const { handleWebhook } = require('../lib/bot');

module.exports = async (req, res) => {
  if (req.method === 'POST') {
    try {
      await handleWebhook(req.body);
      res.status(200).send('OK');
    } catch (err) {
      console.error('Webhook error:', err);
      res.status(200).send('OK'); // always 200 to Telegram
    }
  } else if (req.method === 'GET') {
    res.status(200).send('VAJI + SFG + VISION BOT is running.');
  } else {
    res.status(405).send('Method Not Allowed');
  }
};
