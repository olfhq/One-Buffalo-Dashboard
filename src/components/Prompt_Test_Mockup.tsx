import { useEffect, useState } from "react";

/* ───────────── Types (swap mock data for live feeds with no markup changes) ───────────── */

export type TeamFilter = "all" | "bills" | "sabres";

export interface PlayEvent {
  clock: string;
  quarter: string;
  text: string;
  scoring?: boolean;
}

export interface LiveGameTelemetry {
  quarterLabels?: string[];
  homeSplits?: (number | null)[];
  awaySplits?: (number | null)[];
  currentPeriod?: string;
  clock?: string;
  possession?: "home" | "away";
  down?: number;
  distance?: number;
  yardLine?: number; // 0-100 from the away goal line (left) to the home goal line (right)
  winProbHome?: number; // 0-100
  plays?: PlayEvent[];
  bills?: { nextGame?: NextGameIntel };
}

export interface BroadcastInfo {
  network: string;
  badgeTitle: string;
  crew: string;
  displayString: string;
}

export interface GameTelemetryProps {
  home: { name: string; abbr: string; record: string; score?: number | string | null };
  away: { name: string; abbr: string; record: string; score?: number | string | null };
  venue: string;
  network: string;
  broadcast?: BroadcastInfo;
  leverage?: number;
  status?: StatusState;
  nextGame: NextGameIntel;
  liveData?: LiveGameTelemetry;
  liveTelemetry?: LiveGameTelemetry;
}

export interface UpcomingGameProps {
  home: { name: string; abbr: string; record: string };
  away: { name: string; abbr: string; record: string };
  puckDrop: number; // epoch ms
  venue: string;
  nextGame?: NextGameIntel;
  liveData?: { sabres?: { nextGame?: NextGameIntel } };
  goalies: { team: string; name: string; status: "Confirmed" | "Probable" | "Unconfirmed"; sv: string; gaa: string }[];
}

export interface StandingsRow {
  team: string;
  record: string;
  pts?: number;
  diff: number;
  streak: string;
  rank: number;
  buffalo?: boolean;
}

export interface StandingsTableProps {
  title: string;
  subtitle: string;
  recordLabel: string;
  diffLabel: string;
  showPoints: boolean;
  rows: StandingsRow[];
}

/* ── Types mirroring data.json (bills.* and sabres.*) ── */

export type StatusState = "pre" | "in" | "post" | "bye";
export type ImpactClass = "good" | "bad" | "warning" | "neutral";

/** data.json: *.outOfTownGames[] */
export interface OutOfTownGame {
  isoTime: string;
  slot: string;
  broadcast: string;
  announcers: string;
  venue: string;
  roof?: string; // NFL only
  surface?: string; // NFL only
  weather?: string; // NFL only
  window: string;
  windowLabel: string;
  windowBadge: string;
  statusState: StatusState;
  statusDetail: string;
  awayName: string;
  awayRecord: string;
  awayScore: string;
  homeName: string;
  homeRecord: string;
  homeScore: string;
  homeWinChance: number;
  awayWinChance: number;
  verdict: string;
  impactClass: ImpactClass;
  target: string;
  why: string;
}

/** data.json: *.nextGame.injuries[] (adds practice designation, which the feed does not carry yet) */
export interface InjuryRow {
  player: string;
  pos: string;
  status: string; // Out, Questionable, Probable, Day-To-Day, Injured Reserve, Suspension...
  injury: string;
  team: string;
  practice?: "DNP" | "Limited" | "Full" | "Rest";
}

export interface InjuryIntelProps {
  title: string;
  updated: string;
  rows: InjuryRow[];
}

/** data.json: *.clinchAlert */
export interface ClinchAlert {
  active: boolean;
  scenario: string;
}

export interface EfficiencyRow {
  metric: string;
  team: string; // data.json key is "bills" or "sabres"
  opp: string;
}

/** data.json: *.nextGame (shared fields plus sport-specific blocks) */
export interface NextGameIntel {
  opponent: string;
  oppShortName: string;
  gameTime: string;
  isoTime: string;
  winChance: number;
  matchupRecords: string;
  broadcast: BroadcastInfo;
  announcers: string;
  venue: string;
  roof?: string;
  surface?: string;
  weather?: string;
  window?: string;
  windowLabel?: string;
  windowBadge?: string;
  statusState: StatusState;
  statusDetail: string;
  bufScore: string;
  oppScore: string;
  liveScore: string | null;
  ifWin: number;
  ifLoss: number;
  leverage: number;
  restAdvantage: { teamDays: number; billsDays?: number; sabresDays?: number; oppDays: number; summary: string };
  specialTeams?: { team: string; opp: string; advantage: string }; // NHL only
  goalies?: { team: string; name: string; status: "Confirmed" | "Probable" | "Unconfirmed"; sv: string; gaa: string }[]; // NHL only
  efficiency: EfficiencyRow[];
  turnoverRatio?: { team: string; opp: string; advantage: string }; // NFL only
}

/** data.json: *.seasonSchedule[] (NFL uses week/primeTime/isBye, NHL uses gameNumber/outcome/monthLabel) */
export interface ScheduleEntry {
  week?: number;
  gameNumber?: number;
  id?: number;
  isBye?: boolean;
  date?: string;
  isoTime?: string;
  monthKey?: string;
  monthLabel?: string;
  dayOfWeek?: string;
  dateFormatted?: string;
  timeFormatted?: string;
  opponent: string;
  oppShortName: string;
  oppAbbrev: string;
  isHome?: boolean;
  statusState: StatusState;
  statusDetail: string;
  bufScore?: number | null;
  oppScore?: number | null;
  result?: "W" | "L" | "OTL" | null;
  outcome?: "REG" | "OT" | "SO";
  broadcast?: string;
  primeTime?: string | null;
}

/** data.json: bills and sabres top-level objects */
export interface PlayoffPictureProps {
  team: string;
  makePlayoffs: number;
  winDivision: number;
  seed1?: number; // NFL
  wildcard?: number; // NHL
  magicNumber: string | null;
  tragicNumber?: string; // NHL
  projectedPoints?: number; // NHL
  cutlinePoints?: number; // NHL
  leverage?: number;
  clinchAlert: ClinchAlert;
  divisionRadar: { team: string; pct: number }[];
  seedDistribution: { seed: string; pct: number }[];
  opponents: { team: string; pct: number }[];
}

/** data.json: root */
export interface DashboardMeta {
  updatedAt: string;
  source: string;
  theme: string;
  billsTheme: string;
  sabresTheme: string;
  themeUntil: string | null;
}

/* ───────────── Palette ───────────── */

const C = {
  midnight: "#040A1C",
  royal: "#00338D",
  red: "#C60C30",
  navy: "#002654",
  gold: "#FCB514",
  white: "#FFFFFF",
  dim: "#9DB0D6",
  hair: "rgba(255,255,255,0.85)",
  soft: "rgba(255,255,255,0.16)",
};

/* ───────────── Broadcast Resolver ───────────── */

export function resolveNFLBroadcast(rawNetwork?: string | BroadcastInfo | null, date?: string | Date | null): BroadcastInfo {
  if (rawNetwork && typeof rawNetwork === "object" && rawNetwork.network && rawNetwork.badgeTitle && rawNetwork.crew) {
    return {
      network: rawNetwork.network,
      badgeTitle: rawNetwork.badgeTitle,
      crew: rawNetwork.crew,
      displayString: rawNetwork.displayString || `${rawNetwork.network} • ${rawNetwork.crew} (${rawNetwork.badgeTitle})`,
    };
  }

  const net = String(rawNetwork || "").trim().toUpperCase();
  const dateStr = String(date || "");
  let day = "";
  let hour = 13;

  if (date) {
    const dt = new Date(date);
    if (!isNaN(dt.getTime())) {
      day = dt.toLocaleDateString("en-US", { timeZone: "America/New_York", weekday: "short" });
      hour = parseInt(dt.toLocaleTimeString("en-US", { timeZone: "America/New_York", hour12: false, hour: "2-digit" }), 10);
    } else if (/\bmon/i.test(dateStr)) {
      day = "Mon";
    } else if (/\bthu/i.test(dateStr)) {
      day = "Thu";
    } else if (/\bsun/i.test(dateStr)) {
      day = "Sun";
    }
  }

  const isMonday = day === "Mon" || /\bmonday\b|\bmon\b/i.test(dateStr);
  const isThursday = day === "Thu" || /\bthursday\b|\bthu\b/i.test(dateStr);
  const isSundayNight = (day === "Sun" && hour >= 20) || /\bsnf\b/i.test(dateStr);

  const PACKAGES: Record<string, { network: string; badgeTitle: string; crew: string }> = {
    MNF: { network: "ESPN", badgeTitle: "Monday Night Football", crew: "Joe Buck, Troy Aikman, Lisa Salters" },
    TNF: { network: "Prime Video", badgeTitle: "Thursday Night Football", crew: "Al Michaels, Kirk Herbstreit, Kaylee Hartung" },
    SNF: { network: "NBC", badgeTitle: "Sunday Night Football", crew: "Mike Tirico, Cris Collinsworth, Melissa Stark" },
    FOX: { network: "FOX", badgeTitle: "NFL on FOX", crew: "Kevin Burkhardt, Tom Brady, Erin Andrews" },
    NETFLIX: { network: "Netflix", badgeTitle: "NFL Christmas Gameday", crew: "Ian Eagle, Nate Burleson, J.J. Watt" },
    NFLN: { network: "NFL Network", badgeTitle: "NFL Network Exclusive", crew: "Rich Eisen, Kurt Warner, Stacey Dales" },
    SUNDAY_AFC: { network: "CBS", badgeTitle: "NFL on CBS", crew: "Jim Nantz, Tony Romo, Tracy Wolfson" },
  };

  let pkg = PACKAGES.SUNDAY_AFC;
  if (isMonday || net.includes(PACKAGES.MNF.network) || net.includes("ABC") || net.includes("MNF")) {
    pkg = PACKAGES.MNF;
  } else if (net.includes("PRIME") || net.includes("AMAZON") || net.includes("TNF") || (isThursday && !net.includes("NBC") && !net.includes(PACKAGES.SUNDAY_AFC.network) && !net.includes("FOX"))) {
    pkg = PACKAGES.TNF;
  } else if (net.includes("NBC") || net.includes("PEACOCK") || net.includes("SNF") || isSundayNight) {
    pkg = PACKAGES.SNF;
  } else if (net.includes("FOX")) {
    pkg = PACKAGES.FOX;
  } else if (net.includes("NETFLIX")) {
    pkg = PACKAGES.NETFLIX;
  } else if (net.includes("NFL")) {
    pkg = PACKAGES.NFLN;
  }

  return {
    network: pkg.network,
    badgeTitle: pkg.badgeTitle,
    crew: pkg.crew,
    displayString: `${pkg.network} • ${pkg.crew} (${pkg.badgeTitle})`,
  };
}

