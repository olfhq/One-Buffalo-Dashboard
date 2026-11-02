// test/test_live_poll_match.js
const assert = require('assert');
const fs = require('fs');

const sharedJs = fs.readFileSync('assets/shared.js', 'utf8');
const fnSameGameMatch = sharedJs.match(/function isSameTeamGame\([\s\S]*?^    \}/m)[0];
eval(fnSameGameMatch);

console.log('=== Testing live scoreboard event matching (isSameTeamGame) ===');

// Case 1: Yesterday's Ravens game vs. Next Week's Vikings game (The reported bug)
const ravensScoreboardEvent = {
  date: '2026-11-01T18:00Z',
  competitions: [{
    status: { type: { state: 'post', shortDetail: 'Final' } },
    competitors: [
      { id: '2', homeAway: 'home', score: '36', team: { id: '2', abbreviation: 'BUF', displayName: 'Buffalo Bills' } },
      { id: '33', homeAway: 'away', score: '10', team: { id: '33', abbreviation: 'BAL', displayName: 'Baltimore Ravens', shortDisplayName: 'Ravens' } }
    ]
  }]
};

const vikingsNextGame = {
  opponent: '@ Vikings',
  oppShortName: 'Vikings',
  oppId: '16',
  isoTime: '2026-11-09T01:15Z',
  gameTime: 'Mon, Nov 9 • 8:15 PM ET'
};

const mismatchResult = isSameTeamGame(ravensScoreboardEvent, vikingsNextGame, 'BUF');
assert.strictEqual(mismatchResult, false, 'Scoreboard Ravens game must NOT match upcoming Vikings nextGame');
console.log('✓ Rejected stale Ravens scoreboard game against upcoming Vikings nextGame');

// Case 2: Matching active game
const vikingsScoreboardEvent = {
  date: '2026-11-09T01:15Z',
  competitions: [{
    status: { type: { state: 'in', shortDetail: '2nd 10:14' } },
    competitors: [
      { id: '16', homeAway: 'home', score: '7', team: { id: '16', abbreviation: 'MIN', displayName: 'Minnesota Vikings', shortDisplayName: 'Vikings' } },
      { id: '2', homeAway: 'away', score: '10', team: { id: '2', abbreviation: 'BUF', displayName: 'Buffalo Bills' } }
    ]
  }]
};

const matchResult = isSameTeamGame(vikingsScoreboardEvent, vikingsNextGame, 'BUF');
assert.strictEqual(matchResult, true, 'Live Vikings scoreboard event MUST match Vikings nextGame');
console.log('✓ Accepted matching live Vikings game against Vikings nextGame');

// Case 3: Same day completed game for the same opponent (before nextGame rolls over)
const ravensNextGame = {
  opponent: 'vs. Ravens',
  oppShortName: 'Ravens',
  oppId: '33',
  isoTime: '2026-11-01T18:00Z',
  gameTime: 'Sun, Nov 1 • 1:00 PM ET'
};

const ravensMatchResult = isSameTeamGame(ravensScoreboardEvent, ravensNextGame, 'BUF');
assert.strictEqual(ravensMatchResult, true, 'Scoreboard Ravens game matches Ravens nextGame on game day');
console.log('✓ Accepted completed Ravens game when nextGame is Ravens on game day');

// Case 4: NHL Sabres stale event rejection
const redWingsScoreboardEvent = {
  date: '2026-10-22T23:00Z',
  competitions: [{
    status: { type: { state: 'post', shortDetail: 'Final' } },
    competitors: [
      { id: '2', homeAway: 'home', score: '4', team: { id: '2', abbreviation: 'BUF', displayName: 'Buffalo Sabres' } },
      { id: '17', homeAway: 'away', score: '2', team: { id: '17', abbreviation: 'DET', displayName: 'Detroit Red Wings', shortDisplayName: 'Red Wings' } }
    ]
  }]
};

const capitalsNextGame = {
  opponent: 'vs. Capitals',
  oppShortName: 'Capitals',
  isoTime: '2026-10-25T23:00Z',
  gameTime: 'Sat, Oct 25 • 7:00 PM ET'
};

const nhlMismatchResult = isSameTeamGame(redWingsScoreboardEvent, capitalsNextGame, 'BUF');
assert.strictEqual(nhlMismatchResult, false, 'Scoreboard Red Wings game must NOT match Capitals nextGame');
console.log('✓ Rejected stale NHL Red Wings scoreboard game against Capitals nextGame');

console.log('\nAll live poll matching unit tests passed successfully.');
