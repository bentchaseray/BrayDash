export default async function handler(req, res) {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(200).end();
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { GITHUB_TOKEN } = process.env;
  if (!GITHUB_TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not configured' });
  }

  const { file, content } = req.body;

  if (!file || typeof file !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "file" field (expected vault-relative path, e.g. "hot.md" or "wiki/People/Donovan Fiore.md")' });
  }
  if (!content || typeof content !== 'string') {
    return res.status(400).json({ error: 'Missing or invalid "content" field' });
  }

  // Sanitize: prevent directory traversal outside the vault
  const normalizedFile = file.replace(/\\/g, '/').replace(/^\/+/, '');
  if (normalizedFile.includes('..')) {
    return res.status(400).json({ error: 'Invalid file path' });
  }

  const REPO = 'bentchaseray/brayfilms-vault';
  const API_BASE = `https://api.github.com/repos/${REPO}/contents/${encodeURIComponent(normalizedFile).replace(/%2F/g, '/')}`;

  // Step 1: GET current file SHA (required for updates; null for new files)
  let sha = null;
  try {
    const getRes = await fetch(API_BASE, {
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    if (getRes.ok) {
      const data = await getRes.json();
      sha = data.sha;
    } else if (getRes.status !== 404) {
      const err = await getRes.json();
      return res.status(502).json({ error: 'GitHub GET failed', detail: err.message });
    }
    // 404 = new file, sha stays null — that's fine
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch file SHA', detail: e.message });
  }

  // Step 2: PUT (create or update)
  const encoded = Buffer.from(content, 'utf-8').toString('base64');
  const body = {
    message: `vault-write: update ${normalizedFile}`,
    content: encoded,
    ...(sha ? { sha } : {}),
  };

  try {
    const putRes = await fetch(API_BASE, {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${GITHUB_TOKEN}`,
        Accept: 'application/vnd.github+json',
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
      body: JSON.stringify(body),
    });

    if (!putRes.ok) {
      const err = await putRes.json();
      return res.status(502).json({ error: 'GitHub PUT failed', detail: err.message });
    }

    const result = await putRes.json();
    return res.status(200).json({
      success: true,
      file: normalizedFile,
      sha: result.content?.sha,
      url: result.content?.html_url,
    });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to write file', detail: e.message });
  }
}