function getGameBroadcast(game: { broadcast?: BroadcastInfo | string; announcers?: string; windowLabel?: string; windowBadge?: string; isoTime?: string; gameTime?: string }, isNfl = true): BroadcastInfo {
  if (game.broadcast && typeof game.broadcast === "object" && "network" in game.broadcast) {
    const b = game.broadcast;
    const badgeTitle = b.badgeTitle || game.windowLabel || game.windowBadge || "";
    const crew = b.crew || game.announcers || "";
    return {
      network: b.network,
      badgeTitle,
      crew,
      displayString: b.displayString || `${b.network}${crew ? ` • ${crew}` : ""}${badgeTitle ? ` (${badgeTitle})` : ""}`,
    };
  }
  if (isNfl) {
    return resolveNFLBroadcast(typeof game.broadcast === "string" ? game.broadcast : "", game.isoTime || game.gameTime);
  }
  const network = typeof game.broadcast === "string" && game.broadcast ? game.broadcast : "MSG-B";
  const badgeTitle = game.windowBadge || game.windowLabel || "Sabres Hockey Network";
  const crew = game.announcers || "Dan Dunleavy, Rob Ray";
  return {
    network,
    badgeTitle,
    crew,
    displayString: `${network}${crew ? ` • ${crew}` : ""}${badgeTitle ? ` (${badgeTitle})` : ""}`,
  };
}

/* ───────────── Mock data ───────────── */

const UPCOMING: UpcomingGameProps = {
  home: { name: "Buffalo Sabres", abbr: "BUF", record: "7-4-3, 17 PTS" },
  away: { name: "Ottawa Senators", abbr: "OTT", record: "9-6-1, 19 PTS" },
  puckDrop: Date.parse("2026-11-05T00:30:00Z"),
  venue: "KeyBank Center, Buffalo, NY",
  goalies: [
    { team: "BUF", name: "Ukko-Pekka Luukkonen", status: "Probable", sv: ".874", gaa: "3.40" },
    { team: "OTT", name: "Samuel Ersson", status: "Probable", sv: ".866", gaa: "3.78" },
  ],
};

const AFC_EAST: StandingsTableProps = {
  title: "AFC East",
  subtitle: "Week 9",
  recordLabel: "W-L",
  diffLabel: "Pt diff",
  showPoints: false,
  rows: [
    { team: "Buffalo Bills", record: "6-1", diff: 52, streak: "W3", rank: 1, buffalo: true },
    { team: "New England Patriots", record: "5-3", diff: 14, streak: "W1", rank: 2 },
    { team: "New York Jets", record: "2-6", diff: -58, streak: "L3", rank: 3 },
    { team: "Miami Dolphins", record: "1-6", diff: -44, streak: "L1", rank: 4 },
  ],
};

const NHL_ATL: StandingsTableProps = {
  title: "NHL Atlantic",
  subtitle: "14 games played",
  recordLabel: "W-L-OTL",
  diffLabel: "Goal diff",
  showPoints: true,
  rows: [
    { team: "Boston Bruins", record: "10-4-1", pts: 21, diff: 14, streak: "W1", rank: 1 },
    { team: "Montreal Canadiens", record: "9-3-2", pts: 20, diff: 9, streak: "W5", rank: 2 },
    { team: "Ottawa Senators", record: "9-6-1", pts: 19, diff: -1, streak: "L1", rank: 3 },
    { team: "Tampa Bay Lightning", record: "8-3-2", pts: 18, diff: 8, streak: "OTL1", rank: 4 },
    { team: "Florida Panthers", record: "8-5-1", pts: 17, diff: 3, streak: "W1", rank: 5 },
    { team: "Toronto Maple Leafs", record: "7-5-3", pts: 17, diff: 1, streak: "L1", rank: 6 },
    { team: "Buffalo Sabres", record: "7-4-3", pts: 17, diff: -5, streak: "W3", rank: 7, buffalo: true },
    { team: "Detroit Red Wings", record: "6-6-2", pts: 14, diff: -6, streak: "L2", rank: 8 },
  ],
};

const META: DashboardMeta = {
  updatedAt: "2026-11-02T15:54:21.411Z",
  source: "http://www.playoffstatus.com and NFL API",
  theme: "regular",
  billsTheme: "regular",
  sabresTheme: "regular",
  themeUntil: null,
};

const SUNDAY_LATE_BC = resolveNFLBroadcast("", "2026-11-01T21:25Z");
const MONDAY_BC = resolveNFLBroadcast("", "2026-11-03T01:15Z");

const NFL_OOT: OutOfTownGame[] = [
  {
    isoTime: "2026-11-01T21:25Z", slot: "Sun, Nov 1 • 4:25 PM ET", broadcast: SUNDAY_LATE_BC.network, announcers: "Ian Eagle, J.J. Watt",
    venue: "Hard Rock Stadium, Miami Gardens, FL", roof: "Open-Air Stadium", surface: "Natural Bermuda Grass", weather: "77°F, 9mph Wind, 76% PoP",
    window: "LATE", windowLabel: "Sunday 4:25 PM ET National Window", windowBadge: "America's Game of the Week",
    statusState: "post", statusDetail: "Final", awayName: "New England Patriots", awayRecord: "5-3, W1", awayScore: "24",
    homeName: "Miami Dolphins", homeRecord: "1-6, L1", homeScore: "19", homeWinChance: 20, awayWinChance: 80,
    verdict: "BAD FOR BUFFALO", impactClass: "bad", target: "Root for Miami Dolphins",
    why: "New England Patriots win keeps division pressure on the Bills.",
  },
  {
    isoTime: "2026-11-01T18:00Z", slot: "Sun, Nov 1 • 1:00 PM ET", broadcast: "FOX", announcers: "Joe Davis, Greg Olsen",
    venue: "MetLife Stadium, East Rutherford, NJ", roof: "Open-Air Stadium", surface: "FieldTurf CORE", weather: "61°F, 2mph Wind, 0% PoP",
    window: "EARLY", windowLabel: "Sunday 1:00 PM ET Early Window", windowBadge: "Regional Sunday Lineups",
    statusState: "post", statusDetail: "Final", awayName: "Las Vegas Raiders", awayRecord: "4-4, W1", awayScore: "38",
    homeName: "New York Jets", homeRecord: "2-6, L3", homeScore: "33", homeWinChance: 34, awayWinChance: 66,
    verdict: "GOOD FOR BUFFALO", impactClass: "good", target: "Root for Las Vegas Raiders",
    why: "New York Jets dropped a game, widening Buffalo's division lead.",
  },
  {
    isoTime: "2026-11-01T21:25Z", slot: "Sun, Nov 1 • 4:25 PM ET", broadcast: SUNDAY_LATE_BC.network, announcers: SUNDAY_LATE_BC.crew,
    venue: "Empower Field at Mile High, Denver, CO", roof: "Open-Air Stadium", surface: "Natural Kentucky Bluegrass", weather: "60°F, 13mph Wind, 1% PoP",
    window: "LATE", windowLabel: "Sunday 4:25 PM ET National Window", windowBadge: "America's Game of the Week",
    statusState: "post", statusDetail: "Final", awayName: "Kansas City Chiefs", awayRecord: "5-2, L2", awayScore: "24",
    homeName: "Denver Broncos", homeRecord: "6-2, W4", homeScore: "28", homeWinChance: 58, awayWinChance: 42,
    verdict: "RIVAL WIN", impactClass: "neutral", target: "Root for Kansas City Chiefs",
    why: "Denver Broncos won, keeping pace in the AFC playoff picture.",
  },
  {
    isoTime: "2026-11-03T01:15Z", slot: "Mon, Nov 2 • 8:15 PM ET", broadcast: MONDAY_BC.network, announcers: MONDAY_BC.crew,
    venue: "Lumen Field, Seattle, WA", roof: "Open-Air Stadium", surface: "FieldTurf Revolution", weather: "50°F, 2mph Wind, 2% PoP",
    window: "MNF", windowLabel: MONDAY_BC.badgeTitle, windowBadge: MONDAY_BC.badgeTitle,
    statusState: "pre", statusDetail: "11/2 - 8:15 PM EST", awayName: "Chicago Bears", awayRecord: "5-2, W2", awayScore: "0",
    homeName: "Seattle Seahawks", homeRecord: "4-3, W1", homeScore: "0", homeWinChance: 62, awayWinChance: 38,
    verdict: "NFC MATCHUP", impactClass: "neutral", target: "Neutral Matchup",
    why: "Non-conference NFC matchup with zero direct AFC tiebreaker leverage.",
  },
];

const NHL_OOT: OutOfTownGame[] = [
  {
    isoTime: "2026-10-31T17:00:00Z", slot: "Sat, Oct 31 • 1:00 PM ET", broadcast: "Sportsnet", announcers: "Harnarayan Singh, Louie DeBrusk",
    venue: "TD Garden, Boston, MA", window: "SAT", windowLabel: "Hockey Night in Canada & Saturday National", windowBadge: "CBC / Sportsnet / NHL Network",
    statusState: "post", statusDetail: "Final/OT", awayName: "Chicago Blackhawks", awayRecord: "4-9-1, OT1", awayScore: "4",
    homeName: "Boston Bruins", homeRecord: "10-4-1, W1", homeScore: "5", homeWinChance: 87, awayWinChance: 13,
    verdict: "BAD: RIVAL OT WIN", impactClass: "bad", target: "Root for Chicago Blackhawks in Regulation",
    why: "Boston Bruins collected 2 standings points in overtime.",
  },
  {
    isoTime: "2026-10-31T23:00:00Z", slot: "Sat, Oct 31 • 7:00 PM ET", broadcast: "Sportsnet", announcers: "Rick Ball, Kelly Hrudey",
    venue: "Centre Bell, Montreal, QC", window: "SAT", windowLabel: "Hockey Night in Canada & Saturday National", windowBadge: "CBC / Sportsnet / NHL Network",
    statusState: "post", statusDetail: "Final", awayName: "Pittsburgh Penguins", awayRecord: "5-7-2, L1", awayScore: "4",
    homeName: "Montreal Canadiens", homeRecord: "9-3-2, W5", homeScore: "5", homeWinChance: 80, awayWinChance: 20,
    verdict: "BAD FOR BUFFALO", impactClass: "bad", target: "Root for Pittsburgh Penguins in Regulation",
    why: "Montreal Canadiens collected 2 standings points in the Atlantic race.",
  },
  {
    isoTime: "2026-10-31T18:00:00Z", slot: "Sat, Oct 31 • 2:00 PM ET", broadcast: "Scripps Sports", announcers: "Steve Goldstein, Randy Moller",
    venue: "Bridgestone Arena, Nashville, TN", window: "SAT", windowLabel: "Hockey Night in Canada & Saturday National", windowBadge: "CBC / Sportsnet / NHL Network",
    statusState: "post", statusDetail: "Final/SO", awayName: "Tampa Bay Lightning", awayRecord: "8-3-2, OT1", awayScore: "4",
    homeName: "Nashville Predators", homeRecord: "5-4-5, W1", homeScore: "5", homeWinChance: 37, awayWinChance: 63,
    verdict: "RIVAL STOLE OT POINT", impactClass: "warning", target: "Root for Nashville Predators in Regulation",
    why: "Nashville Predators won in overtime, but Tampa Bay Lightning salvaged a loser point.",
  },
  {
    isoTime: "2026-11-03T00:00:00Z", slot: "Mon, Nov 2 • 7:00 PM ET", broadcast: "NHL Net", announcers: "E.J. Hradek, Kevin Weekes",
    venue: "TD Garden, Boston, MA", window: "MON", windowLabel: "Monday Night NHL Action", windowBadge: "Early Week Matchups",
    statusState: "pre", statusDetail: "Scheduled", awayName: "Vegas Golden Knights", awayRecord: "9-5-1, L1", awayScore: "",
    homeName: "Boston Bruins", homeRecord: "10-4-1, W1", homeScore: "", homeWinChance: 61, awayWinChance: 39,
    verdict: "ATLANTIC WATCH", impactClass: "warning", target: "Root for Vegas Golden Knights in Regulation",
    why: "A regulation loss leaves Boston Bruins with 0 standings points in the Atlantic Division.",
  },
];

