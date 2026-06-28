// Vercel serverless function — /api/github
// Server-side only — token never reaches the browser

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=86400');

  const TOKEN = process.env.GITHUB_TOKEN;
  if (!TOKEN) {
    return res.status(500).json({ error: 'GITHUB_TOKEN env var not set in Vercel' });
  }

  const query = `{
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
  }`;

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
      return res.status(r.status).json({ error: 'GitHub API error: ' + r.status });
    }

    const json = await r.json();
    if (json.errors) {
      return res.status(400).json({ error: json.errors[0].message });
    }

    const cal = json.data.user.contributionsCollection.contributionCalendar;
    const levelMap = { NONE:0, FIRST_QUARTILE:1, SECOND_QUARTILE:2, THIRD_QUARTILE:3, FOURTH_QUARTILE:4 };

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

    return res.status(200).json({ total: cal.totalContributions, days });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
};
