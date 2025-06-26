#!/usr/bin/env node

const fs = require('fs');

/**
 * Final analysis of cleaned roster to identify remaining issues
 */
class FinalRosterAnalysis {
    constructor() {
        this.rosterFile = './data/rosters.json';
    }

    /**
     * Load and analyze the cleaned roster
     */
    analyzeCleanedRoster() {
        console.log('📊 Final Roster Analysis After Cleanup');
        console.log('======================================\n');

        try {
            const rosterData = fs.readFileSync(this.rosterFile, 'utf8');
            const roster = JSON.parse(rosterData);

            console.log(`📋 Total players after cleanup: ${roster.length}`);

            // Find remaining abbreviated names
            const abbreviatedPattern = /^[A-Z]\.\s+[A-Za-z]+/;
            const abbreviatedPlayers = roster.filter(player => 
                player.fullName && abbreviatedPattern.test(player.fullName)
            );

            console.log(`🔍 Remaining abbreviated names: ${abbreviatedPlayers.length}`);

            if (abbreviatedPlayers.length > 0) {
                console.log('\n🎯 Sample of remaining abbreviated players:');
                abbreviatedPlayers.slice(0, 20).forEach((player, idx) => {
                    console.log(`${(idx + 1).toString().padStart(2)}. ${player.fullName} (${player.team}, ${player.type})`);
                });

                if (abbreviatedPlayers.length > 20) {
                    console.log(`... and ${abbreviatedPlayers.length - 20} more`);
                }
            }

            // Analyze by team
            const teamStats = {};
            abbreviatedPlayers.forEach(player => {
                if (!teamStats[player.team]) {
                    teamStats[player.team] = { hitters: 0, pitchers: 0, total: 0 };
                }
                teamStats[player.team][player.type]++;
                teamStats[player.team].total++;
            });

            console.log('\n📊 Abbreviated names by team:');
            Object.entries(teamStats)
                .sort(([,a], [,b]) => b.total - a.total)
                .slice(0, 10)
                .forEach(([team, stats]) => {
                    console.log(`${team}: ${stats.total} (${stats.hitters}H, ${stats.pitchers}P)`);
                });

            // Generate summary
            const summary = {
                total_players: roster.length,
                remaining_abbreviated: abbreviatedPlayers.length,
                percentage_abbreviated: ((abbreviatedPlayers.length / roster.length) * 100).toFixed(1),
                by_type: {
                    hitters: abbreviatedPlayers.filter(p => p.type === 'hitter').length,
                    pitchers: abbreviatedPlayers.filter(p => p.type === 'pitcher').length
                },
                top_teams: Object.entries(teamStats)
                    .sort(([,a], [,b]) => b.total - a.total)
                    .slice(0, 5)
                    .map(([team, stats]) => ({ team, count: stats.total }))
            };

            console.log('\n📈 FINAL SUMMARY:');
            console.log(`Total players: ${summary.total_players}`);
            console.log(`Abbreviated names: ${summary.remaining_abbreviated} (${summary.percentage_abbreviated}%)`);
            console.log(`Hitters: ${summary.by_type.hitters}`);
            console.log(`Pitchers: ${summary.by_type.pitchers}`);

            console.log('\n🎯 RECOMMENDATIONS:');
            if (summary.remaining_abbreviated > 0) {
                console.log(`1. Apply correct_roster_names.js to fix ${summary.remaining_abbreviated} remaining names`);
                console.log(`2. Use improved web search for any unresolved players`);
                console.log(`3. Consider manual research for high-profile players`);
            } else {
                console.log('✅ All abbreviated names have been resolved!');
            }

            // Save analysis
            fs.writeFileSync('./final_roster_analysis.json', JSON.stringify({
                timestamp: new Date().toISOString(),
                summary,
                abbreviated_players: abbreviatedPlayers.slice(0, 50), // Save sample
                team_breakdown: teamStats
            }, null, 2));

            console.log('\n💾 Analysis saved to: final_roster_analysis.json');

            return summary;

        } catch (error) {
            console.error('❌ Error analyzing roster:', error.message);
            throw error;
        }
    }

    /**
     * Run the analysis
     */
    run() {
        return this.analyzeCleanedRoster();
    }
}

// Execute if run directly
if (require.main === module) {
    const analyzer = new FinalRosterAnalysis();
    analyzer.run();
}

module.exports = FinalRosterAnalysis;