const BILLS_PICTURE: PlayoffPictureProps = {
  team: "Buffalo Bills", makePlayoffs: 94, winDivision: 72, seed1: 28, magicNumber: "9", leverage: 15,
  clinchAlert: { active: false, scenario: "No clinching scenarios available this week." },
  divisionRadar: [{ team: "Bills", pct: 72 }, { team: "Patriots", pct: 28 }, { team: "Jets", pct: 2 }, { team: "Dolphins", pct: 2 }],
  seedDistribution: [
    { seed: "#1 Seed", pct: 28 }, { seed: "#2 Seed", pct: 18 }, { seed: "#3 Seed", pct: 16 }, { seed: "#4 Seed", pct: 10 },
    { seed: "#5 Seed", pct: 9 }, { seed: "#6 Seed", pct: 7 }, { seed: "#7 Seed", pct: 6 },
  ],
  opponents: [{ team: "New England Patriots", pct: 11 }, { team: "Kansas City Chiefs", pct: 9 }, { team: "Cleveland Browns", pct: 8 }],
};

const SABRES_PICTURE: PlayoffPictureProps = {
  team: "Buffalo Sabres", makePlayoffs: 48, winDivision: 32, wildcard: 16, magicNumber: null, tragicNumber: "100 PTS",
  projectedPoints: 100, cutlinePoints: 102, leverage: 11,
  clinchAlert: { active: false, scenario: "No clinching scenarios available this week." },
  divisionRadar: [{ team: "Bruins", pct: 67 }, { team: "Canadiens", pct: 63 }, { team: "Senators", pct: 52 }, { team: "Sabres", pct: 48 }],
  seedDistribution: [
    { seed: "Div 1", pct: 8 }, { seed: "Div 2", pct: 11 }, { seed: "Div 3", pct: 13 }, { seed: "Wildcard 1", pct: 8 }, { seed: "Wildcard 2", pct: 8 },
  ],
  opponents: [{ team: "Boston Bruins", pct: 7 }, { team: "Montreal Canadiens", pct: 7 }, { team: "Tampa Bay Lightning", pct: 6 }],
};

const BILLS_NEXT_BROADCAST = resolveNFLBroadcast("", "2026-11-10T01:15Z");

const BILLS_NEXT: NextGameIntel = {
  opponent: "@ Vikings", oppShortName: "Vikings", gameTime: "Mon, Nov 9 • 8:15 PM ET", isoTime: "2026-11-10T01:15Z", winChance: 46,
  matchupRecords: "Bills (6-1, W3) vs. Vikings (6-1, L1)",
  broadcast: BILLS_NEXT_BROADCAST,
  announcers: BILLS_NEXT_BROADCAST.crew,
  venue: "U.S. Bank Stadium, Minneapolis, MN", roof: "Domed Stadium", surface: "Act Global Turf", weather: "Controlled 72°F Climate",
  window: "MNF", windowLabel: BILLS_NEXT_BROADCAST.badgeTitle, windowBadge: BILLS_NEXT_BROADCAST.badgeTitle,
  statusState: "pre", statusDetail: "11/9 - 8:15 PM EST", bufScore: "", oppScore: "", liveScore: null,
  ifWin: 99, ifLoss: 84, leverage: 15,
  restAdvantage: { teamDays: 8, billsDays: 8, oppDays: 8, summary: "Even Rest (Both on 8 Days Rest)" },
  efficiency: [
    { metric: "Points / Game", team: "33.3 (1st)", opp: "20.0 (27th)" },
    { metric: "Total Yards / Game", team: "404.6 (3rd)", opp: "299.3 (29th)" },
    { metric: "Passing Yards / Game", team: "244.7 (10th)", opp: "165.6 (31st)" },
    { metric: "Rushing Yards / Game", team: "148.4 (3rd)", opp: "113.9 (17th)" },
    { metric: "3rd Down Conversion %", team: "44.2% (5th)", opp: "36.0% (27th)" },
    { metric: "Red Zone TD %", team: "70.0% (6th)", opp: "56.3% (18th)" },
  ],
  turnoverRatio: {
    team: "-2 (9 Takeaways / 11 Giveaways)", opp: "+7 (12 Takeaways / 5 Giveaways)", advantage: "Vikings (+9 Differential Margin)",
  },
};

const SABRES_NEXT_BROADCAST: BroadcastInfo = {
  network: "MSG-B",
  badgeTitle: "Sabres Hockey Network",
  crew: "Dan Dunleavy, Rob Ray",
  displayString: "MSG-B • Dan Dunleavy, Rob Ray (Sabres Hockey Network)",
};

const SABRES_NEXT: NextGameIntel = {
  opponent: "vs. Ottawa", oppShortName: "Ottawa", gameTime: "Wed, Nov 4 • 7:30 PM ET", isoTime: "2026-11-05T00:30:00Z", winChance: 55,
  matchupRecords: "Sabres (7-4-3, 17 pts, W3) vs. Ottawa (9-6-1, 19 pts, L1)",
  broadcast: SABRES_NEXT_BROADCAST,
  announcers: SABRES_NEXT_BROADCAST.crew,
  venue: "KeyBank Center, Buffalo, NY",
  statusState: "pre", statusDetail: "Wed, Nov 4 • 7:30 PM ET", bufScore: "", oppScore: "", liveScore: null,
  ifWin: 54, ifLoss: 43, leverage: 11,
  restAdvantage: { teamDays: 4, sabresDays: 4, oppDays: 3, summary: "Sabres +1 (4d vs 3d Rest)" },
  specialTeams: {
    team: "PP: 17.0% (23rd) | PK: 68.6% (29th)", opp: "PP: 12.3% (30th) | PK: 73.3% (22nd)", advantage: "Even Special Teams Matchup",
  },
  goalies: [
    { team: "BUF", name: "Ukko-Pekka Luukkonen", status: "Probable", sv: ".874", gaa: "3.40" },
    { team: "OTT", name: "Samuel Ersson", status: "Probable", sv: ".866", gaa: "3.78" },
  ],
  efficiency: [
    { metric: "Goals / Game", team: "3.07 (19th)", opp: "3.13 (18th)" },
    { metric: "Goals Against / Game", team: "3.43 (24th)", opp: "3.19 (16th)" },
    { metric: "Power Play %", team: "17.0% (23rd)", opp: "12.3% (30th)" },
    { metric: "Penalty Kill %", team: "68.6% (29th)", opp: "73.3% (22nd)" },
    { metric: "Shots / Game", team: "28.1 (13th)", opp: "25.6 (24th)" },
    { metric: "Faceoff Win %", team: "46.2% (29th)", opp: "52.7% (8th)" },
  ],
};

const BILLS_SCHEDULE: ScheduleEntry[] = [
  { week: 5, isBye: false, date: "2026-10-13T00:15Z", dayOfWeek: "Mon", dateFormatted: "Oct 12", timeFormatted: "8:15 PM ET", opponent: "Los Angeles Rams", oppShortName: "Rams", oppAbbrev: "LAR", isHome: false, statusState: "post", statusDetail: "Final/OT", bufScore: 37, oppScore: 34, result: "W", broadcast: resolveNFLBroadcast("", "2026-10-13T00:15Z").network, primeTime: "MNF" },
  { week: 6, isBye: false, date: "2026-10-18T17:00Z", dayOfWeek: "Sun", dateFormatted: "Oct 18", timeFormatted: "1:00 PM ET", opponent: "Miami Dolphins", oppShortName: "Dolphins", oppAbbrev: "MIA", isHome: true, statusState: "post", statusDetail: "Final", bufScore: 31, oppScore: 17, result: "W", broadcast: resolveNFLBroadcast("", "2026-10-18T17:00Z").network, primeTime: null },
  { week: 7, isBye: true, opponent: "BYE WEEK", oppShortName: "BYE", oppAbbrev: "BYE", statusState: "bye", statusDetail: "Bye Week" },
  { week: 8, isBye: false, date: "2026-11-01T18:00Z", dayOfWeek: "Sun", dateFormatted: "Nov 1", timeFormatted: "1:00 PM ET", opponent: "Baltimore Ravens", oppShortName: "Ravens", oppAbbrev: "BAL", isHome: true, statusState: "post", statusDetail: "Final", bufScore: 36, oppScore: 10, result: "W", broadcast: resolveNFLBroadcast("", "2026-11-01T18:00Z").network, primeTime: null },
  { week: 9, isBye: false, date: "2026-11-10T01:15Z", dayOfWeek: "Mon", dateFormatted: "Nov 9", timeFormatted: "8:15 PM ET", opponent: "Minnesota Vikings", oppShortName: "Vikings", oppAbbrev: "MIN", isHome: false, statusState: "pre", statusDetail: "11/9 - 8:15 PM EST", bufScore: null, oppScore: null, result: null, broadcast: resolveNFLBroadcast("", "2026-11-10T01:15Z").network, primeTime: "MNF" },
  { week: 10, isBye: false, date: "2026-11-15T18:00Z", dayOfWeek: "Sun", dateFormatted: "Nov 15", timeFormatted: "1:00 PM ET", opponent: "New York Jets", oppShortName: "Jets", oppAbbrev: "NYJ", isHome: false, statusState: "pre", statusDetail: "11/15 - 1:00 PM EST", bufScore: null, oppScore: null, result: null, broadcast: resolveNFLBroadcast("", "2026-11-15T18:00Z").network, primeTime: null },
  { week: 11, isBye: false, date: "2026-11-22T18:00Z", dayOfWeek: "Sun", dateFormatted: "Nov 22", timeFormatted: "1:00 PM ET", opponent: "Indianapolis Colts", oppShortName: "Colts", oppAbbrev: "IND", isHome: true, statusState: "pre", statusDetail: "11/22 - 1:00 PM EST", bufScore: null, oppScore: null, result: null, broadcast: resolveNFLBroadcast("", "2026-11-22T18:00Z").network, primeTime: null },
];

