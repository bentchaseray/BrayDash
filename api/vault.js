export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { file } = req.query;
  if (!file) return res.status(400).json({ error: 'file param required' });

  try {
    const url = `https://api.github.com/repos/bentchaseray/brayfilms-vault/contents/${file}`;
    const ghRes = await fetch(url, {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
        Accept: 'application/vnd.github.v3.raw',
      },
    });

    if (ghRes.status === 404) return res.status(404).json({ error: 'file not found' });
    if (!ghRes.ok) throw new Error(`GitHub API error: ${ghRes.status}`);

    const text = await ghRes.text();
    res.setHeader('Content-Type', 'text/plain');
    res.status(200).send(text);
  } catch (err) {
    console.error('vault error:', err.message);
    res.status(500).json({ error: 'vault fetch failed' });
  }
}
