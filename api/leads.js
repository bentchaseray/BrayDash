// CRM 2.0 (appHaT4kp3bJ5otJQ / Leads tbla1tvqnhAyJalX9) -- old base appQnZmRHt0UTS043 retired 2026-07-05
const BASE_URL = 'https://api.airtable.com/v0/appHaT4kp3bJ5otJQ/tbla1tvqnhAyJalX9';

function clean(r) {
  const f = r.fields || {};
  return {
    id:           r.id,
    name:         f['Business Name'] || '',
    owner:        f['Owner'] || '',
    phone:        f['Phone'] || null,
    email:        f['Email'] || null,
    website:      f['Website/IG'] || null,
    businessType: f['Business Type'] || '',
    market:       f['Market'] || '',
    town:         f['Town'] || '',
    niche:        f['Niche'] || '',
    source:       f['Source'] || '',
    temperature:  f['Temperature'] || '',
    reportLink:   f['Report Link'] || null,
    notes:        f['Notes'] || '',
  };
}

const TEMP_ORDER = { hot: 0, warm: 1, cold: 2 };

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { temperature, id } = req.query;
  const auth = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` };

  try {
    if (id) {
      const r = await fetch(`${BASE_URL}/${id}`, { headers: auth });
      if (!r.ok) throw new Error(`Airtable error: ${r.status}`);
      return res.status(200).json(clean(await r.json()));
    }

    const params = new URLSearchParams();
    if (temperature) params.set('filterByFormula', `{Temperature}="${temperature}"`);

    const r = await fetch(`${BASE_URL}?${params}`, { headers: auth });
    if (!r.ok) throw new Error(`Airtable error: ${r.status}`);

    const data = await r.json();
    const records = (data.records || []).map(clean);
    records.sort((a, b) => {
      const ta = TEMP_ORDER[(a.temperature || '').toLowerCase()] ?? 3;
      const tb = TEMP_ORDER[(b.temperature || '').toLowerCase()] ?? 3;
      if (ta !== tb) return ta - tb;
      return a.name.localeCompare(b.name);
    });
    res.status(200).json(records);
  } catch (err) {
    console.error('leads error:', err.message);
    res.status(500).json({ error: 'leads fetch failed' });
  }
}