const SABRES_SCHEDULE: ScheduleEntry[] = [
  { gameNumber: 12, id: 2026020195, date: "2026-10-27", isoTime: "2026-10-27T23:00:00Z", monthKey: "2026-10", monthLabel: "OCT", dayOfWeek: "Tue", dateFormatted: "Oct 27", timeFormatted: "7:00 PM ET", opponent: "Detroit Red Wings", oppShortName: "Red Wings", oppAbbrev: "DET", isHome: true, statusState: "post", statusDetail: "Final", bufScore: 5, oppScore: 3, result: "W", outcome: "REG", broadcast: "MSG-B" },
  { gameNumber: 13, id: 2026020211, date: "2026-10-29", isoTime: "2026-10-30T02:00:00Z", monthKey: "2026-10", monthLabel: "OCT", dayOfWeek: "Thu", dateFormatted: "Oct 29", timeFormatted: "10:00 PM ET", opponent: "Anaheim Ducks", oppShortName: "Ducks", oppAbbrev: "ANA", isHome: false, statusState: "post", statusDetail: "Final", bufScore: 7, oppScore: 6, result: "W", outcome: "REG", broadcast: "MSG-B" },
  { gameNumber: 14, id: 2026020221, date: "2026-10-31", isoTime: "2026-10-31T20:00:00Z", monthKey: "2026-10", monthLabel: "OCT", dayOfWeek: "Sat", dateFormatted: "Oct 31", timeFormatted: "4:00 PM ET", opponent: "Los Angeles Kings", oppShortName: "Kings", oppAbbrev: "LAK", isHome: false, statusState: "post", statusDetail: "Final", bufScore: 3, oppScore: 2, result: "W", outcome: "REG", broadcast: "MSG-B" },
  { gameNumber: 15, id: 2026020247, date: "2026-11-04", isoTime: "2026-11-05T00:30:00Z", monthKey: "2026-11", monthLabel: "NOV", dayOfWeek: "Wed", dateFormatted: "Nov 4", timeFormatted: "7:30 PM ET", opponent: "Ottawa Senators", oppShortName: "Senators", oppAbbrev: "OTT", isHome: true, statusState: "pre", statusDetail: "Nov 4", bufScore: null, oppScore: null, result: null, outcome: "REG", broadcast: "MSG-B" },
  { gameNumber: 16, id: 2026020262, date: "2026-11-06", isoTime: "2026-11-07T00:00:00Z", monthKey: "2026-11", monthLabel: "NOV", dayOfWeek: "Fri", dateFormatted: "Nov 6", timeFormatted: "7:00 PM ET", opponent: "Columbus Blue Jackets", oppShortName: "Blue Jackets", oppAbbrev: "CBJ", isHome: true, statusState: "pre", statusDetail: "Nov 6", bufScore: null, oppScore: null, result: null, outcome: "REG", broadcast: "MSG-B" },
  { gameNumber: 17, id: 2026020278, date: "2026-11-08", isoTime: "2026-11-08T20:30:00Z", monthKey: "2026-11", monthLabel: "NOV", dayOfWeek: "Sun", dateFormatted: "Nov 8", timeFormatted: "3:30 PM ET", opponent: "Vegas Golden Knights", oppShortName: "Golden Knights", oppAbbrev: "VGK", isHome: true, statusState: "pre", statusDetail: "Nov 8", bufScore: null, oppScore: null, result: null, outcome: "REG", broadcast: "MSG-B" },
];

const BILLS_INJ: InjuryIntelProps = {
  title: "Bills availability",
  updated: "Updated 12:41 PM",
  rows: [
    { player: "C.J. Gardner-Johnson", pos: "S", status: "Suspension", injury: "Suspension", team: "Bills" },
    { player: "DJ Moore", pos: "WR", status: "Questionable", injury: "Knee", team: "Bills", practice: "Limited" },
    { player: "Joshua Palmer", pos: "WR", status: "Questionable", injury: "Hamstring", team: "Bills", practice: "Limited" },
    { player: "Dee Alford", pos: "CB", status: "Out", injury: "Ankle", team: "Bills", practice: "DNP" },
    { player: "Greg Gaines", pos: "DT", status: "Out", injury: "Calf", team: "Bills", practice: "DNP" },
    { player: "Kyler Murray", pos: "QB", status: "Questionable", injury: "Hamstring", team: "Vikings" },
    { player: "Theo Jackson", pos: "S", status: "Questionable", injury: "Quadriceps", team: "Vikings" },
    { player: "Max Brosmer", pos: "QB", status: "Out", injury: "Coach's Decision", team: "Vikings" },
    { player: "Jakobe Thomas", pos: "S", status: "Out", injury: "Coach's Decision", team: "Vikings" },
    { player: "Caleb Tiernan", pos: "OT", status: "Out", injury: "Coach's Decision", team: "Vikings" },
  ],
};

const SABRES_INJ: InjuryIntelProps = {
  title: "Sabres availability",
  updated: "Updated 11:58 AM",
  rows: [
    { player: "Ukko-Pekka Luukkonen", pos: "G", status: "Probable", injury: "Expected Starter (3.40 GAA, .874 SV%)", team: "Sabres" },
    { player: "Jiri Kulich", pos: "C", status: "Day-To-Day", injury: "Concussion", team: "Sabres" },
    { player: "Konsta Helenius", pos: "C", status: "Day-To-Day", injury: "Upper Body", team: "Sabres" },
    { player: "Justin Danforth", pos: "RW", status: "Injured Reserve", injury: "Upper Body", team: "Sabres" },
    { player: "Alex Lyon", pos: "G", status: "Injured Reserve", injury: "Upper Body", team: "Sabres" },
    { player: "Matt Grzelcyk", pos: "D", status: "Injured Reserve", injury: "Lower Body", team: "Sabres" },
    { player: "Conor Timmins", pos: "D", status: "Injured Reserve", injury: "Lower Body", team: "Sabres" },
    { player: "Jack Rathbone", pos: "D", status: "Injured Reserve", injury: "Undisclosed", team: "Sabres" },
    { player: "Samuel Ersson", pos: "G", status: "Probable", injury: "Expected Starter (3.78 GAA, .866 SV%)", team: "Ottawa" },
    { player: "Andre Burakovsky", pos: "LW", status: "Injured Reserve", injury: "Lower Body", team: "Ottawa" },
    { player: "Warren Foegele", pos: "LW", status: "Injured Reserve", injury: "Knee", team: "Ottawa" },
    { player: "Linus Ullmark", pos: "G", status: "Injured Reserve", injury: "Lower Body", team: "Ottawa" },
    { player: "William Eklund", pos: "LW", status: "Injured Reserve", injury: "Ankle", team: "Ottawa" },
  ],
};

/* ───────────── Styles ───────────── */

const css = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@600;800&family=Barlow:wght@400;500;600&family=JetBrains+Mono:wght@400;600&display=swap');
.ob { font-family: 'Barlow', system-ui, sans-serif; background: ${C.midnight}; color: ${C.white}; min-height: 100vh; font-size: 15px; line-height: 1.45; overflow-x: hidden; }
.ob * { box-sizing: border-box; }
.ob .disp { font-family: 'Barlow Condensed', 'Arial Narrow', sans-serif; font-weight: 800; letter-spacing: 0.01em; }
.ob .num { font-family: 'JetBrains Mono', ui-monospace, monospace; font-variant-numeric: tabular-nums; }
.ob button { font: inherit; color: inherit; background: none; border: 0; cursor: pointer; }
.ob button:focus-visible { outline: 2px solid ${C.gold}; outline-offset: 2px; }
.ob table { border-collapse: collapse; width: 100%; }
.ob th { text-align: right; font-weight: 500; color: ${C.dim}; font-size: 12px; padding: 6px 10px; border-bottom: 1px solid ${C.hair}; }
.ob td { text-align: right; padding: 8px 10px; border-bottom: 1px solid ${C.soft}; }
.ob th.l, .ob td.l { text-align: left; }
.ob .wrap { max-width: 1280px; margin: 0 auto; padding: 0 24px; width: 100%; }
.ob .grid { display: grid; }
.ob .grid-cols-1 { grid-template-columns: minmax(0, 1fr); }
.ob .gap-6 { gap: 1.5rem; }
.ob .grid2 { display: grid; grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }
.ob .sect { border-top: 1px solid ${C.hair}; padding: 24px 0; }
.ob .w-full { width: 100%; }
.ob .table-fixed { table-layout: fixed; }
.ob .hidden { display: none; }
.ob .md\\:hidden { display: inline; }
.ob .whitespace-nowrap { white-space: nowrap; }
.ob .truncate { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ob th.px-1\\.5, .ob td.px-1\\.5, .ob .px-1\\.5 { padding-left: 0.375rem; padding-right: 0.375rem; }
.ob th.py-1, .ob td.py-1, .ob .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
.ob th.text-xs, .ob td.text-xs, .ob .text-xs { font-size: 0.75rem; line-height: 1rem; }
.ob .rooting-row { display: flex; flex-direction: column; gap: 6px; width: 100%; text-align: left; padding: 10px 0; min-width: 0; }
.ob .rooting-row-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; flex-wrap: wrap; }
.ob .rooting-row-bottom { display: flex; align-items: center; justify-content: space-between; gap: 8px; width: 100%; min-width: 0; flex-wrap: wrap; }
@media (min-width: 640px) {
  .ob th.sm\\:px-3, .ob td.sm\\:px-3, .ob .sm\\:px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
  .ob th.sm\\:py-2, .ob td.sm\\:py-2, .ob .sm\\:py-2 { padding-top: 0.5rem; padding-bottom: 0.5rem; }
}
@media (min-width: 768px) {
  .ob .md\\:hidden { display: none !important; }
  .ob th.md\\:table-cell, .ob td.md\\:table-cell, .ob .md\\:table-cell { display: table-cell; }
  .ob .md\\:inline { display: inline; }
}
@media (min-width: 1024px) {
  .ob .lg\\:grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .ob .grid2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@keyframes obpulse { 50% { opacity: .2; } }
.ob .live { animation: obpulse 1.4s steps(2) infinite; }
@media (prefers-reduced-motion: reduce) { .ob .live { animation: none; } }
@media (max-width: 1023px) {
  .ob .grid2 { grid-template-columns: minmax(0, 1fr); }
  .ob .wrap { padding: 0 14px; }
}
`;

const pad = (n: number) => String(n).padStart(2, "0");
const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0");
const ord = (n: number) => ["", "1st", "2nd", "3rd", "4th"][n] ?? `${n}th`;

/* ───────────── Shared pieces ───────────── */

function LiveDot() {
  return <span className="live" aria-hidden style={{ display: "inline-block", width: 8, height: 8, background: C.red, marginRight: 6 }} />;
}

function SectionHead({ title, meta }: { title: string; meta?: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 14, gap: 12, flexWrap: "wrap" }}>
      <h2 className="disp" style={{ margin: 0, fontSize: 28 }}>{title}</h2>
      {meta && <span style={{ color: C.dim, fontSize: 13 }}>{meta}</span>}
    </div>
  );
}

/* ───────────── Top telemetry bar ───────────── */

const parseSideScore = (raw?: string | number | null): number | null => {
  if (raw === null || raw === undefined || raw === "") return null;
  const n = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
};

const GAME: GameTelemetryProps = {
  nextGame: BILLS_NEXT,
  status: BILLS_NEXT.statusState,
  away: {
    name: "Buffalo Bills",
    abbr: "BUF",
    record: "6-1, W3",
    score: parseSideScore(BILLS_NEXT.bufScore),
  },
  home: {
    name: "Minnesota Vikings",
    abbr: "MIN",
    record: "6-1, L1",
    score: parseSideScore(BILLS_NEXT.oppScore),
  },
  venue: BILLS_NEXT.venue,
  network: BILLS_NEXT.broadcast.network,
  broadcast: BILLS_NEXT.broadcast,
  leverage: BILLS_NEXT.leverage,
};

function useCountdown(target: number) {
  const [left, setLeft] = useState(() => Math.max(0, target - Date.now()));
  useEffect(() => {
    const t = setInterval(() => setLeft(Math.max(0, target - Date.now())), 1000);
    return () => clearInterval(t);
  }, [target]);
  const s = Math.floor(left / 1000);
  const days = Math.floor(s / 86400);
  const hours = Math.floor((s % 86400) / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = s % 60;
  return days > 0
    ? `${days}d ${pad(hours)}:${pad(mins)}:${pad(secs)}`
    : `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function TelemetryBar({
  filter,
  onFilter,
  game = BILLS_NEXT,
  sabresGame = SABRES_NEXT,
}: {
  filter: TeamFilter;
  onFilter: (f: TeamFilter) => void;
  game?: NextGameIntel;
  sabresGame?: NextGameIntel;
}) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  const rawHours = now.getHours();
  const hours12 = rawHours % 12 || 12;
  const ampm = rawHours >= 12 ? "PM" : "AM";
  const time = `${hours12}:${pad(now.getMinutes())}:${pad(now.getSeconds())} ${ampm}`;
  const billsBroadcast = getGameBroadcast(game, true);
  const sabresBroadcast = getGameBroadcast(sabresGame, false);
  const channels = [
    { name: billsBroadcast.network, detail: `Bills ${game.opponent} • ${game.gameTime}`, live: game.statusState === "in" },
    { name: sabresBroadcast.network, detail: `Sabres ${sabresGame.opponent} • ${sabresGame.gameTime}`, live: sabresGame.statusState === "in" },
  ];
  const tabs: { id: TeamFilter; label: string }[] = [
    { id: "all", label: "All Teams" },
    { id: "bills", label: "Buffalo Bills" },
    { id: "sabres", label: "Buffalo Sabres" },
  ];
  const accent = filter === "sabres" ? C.gold : filter === "bills" ? C.red : C.white;
  return (
    <header style={{ background: C.royal, borderBottom: `4px solid ${C.red}` }}>
      <div className="wrap" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 16 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 0" }}>
          <div className="disp" style={{ fontSize: 40, lineHeight: 0.9 }}>One<br />Buffalo</div>
          <div style={{ borderLeft: `1px solid ${C.hair}`, paddingLeft: 14, fontSize: 13, color: "#DCE6FF" }}>
            Bills and Sabres,<br />one screen.
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          {channels.map((c) => (
            <div key={c.name} style={{ fontSize: 12, lineHeight: 1.25 }}>
              <div style={{ fontWeight: 600 }}>{c.live && <LiveDot />}{c.name}</div>
              <div style={{ color: "#DCE6FF" }}>{c.detail}</div>
            </div>
          ))}
          <div style={{ borderLeft: `1px solid ${C.hair}`, paddingLeft: 20, textAlign: "right" }}>
            <div className="num" style={{ fontSize: 26, fontWeight: 600 }}>{time}</div>
            <div style={{ fontSize: 12, color: "#DCE6FF" }}>Eastern, Mon Nov 2</div>
          </div>
        </div>
      </div>
      <nav aria-label="Team filter" style={{ background: C.navy, borderTop: `1px solid ${C.hair}` }}>
        <div className="wrap" style={{ display: "flex", overflowX: "auto" }} role="tablist">
          {tabs.map((t) => {
            const active = filter === t.id;
            return (
              <button
                key={t.id}
                role="tab"
                aria-selected={active}
                onClick={() => onFilter(t.id)}
                style={{
                  padding: "12px 20px",
                  whiteSpace: "nowrap",
                  fontWeight: active ? 600 : 500,
                  color: active ? C.white : C.dim,
                  borderBottom: `3px solid ${active ? accent : "transparent"}`,
                }}
              >
                {t.label}
              </button>
            );
          })}
        </div>
      </nav>
    </header>
  );
}

