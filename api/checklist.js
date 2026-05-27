const REPO = 'bentchaseray/brayfilms-vault';

async function ghGet(filePath) {
  const url = `https://api.github.com/repos/${REPO}/contents/${filePath.replace(/ /g, '%20')}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (!res.ok) return null;
  const data = await res.json();
  return Buffer.from(data.content, 'base64').toString('utf-8');
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { GITHUB_TOKEN } = process.env;
  if (!GITHUB_TOKEN) return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });

  const briefing = await ghGet('daily/briefing.md');
  if (!briefing) return res.status(200).json({ punchlist: [], executive: [], date: null, error: 'No briefing found' });

  let state = { date: null, checked: [] };
  try {
    const stateRaw = await ghGet('daily/checklist-state.json');
    if (stateRaw) state = JSON.parse(stateRaw);
  } catch (_) {}

  const punchlistItems = [];
  const execItems = [];
  let inPunchlist = false;
  let inExec = false;

  for (const line of briefing.split('\n')) {
    const trimmed = line.trim();
    if (/^PUNCHLIST/i.test(trimmed))        { inPunchlist = true;  inExec = false; continue; }
    if (/^EXECUTIVE ACTIONS/i.test(trimmed)) { inPunchlist = false; inExec = true;  continue; }
    if (/^UPCOMING/i.test(trimmed))          { inPunchlist = false; inExec = false; continue; }

    if (inPunchlist && /^\d+\./.test(trimmed)) {
      const text = trimmed.replace(/^\d+\.\s*/, '');
      punchlistItems.push({ id: String(punchlistItems.length + 1), text, tag: inferTag(text, 'punchlist') });
    }
    if (inExec && /^[A-C]\./.test(trimmed)) {
      const text = trimmed.replace(/^[A-C]\.\s*/, '');
      execItems.push({ id: String.fromCharCode(65 + execItems.length), text, tag: inferTag(text, 'executive') });
    }
  }

  const today = new Date().toISOString().slice(0, 10);
  const checkedIds = state.date === today ? (state.checked || []) : [];

  const punchlist = punchlistItems.map(i => ({ ...i, checked: checkedIds.includes(i.id) }));
  const executive = execItems.map(i => ({ ...i, checked: checkedIds.includes(i.id) }));

  return res.status(200).json({ date: today, punchlist, executive });
}

function inferTag(text, section) {
  const t = text.toLowerCase();
  if (section === 'punchlist') {
    if (/invoice|send invoice|\$/.test(t))    return 'INVOICE';
    if (/call|text|dm|message/.test(t))        return 'OUTREACH';
    if (/wait|hold|owns the move/.test(t))     return 'HOLD';
    if (/shoot|show up|2pm|on-site/.test(t))   return 'SHOOT';
    return 'PRIORITY';
  }
  if (/renewal|rate|pricing|revenue|retainer|contract renew/.test(t)) return 'REVENUE';
  if (/relationship|referral|cold|thank|acknowledge/.test(t))         return 'RELATIONSHIP';
  if (/content|post|social|reel|ig/.test(t))                          return 'CONTENT';
  if (/expir|close|contract|risk|deadline/.test(t))                   return 'RISK';
  return 'STRATEGY';
}
