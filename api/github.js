// Vercel serverless function — /api/github
// Calls GitHub GraphQL API server-side so the token stays hidden
// Returns: { total: number, days: [{date, count, level}] }

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // cache 1 hour

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN not set in Vercel env vars' });
  }

  const query = `
    query {
      user(login: "Rafie-kun") {
        contributionsCollection {
          contributionCalendar {
            totalContributions
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  try {
    const r = await fetch('https://api.github.com/graphql', {
      method: 'POST',
      headers: {
        'Authorization': `bearer ${TOKEN}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Rafie-Portfolio'
      },
      body: JSON.stringify({ query })
    });

    if (!r.ok) {
      const text = await r.text();
      return res.status(r.status).json({ error: text });
    }

    const json = await r.json();
    if (json.errors) {
      return res.status(400).json({ error: json.errors[0].message });
    }

    const cal = json.data.user.contributionsCollection.contributionCalendar;
    const total = cal.totalContributions;

    const levelMap = {
      'NONE': 0,
      'FIRST_QUARTILE': 1,
      'SECOND_QUARTILE': 2,
      'THIRD_QUARTILE': 3,
      'FOURTH_QUARTILE': 4
    };

    const days = [];
    cal.weeks.forEach(week => {
      week.contributionDays.forEach(day => {
        days.push({
          date: day.date,
          count: day.contributionCount,
          level: levelMap[day.contributionLevel] ?? 0
        });
      });
    });

    return res.status(200).json({ total, days });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