/* ───────────── Active game center ───────────── */

function GameCenter(p: GameTelemetryProps) {
  const game = p.nextGame ?? BILLS_NEXT;
  const nextGame = game;
  const statusState: StatusState = game.statusState ?? p.status ?? "pre";
  const live = p.liveData ?? p.liveTelemetry;
  const [expanded, setExpanded] = useState(false);
  const kickoffTarget = Date.parse(game.isoTime);
  const kickoffCountdown = useCountdown(Number.isFinite(kickoffTarget) ? kickoffTarget : Date.now());

  const bufIsAway = game.opponent.trim().startsWith("@");
  const bufRawScore = parseSideScore(game.bufScore);
  const oppRawScore = parseSideScore(game.oppScore);
  const sumSplits = (splits?: (number | null)[]) =>
    splits && splits.some((s) => s !== null)
      ? splits.reduce<number>((acc, s) => acc + (s ?? 0), 0)
      : null;

  const awayScore =
    (bufIsAway ? bufRawScore : oppRawScore) ??
    parseSideScore(p.away.score) ??
    sumSplits(live?.awaySplits);
  const homeScore =
    (bufIsAway ? oppRawScore : bufRawScore) ??
    parseSideScore(p.home.score) ??
    sumSplits(live?.homeSplits);

  const bufWinChance = game.winChance;
  const homeWin = live?.winProbHome ?? (bufIsAway ? 100 - bufWinChance : bufWinChance);
  const awayWin = 100 - homeWin;

  const venueLabel = game.venue || p.venue;
  const broadcast = getGameBroadcast(game, true);
  const networkLabel = broadcast.network;
  const matchupTitle = `${p.away.name} at ${p.home.name}`;

  const quarterLabels = live?.quarterLabels ?? ["1st", "2nd", "3rd", "4th", "OT"];
  const awaySplits = live?.awaySplits ?? quarterLabels.map(() => null);
  const homeSplits = live?.homeSplits ?? quarterLabels.map(() => null);
  const plays = live?.plays ?? [];
  const visiblePlays = expanded ? plays : plays.slice(0, 4);
  const offense = live?.possession === "home" ? p.home : live?.possession === "away" ? p.away : null;
  const yardLine = live?.yardLine ?? 50;
  const distance = live?.distance ?? 10;
  const dir = live?.possession === "home" ? -1 : 1;
  const firstDown = Math.max(0, Math.min(100, yardLine + dir * distance));

  const liveData = p.liveData;
  const billsDays =
    liveData?.bills?.nextGame?.restAdvantage?.billsDays ??
    nextGame.restAdvantage?.billsDays ??
    nextGame.restAdvantage?.teamDays;
  const oppDays =
    liveData?.bills?.nextGame?.restAdvantage?.oppDays ??
    nextGame.restAdvantage?.oppDays;
  const diffText =
    liveData?.bills?.nextGame?.restAdvantage?.summary ??
    nextGame.restAdvantage?.summary ??
    "Even Rest";
  const billsRestEdge =
    billsDays !== undefined && oppDays !== undefined
      ? `BUF ${billsDays}d vs MIN ${oppDays}d (${diffText})`
      : (nextGame.restAdvantage?.summary ?? "Even Rest (Both on 8 Days Rest)");

  const rows = [
    { t: p.away, splits: awaySplits, score: awayScore },
    { t: p.home, splits: homeSplits, score: homeScore },
  ];

  return (
    <section aria-label="Game center" className="sect">
      <div className="wrap">
        <SectionHead title={matchupTitle} meta={`${venueLabel} • ${networkLabel}`} />

        {statusState === "pre" && (
          <div className="grid2" style={{ borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}` }}>
            {/* Pregame matchup banner + Win probability */}
            <div style={{ padding: "18px 20px 18px 0" }}>
              <div style={{ color: C.dim, fontSize: 13 }}>Kickoff in</div>
              <div className="num" style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.1, color: C.gold, marginBottom: 14 }}>
                {kickoffCountdown}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12, flexWrap: "wrap", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ background: C.royal, border: `1px solid ${C.hair}`, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                    {broadcast.network}
                  </span>
                  {broadcast.badgeTitle && (
                    <span style={{ color: C.gold, fontSize: 12, fontWeight: 600 }}>
                      {broadcast.badgeTitle}
                    </span>
                  )}
                </div>
                <span className="num" style={{ fontSize: 14, fontWeight: 600, color: C.white }}>
                  Kickoff: {game.gameTime}
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "center", gap: 16, padding: "12px 0", borderTop: `1px solid ${C.soft}`, borderBottom: `1px solid ${C.soft}` }}>
                <div>
                  <div className="disp" style={{ fontSize: 36, lineHeight: 1 }}>{p.away.abbr}</div>
                  <div style={{ fontWeight: 600 }}>{p.away.name}</div>
                  <div className="num" style={{ color: C.dim, fontSize: 13 }}>{p.away.record}</div>
                </div>
                <div className="disp" style={{ fontSize: 22, color: C.dim, padding: "0 8px" }}>@</div>
                <div style={{ textAlign: "right" }}>
                  <div className="disp" style={{ fontSize: 36, lineHeight: 1 }}>{p.home.abbr}</div>
                  <div style={{ fontWeight: 600 }}>{p.home.name}</div>
                  <div className="num" style={{ color: C.dim, fontSize: 13 }}>{p.home.record}</div>
                </div>
              </div>

              {/* Win probability */}
              <div style={{ marginTop: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span className="num">{p.away.abbr} {awayWin}%</span>
                  <span style={{ color: C.dim }}>Win probability</span>
                  <span className="num">{p.home.abbr} {homeWin}%</span>
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={bufWinChance}
                  aria-label="Bills win probability"
                  style={{ display: "flex", height: 14, border: `1px solid ${C.hair}` }}
                >
                  <div style={{ width: `${awayWin}%`, background: bufIsAway ? C.royal : "#3B4A6E" }} />
                  <div style={{ width: `${homeWin}%`, background: bufIsAway ? "#3B4A6E" : C.royal, borderLeft: `2px solid ${C.white}` }} />
                </div>
              </div>
            </div>

            {/* Kickoff, Broadcast, Venue & Weather details */}
            <div style={{ padding: "18px 0 18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
              <div>
                <h3 className="disp" style={{ margin: "0 0 8px", fontSize: 20 }}>Pregame Matchup Info</h3>
                <div className="num" style={{ display: "grid", gridTemplateColumns: "110px 1fr", rowGap: 6, columnGap: 12, fontSize: 13 }}>
                  <span style={{ color: C.dim }}>Kickoff</span>
                  <span>{game.gameTime} ({game.statusDetail})</span>
                  <span style={{ color: C.dim }}>Broadcast</span>
                  <span>{broadcast.displayString}</span>
                  <span style={{ color: C.dim }}>Venue</span>
                  <span>{venueLabel}</span>
                  {(nextGame.roof || nextGame.surface || nextGame.weather) && (
                    <>
                      <span style={{ color: C.dim }}>Conditions</span>
                      <span>
                        {[nextGame.weather, nextGame.roof, nextGame.surface].filter(Boolean).join(" • ")}
                      </span>
                    </>
                  )}
                  <span style={{ color: C.dim }}>Rest edge</span>
                  <span>{billsRestEdge}</span>
                </div>
              </div>

              <div className="num" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
                <div style={{ paddingRight: 10 }}>
                  <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>CURRENT STANDING</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>1st in AFC East • 6-1</div>
                  <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>(AFC #2 Seed • 2.5 game division lead)</div>
                </div>
                <div style={{ borderLeft: `1px solid ${C.soft}`, padding: "0 10px" }}>
                  <div style={{ fontSize: 11, color: "#4ADE80", fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>WITH A WIN</div>
                  <div style={{ fontSize: 13, fontWeight: 600, color: "#4ADE80", marginTop: 2 }}>{nextGame.ifWin ?? 99}% Playoff Odds</div>
                  <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>Moves to 7-1 • Contends for #1 Seed</div>
                </div>
                <div style={{ borderLeft: `1px solid ${C.soft}`, paddingLeft: 10 }}>
                  <div style={{ fontSize: 11, color: "#FF8A9C", fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>WITH A LOSS</div>
                  <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>{nextGame.ifLoss ?? 84}% Playoff Odds</div>
                  <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>Drops to 6-2 • Division buffer tightens</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {statusState === "in" && (
          <div className="grid2" style={{ borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}` }}>
            {/* Live score and quarter splits */}
            <div style={{ padding: "18px 20px 18px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <span style={{ fontWeight: 600 }}>
                  <LiveDot />
                  {live?.currentPeriod
                    ? `Live, ${ord(parseInt(live.currentPeriod, 10))} quarter`
                    : nextGame.statusDetail || "Live"}
                </span>
                <span className="num" style={{ fontSize: 22, fontWeight: 600 }}>
                  {live?.clock ?? nextGame.liveScore ?? ""}
                </span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="l">Team</th>
                    {quarterLabels.map((q) => <th key={q}>{q}</th>)}
                    <th style={{ color: C.white }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ t, splits, score }) => {
                    const hasBall = offense?.abbr === t.abbr;
                    return (
                      <tr key={t.abbr}>
                        <td className="l">
                          <span className="disp" style={{ fontSize: 24 }}>{t.abbr}</span>{" "}
                          <span className="num" style={{ color: C.dim, fontSize: 12 }}>{t.record}</span>{" "}
                          {hasBall && (
                            <span style={{ background: C.red, fontSize: 12, fontWeight: 600, padding: "1px 6px" }}>Ball</span>
                          )}
                        </td>
                        {splits.map((s, i) => (
                          <td key={i} className="num" style={{ color: s === null ? C.soft : C.white }}>{s === null ? "–" : s}</td>
                        ))}
                        <td className="num" style={{ fontSize: 28, fontWeight: 600 }}>{score ?? "–"}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* Win probability */}
              <div style={{ marginTop: 18 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 4 }}>
                  <span className="num">{p.away.abbr} {awayWin}%</span>
                  <span style={{ color: C.dim }}>Win probability</span>
                  <span className="num">{p.home.abbr} {homeWin}%</span>
                </div>
                <div
                  role="meter"
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={homeWin}
                  aria-label="Live win probability"
                  style={{ display: "flex", height: 14, border: `1px solid ${C.hair}` }}
                >
                  <div style={{ width: `${awayWin}%`, background: "#3B4A6E" }} />
                  <div style={{ width: `${homeWin}%`, background: C.royal, borderLeft: `2px solid ${C.white}` }} />
                </div>
              </div>
            </div>

            {/* Down & distance + ticker */}
            <div style={{ padding: "18px 0 18px 20px" }}>
              {live?.down !== undefined && live?.distance !== undefined ? (
                <>
                  <div style={{ display: "flex", alignItems: "baseline", gap: 14, marginBottom: 12, flexWrap: "wrap" }}>
                    <span className="disp" style={{ fontSize: 46, lineHeight: 1 }}>
                      {ord(live.down)} &amp; {live.distance}
                    </span>
                    <span className="num" style={{ color: C.dim }}>
                      Ball on {yardLine >= 50 ? `${p.home.abbr} ${100 - yardLine}` : `${p.away.abbr} ${yardLine}`}
                    </span>
                  </div>

                  <div
                    role="img"
                    aria-label={`Ball at the ${100 - yardLine} yard line, ${distance} yards to go`}
                    style={{ position: "relative", height: 54, background: C.navy, border: `1px solid ${C.hair}`, marginBottom: 6 }}
                  >
                    {[10, 20, 30, 40, 50, 60, 70, 80, 90].map((y) => (
                      <div key={y} style={{ position: "absolute", left: `${y}%`, top: 0, bottom: 0, borderLeft: `1px solid ${C.soft}` }} />
                    ))}
                    <div style={{ position: "absolute", left: 0, width: "6%", top: 0, bottom: 0, background: "#125740", opacity: 0.9 }} />
                    <div style={{ position: "absolute", right: 0, width: "6%", top: 0, bottom: 0, background: C.royal }} />
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${Math.min(yardLine, firstDown)}%`, width: `${distance}%`, background: "rgba(252,181,20,0.28)" }} />
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${yardLine}%`, borderLeft: `2px solid ${C.white}` }} />
                    <div style={{ position: "absolute", top: 0, bottom: 0, left: `${firstDown}%`, borderLeft: `3px solid ${C.gold}` }} />
                    <div style={{ position: "absolute", top: "50%", left: `${yardLine}%`, width: 14, height: 14, background: C.red, transform: "translate(-50%, -50%) rotate(45deg)", border: `2px solid ${C.white}` }} />
                  </div>
                  <div className="num" style={{ display: "flex", justifyContent: "space-between", color: C.dim, fontSize: 11, marginBottom: 16 }}>
                    <span>{p.away.abbr} goal</span><span>10</span><span>20</span><span>30</span><span>40</span><span>50</span><span>40</span><span>30</span><span>20</span><span>10</span><span>{p.home.abbr} goal</span>
                  </div>
                </>
              ) : (
                <div className="num" style={{ color: C.dim, fontSize: 13, marginBottom: 14 }}>
                  Awaiting live down &amp; distance telemetry ({nextGame.statusDetail || "In Progress"}).
                </div>
              )}

              {plays.length > 0 && (
                <>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
                    <h3 className="disp" style={{ margin: 0, fontSize: 20 }}>Play by play</h3>
                    <button onClick={() => setExpanded((e) => !e)} style={{ color: C.gold, fontSize: 13, fontWeight: 600 }}>
                      {expanded ? "Show fewer plays" : "Show all plays"}
                    </button>
                  </div>
                  <ol style={{ listStyle: "none", margin: 0, padding: 0 }} aria-live="polite">
                    {visiblePlays.map((pl, i) => (
                      <li key={`${pl.quarter}${pl.clock}`} style={{
                        display: "grid", gridTemplateColumns: "64px 1fr", gap: 10, padding: "7px 0",
                        borderTop: `1px solid ${C.soft}`,
                        borderLeft: pl.scoring ? `3px solid ${C.red}` : "3px solid transparent",
                        paddingLeft: 8,
                        fontWeight: i === 0 ? 600 : 400,
                      }}>
                        <span className="num" style={{ color: C.dim, fontSize: 13 }}>{pl.quarter} {pl.clock}</span>
                        <span>{pl.text}</span>
                      </li>
                    ))}
                  </ol>
                </>
              )}
            </div>
          </div>
        )}

        {statusState === "post" && (
          <div className="grid2" style={{ borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}` }}>
            {/* Final scoreline */}
            <div style={{ padding: "18px 20px 18px 0" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
                <span style={{ background: C.navy, border: `1px solid ${C.hair}`, padding: "2px 8px", fontSize: 12, fontWeight: 600 }}>
                  {nextGame.statusDetail || "Final"}
                </span>
                <span className="num" style={{ fontSize: 12, color: C.dim }}>{nextGame.gameTime}</span>
              </div>
              <table>
                <thead>
                  <tr>
                    <th className="l">Team</th>
                    {live?.quarterLabels && quarterLabels.map((q) => <th key={q}>{q}</th>)}
                    <th style={{ color: C.white }}>Final</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map(({ t, splits, score }) => {
                    const otherScore = t.abbr === p.away.abbr ? homeScore : awayScore;
                    const isWinner = score !== null && otherScore !== null && score > otherScore;
                    return (
                      <tr key={t.abbr}>
                        <td className="l">
                          <span className="disp" style={{ fontSize: 26, color: isWinner ? C.gold : C.white }}>{t.abbr}</span>{" "}
                          <span style={{ fontWeight: isWinner ? 600 : 400 }}>{t.name}</span>{" "}
                          <span className="num" style={{ color: C.dim, fontSize: 12 }}>{t.record}</span>
                        </td>
                        {live?.quarterLabels && splits.map((s, i) => (
                          <td key={i} className="num" style={{ color: s === null ? C.soft : C.white }}>{s === null ? "–" : s}</td>
                        ))}
                        <td className="num" style={{ fontSize: 30, fontWeight: 600, color: isWinner ? C.gold : C.white }}>
                          {score ?? "–"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Postgame summary */}
            <div style={{ padding: "18px 0 18px 20px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
              <h3 className="disp" style={{ margin: 0, fontSize: 20 }}>Final Matchup Summary</h3>
              <p className="num" style={{ margin: 0, fontSize: 13 }}>{game.matchupRecords}</p>
              <p style={{ margin: 0, fontSize: 13, color: C.dim }}>
                {venueLabel} • {broadcast.displayString}
              </p>
              {(nextGame.weather || nextGame.roof || nextGame.surface) && (
                <p className="num" style={{ margin: 0, fontSize: 12, color: C.dim }}>
                  {[nextGame.weather, nextGame.roof, nextGame.surface].filter(Boolean).join(" • ")}
                </p>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

/* ───────────── Upcoming game and pregame intel ───────────── */

function UpcomingGame(p: UpcomingGameProps) {
  const liveData = p.liveData ?? { sabres: { nextGame: p.nextGame ?? SABRES_NEXT } };
  const nextGame = liveData.sabres?.nextGame ?? p.nextGame ?? SABRES_NEXT;
  const intel = nextGame;
  const puckDropTarget = Date.parse(nextGame.isoTime);
  const countdown = useCountdown(Number.isFinite(puckDropTarget) ? puckDropTarget : p.puckDrop);
  const statusColor = (s: string) => (s === "Confirmed" ? C.gold : C.dim);

  const oppAbbr = nextGame.opponent.toLowerCase().includes("ottawa") ? "OTT" : p.away.abbr;
  const oppTeam = {
    name: oppAbbr === "OTT" ? "Ottawa Senators" : (nextGame.oppShortName || p.away.name),
    abbr: oppAbbr,
    record: oppAbbr === "OTT" ? "9-6-1, 19 PTS" : p.away.record,
  };
  const gameTimeLabel = nextGame.gameTime || "Wed, Nov 4 • 7:30 PM ET";
  const venueLabel = nextGame.venue || p.venue || "KeyBank Center, Buffalo, NY";
  const goalies =
    liveData.sabres?.nextGame?.goalies ??
    nextGame.goalies ??
    p.goalies ?? [
      { team: "BUF", name: "Ukko-Pekka Luukkonen", status: "Probable", sv: ".874", gaa: "3.40" },
      { team: "OTT", name: "Samuel Ersson", status: "Probable", sv: ".866", gaa: "3.78" },
    ];

  const ppRow = intel.efficiency.find((e) => e.metric.toLowerCase().includes("power play"));
  const pkRow = intel.efficiency.find((e) => e.metric.toLowerCase().includes("penalty kill"));
  const ppRate = ppRow ? `BUF ${ppRow.team} vs ${oppAbbr} ${ppRow.opp}` : `BUF 17.0% (23rd) vs ${oppAbbr} 12.3% (30th)`;
  const pkRate = pkRow ? `BUF ${pkRow.team} vs ${oppAbbr} ${pkRow.opp}` : `BUF 68.6% (29th) vs ${oppAbbr} 73.3% (22nd)`;
  const sabresDays =
    liveData?.sabres?.nextGame?.restAdvantage?.sabresDays ??
    intel.restAdvantage?.sabresDays ??
    intel.restAdvantage?.teamDays;
  const oppDays =
    liveData?.sabres?.nextGame?.restAdvantage?.oppDays ??
    intel.restAdvantage?.oppDays;
  const diffText =
    liveData?.sabres?.nextGame?.restAdvantage?.summary ??
    intel.restAdvantage?.summary ??
    "Sabres +1";
  const restSummary =
    sabresDays !== undefined && oppDays !== undefined
      ? `BUF ${sabresDays}d vs ${oppAbbr} ${oppDays}d (${diffText})`
      : (intel.restAdvantage?.summary ?? "Sabres +1 (4d vs 3d Rest)");

  return (
    <section aria-label="Upcoming game" className="sect">
      <div className="wrap">
        <SectionHead title={`Sabres ${nextGame.opponent || "vs. Ottawa Senators"}`} meta={`${venueLabel} • ${gameTimeLabel}`} />
        <div className="grid2" style={{ borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}` }}>
          <div style={{ padding: "18px 20px 18px 0" }}>
            <div style={{ color: C.dim, fontSize: 13 }}>Puck drops in</div>
            <div className="num" style={{ fontSize: 56, fontWeight: 600, lineHeight: 1.1, color: C.gold }}>{countdown}</div>
            <div style={{ display: "flex", gap: 24, marginTop: 14 }}>
              {[oppTeam, p.home].map((t) => (
                <div key={t.abbr}>
                  <div className="disp" style={{ fontSize: 28, lineHeight: 1 }}>{t.abbr}</div>
                  <div style={{ fontSize: 13, color: C.dim }}>{t.name}</div>
                  <div className="num" style={{ fontSize: 13 }}>{t.record}</div>
                </div>
              ))}
            </div>

            <h3 className="disp" style={{ fontSize: 20, margin: "22px 0 4px" }}>Starting goaltenders</h3>
            <table>
              <thead>
                <tr><th className="l">Goalie</th><th>Status</th><th>Sv%</th><th>GAA</th></tr>
              </thead>
              <tbody>
                {goalies.map((g) => (
                  <tr key={g.team}>
                    <td className="l"><span className="num" style={{ color: C.dim }}>{g.team}</span> {g.name}</td>
                    <td style={{ color: statusColor(g.status), fontWeight: 600 }}>{g.status}</td>
                    <td className="num">{g.sv}</td>
                    <td className="num">{g.gaa}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ padding: "18px 0 18px 20px", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 14 }}>
            <div>
              <h3 className="disp" style={{ fontSize: 20, margin: "0 0 8px" }}>Pregame Matchup Info</h3>
              <div className="num" style={{ display: "grid", gridTemplateColumns: "120px 1fr", rowGap: 6, columnGap: 12, fontSize: 13 }}>
                <span style={{ color: C.dim }}>Puck Drop</span>
                <span>{gameTimeLabel}</span>
                <span style={{ color: C.dim }}>Broadcast</span>
                <span>{getGameBroadcast(intel, false).displayString}</span>
                <span style={{ color: C.dim }}>Venue</span>
                <span>{venueLabel}</span>
                <span style={{ color: C.dim }}>Power Play %</span>
                <span>{ppRate}</span>
                <span style={{ color: C.dim }}>Penalty Kill %</span>
                <span>{pkRate}</span>
                <span style={{ color: C.dim }}>Rest edge</span>
                <span>{restSummary}</span>
              </div>
            </div>

            <div className="num" style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", borderTop: `1px solid ${C.hair}`, paddingTop: 10 }}>
              <div style={{ paddingRight: 10 }}>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>CURRENT STANDING</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>7th in Atlantic • 17 PTS</div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>(2 pts back of WC2)</div>
              </div>
              <div style={{ borderLeft: `1px solid ${C.soft}`, padding: "0 10px" }}>
                <div style={{ fontSize: 11, color: C.gold, fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>REGULATION WIN (+2)</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: C.gold, marginTop: 2 }}>Up to 19 PTS</div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>Closes Wild Card gap</div>
              </div>
              <div style={{ borderLeft: `1px solid ${C.soft}`, paddingLeft: 10 }}>
                <div style={{ fontSize: 11, color: "#FF8A9C", fontFamily: "Barlow, sans-serif", fontWeight: 600 }}>REGULATION LOSS (0)</div>
                <div style={{ fontSize: 13, fontWeight: 600, marginTop: 2 }}>Stays at 17 PTS</div>
                <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>Missed opportunity vs division rival</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ───────────── Standings ───────────── */

function StandingsTable(p: StandingsTableProps) {
  const colSpan = p.showPoints ? 6 : 5;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4 }}>
        <h3 className="disp" style={{ margin: 0, fontSize: 22 }}>{p.title}</h3>
        <span style={{ color: C.dim, fontSize: 12 }}>{p.subtitle}</span>
      </div>
      <table className="num w-full table-fixed">
        <thead>
          <tr>
            <th className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ width: 28 }}>Rank</th>
            <th className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ fontFamily: "Barlow, sans-serif" }}>Team</th>
            <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2">{p.recordLabel}</th>
            {p.showPoints && <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2">Pts</th>}
            <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2">{p.diffLabel}</th>
            <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2">Streak</th>
          </tr>
        </thead>
        <tbody>
          {p.rows.flatMap((r, idx) => {
            const nextRow = p.rows[idx + 1];
            const showCutoff = p.showPoints && r.rank === 3 && nextRow !== undefined;
            const teamRow = (
              <tr key={r.team} style={r.buffalo ? { background: C.royal } : undefined}>
                <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2">{r.rank}</td>
                <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2 truncate" style={{ fontFamily: "Barlow, sans-serif", fontWeight: r.buffalo ? 600 : 400 }}>{r.team}</td>
                <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2 whitespace-nowrap">{r.record}</td>
                {p.showPoints && <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ fontWeight: 600 }}>{r.pts}</td>}
                <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ color: r.diff < 0 ? "#FF8A9C" : C.white }}>{signed(r.diff)}</td>
                <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ color: r.streak.startsWith("W") ? C.gold : C.dim }}>{r.streak}</td>
              </tr>
            );
            if (!showCutoff) return [teamRow];
            return [
              teamRow,
              <tr key={`${r.team}-wildcard-cutoff`} style={{ background: C.navy }}>
                <td
                  colSpan={colSpan}
                  className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2"
                  style={{
                    fontFamily: "Barlow, sans-serif",
                    fontSize: 11,
                    fontWeight: 600,
                    color: C.gold,
                    letterSpacing: "0.05em",
                    textTransform: "uppercase",
                    padding: "4px 10px",
                    borderBottom: `1px dashed ${C.gold}`,
                  }}
                >
                  Wild Card Cutoff — Top 3 Clinch Division Seeds
                </td>
              </tr>,
            ];
          })}
        </tbody>
      </table>
    </div>
  );
}

