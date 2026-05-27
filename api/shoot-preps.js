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

  try {
    const raw = await ghGet('daily/shoot-preps.json');
    const preps = raw ? JSON.parse(raw) : [];
    return res.status(200).json(preps);
  } catch (_) {
    return res.status(200).json([]);
  }
}
