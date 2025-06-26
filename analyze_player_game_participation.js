#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

/**
 * Analyze game participation frequency for abbreviated name players
 * Scans daily JSON files to determine how often players appear in games
 */
class PlayerGameParticipationAnalyzer {
    constructor() {
        this.participationData = {
            timestamp: new Date().toISOString(),
            total_abbreviated_players: 0,
            total_files_scanned: 0,
            total_games_found: 0,
            player_participation: new Map(),
            participation_summary: {},
            low_activity_players: [],
            high_activity_players: [],
            missing_players: [],
            date_range: { start: null, end: null }
        };
        
        this.dataPath = './data/2025';
    }

    /**
     * Get list of remaining abbreviated name players
     */
    getRemainingAbbreviatedPlayers() {
        console.log('📋 Loading remaining abbreviated name players...');
        
        try {
            // Load the web-updated roster to see which players still need fixes
            const rosterData = fs.readFileSync('./data/rosters_web_updated.json', 'utf8');
            const roster = JSON.parse(rosterData);
            
            // Find players with abbreviated fullNames (still in "X. LastName" format)
            const abbreviatedPlayers = roster.filter(player => {
                if (!player.fullName) return false;
                return /^[A-Z]\.\s+[A-Za-z]+/.test(player.fullName);
            });
            
            console.log(`✅ Found ${abbreviatedPlayers.length} players with abbreviated names`);
            this.participationData.total_abbreviated_players = abbreviatedPlayers.length;
            
            // Initialize participation tracking
            abbreviatedPlayers.forEach(player => {
                const playerKey = `${player.name}_${player.team}_${player.type}`;
                this.participationData.player_participation.set(playerKey, {
                    player: player,
                    games_appeared: 0,
                    dates_appeared: [],
                    teams_appeared_with: new Set(),
                    positions_played: new Set(),
                    total_stats_records: 0
                });
            });
            
            return abbreviatedPlayers;
            
        } catch (error) {
            console.error('❌ Error loading abbreviated players:', error.message);
            throw error;
        }
    }

    /**
     * Scan all daily JSON files to find player appearances
     */
    async scanDailyFiles() {
        console.log(`📁 Scanning daily JSON files in ${this.dataPath}...`);
        
        try {
            // Get all month directories
            const yearPath = this.dataPath;
            if (!fs.existsSync(yearPath)) {
                console.error(`❌ Directory not found: ${yearPath}`);
                return;
            }
            
            const monthDirs = fs.readdirSync(yearPath).filter(dir => {
                const fullPath = path.join(yearPath, dir);
                return fs.statSync(fullPath).isDirectory();
            }).sort();
            
            console.log(`📅 Found ${monthDirs.length} month directories: ${monthDirs.join(', ')}`);
            
            let totalFilesScanned = 0;
            
            for (const monthDir of monthDirs) {
                const monthPath = path.join(yearPath, monthDir);
                console.log(`\n📂 Processing month: ${monthDir}`);
                
                // Get all JSON files in this month
                const files = fs.readdirSync(monthPath).filter(file => file.endsWith('.json')).sort();
                
                console.log(`   Found ${files.length} JSON files`);
                
                for (const file of files) {
                    const filePath = path.join(monthPath, file);
                    await this.scanSingleFile(filePath, file);
                    totalFilesScanned++;
                    
                    // Progress indicator
                    if (totalFilesScanned % 10 === 0) {
                        console.log(`   Processed ${totalFilesScanned} files...`);
                    }
                }
            }
            
            this.participationData.total_files_scanned = totalFilesScanned;
            console.log(`\n✅ Completed scanning ${totalFilesScanned} daily files`);
            
        } catch (error) {
            console.error('❌ Error scanning daily files:', error.message);
            throw error;
        }
    }

