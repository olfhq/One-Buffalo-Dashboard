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

// Case 5: NLL Bandits matching live game
const swarmScoreboardEvent = {
  date: '2026-11-29T00:00Z',
  competitions: [{
    status: { type: { state: 'in', shortDetail: '3rd Qtr 8:42' } },
    competitors: [
      { id: '125429', homeAway: 'home', score: '9', team: { id: '125429', abbreviation: 'BUF', displayName: 'Buffalo Bandits' } },
      { id: '125425', homeAway: 'away', score: '7', team: { id: '125425', abbreviation: 'GA', displayName: 'Georgia Swarm', shortDisplayName: 'Swarm' } }
    ]
  }]
};

const swarmNextGame = {
  opponent: 'vs. Georgia Swarm',
  oppShortName: 'Swarm',
  oppId: '125425',
  isoTime: '2026-11-29T00:00Z',
  gameTime: 'Sat, Nov 28 • 7:00 PM ET'
};

const banditsMatchResult = isSameTeamGame(swarmScoreboardEvent, swarmNextGame, 'BUF');
assert.strictEqual(banditsMatchResult, true, 'Live NLL Swarm scoreboard event MUST match Bandits nextGame');
console.log('✓ Accepted matching live NLL Swarm game against Bandits nextGame');

// Case 6: NLL Bandits stale event rejection
const thunderbirdsNextGame = {
  opponent: '@ Halifax Thunderbirds',
  oppShortName: 'Thunderbirds',
  oppId: '125426',
  isoTime: '2026-12-19T23:00Z',
  gameTime: 'Sat, Dec 19 • 6:00 PM ET'
};

const banditsMismatchResult = isSameTeamGame(swarmScoreboardEvent, thunderbirdsNextGame, 'BUF');
assert.strictEqual(banditsMismatchResult, false, 'Stale NLL Swarm game must NOT match upcoming Thunderbirds nextGame');
console.log('✓ Rejected stale NLL Swarm scoreboard game against Thunderbirds nextGame');

console.log('\nAll live poll matching unit tests passed successfully.');
