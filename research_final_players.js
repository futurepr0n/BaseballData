#!/usr/bin/env node

const fs = require('fs');

/**
 * Research the final 3 players that need manual review
 * Uses improved web search with depth chart URLs
 */
class FinalPlayerResearch {
    constructor() {
        this.teamUrlMappings = {
            'ARI': 'diamondbacks', 'ATL': 'braves', 'BAL': 'orioles', 'BOS': 'redsox',
            'CHC': 'cubs', 'CHW': 'whitesox', 'CIN': 'reds', 'CLE': 'guardians',
            'COL': 'rockies', 'DET': 'tigers', 'HOU': 'astros', 'KC': 'royals',
            'LAA': 'angels', 'LAD': 'dodgers', 'MIA': 'marlins', 'MIL': 'brewers',
            'MIN': 'twins', 'NYM': 'mets', 'NYY': 'yankees', 'OAK': 'athletics',
            'PHI': 'phillies', 'PIT': 'pirates', 'SD': 'padres', 'SEA': 'mariners',
            'SF': 'giants', 'STL': 'cardinals', 'TB': 'rays', 'TEX': 'rangers',
            'TOR': 'bluejays', 'WSH': 'nationals'
        };

        this.finalPlayers = [
            { name: 'A. Cox', team: 'ATL', type: 'pitcher', note: 'Need full name research' },
            { name: 'A. Garcia', team: 'ARI', type: 'hitter', note: 'Previously confirmed as Aramis Garcia' },
            { name: 'A. Martinez', team: 'CLE', type: 'hitter', note: 'Previously confirmed as Angel Martinez' }
        ];

        this.confirmedResults = [
            {
                current_name: 'A. Garcia',
                team: 'ARI',
                confirmed_full_name: 'Aramis Garcia',
                confidence: 'high',
                source: 'previous web search confirmation'
            },
            {
                current_name: 'A. Martinez',
                team: 'CLE',
                confirmed_full_name: 'Angel Martinez',
                confidence: 'high',
                source: 'previous web search confirmation'
            }
        ];
    }

    /**
     * Research all final players
     */
    async researchFinalPlayers() {
        console.log('🔍 Final Player Name Research');
        console.log('============================\n');

        console.log('📋 Players needing research:');
        this.finalPlayers.forEach((player, idx) => {
            console.log(`${idx + 1}. ${player.name} (${player.team}, ${player.type}) - ${player.note}`);
        });

        console.log('\n✅ Confirmed results from previous research:');
        this.confirmedResults.forEach((result, idx) => {
            console.log(`${idx + 1}. ${result.current_name} (${result.team}) → ${result.confirmed_full_name}`);
        });

        // Generate research URLs for A. Cox (the only unresolved player)
        const coxPlayer = this.finalPlayers.find(p => p.name === 'A. Cox');
        if (coxPlayer) {
            console.log('\n🌐 Research URLs for A. Cox (ATL):');
            await this.generateSearchUrls(coxPlayer);
        }

        // Apply confirmed corrections
        await this.applyConfirmedCorrections();
    }

    /**
     * Generate search URLs for a player
     */
    async generateSearchUrls(player) {
        const teamUrlName = this.teamUrlMappings[player.team];
        
        const searchUrls = [
            `https://www.mlb.com/${teamUrlName}/roster/depth-chart`,
            `https://www.mlb.com/${teamUrlName}/roster/40-man`,
            `https://www.mlb.com/${teamUrlName}/roster`,
            `https://www.baseball-reference.com/teams/${player.team}/2025.shtml`,
            `https://www.espn.com/mlb/team/roster/_/name/${player.team.toLowerCase()}`
        ];

        searchUrls.forEach((url, idx) => {
            console.log(`   ${idx + 1}. ${url}`);
        });

        console.log('\n🔍 Search terms to look for:');
        console.log(`   - Players with first name starting with "A" and last name "Cox"`);
        console.log(`   - ${player.type} position`);
        console.log(`   - Atlanta Braves roster`);
    }