    /**
     * Scan a single daily JSON file for player appearances
     */
    async scanSingleFile(filePath, fileName) {
        try {
            const fileData = fs.readFileSync(filePath, 'utf8');
            const dailyData = JSON.parse(fileData);
            
            // Extract date from filename (format: month_DD_YYYY.json)
            const dateMatch = fileName.match(/(\w+)_(\d{2})_(\d{4})\.json/);
            if (!dateMatch) return;
            
            const [, month, day, year] = dateMatch;
            const dateStr = `${year}-${this.getMonthNumber(month)}-${day}`;
            
            // Track date range
            if (!this.participationData.date_range.start || dateStr < this.participationData.date_range.start) {
                this.participationData.date_range.start = dateStr;
            }
            if (!this.participationData.date_range.end || dateStr > this.participationData.date_range.end) {
                this.participationData.date_range.end = dateStr;
            }
            
            // Check if this file has game data
            if (!dailyData.games || !Array.isArray(dailyData.games)) {
                return;
            }
            
            this.participationData.total_games_found += dailyData.games.length;
            
            // Scan each game for our abbreviated players
            for (const game of dailyData.games) {
                this.scanGameForPlayers(game, dateStr);
            }
            
        } catch (error) {
            // Skip files with parsing errors (they might be corrupted or different format)
            return;
        }
    }

    /**
     * Scan a single game for our abbreviated name players
     */
    scanGameForPlayers(game, dateStr) {
        // Check various possible locations for player data
        const playerSources = [
            game.home_team_players || [],
            game.away_team_players || [],
            game.players || [],
            game.home_lineup || [],
            game.away_lineup || [],
            game.pitchers || [],
            game.batters || []
        ];
        
        // Also check nested team data
        if (game.home_team && game.home_team.players) {
            playerSources.push(game.home_team.players);
        }
        if (game.away_team && game.away_team.players) {
            playerSources.push(game.away_team.players);
        }
        
        // Flatten all player sources
        const allPlayers = playerSources.flat().filter(player => player && player.name);
        
        // Check each player against our abbreviated list
        for (const gamePlayer of allPlayers) {
            this.checkPlayerParticipation(gamePlayer, dateStr);
        }
    }

    /**
     * Check if a game player matches one of our abbreviated players
     */
    checkPlayerParticipation(gamePlayer, dateStr) {
        // Try different matching strategies
        const matchingStrategies = [
            `${gamePlayer.name}_${gamePlayer.team}_${gamePlayer.type}`,
            `${gamePlayer.name}_${gamePlayer.team}_hitter`,
            `${gamePlayer.name}_${gamePlayer.team}_pitcher`,
            `${gamePlayer.name}_${gamePlayer.Team}_${gamePlayer.type}`, // Capital T variation
            `${gamePlayer.name}_${gamePlayer.Team}_hitter`,
            `${gamePlayer.name}_${gamePlayer.Team}_pitcher`
        ];
        
        for (const key of matchingStrategies) {
            if (this.participationData.player_participation.has(key)) {
                const participationRecord = this.participationData.player_participation.get(key);
                
                // Update participation data
                participationRecord.games_appeared++;
                participationRecord.dates_appeared.push(dateStr);
                participationRecord.teams_appeared_with.add(gamePlayer.team || gamePlayer.Team);
                participationRecord.total_stats_records++;
                
                // Track positions if available
                if (gamePlayer.position) {
                    participationRecord.positions_played.add(gamePlayer.position);
                }
                if (gamePlayer.type) {
                    participationRecord.positions_played.add(gamePlayer.type);
                }
                
                break; // Found a match, no need to try other strategies
            }
        }
    }

    /**
     * Convert month name to number (zero-padded)
     */
    getMonthNumber(monthName) {
        const months = {
            'january': '01', 'february': '02', 'march': '03', 'april': '04',
            'may': '05', 'june': '06', 'july': '07', 'august': '08',
            'september': '09', 'october': '10', 'november': '11', 'december': '12'
        };
        return months[monthName.toLowerCase()] || '01';
    }

