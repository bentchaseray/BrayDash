export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN } = process.env;

  // Graceful fallback if not configured yet
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET || !GOOGLE_REFRESH_TOKEN) {
    res.setHeader('X-Data-Source', 'fallback');
    return res.status(200).json([]);
  }

  try {
    // Step 1: Exchange refresh token for a fresh access token
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        refresh_token: GOOGLE_REFRESH_TOKEN,
        grant_type: 'refresh_token'
      })
    });

    if (!tokenRes.ok) {
      console.error('Token refresh failed:', await tokenRes.text());
      res.setHeader('X-Data-Source', 'fallback');
      return res.status(200).json([]);
    }

    const { access_token } = await tokenRes.json();

    // Step 2: Fetch calendar events
    const days = parseInt(req.query.days) || 90;
    const now = new Date().toISOString();
    const future = new Date(Date.now() + days * 86400000).toISOString();

    const calRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?` +
      new URLSearchParams({
        timeMin: now,
        timeMax: future,
        orderBy: 'startTime',
        singleEvents: 'true',
        maxResults: '50'
      }),
      { headers: { Authorization: `Bearer ${access_token}` } }
    );

    if (!calRes.ok) {
      console.error('Calendar fetch failed:', await calRes.text());
      res.setHeader('X-Data-Source', 'fallback');
      return res.status(200).json([]);
    }

    const { items = [] } = await calRes.json();

    // Step 3: Filter for shoot-related events
    const SHOOT_KEYWORDS = ['shoot', 'film', 'video', 'creekside', 'beelite', 'gravel', 'brayfilms', 'explore harrison'];
    const shoots = items
      .filter(e => {
        const text = `${e.summary || ''} ${e.description || ''}`.toLowerCase();
        return SHOOT_KEYWORDS.some(k => text.includes(k));
      })
      .map(e => {
        const dateStr = e.start?.date || e.start?.dateTime?.split('T')[0] || '';
        const date = new Date(dateStr + 'T00:00:00');
        const daysOut = Math.ceil((date - Date.now()) / 86400000);
        const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
        return {
          id: e.id,
          title: e.summary || 'Shoot',
          date: dateStr,
          dateFormatted: `${months[date.getMonth()]} ${date.getDate()}`,
          daysOut,
          location: e.location || '',
          description: e.description || '',
          value: extractValue(e.description || e.summary || '')
        };
      })
      .filter(s => s.daysOut >= 0)
      .sort((a, b) => a.daysOut - b.daysOut);

    res.setHeader('X-Data-Source', 'google-calendar');
    res.status(200).json(shoots);

  } catch (err) {
    console.error('Calendar error:', err.message);
    res.setHeader('X-Data-Source', 'fallback');
    res.status(200).json([]);
  }
}

function extractValue(text) {
  const match = text.match(/\$[\d,]+/);
  if (match) return match[0];
  if (/retainer/i.test(text)) return 'retainer';
  if (/net/i.test(text)) return text.match(/\$[\d,]+\s*net/i)?.[0] || '';
  return '';
}