    /**
     * Apply confirmed corrections to the roster
     */
    async applyConfirmedCorrections() {
        console.log('\n🔧 Applying confirmed corrections...');

        try {
            // Load the corrected roster
            const rosterData = fs.readFileSync('./data/rosters_corrected.json', 'utf8');
            const roster = JSON.parse(rosterData);

            let appliedCount = 0;

            // Apply each confirmed correction
            this.confirmedResults.forEach(correction => {
                const playerIndex = roster.findIndex(player => 
                    player.name === correction.current_name && 
                    player.team === correction.team
                );

                if (playerIndex !== -1) {
                    const oldName = roster[playerIndex].fullName;
                    roster[playerIndex].fullName = correction.confirmed_full_name;
                    console.log(`✅ ${correction.current_name} (${correction.team}) → ${correction.confirmed_full_name}`);
                    appliedCount++;
                } else {
                    console.log(`⚠️  Player not found: ${correction.current_name} (${correction.team})`);
                }
            });

            // Save updated roster
            fs.writeFileSync('./data/rosters_final.json', JSON.stringify(roster, null, 2));
            console.log(`\n💾 Final roster saved with ${appliedCount} additional corrections`);

            // Generate final report
            await this.generateFinalReport(roster);

        } catch (error) {
            console.error('❌ Error applying corrections:', error.message);
        }
    }

    /**
     * Generate final quality report
     */
    async generateFinalReport(roster) {
        console.log('\n📊 Final Roster Quality Report');
        console.log('==============================');

        const abbreviatedPattern = /^[A-Z]\.\s+[A-Za-z]+/;
        const abbreviatedCount = roster.filter(player => 
            player.fullName && abbreviatedPattern.test(player.fullName)
        ).length;

        const totalPlayers = roster.length;
        const completeNames = roster.filter(player => 
            player.fullName && !abbreviatedPattern.test(player.fullName)
        ).length;

        const qualityScore = Math.round((completeNames / totalPlayers) * 100);

        console.log(`Total Players: ${totalPlayers}`);
        console.log(`Complete Names: ${completeNames} (${((completeNames/totalPlayers)*100).toFixed(1)}%)`);
        console.log(`Abbreviated Names: ${abbreviatedCount} (${((abbreviatedCount/totalPlayers)*100).toFixed(1)}%)`);
        console.log(`Quality Score: ${qualityScore}/100`);

        const report = {
            timestamp: new Date().toISOString(),
            final_statistics: {
                total_players: totalPlayers,
                complete_names: completeNames,
                abbreviated_names: abbreviatedCount,
                quality_score: qualityScore,
                completion_percentage: ((completeNames/totalPlayers)*100).toFixed(1)
            },
            confirmed_corrections: this.confirmedResults,
            remaining_research: abbreviatedCount > 0 ? ['A. Cox (ATL) - needs manual research'] : [],
            next_steps: abbreviatedCount === 0 ? 
                ['✅ All names resolved!'] : 
                ['Research A. Cox full name using provided URLs', 'Replace original roster when complete']
        };

        fs.writeFileSync('./final_roster_quality_report.json', JSON.stringify(report, null, 2));
        console.log('\n💾 Final report saved to: final_roster_quality_report.json');

        if (abbreviatedCount <= 1) {
            console.log('\n🎉 SUCCESS: Roster name normalization nearly complete!');
            console.log('Only 1 player requires manual research.');
        }
    }

    /**
     * Run the research process
     */
    async run() {
        await this.researchFinalPlayers();
    }
}

// Execute if run directly
if (require.main === module) {
    const researcher = new FinalPlayerResearch();
    researcher.run().catch(error => {
        console.error('💥 Research failed:', error);
        process.exit(1);
    });
}

module.exports = FinalPlayerResearch;