/* ───────────── Out-of-town rooting companion ───────────── */

function RootingStrip({ games }: { games: (OutOfTownGame & { league: "NFL" | "NHL" })[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const IMPACT_COLOR: Record<ImpactClass, string> = { good: C.gold, bad: "#FF8A9C", warning: C.white, neutral: C.dim };
  return (
    <section aria-label="Out-of-town games" className="sect">
      <div className="wrap">
        <SectionHead title="Rooting guide" meta="Games that move Buffalo's seeding" />
        <ul style={{ listStyle: "none", margin: 0, padding: 0, borderTop: `1px solid ${C.hair}` }}>
          {games.map((g) => {
            const id = `${g.isoTime}${g.awayName}`;
            const isOpen = open === id;
            const live = g.statusState === "in";
            const pre = g.statusState === "pre";
            return (
              <li key={id} style={{ borderBottom: `1px solid ${C.soft}` }}>
                <button
                  onClick={() => setOpen(isOpen ? null : id)}
                  aria-expanded={isOpen}
                  className="rooting-row"
                >
                  <div className="rooting-row-top">
                    <div style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                      <span className="num" style={{ color: g.league === "NHL" ? C.gold : C.dim, fontSize: 12, fontWeight: 600 }}>{g.league}</span>
                      <span className="num truncate" style={{ fontWeight: 500 }}>
                        {g.awayName} <b>{pre ? "" : g.awayScore}</b>, {g.homeName} <b>{pre ? "" : g.homeScore}</b>
                      </span>
                    </div>
                    <span className="num whitespace-nowrap" style={{ fontSize: 12, color: live ? C.white : C.dim }}>
                      {live && <LiveDot />}{g.statusDetail}
                    </span>
                  </div>
                  <div className="rooting-row-bottom">
                    <span style={{ fontSize: 12, color: IMPACT_COLOR[g.impactClass], fontWeight: 600 }}>{g.verdict}</span>
                    <span className="truncate" style={{ fontSize: 12, color: C.dim, textAlign: "right" }}>{g.target}</span>
                  </div>
                </button>
                {isOpen && (
                  <div style={{ margin: "0 0 12px 14px", color: C.dim, fontSize: 13, maxWidth: "90ch" }}>
                    <p style={{ margin: "0 0 6px", color: C.white }}>{g.why}</p>
                    <p className="num" style={{ margin: 0, fontSize: 12 }}>
                      {g.awayName} {g.awayRecord}, {g.awayWinChance}% win. {g.homeName} {g.homeRecord}, {g.homeWinChance}% win.
                    </p>
                    <p className="num" style={{ margin: "2px 0 0", fontSize: 12 }}>
                      {g.slot}. {g.broadcast}, {g.announcers}. {g.venue}.
                      {g.roof ? ` ${g.roof}, ${g.surface}, ${g.weather}.` : ""} {g.windowLabel} ({g.windowBadge}).
                    </p>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

/* ───────────── Injury and practice wire ───────────── */

const STATUS_COLOR: Record<string, string> = {
  Out: C.red,
  "Injured Reserve": C.red,
  Suspension: C.red,
  Doubtful: "#FF8A9C",
  Questionable: C.gold,
  "Day-To-Day": C.gold,
  Probable: C.white,
};

function InjuryIntel(p: InjuryIntelProps) {
  const cols = "minmax(140px,1.3fr) 56px 44px 130px 80px minmax(140px,1.6fr)";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
        <h3 className="disp" style={{ margin: 0, fontSize: 22 }}>{p.title}</h3>
        <span style={{ color: C.dim, fontSize: 12 }}>{p.updated}</span>
      </div>
      <div className="num" style={{ fontSize: 13, overflowX: "auto" }}>
        <div style={{ minWidth: 640 }}>
          <div style={{ display: "grid", gridTemplateColumns: cols, gap: 8, color: C.dim, padding: "4px 0", borderBottom: `1px solid ${C.hair}` }}>
            <span>Player</span><span>Team</span><span>Pos</span><span>Status</span><span>Practice</span><span>Injury</span>
          </div>
          {p.rows.map((r) => (
            <div key={`${r.team}${r.player}`} style={{ display: "grid", gridTemplateColumns: cols, gap: 8, padding: "7px 0", borderBottom: `1px solid ${C.soft}` }}>
              <span>{r.player}</span>
              <span style={{ color: C.dim }}>{r.team}</span>
              <span style={{ color: C.dim }}>{r.pos}</span>
              <span style={{ color: STATUS_COLOR[r.status] ?? C.white, fontWeight: 600 }}>{r.status}</span>
              <span style={{ color: r.practice ? C.white : C.soft }}>{r.practice ?? "n/a"}</span>
              <span style={{ color: C.dim }}>{r.injury}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ───────────── Next-game intel (data.json nextGame) ───────────── */

function MatchupIntel({ title, teamLabel, g }: { title: string; teamLabel: string; g: NextGameIntel }) {
  const special = g.specialTeams ?? g.turnoverRatio;
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
        <h3 className="disp" style={{ margin: 0, fontSize: 22 }}>{title}</h3>
        <span style={{ color: C.dim, fontSize: 12 }}>Matchup Tale of the Tape</span>
      </div>
      <table>
        <thead>
          <tr><th className="l">Metric</th><th>{teamLabel}</th><th>{g.oppShortName}</th></tr>
        </thead>
        <tbody>
          {g.efficiency.map((e) => (
            <tr key={e.metric}><td className="l">{e.metric}</td><td className="num">{e.team}</td><td className="num">{e.opp}</td></tr>
          ))}
          {special && (
            <tr>
              <td className="l">{g.specialTeams ? "Special teams" : "Turnovers"}</td>
              <td className="num">{special.team}</td>
              <td className="num">{special.opp}</td>
            </tr>
          )}
        </tbody>
      </table>
      {special && <p style={{ margin: "6px 0 0", fontSize: 13, color: C.gold }}>{special.advantage}</p>}
    </div>
  );
}

/* ───────────── Playoff picture (data.json top-level team fields) ───────────── */

function Bars({ rows, keyLabel }: { rows: { label: string; pct: number }[]; keyLabel: string }) {
  return (
    <div role="list" aria-label={keyLabel}>
      {rows.map((r) => (
        <div key={r.label} role="listitem" style={{ display: "grid", gridTemplateColumns: "110px 1fr 44px", gap: 10, alignItems: "center", padding: "3px 0", fontSize: 13 }}>
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{r.label}</span>
          <span style={{ height: 8, background: C.soft, display: "block" }}>
            <span style={{ display: "block", height: "100%", width: `${r.pct}%`, background: C.royal, borderRight: `2px solid ${C.white}` }} />
          </span>
          <span className="num" style={{ textAlign: "right" }}>{r.pct}%</span>
        </div>
      ))}
    </div>
  );
}

function PlayoffPicture(p: PlayoffPictureProps) {
  const stats: { l: string; v: string }[] = [
    { l: "Make playoffs", v: `${p.makePlayoffs}%` },
    { l: "Win division", v: `${p.winDivision}%` },
    p.seed1 !== undefined ? { l: "Top seed", v: `${p.seed1}%` } : { l: "Wild card", v: `${p.wildcard}%` },
    { l: p.magicNumber ? "Magic number" : "Tragic number", v: p.magicNumber ?? p.tragicNumber ?? "n/a" },
  ];
  if (p.projectedPoints !== undefined) stats.push({ l: "Projected points", v: String(p.projectedPoints) });
  if (p.cutlinePoints !== undefined) stats.push({ l: "Cutline points", v: String(p.cutlinePoints) });
  if (p.seed1 !== undefined) {
    stats.push({ l: "Games Ahead", v: "+2.5" });
  } else {
    stats.push({ l: "Cutline Gap", v: "-2 PTS" });
  }
  return (
    <div style={{ minWidth: 0 }}>
      <h3 className="disp" style={{ margin: "0 0 6px", fontSize: 22 }}>{p.team}</h3>
      <div className="num" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}`, marginBottom: 8 }}>
        {stats.map((s, i) => (
          <div key={s.l} style={{ padding: "8px 10px", borderLeft: i ? `1px solid ${C.soft}` : 0 }}>
            <div style={{ fontSize: 11, color: C.dim, fontFamily: "Barlow, sans-serif" }}>{s.l}</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>{s.v}</div>
          </div>
        ))}
      </div>
      <p style={{ margin: "0 0 12px", fontSize: 13, color: p.clinchAlert.active ? C.gold : C.dim }}>
        {p.clinchAlert.active ? "Clinch alert: " : ""}{p.clinchAlert.scenario}
      </p>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: 20 }}>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Division odds</h4>
          <Bars keyLabel="Division odds" rows={p.divisionRadar.map((d) => ({ label: d.team, pct: d.pct }))} />
        </div>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Seed distribution</h4>
          <Bars keyLabel="Seed distribution" rows={p.seedDistribution.map((d) => ({ label: d.seed, pct: d.pct }))} />
        </div>
        <div>
          <h4 style={{ margin: "0 0 4px", fontSize: 13, fontWeight: 600 }}>Likeliest first-round opponents</h4>
          <Bars keyLabel="Opponent odds" rows={p.opponents.map((d) => ({ label: d.team, pct: d.pct }))} />
        </div>
      </div>
    </div>
  );
}

/* ───────────── Season schedule (data.json seasonSchedule) ───────────── */

function ScheduleStrip({ title, rows }: { title: string; rows: ScheduleEntry[] }) {
  const resColor = (r?: string | null) => (r === "W" ? C.gold : r === "L" || r === "OTL" ? "#FF8A9C" : C.dim);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 4, gap: 8, flexWrap: "wrap" }}>
        <h3 className="disp" style={{ margin: 0, fontSize: 22 }}>{title}</h3>
        <span style={{ color: C.dim, fontSize: 12 }}>Recent Results &amp; Upcoming</span>
      </div>
      <div>
        <table className="num w-full table-fixed">
          <thead>
            <tr>
              <th className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ width: "12%" }}>{rows[0]?.week !== undefined ? "Week" : "Game"}</th>
              <th className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ width: "24%" }}>Date</th>
              <th className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ fontFamily: "Barlow, sans-serif", width: "34%" }}>Opponent</th>
              <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ width: "16%" }}>Score</th>
              <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2" style={{ width: "14%" }}>Result</th>
              <th className="px-1.5 py-1 text-xs sm:px-3 sm:py-2 hidden md:table-cell" style={{ width: "18%" }}>Network</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const key = `${r.week ?? r.gameNumber}`;
              if (r.isBye) {
                return (
                  <tr key={key}>
                    <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2">{r.week}</td>
                    <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2" colSpan={5} style={{ color: C.dim, fontFamily: "Barlow, sans-serif" }}>{r.statusDetail}</td>
                  </tr>
                );
              }
              const done = r.statusState === "post";
              const fullDate = [r.dayOfWeek && r.dateFormatted ? `${r.dayOfWeek}, ${r.dateFormatted}` : (r.dateFormatted ?? r.date), r.timeFormatted]
                .filter(Boolean)
                .join(" • ");
              const shortDate = r.dateFormatted ?? r.date ?? "";
              return (
                <tr key={key}>
                  <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2">{r.week ?? r.gameNumber}</td>
                  <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2 truncate">
                    <span className="md:hidden">{shortDate}</span>
                    <span className="hidden md:inline">{fullDate}</span>
                  </td>
                  <td className="l px-1.5 py-1 text-xs sm:px-3 sm:py-2 truncate" style={{ fontFamily: "Barlow, sans-serif" }}>
                    {r.isHome ? "vs." : "at"} {r.opponent} <span className="num" style={{ color: C.dim }}>{r.oppAbbrev}</span>
                  </td>
                  <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2 whitespace-nowrap" style={{ color: done ? C.white : C.dim }}>
                    {done ? `${r.bufScore}-${r.oppScore}${r.outcome && r.outcome !== "REG" ? ` ${r.outcome}` : ""}` : "—"}
                  </td>
                  <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2 whitespace-nowrap" style={{ color: resColor(r.result), fontWeight: 600 }}>
                    {done ? (r.result ?? "—") : "—"}
                  </td>
                  <td className="px-1.5 py-1 text-xs sm:px-3 sm:py-2 whitespace-nowrap hidden md:table-cell">
                    {r.primeTime ? `${r.broadcast} (${r.primeTime})` : r.broadcast}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ───────────── Page ───────────── */

export default function Prompt_Test_Mockup() {
  const [filter, setFilter] = useState<TeamFilter>("all");
  const showBills = filter !== "sabres";
  const showSabres = filter !== "bills";
  const rooting = [
    ...(showBills ? NFL_OOT.map((g) => ({ ...g, league: "NFL" as const })) : []),
    ...(showSabres ? NHL_OOT.map((g) => ({ ...g, league: "NHL" as const })) : []),
  ];
  const two = showBills && showSabres;
  const splitStyle = { borderTop: `1px solid ${C.hair}`, paddingTop: 14 };

  return (
    <div className="ob">
      <style>{css}</style>
      <TelemetryBar filter={filter} onFilter={setFilter} />

      {showBills && <GameCenter {...GAME} />}
      {showSabres && <UpcomingGame {...UPCOMING} />}

      <section aria-label="Next game intel" className="sect">
        <div className="wrap">
          <SectionHead title="Next game intel" />
          <div className={two ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined} style={splitStyle}>
            {showBills && <div><MatchupIntel title="Bills at Vikings" teamLabel="Bills" g={BILLS_NEXT} /></div>}
            {showSabres && <div><MatchupIntel title="Sabres vs. Senators" teamLabel="Sabres" g={SABRES_NEXT} /></div>}
          </div>
        </div>
      </section>

      <section aria-label="Playoff picture" className="sect">
        <div className="wrap">
          <SectionHead title="Playoff picture" />
          <div className={two ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined} style={splitStyle}>
            {showBills && <div><PlayoffPicture {...BILLS_PICTURE} /></div>}
            {showSabres && <div><PlayoffPicture {...SABRES_PICTURE} /></div>}
          </div>
        </div>
      </section>

      <section aria-label="Division standings" className="sect">
        <div className="wrap">
          <SectionHead title="Division standings" />
          <div className={two ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined} style={splitStyle}>
            {showBills && <div><StandingsTable {...AFC_EAST} /></div>}
            {showSabres && <div><StandingsTable {...NHL_ATL} /></div>}
          </div>
        </div>
      </section>

      <section aria-label="Season schedule" className="sect">
        <div className="wrap">
          <SectionHead title="Season schedule" meta="Recent Results & Upcoming" />
          <div className={two ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined} style={splitStyle}>
            {showBills && <div><ScheduleStrip title="Bills" rows={BILLS_SCHEDULE} /></div>}
            {showSabres && <div><ScheduleStrip title="Sabres" rows={SABRES_SCHEDULE} /></div>}
          </div>
        </div>
      </section>

      <RootingStrip games={rooting} />

      <section aria-label="Injury and practice wire" className="sect">
        <div className="wrap">
          <SectionHead title="Injury and practice wire" />
          <div className={two ? "grid grid-cols-1 lg:grid-cols-2 gap-6" : undefined} style={splitStyle}>
            {showBills && <div><InjuryIntel {...BILLS_INJ} /></div>}
            {showSabres && <div><InjuryIntel {...SABRES_INJ} /></div>}
          </div>
        </div>
      </section>

      <footer
        className="w-full text-center border-t border-slate-800 bg-slate-950/60 py-6 px-4"
        style={{
          width: "100%",
          textAlign: "center",
          borderTop: "1px solid #1e293b",
          backgroundColor: "rgba(2, 6, 23, 0.6)",
          padding: "1.5rem 1rem",
        }}
      >
        <p
          className="text-xs text-slate-400 font-sans tracking-normal leading-relaxed text-center max-w-4xl mx-auto"
          style={{
            fontSize: "0.75rem",
            color: "#94a3b8",
            fontFamily: "'Barlow', system-ui, sans-serif",
            letterSpacing: "0em",
            lineHeight: 1.625,
            textAlign: "center",
            maxWidth: "56rem",
            margin: "0 auto",
          }}
        >
          {"One Buffalo Tracker is an independent fan dashboard and is not affiliated with, endorsed by, or sponsored by Pegula Sports & Entertainment, the Buffalo Bills, the Buffalo Sabres, the NFL, or the NHL."}
        </p>
      </footer>
    </div>
  );
}
