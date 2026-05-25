const WORKFLOWS = {
  'lead-hunt':     () => process.env.N8N_WEBHOOK_LEAD_HUNT,
  'lead-research': () => process.env.N8N_WEBHOOK_LEAD_RESEARCH,
  'daily-sync':    () => process.env.N8N_WEBHOOK_DAILY_SYNC,
};

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { workflow, payload } = req.body || {};
  if (!workflow || !WORKFLOWS[workflow]) return res.status(400).json({ error: 'unknown workflow' });

  const webhookUrl = WORKFLOWS[workflow]();
  if (!webhookUrl) return res.status(400).json({ error: 'workflow not configured' });

  try {
    const n8nRes = await fetch(webhookUrl, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload || {}),
    });
    if (!n8nRes.ok) throw new Error(`n8n responded with ${n8nRes.status}`);

    res.status(200).json({ success: true, workflow, triggered_at: new Date().toISOString() });
  } catch (err) {
    console.error('trigger error:', err.message);
    res.status(502).json({ error: 'workflow trigger failed', detail: err.message });
  }
}
