const fs = require('fs');
const path = require('path');

const dataPath = path.resolve('c:/Users/wardr/OneDrive/Documents/GitHub/One-Buffalo-Dashboard/data.json');
const raw = fs.readFileSync(dataPath, 'utf8');
const data = JSON.parse(raw);

const NHL_ARENAS = {
  'Sabres': { venue: 'KeyBank Center', city: 'Buffalo, NY', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Panthers': { venue: 'Amerant Bank Arena', city: 'Sunrise, FL', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 61°F / 22°F Sheet' },
  'Lightning': { venue: 'Amalie Arena', city: 'Tampa, FL', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Bruins': { venue: 'TD Garden', city: 'Boston, MA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Maple Leafs': { venue: 'Scotiabank Arena', city: 'Toronto, ON', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Canadiens': { venue: 'Bell Centre', city: 'Montreal, QC', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 58°F / 20°F Sheet' },
  'Senators': { venue: 'Canadian Tire Centre', city: 'Ottawa, ON', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Red Wings': { venue: 'Little Caesars Arena', city: 'Detroit, MI', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Rangers': { venue: 'Madison Square Garden', city: 'New York, NY', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Islanders': { venue: 'UBS Arena', city: 'Elmont, NY', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Devils': { venue: 'Prudential Center', city: 'Newark, NJ', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Flyers': { venue: 'Wells Fargo Center', city: 'Philadelphia, PA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Penguins': { venue: 'PPG Paints Arena', city: 'Pittsburgh, PA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Capitals': { venue: 'Capital One Arena', city: 'Washington, DC', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Hurricanes': { venue: 'Lenovo Center', city: 'Raleigh, NC', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Blue Jackets': { venue: 'Nationwide Arena', city: 'Columbus, OH', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Blackhawks': { venue: 'United Center', city: 'Chicago, IL', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Avalanche': { venue: 'Ball Arena', city: 'Denver, CO', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Stars': { venue: 'American Airlines Center', city: 'Dallas, TX', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 61°F / 22°F Sheet' },
  'Wild': { venue: 'Xcel Energy Center', city: 'St. Paul, MN', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Predators': { venue: 'Bridgestone Arena', city: 'Nashville, TN', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Blues': { venue: 'Enterprise Center', city: 'St. Louis, MO', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Jets': { venue: 'Canada Life Centre', city: 'Winnipeg, MB', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 58°F / 20°F Sheet' },
  'Utah': { venue: 'Delta Center', city: 'Salt Lake City, UT', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' },
  'Ducks': { venue: 'Honda Center', city: 'Anaheim, CA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 62°F / 22°F Sheet' },
  'Flames': { venue: 'Scotiabank Saddledome', city: 'Calgary, AB', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Oilers': { venue: 'Rogers Place', city: 'Edmonton, AB', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 58°F / 20°F Sheet' },
  'Kings': { venue: 'Crypto.com Arena', city: 'Los Angeles, CA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 61°F / 22°F Sheet' },
  'Sharks': { venue: 'SAP Center', city: 'San Jose, CA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 61°F / 22°F Sheet' },
  'Kraken': { venue: 'Climate Pledge Arena', city: 'Seattle, WA', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Canucks': { venue: 'Rogers Arena', city: 'Vancouver, BC', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 59°F / 21°F Sheet' },
  'Golden Knights': { venue: 'T-Mobile Arena', city: 'Las Vegas, NV', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 61°F / 22°F Sheet' }
};

function getNhlArena(homeName) {
  const key = Object.keys(NHL_ARENAS).find(k => (homeName || '').includes(k));
  return key ? NHL_ARENAS[key] : { venue: 'NHL Arena', city: '', type: 'Indoor NHL Arena', sheet: "Standard NHL (200' × 85')", climate: 'Controlled 60°F / 22°F Sheet' };
}

function getNhlBroadcast(rawNet, homeName, awayName, isSabresGame = false) {
  const net = (rawNet || 'ESPN+').toUpperCase();
  if (isSabresGame) {
    if (net.includes('TNT')) return { network: 'TNT', crew: 'Kenny Albert, Eddie Olczyk, Brian Boucher', tag: 'tv-tnt' };
    if (net.includes('ESPN')) return { network: 'ESPN', crew: 'Sean McDonough, Ray Ferraro', tag: 'tv-espn' };
    return { network: 'MSG-B', crew: 'Dan Dunleavy, Rob Ray', tag: 'tv-msg' };
  }
  if (net.includes('TNT') || net.includes('MAX')) return { network: 'TNT', crew: 'Kenny Albert, Eddie Olczyk, Brian Boucher', tag: 'tv-tnt' };
  if (net.includes('ABC')) return { network: 'ABC', crew: 'Sean McDonough, Ray Ferraro', tag: 'tv-espn' };
  if (net.includes('ESPN+')) return { network: 'ESPN+', crew: 'Bob Wischusen, Kevin Weekes', tag: 'tv-espn' };
  if (net.includes('ESPN')) return { network: 'ESPN', crew: 'Steve Levy, Ray Ferraro', tag: 'tv-espn' };
  if (net.includes('SN') || net.includes('SPORTSNET')) return { network: 'Sportsnet', crew: 'Chris Cuthbert, Craig Simpson', tag: 'tv-sn' };
  if (net.includes('TSN')) return { network: 'TSN4', crew: 'Gord Miller, Mike Johnson', tag: 'tv-tsn' };
  if (net.includes('NESN')) return { network: 'NESN', crew: 'Judd Sirott, Andy Brickley', tag: 'tv-nesn' };
  return { network: rawNet || 'TV', crew: 'Regional Broadcast Crew', tag: 'tv-rsn' };
}

function getNhlWindow(isoTime) {
  const dt = new Date(isoTime);
  const day = dt.toLocaleDateString('en-US', { timeZone: 'America/New_York', weekday: 'short' });
  
  if (day === 'Wed') return { key: 'WED', label: 'Wednesday Night Hockey Showcase', badge: 'TNT / Max / National Slate', order: 1 };
  if (day === 'Thu') return { key: 'THU', label: 'Thursday Prime NHL Slate', badge: 'ESPN+ / RSN Lineups', order: 2 };
  if (day === 'Sat') return { key: 'SAT', label: 'Hockey Night in Canada & Saturday National', badge: 'CBC / Sportsnet / NHL Network', order: 3 };
  if (day === 'Sun') return { key: 'SUN', label: 'Sunday NHL Showcase Slate', badge: 'National & Matinee Window', order: 4 };
  if (day === 'Fri') return { key: 'FRI', label: 'Friday Night NHL Matchups', badge: 'Regional & Streaming Lineup', order: 5 };
  if (day === 'Tue') return { key: 'TUE', label: 'Tuesday Night NHL Slate', badge: 'Frozen Frenzy / Regional Lineups', order: 6 };
  return { key: 'MON', label: 'Monday Night NHL Action', badge: 'Early Week Matchups', order: 7 };
}

// 1. Enrich Sabres nextGame
const sNext = data.sabres.nextGame;
const sArena = getNhlArena('Sabres');
const sBc = getNhlBroadcast(sNext.broadcast || 'TNT', 'Sabres', sNext.oppShortName || 'Flyers', true);
const sWin = getNhlWindow(sNext.isoTime);

sNext.venue = `${sArena.venue}, ${sArena.city}`;
sNext.arena = sArena.venue;
sNext.city = sArena.city;
sNext.type = sArena.type;
sNext.sheet = sArena.sheet;
sNext.climate = sArena.climate;
sNext.broadcast = sBc.network;
sNext.announcers = sBc.crew;
sNext.window = sWin.key;
sNext.windowLabel = sWin.label;
sNext.windowBadge = sWin.badge;

// 2. Existing completed results (11 games)
const existingResults = data.sabres.outOfTownGames.map(g => {
  const arena = getNhlArena(g.homeName);
  const bc = getNhlBroadcast(g.broadcast, g.homeName, g.awayName, false);
  const win = getNhlWindow(g.isoTime);
  return {
    ...g,
    statusState: 'post',
    statusDetail: g.statusDetail || 'Final',
    broadcast: bc.network,
    announcers: bc.crew,
    venue: `${arena.venue}, ${arena.city}`,
    type: arena.type,
    sheet: arena.sheet,
    climate: arena.climate,
    window: win.key,
    windowLabel: win.label,
    windowBadge: win.badge
  };
});

// 3. Upcoming NHL Slate
const upcomingNhlGames = [
  {
    isoTime: '2026-10-21T23:30Z',
    slot: 'Wed, Oct 21 • 7:30 PM ET',
    broadcast: 'TNT',
    announcers: 'Kenny Albert, Eddie Olczyk, Brian Boucher',
    venue: 'UBS Arena, Elmont, NY',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 60°F / 22°F Sheet',
    window: 'WED',
    windowLabel: 'Wednesday Night Hockey Showcase',
    windowBadge: 'TNT / Max National Showcase',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Detroit Red Wings',
    awayScore: '',
    homeName: 'New York Islanders',
    homeScore: '',
    verdict: 'ATLANTIC WATCH',
    impactClass: 'warning',
    target: 'Root for New York Islanders in Regulation',
    why: 'Detroit regulation loss prevents an Atlantic division rival from collecting points.'
  },
  {
    isoTime: '2026-10-22T23:00Z',
    slot: 'Thu, Oct 22 • 7:00 PM ET',
    broadcast: 'ESPN+',
    announcers: 'Judd Sirott, Andy Brickley',
    venue: 'TD Garden, Boston, MA',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 59°F / 21°F Sheet',
    window: 'THU',
    windowLabel: 'Thursday Prime NHL Slate',
    windowBadge: 'ESPN+ / Regional Lineups',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Dallas Stars',
    awayScore: '',
    homeName: 'Boston Bruins',
    homeScore: '',
    verdict: 'WEST OVER EAST',
    impactClass: 'good',
    target: 'Root for Dallas Stars in Regulation',
    why: 'Western conference win keeps both standings points out of the Eastern playoff pool.'
  },
  {
    isoTime: '2026-10-22T23:00Z',
    slot: 'Thu, Oct 22 • 7:00 PM ET',
    broadcast: 'Sportsnet',
    announcers: 'Chris Cuthbert, Craig Simpson',
    venue: 'Amalie Arena, Tampa, FL',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 60°F / 22°F Sheet',
    window: 'THU',
    windowLabel: 'Thursday Prime NHL Slate',
    windowBadge: 'ESPN+ / Regional Lineups',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Toronto Maple Leafs',
    awayScore: '',
    homeName: 'Tampa Bay Lightning',
    homeScore: '',
    verdict: 'ATLANTIC WATCH',
    impactClass: 'warning',
    target: 'Root for Tampa Bay in Regulation',
    why: 'Crucial regulation finish prevents 3 total standings points entering the Atlantic race.'
  },
  {
    isoTime: '2026-10-22T23:00Z',
    slot: 'Thu, Oct 22 • 7:00 PM ET',
    broadcast: 'ESPN+',
    announcers: 'Bob Wischusen, Kevin Weekes',
    venue: 'Madison Square Garden, New York, NY',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 60°F / 22°F Sheet',
    window: 'THU',
    windowLabel: 'Thursday Prime NHL Slate',
    windowBadge: 'ESPN+ / Regional Lineups',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Florida Panthers',
    awayScore: '',
    homeName: 'New York Rangers',
    homeScore: '',
    verdict: 'ATLANTIC WATCH',
    impactClass: 'good',
    target: 'Root for New York Rangers in Regulation',
    why: 'Rangers regulation win slows down the Atlantic division frontrunner.'
  },
  {
    isoTime: '2026-10-22T23:00Z',
    slot: 'Thu, Oct 22 • 7:00 PM ET',
    broadcast: 'ESPN+',
    announcers: 'Ken Daniels, Mickey Redmond',
    venue: 'Little Caesars Arena, Detroit, MI',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 60°F / 22°F Sheet',
    window: 'THU',
    windowLabel: 'Thursday Prime NHL Slate',
    windowBadge: 'ESPN+ / Regional Lineups',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'New Jersey Devils',
    awayScore: '',
    homeName: 'Detroit Red Wings',
    homeScore: '',
    verdict: 'ATLANTIC WATCH',
    impactClass: 'warning',
    target: 'Root for New Jersey Devils in Regulation',
    why: 'Stalls an immediate Atlantic division competitor from picking up points.'
  },
  {
    isoTime: '2026-10-23T23:00Z',
    slot: 'Fri, Oct 23 • 7:00 PM ET',
    broadcast: 'ESPN+',
    announcers: 'Bob Wischusen, Kevin Weekes',
    venue: 'Canadian Tire Centre, Ottawa, ON',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 59°F / 21°F Sheet',
    window: 'FRI',
    windowLabel: 'Friday Night NHL Matchups',
    windowBadge: 'Streaming Lineup',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Colorado Avalanche',
    awayScore: '',
    homeName: 'Ottawa Senators',
    homeScore: '',
    verdict: 'WEST OVER EAST',
    impactClass: 'good',
    target: 'Root for Colorado Avalanche in Regulation',
    why: 'Western regulation win stops an Atlantic rival from gaining ground on Buffalo.'
  },
  {
    isoTime: '2026-10-24T23:00Z',
    slot: 'Sat, Oct 24 • 7:00 PM ET',
    broadcast: 'Sportsnet',
    announcers: 'Chris Cuthbert, Craig Simpson',
    venue: 'TD Garden, Boston, MA',
    type: 'Indoor NHL Arena',
    sheet: "Standard NHL (200' × 85')",
    climate: 'Controlled 59°F / 21°F Sheet',
    window: 'SAT',
    windowLabel: 'Hockey Night in Canada & Saturday National',
    windowBadge: 'CBC / Sportsnet National Slate',
    statusState: 'pre',
    statusDetail: 'Scheduled',
    awayName: 'Toronto Maple Leafs',
    awayScore: '',
    homeName: 'Boston Bruins',
    homeScore: '',
    verdict: '3-POINT GAME DANGER',
    impactClass: 'warning',
    target: 'Root for Regulation Decision',
    why: 'Avoid 3-point overtime game between top Atlantic division rivals.'
  }
];

// Combine both: Upcoming games first, then Completed results
data.sabres.outOfTownGames = [...upcomingNhlGames, ...existingResults];

fs.writeFileSync(dataPath, JSON.stringify(data, null, 2), 'utf8');
console.log(`SUCCESS: Enriched Sabres data with ${upcomingNhlGames.length} upcoming games AND ${existingResults.length} completed results (Total: ${data.sabres.outOfTownGames.length})!`);