    /**
     * Analyze participation patterns and generate summary
     */
    analyzeParticipationPatterns() {
        console.log('\n📊 Analyzing participation patterns...');
        
        const participationCounts = {
            '0_games': [],
            '1-5_games': [],
            '6-15_games': [],
            '16-30_games': [],
            '31-50_games': [],
            '51+_games': []
        };
        
        const highActivityThreshold = 31;
        const lowActivityThreshold = 5;
        
        // Categorize players by participation level
        for (const [playerKey, data] of this.participationData.player_participation) {
            const gamesCount = data.games_appeared;
            
            // Categorize by game count
            if (gamesCount === 0) {
                participationCounts['0_games'].push(data);
                this.participationData.missing_players.push(data);
            } else if (gamesCount <= 5) {
                participationCounts['1-5_games'].push(data);
                if (gamesCount <= lowActivityThreshold) {
                    this.participationData.low_activity_players.push(data);
                }
            } else if (gamesCount <= 15) {
                participationCounts['6-15_games'].push(data);
            } else if (gamesCount <= 30) {
                participationCounts['16-30_games'].push(data);
            } else if (gamesCount <= 50) {
                participationCounts['31-50_games'].push(data);
                if (gamesCount >= highActivityThreshold) {
                    this.participationData.high_activity_players.push(data);
                }
            } else {
                participationCounts['51+_games'].push(data);
                this.participationData.high_activity_players.push(data);
            }
        }
        
        this.participationData.participation_summary = {
            by_game_count: participationCounts,
            thresholds: {
                high_activity: highActivityThreshold,
                low_activity: lowActivityThreshold
            },
            recommendations: {
                drop_candidates: this.participationData.missing_players.length + this.participationData.low_activity_players.length,
                research_priority: this.participationData.high_activity_players.length,
                total_abbreviated: this.participationData.total_abbreviated_players
            }
        };
        
        console.log('✅ Participation analysis complete');
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('\n📋 PLAYER GAME PARTICIPATION ANALYSIS');
        console.log('====================================');
        console.log(`Analysis Period: ${this.participationData.date_range.start} to ${this.participationData.date_range.end}`);
        console.log(`Files Scanned: ${this.participationData.total_files_scanned}`);
        console.log(`Games Found: ${this.participationData.total_games_found}`);
        console.log(`Abbreviated Players Analyzed: ${this.participationData.total_abbreviated_players}`);
        
        console.log('\n📊 PARTICIPATION BREAKDOWN:');
        Object.entries(this.participationData.participation_summary.by_game_count).forEach(([range, players]) => {
            console.log(`${range.padEnd(15)}: ${players.length.toString().padStart(3)} players`);
        });
        
        console.log('\n🎯 RECOMMENDATIONS:');
        const rec = this.participationData.participation_summary.recommendations;
        console.log(`Drop Candidates (≤5 games): ${rec.drop_candidates} players`);
        console.log(`Research Priority (≥31 games): ${rec.research_priority} players`);
        console.log(`Total Remaining: ${rec.total_abbreviated} players`);
        
        if (this.participationData.high_activity_players.length > 0) {
            console.log('\n⭐ HIGH ACTIVITY PLAYERS (Priority Research):');
            this.participationData.high_activity_players
                .sort((a, b) => b.games_appeared - a.games_appeared)
                .slice(0, 15)
                .forEach((data, idx) => {
                    console.log(`${(idx + 1).toString().padStart(2)}. ${data.player.name} (${data.player.team}, ${data.player.type}) - ${data.games_appeared} games`);
                });
            
            if (this.participationData.high_activity_players.length > 15) {
                console.log(`... and ${this.participationData.high_activity_players.length - 15} more high-activity players`);
            }
        }
        
        if (this.participationData.low_activity_players.length > 0) {
            console.log('\n❌ LOW ACTIVITY PLAYERS (Drop Candidates):');
            this.participationData.low_activity_players
                .sort((a, b) => a.games_appeared - b.games_appeared)
                .slice(0, 15)
                .forEach((data, idx) => {
                    const gamesText = data.games_appeared === 0 ? 'No games' : `${data.games_appeared} games`;
                    console.log(`${(idx + 1).toString().padStart(2)}. ${data.player.name} (${data.player.team}, ${data.player.type}) - ${gamesText}`);
                });
            
            if (this.participationData.low_activity_players.length > 15) {
                console.log(`... and ${this.participationData.low_activity_players.length - 15} more low-activity players`);
            }
        }
        
        console.log('\n📈 ACTIVITY DISTRIBUTION:');
        const total = this.participationData.total_abbreviated_players;
        Object.entries(this.participationData.participation_summary.by_game_count).forEach(([range, players]) => {
            const percentage = ((players.length / total) * 100).toFixed(1);
            console.log(`${range.padEnd(15)}: ${percentage.padStart(5)}% (${players.length} players)`);
        });
    }

