const BASE_URL = 'https://api.airtable.com/v0/appQnZmRHt0UTS043/Leads';

function clean(r) {
  const f = r.fields || {};
  return {
    id:             r.id,
    name:           f['Business Name'] || f['Name'] || '',
    owner:          f['Owner'] || '',
    phone:          f['Phone'] || null,
    email:          f['Email'] || null,
    instagram:      f['Instagram'] || null,
    website:        f['Website'] || null,
    stage:          f['Stage'] || '',
    status:         f['Status'] || '',
    value:          f['Value'] || 0,
    score:          f['Score'] || 0,
    industry:       f['Industry'] || '',
    nextAction:     f['Next Action'] || '',
    outreachStatus: f['Outreach Status'] || '',
    reportLink:     f['Report Link'] || null,
    pitchAngle:     f['Pitch Angle'] || '',
    source:         f['Source'] || '',
    town:           f['Town'] || '',
    tier:           f['Tier'] || '',
  };
}

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { stage, id } = req.query;
  const auth = { Authorization: `Bearer ${process.env.AIRTABLE_TOKEN}` };

  try {
    if (id) {
      const r = await fetch(`${BASE_URL}/${id}`, { headers: auth });
      if (!r.ok) throw new Error(`Airtable error: ${r.status}`);
      return res.status(200).json(clean(await r.json()));
    }

    const params = new URLSearchParams();
    if (stage) params.set('filterByFormula', `Stage="${stage}"`);
    params.set('sort[0][field]', 'Score');
    params.set('sort[0][direction]', 'desc');

    const r = await fetch(`${BASE_URL}?${params}`, { headers: auth });
    if (!r.ok) throw new Error(`Airtable error: ${r.status}`);

    const data = await r.json();
    const records = (data.records || []).map(clean);
    records.sort((a, b) => {
      if (a.stage === 'HOT' && b.stage !== 'HOT') return -1;
      if (a.stage !== 'HOT' && b.stage === 'HOT') return 1;
      return b.score - a.score;
    });
    res.status(200).json(records);
  } catch (err) {
    console.error('leads error:', err.message);
    res.status(500).json({ error: 'leads fetch failed' });
  }
}
