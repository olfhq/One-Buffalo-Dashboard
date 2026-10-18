// Fetch comprehensive injury report for both rosters
let realInjuries = [];
try {
  const sumRes = await fetch(`https://site.api.espn.com/apis/site/v2/sports/football/nfl/summary?event=${nextGame.id}`);
  if (sumRes.ok) {
    const sumData = await sumRes.json();
    if (sumData.injuries && Array.isArray(sumData.injuries)) {
      sumData.injuries.forEach(teamGroup => {
        const teamName = teamGroup.team?.abbreviation || teamGroup.team?.displayName;
        (teamGroup.injuries || []).forEach(inj => {
          realInjuries.push({
            player: inj.athlete?.displayName || 'Player',
            pos: inj.athlete?.position?.abbreviation || '',
            status: inj.status || 'Questionable',
            injury: inj.type?.detail || inj.details?.type || 'Undisclosed',
            team: teamName === 'BUF' ? 'Bills' : oppName
          });
        });
      });
    }
  }
} catch (e) {
  console.warn('Live injury report fallback:', e.message);
}

// Pass all real injuries (or fallback if empty early in the week)
billsSchedule.injuries = realInjuries.length > 0 ? realInjuries : billsSchedule.injuries;
