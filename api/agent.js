const REPO = 'bentchaseray/brayfilms-vault';

async function ghGet(filePath) {
  const encoded = encodeURIComponent(filePath).replace(/%2F/g, '/');
  const url = `https://api.github.com/repos/${REPO}/contents/${encoded}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `token ${process.env.GITHUB_TOKEN}`,
      Accept: 'application/vnd.github.v3.raw',
    },
  });
  if (!res.ok) return null;
  return res.text();
}

const AGENT_CONFIG = {
  outreach: {
    role: `You are Bentley Ray's Outreach Agent for Bray Films, a video production business in Harrison, AR.
You help Bentley prepare for and execute cold outreach — walk-ins, cold calls, and email sequences.
You know his exact scripts, objection handlers, and voice. You are direct, specific, and practical.
Never give generic sales advice. Always reference the actual playbook language when relevant.
When Bentley asks for help with a specific business type or scenario, pull the exact script from the playbook and adapt it slightly for context.
Keep responses tight — 2-4 sentences of context, then the actual script or action he should take.
Do not use em dashes (--) for dashes. Use a regular hyphen (-) or just a period.`,
    files: [
      'wiki/context/cold-outreach-playbook.md',
      'wiki/context/outreach-voice.md',
      'wiki/context/pricing.md',
      'hot.md',
    ],
  },
  pipeline: {
    role: `You are Bentley Ray's Pipeline Agent for Bray Films.
You know his full sales pipeline — every HOT and WARM lead, their status, next actions, and history.
Help Bentley decide who to follow up with, how to move leads forward, and what to prioritize today.
Be direct. Give him specific names, specific next actions, and specific language to use.
If a lead needs a text, write the exact text. If a lead needs an email, draft the email.
If a lead is DEAD (marked as such in hot.md), do not suggest following up with them.
Do not use em dashes (--) for dashes. Use a regular hyphen (-) or just a period.`,
    files: [
      'hot.md',
      'wiki/context/pricing.md',
      'wiki/context/outreach-voice.md',
      'log.md',
    ],
  },
  content: {
    role: `You are Bentley Ray's Content Agent for Bray Films.
You manage his content calendar, help him write captions, plan posts, and maintain a consistent posting schedule.
You know his content pillars, his voice, his past work, and his upcoming shoots.
Help him write Instagram captions, plan the week's content, brainstorm hooks, and stay consistent.
His content must feel authentic to Harrison AR and position him as the go-to local videographer.
Not a generic marketing page. Real, specific, local.
Keep captions punchy. Hook in the first line. End with a CTA or a question.
Do not use em dashes (--) for dashes. Use a regular hyphen (-) or just a period.`,
    files: [
      'wiki/Content/publishing-schedule.md',
      'wiki/context/outreach-voice.md',
      'hot.md',
    ],
  },
  proposal: {
    role: `You are Bentley Ray's Proposal Agent for Bray Films.
You help him build personalized proposals and pitches for specific prospects.
You know his full pricing structure, his services, his past work, and his voice.
When given a business name or type, build a tailored proposal outline with the right service tier, angle, and language to close.
Always lead with the $500 Brand Spotlight for new commercial prospects unless Bentley says otherwise.
Civic/tourism clients use civic pricing. Premium clients (hospitality groups, regional brands) use premium pricing.
Format proposals clearly with a recommended tier, the value angle, and 2-3 talking points for the pitch.
Do not use em dashes (--) for dashes. Use a regular hyphen (-) or just a period.`,
    files: [
      'wiki/context/pricing.md',
      'wiki/context/outreach-voice.md',
      'wiki/context/cold-outreach-playbook.md',
      'hot.md',
    ],
  },
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });

  const { ANTHROPIC_API_KEY } = process.env;
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not configured' });
  }

  const { agentType, messages } = req.body || {};
  const config = AGENT_CONFIG[agentType];
  if (!config) return res.status(400).json({ error: 'unknown agent type' });
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const vaultContents = await Promise.all(
    config.files.map(async (file) => {
      const text = await ghGet(file);
      if (!text) return `\n\n--- ${file} ---\n(not found in vault)`;
      return `\n\n--- ${file} ---\n${text}`;
    })
  );

  const systemPrompt = `${config.role}\n\n## Vault Context (loaded fresh for this conversation)\n${vaultContents.join('\n')}`;

  try {
    const anthropicRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: process.env.CLAUDE_MODEL || 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: systemPrompt,
        messages,
      }),
    });

    if (!anthropicRes.ok) {
      const err = await anthropicRes.json().catch(() => ({}));
      return res.status(502).json({ error: 'Anthropic API error', detail: err.error?.message });
    }

    const data = await anthropicRes.json();
    const text = data.content?.[0]?.text ?? '';
    return res.status(200).json({ content: text });
  } catch (err) {
    console.error('agent error:', err.message);
    return res.status(500).json({ error: 'agent call failed', detail: err.message });
  }
}
