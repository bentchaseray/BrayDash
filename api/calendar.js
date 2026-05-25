const KEYWORDS = ['shoot', 'film', 'video', 'creekside', 'beelite', 'gravel', 'brayfilms'];

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  if (!process.env.GOOGLE_CALENDAR_TOKEN) {
    res.setHeader('X-Data-Source', 'fallback');
    return res.status(200).json([]);
  }

  const days = parseInt(req.query.days) || 90;
  const now  = new Date();
  const max  = new Date(now.getTime() + days * 86400000);

  try {
    const params = new URLSearchParams({
      timeMin:       now.toISOString(),
      timeMax:       max.toISOString(),
      orderBy:       'startTime',
      singleEvents:  'true',
      maxResults:    '50',
    });

    const gcRes = await fetch(
      `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
      { headers: { Authorization: `Bearer ${process.env.GOOGLE_CALENDAR_TOKEN}` } }
    );
    if (!gcRes.ok) throw new Error(`Calendar API error: ${gcRes.status}`);

    const data   = await gcRes.json();
    const today  = new Date(); today.setHours(0, 0, 0, 0);

    const events = (data.items || [])
      .filter(e => KEYWORDS.some(k => `${e.summary || ''} ${e.description || ''}`.toLowerCase().includes(k)))
      .map(e => {
        const dateStr      = e.start.date || e.start.dateTime?.split('T')[0];
        const date         = new Date(`${dateStr}T00:00:00`);
        const daysOut      = Math.round((date - today) / 86400000);
        const dateFormatted = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
        return { id: e.id, title: e.summary || '', date: dateStr, dateFormatted, daysOut, location: e.location || '', description: e.description || '', value: '' };
      });

    res.status(200).json(events);
  } catch (err) {
    console.error('calendar error:', err.message);
    res.setHeader('X-Data-Source', 'fallback');
    res.status(200).json([]);
  }
}