    /**
     * Save detailed results to files
     */
    saveResults() {
        console.log('\n💾 Saving analysis results...');
        
        // Convert Map to object for JSON serialization
        const participationArray = Array.from(this.participationData.player_participation.entries()).map(([key, data]) => ({
            playerKey: key,
            player: data.player,
            games_appeared: data.games_appeared,
            dates_appeared: data.dates_appeared,
            teams_appeared_with: Array.from(data.teams_appeared_with),
            positions_played: Array.from(data.positions_played),
            total_stats_records: data.total_stats_records
        }));
        
        const reportData = {
            ...this.participationData,
            player_participation: participationArray
        };
        
        // Save comprehensive report
        const reportFile = './player_participation_analysis.json';
        fs.writeFileSync(reportFile, JSON.stringify(reportData, null, 2));
        console.log(`✅ Detailed report saved to: ${reportFile}`);
        
        // Save drop candidates CSV
        const dropCandidates = [...this.participationData.missing_players, ...this.participationData.low_activity_players];
        const csvHeaders = 'Name,Team,Type,GamesAppeared,LastSeen,DropReason\n';
        const csvRows = dropCandidates.map(data => {
            const lastSeen = data.dates_appeared.length > 0 ? data.dates_appeared[data.dates_appeared.length - 1] : 'Never';
            const reason = data.games_appeared === 0 ? 'Never appeared' : 'Low activity';
            return `"${data.player.name}","${data.player.team}","${data.player.type}","${data.games_appeared}","${lastSeen}","${reason}"`;
        }).join('\n');
        
        const dropFile = './drop_candidates.csv';
        fs.writeFileSync(dropFile, csvHeaders + csvRows);
        console.log(`✅ Drop candidates saved to: ${dropFile}`);
        
        // Save priority research CSV
        const priorityCandidates = this.participationData.high_activity_players.sort((a, b) => b.games_appeared - a.games_appeared);
        const priorityHeaders = 'Name,Team,Type,GamesAppeared,DatesRange,Priority\n';
        const priorityRows = priorityCandidates.map(data => {
            const dateRange = data.dates_appeared.length > 0 ? 
                `${data.dates_appeared[0]} to ${data.dates_appeared[data.dates_appeared.length - 1]}` : 'No dates';
            return `"${data.player.name}","${data.player.team}","${data.player.type}","${data.games_appeared}","${dateRange}","High"`;
        }).join('\n');
        
        const priorityFile = './priority_research_candidates.csv';
        fs.writeFileSync(priorityFile, priorityHeaders + priorityRows);
        console.log(`✅ Priority research list saved to: ${priorityFile}`);
    }

    /**
     * Run complete participation analysis
     */
    async run() {
        console.log('🔍 Starting Player Game Participation Analysis');
        console.log('==============================================\n');
        
        try {
            // Get list of abbreviated players
            const abbreviatedPlayers = this.getRemainingAbbreviatedPlayers();
            
            if (abbreviatedPlayers.length === 0) {
                console.log('✅ No abbreviated players found - all names appear to be resolved!');
                return;
            }
            
            // Scan all daily files
            await this.scanDailyFiles();
            
            // Analyze patterns
            this.analyzeParticipationPatterns();
            
            // Generate report
            this.generateReport();
            
            // Save results
            this.saveResults();
            
            console.log('\n✅ Player participation analysis complete!');
            
        } catch (error) {
            console.error('💥 Analysis failed:', error.message);
            throw error;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const analyzer = new PlayerGameParticipationAnalyzer();
    analyzer.run().catch(error => {
        console.error('💥 Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = PlayerGameParticipationAnalyzer;