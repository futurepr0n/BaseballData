#!/usr/bin/env node

const fs = require('fs');

/**
 * Clean up roster by removing players with zero game participation
 * Based on participation analysis findings
 */
class RosterCleanup {
    constructor() {
        this.rosterFile = './data/rosters.json';
        this.backupFile = './data/rosters_before_cleanup.json';
        this.dropCandidatesFile = './drop_candidates.csv';
        this.cleanupReport = {
            timestamp: new Date().toISOString(),
            players_removed: [],
            players_kept: [],
            quality_improvement: {},
            summary: {}
        };
    }

    /**
     * Load drop candidates from CSV
     */
    loadDropCandidates() {
        console.log('📋 Loading drop candidates...');
        
        try {
            const csvData = fs.readFileSync(this.dropCandidatesFile, 'utf8');
            const lines = csvData.split('\n').slice(1); // Skip header
            
            const dropCandidates = new Set();
            
            lines.forEach(line => {
                if (line.trim()) {
                    // Parse CSV line: "Name","Team","Type","GamesAppeared","LastSeen","DropReason"
                    const match = line.match(/"([^"]+)","([^"]+)","([^"]+)","(\d+)","([^"]+)","([^"]+)"/);
                    if (match) {
                        const [, name, team, type] = match;
                        const playerKey = `${name}_${team}_${type}`;
                        dropCandidates.add(playerKey);
                    }
                }
            });
            
            console.log(`✅ Found ${dropCandidates.size} players to remove`);
            return dropCandidates;
            
        } catch (error) {
            console.error('❌ Error loading drop candidates:', error.message);
            throw error;
        }
    }

    /**
     * Load current roster
     */
    loadRoster() {
        console.log('📁 Loading current roster...');
        
        try {
            const rosterData = fs.readFileSync(this.rosterFile, 'utf8');
            const roster = JSON.parse(rosterData);
            
            console.log(`✅ Loaded ${roster.length} total players`);
            return roster;
            
        } catch (error) {
            console.error('❌ Error loading roster:', error.message);
            throw error;
        }
    }

    /**
     * Create backup of current roster
     */
    createBackup(roster) {
        console.log('💾 Creating backup...');
        
        try {
            fs.writeFileSync(this.backupFile, JSON.stringify(roster, null, 2));
            console.log(`✅ Backup created: ${this.backupFile}`);
            
        } catch (error) {
            console.error('❌ Error creating backup:', error.message);
            throw error;
        }
    }

    /**
     * Analyze roster quality before cleanup
     */
    analyzeRosterQuality(roster) {
        const analysis = {
            total_players: roster.length,
            abbreviated_names: 0,
            complete_names: 0,
            missing_fullname: 0,
            invalid_teams: 0,
            duplicates: 0
        };

        const namePattern = /^[A-Z]\.\s+[A-Za-z]+/;
        const validTeams = new Set([
            'ARI', 'ATL', 'BAL', 'BOS', 'CHC', 'CHW', 'CIN', 'CLE', 'COL', 'DET',
            'HOU', 'KC', 'LAA', 'LAD', 'MIA', 'MIL', 'MIN', 'NYM', 'NYY', 'OAK',
            'PHI', 'PIT', 'SD', 'SEA', 'SF', 'STL', 'TB', 'TEX', 'TOR', 'WSH'
        ]);

        const playerKeys = new Set();

        roster.forEach(player => {
            // Check for abbreviated names
            if (player.fullName && namePattern.test(player.fullName)) {
                analysis.abbreviated_names++;
            } else if (player.fullName) {
                analysis.complete_names++;
            } else {
                analysis.missing_fullname++;
            }

            // Check for invalid teams
            if (!validTeams.has(player.team)) {
                analysis.invalid_teams++;
            }

            // Check for duplicates
            const playerKey = `${player.name}_${player.team}_${player.type}`;
            if (playerKeys.has(playerKey)) {
                analysis.duplicates++;
            } else {
                playerKeys.add(playerKey);
            }
        });

        const qualityScore = Math.round(
            ((analysis.complete_names + analysis.missing_fullname) / analysis.total_players) * 100
        );

        return { ...analysis, quality_score: qualityScore };
    }

    /**
     * Clean up roster by removing inactive players
     */
    cleanupRoster(roster, dropCandidates) {
        console.log('🧹 Cleaning up roster...');
        
        const cleanedRoster = [];
        let removedCount = 0;

        roster.forEach(player => {
            const playerKey = `${player.name}_${player.team}_${player.type}`;
            
            if (dropCandidates.has(playerKey)) {
                // This player should be removed
                this.cleanupReport.players_removed.push({
                    name: player.name,
                    team: player.team,
                    type: player.type,
                    fullName: player.fullName,
                    reason: 'zero_game_participation'
                });
                removedCount++;
            } else {
                // Keep this player
                cleanedRoster.push(player);
                this.cleanupReport.players_kept.push({
                    name: player.name,
                    team: player.team,
                    type: player.type,
                    fullName: player.fullName
                });
            }
        });

        console.log(`✅ Removed ${removedCount} inactive players`);
        console.log(`✅ Kept ${cleanedRoster.length} active players`);

        return cleanedRoster;
    }

    /**
     * Save cleaned roster
     */
    saveCleanedRoster(cleanedRoster) {
        console.log('💾 Saving cleaned roster...');
        
        try {
            fs.writeFileSync(this.rosterFile, JSON.stringify(cleanedRoster, null, 2));
            console.log(`✅ Cleaned roster saved to: ${this.rosterFile}`);
            
        } catch (error) {
            console.error('❌ Error saving cleaned roster:', error.message);
            throw error;
        }
    }

    /**
     * Generate cleanup report
     */
    generateReport(beforeQuality, afterQuality) {
        console.log('\n📊 ROSTER CLEANUP REPORT');
        console.log('========================');
        
        this.cleanupReport.summary = {
            total_players_before: beforeQuality.total_players,
            total_players_after: afterQuality.total_players,
            players_removed: this.cleanupReport.players_removed.length,
            removal_percentage: ((this.cleanupReport.players_removed.length / beforeQuality.total_players) * 100).toFixed(1)
        };

        this.cleanupReport.quality_improvement = {
            quality_score_before: beforeQuality.quality_score,
            quality_score_after: afterQuality.quality_score,
            improvement: afterQuality.quality_score - beforeQuality.quality_score,
            abbreviated_names_before: beforeQuality.abbreviated_names,
            abbreviated_names_after: afterQuality.abbreviated_names,
            abbreviated_reduction: beforeQuality.abbreviated_names - afterQuality.abbreviated_names
        };

        console.log(`Players Before: ${beforeQuality.total_players}`);
        console.log(`Players After:  ${afterQuality.total_players}`);
        console.log(`Players Removed: ${this.cleanupReport.players_removed.length} (${this.cleanupReport.summary.removal_percentage}%)`);
        console.log(`\nQuality Score Before: ${beforeQuality.quality_score}/100`);
        console.log(`Quality Score After:  ${afterQuality.quality_score}/100`);
        console.log(`Quality Improvement:  +${this.cleanupReport.quality_improvement.improvement} points`);
        console.log(`\nAbbreviated Names Before: ${beforeQuality.abbreviated_names}`);
        console.log(`Abbreviated Names After:  ${afterQuality.abbreviated_names}`);
        console.log(`Abbreviated Reduction:    ${this.cleanupReport.quality_improvement.abbreviated_reduction} names`);

        // Save detailed report
        const reportFile = './roster_cleanup_report.json';
        fs.writeFileSync(reportFile, JSON.stringify(this.cleanupReport, null, 2));
        console.log(`\n💾 Detailed report saved to: ${reportFile}`);
    }

    /**
     * Run complete cleanup process
     */
    async run() {
        console.log('🧹 Starting Roster Cleanup Process');
        console.log('===================================\n');

        try {
            // Load data
            const dropCandidates = this.loadDropCandidates();
            const roster = this.loadRoster();

            // Analyze quality before cleanup
            const beforeQuality = this.analyzeRosterQuality(roster);
            console.log(`\n📊 Current roster quality: ${beforeQuality.quality_score}/100`);
            console.log(`   Abbreviated names: ${beforeQuality.abbreviated_names}`);
            console.log(`   Complete names: ${beforeQuality.complete_names}`);

            // Create backup
            this.createBackup(roster);

            // Clean up roster
            const cleanedRoster = this.cleanupRoster(roster, dropCandidates);

            // Analyze quality after cleanup
            const afterQuality = this.analyzeRosterQuality(cleanedRoster);

            // Save cleaned roster
            this.saveCleanedRoster(cleanedRoster);

            // Generate report
            this.generateReport(beforeQuality, afterQuality);

            console.log('\n✅ Roster cleanup completed successfully!');
            console.log(`\n🎯 NEXT STEPS:`);
            console.log(`1. Review remaining ${afterQuality.abbreviated_names} abbreviated names`);
            console.log(`2. Use improved web search for any active players if needed`);
            console.log(`3. Run application tests to verify roster compatibility`);

        } catch (error) {
            console.error('💥 Cleanup failed:', error.message);
            throw error;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const cleanup = new RosterCleanup();
    cleanup.run().catch(error => {
        console.error('💥 Cleanup failed:', error);
        process.exit(1);
    });
}

module.exports = RosterCleanup;