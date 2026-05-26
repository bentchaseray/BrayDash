export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN } = process.env;
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  const { content } = req.body;
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Missing content field' });
  }

  const REPO = 'bentchaseray/brayfilms-vault';
  const FILE = 'daily/briefing.md';
  const API_BASE = `https://api.github.com/repos/${REPO}/contents/${FILE}`;
  const HEADERS = {
    'Authorization': `token ${GITHUB_TOKEN}`,
    'Accept': 'application/vnd.github.v3+json',
    'Content-Type': 'application/json'
  };

  try {
    // Step 1: Get current SHA (needed for updates — 404 means first write)
    let sha = null;
    const shaRes = await fetch(API_BASE, { headers: HEADERS });
    if (shaRes.ok) {
      const shaData = await shaRes.json();
      sha = shaData.sha;
    } else if (shaRes.status !== 404) {
      const err = await shaRes.text();
      console.error('SHA fetch failed:', err);
      return res.status(502).json({ error: 'GitHub SHA fetch failed', detail: err });
    }

    // Step 2: Base64-encode the content
    const encoded = Buffer.from(content, 'utf-8').toString('base64');

    // Step 3: Push to GitHub
    const today = new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
    const body = {
      message: `briefing: ${today}`,
      content: encoded
    };
    if (sha) body.sha = sha;

    const pushRes = await fetch(API_BASE, {
      method: 'PUT',
      headers: HEADERS,
      body: JSON.stringify(body)
    });

    if (!pushRes.ok) {
      const err = await pushRes.text();
      console.error('GitHub push failed:', err);
      return res.status(502).json({ error: 'GitHub push failed', detail: err });
    }

    const pushData = await pushRes.json();
    return res.status(200).json({
      success: true,
      sha: pushData.content.sha,
      url: pushData.content.html_url
    });

  } catch (err) {
    console.error('Briefing API error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
