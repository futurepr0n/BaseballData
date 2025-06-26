#!/usr/bin/env node

const fs = require('fs');

/**
 * Roster data quality validation tool
 * Provides ongoing validation of roster data integrity
 */
class RosterQualityValidator {
    constructor() {
        this.validationResults = {
            timestamp: new Date().toISOString(),
            total_players: 0,
            quality_score: 0,
            issues: {
                abbreviated_names: [],
                missing_fields: [],
                duplicate_players: [],
                invalid_teams: [],
                name_format_issues: [],
                special_character_issues: []
            },
            statistics: {},
            recommendations: []
        };
        this.validTeams = new Set([
            'LAA', 'HOU', 'OAK', 'TOR', 'ATL', 'MIL', 'STL', 'CHC', 'ARI', 'LAD',
            'SF', 'CLE', 'SEA', 'MIA', 'NYM', 'WSH', 'BAL', 'SD', 'PHI', 'PIT',
            'TEX', 'TB', 'BOS', 'CIN', 'COL', 'MIN', 'CHW', 'DET', 'KC', 'NYY'
        ]);
    }

    /**
     * Load and validate roster data
     * @param {string} rosterPath - Path to roster file
     */
    validateRoster(rosterPath = './data/rosters.json') {
        console.log(`🔍 Validating roster data from ${rosterPath}...`);
        
        try {
            const rosterData = fs.readFileSync(rosterPath, 'utf8');
            const roster = JSON.parse(rosterData);
            this.validationResults.total_players = roster.length;

            console.log(`📊 Loaded ${roster.length} players for validation`);

            // Run all validation checks
            this.checkAbbreviatedNames(roster);
            this.checkMissingFields(roster);
            this.checkDuplicatePlayers(roster);
            this.checkValidTeams(roster);
            this.checkNameFormats(roster);
            this.checkSpecialCharacters(roster);
            this.generateStatistics(roster);
            this.calculateQualityScore();
            this.generateRecommendations();

            console.log('✅ Validation complete');
            return this.validationResults;

        } catch (error) {
            console.error('❌ Error validating roster:', error.message);
            throw error;
        }
    }

    /**
     * Check for abbreviated names (format: "X. LastName")
     */
    checkAbbreviatedNames(roster) {
        const abbreviatedPattern = /^[A-Z]\.\s+[A-Za-z]+/;
        
        for (const player of roster) {
            if (player.fullName && abbreviatedPattern.test(player.fullName)) {
                this.validationResults.issues.abbreviated_names.push({
                    name: player.name,
                    fullName: player.fullName,
                    team: player.team,
                    type: player.type
                });
            }
        }
    }

    /**
     * Check for missing required fields
     */
    checkMissingFields(roster) {
        const requiredFields = ['name', 'fullName', 'team', 'type'];
        
        for (const player of roster) {
            const missingFields = requiredFields.filter(field => !player[field]);
            
            if (missingFields.length > 0) {
                this.validationResults.issues.missing_fields.push({
                    name: player.name || 'UNKNOWN',
                    team: player.team || 'UNKNOWN',
                    missing: missingFields
                });
            }
        }
    }

    /**
     * Check for duplicate players (same name and team)
     */
    checkDuplicatePlayers(roster) {
        const playerMap = new Map();
        
        for (const player of roster) {
            const key = `${player.name}_${player.team}`;
            
            if (playerMap.has(key)) {
                this.validationResults.issues.duplicate_players.push({
                    name: player.name,
                    team: player.team,
                    occurrences: playerMap.get(key) + 1
                });
                playerMap.set(key, playerMap.get(key) + 1);
            } else {
                playerMap.set(key, 1);
            }
        }
    }

    /**
     * Check for invalid team abbreviations
     */
    checkValidTeams(roster) {
        for (const player of roster) {
            if (player.team && !this.validTeams.has(player.team)) {
                this.validationResults.issues.invalid_teams.push({
                    name: player.name,
                    team: player.team,
                    type: player.type
                });
            }
        }
    }

    /**
     * Check for name format inconsistencies
     */
    checkNameFormats(roster) {
        const issues = [];
        
        for (const player of roster) {
            if (!player.fullName || !player.name) continue;
            
            // Check for mismatched name vs fullName
            const nameParts = player.name.split(' ');
            const fullNameParts = player.fullName.split(' ');
            
            // Basic consistency check
            if (nameParts.length > 1 && fullNameParts.length > 1) {
                const lastName = nameParts[nameParts.length - 1];
                const fullLastName = fullNameParts[fullNameParts.length - 1];
                
                if (lastName.toLowerCase() !== fullLastName.toLowerCase()) {
                    issues.push({
                        name: player.name,
                        fullName: player.fullName,
                        team: player.team,
                        issue: 'lastname_mismatch'
                    });
                }
            }

            // Check for unusual formats
            if (player.fullName.includes('  ')) { // Double spaces
                issues.push({
                    name: player.name,
                    fullName: player.fullName,
                    team: player.team,
                    issue: 'double_spaces'
                });
            }

            if (player.fullName.match(/^[a-z]/)) { // Starts with lowercase
                issues.push({
                    name: player.name,
                    fullName: player.fullName,
                    team: player.team,
                    issue: 'lowercase_start'
                });
            }
        }
        
        this.validationResults.issues.name_format_issues = issues;
    }

    /**
     * Check for special character handling
     */
    checkSpecialCharacters(roster) {
        const issues = [];
        
        for (const player of roster) {
            if (!player.fullName) continue;
            
            // Check for potential encoding issues
            if (player.fullName.includes('�')) {
                issues.push({
                    name: player.name,
                    fullName: player.fullName,
                    team: player.team,
                    issue: 'encoding_corruption'
                });
            }

            // Check for mixed character sets
            const hasAccents = /[àáâãäåæçèéêëìíîïñòóôõöøùúûüý]/i.test(player.fullName);
            const hasBasicChars = /[a-zA-Z]/.test(player.fullName);
            
            if (hasAccents && hasBasicChars) {
                // This is normal for Spanish names, just flag for review
                issues.push({
                    name: player.name,
                    fullName: player.fullName,
                    team: player.team,
                    issue: 'mixed_character_set',
                    severity: 'low'
                });
            }
        }
        
        this.validationResults.issues.special_character_issues = issues;
    }

    /**
     * Generate validation statistics
     */
    generateStatistics(roster) {
        // Team distribution
        const teamCounts = {};
        const typeCounts = { hitter: 0, pitcher: 0 };
        let fullNamesCount = 0;
        let hasStatsCount = 0;

        for (const player of roster) {
            // Team stats
            teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            
            // Type stats
            if (player.type) {
                typeCounts[player.type]++;
            }
            
            // Data completeness
            if (player.fullName && !this.isAbbreviated(player.fullName)) {
                fullNamesCount++;
            }
            
            if (player.stats || player.pitches) {
                hasStatsCount++;
            }
        }

        this.validationResults.statistics = {
            players_by_team: teamCounts,
            players_by_type: typeCounts,
            complete_names_count: fullNamesCount,
            complete_names_percentage: ((fullNamesCount / roster.length) * 100).toFixed(2),
            players_with_stats: hasStatsCount,
            stats_coverage_percentage: ((hasStatsCount / roster.length) * 100).toFixed(2)
        };
    }

    /**
     * Check if a name is abbreviated
     */
    isAbbreviated(fullName) {
        return /^[A-Z]\.\s+[A-Za-z]+/.test(fullName);
    }

    /**
     * Calculate overall quality score (0-100)
     */
    calculateQualityScore() {
        const totalIssues = Object.values(this.validationResults.issues)
            .reduce((sum, issueArray) => sum + issueArray.length, 0);
        
        const totalPlayers = this.validationResults.total_players;
        const issueRate = totalIssues / totalPlayers;
        
        // Quality score: 100 - (issue rate * 100), minimum 0
        this.validationResults.quality_score = Math.max(0, Math.round(100 - (issueRate * 100)));
    }

    /**
     * Generate actionable recommendations
     */
    generateRecommendations() {
        const recommendations = [];
        
        if (this.validationResults.issues.abbreviated_names.length > 0) {
            recommendations.push({
                priority: 'high',
                issue: 'abbreviated_names',
                count: this.validationResults.issues.abbreviated_names.length,
                action: 'Run correct_roster_names.js to fix abbreviated names using CSV data'
            });
        }

        if (this.validationResults.issues.missing_fields.length > 0) {
            recommendations.push({
                priority: 'critical',
                issue: 'missing_fields',
                count: this.validationResults.issues.missing_fields.length,
                action: 'Manually add missing required fields or remove incomplete records'
            });
        }

        if (this.validationResults.issues.duplicate_players.length > 0) {
            recommendations.push({
                priority: 'medium',
                issue: 'duplicate_players',
                count: this.validationResults.issues.duplicate_players.length,
                action: 'Review and merge or remove duplicate player entries'
            });
        }

        if (this.validationResults.issues.invalid_teams.length > 0) {
            recommendations.push({
                priority: 'high',
                issue: 'invalid_teams',
                count: this.validationResults.issues.invalid_teams.length,
                action: 'Correct invalid team abbreviations or remove invalid entries'
            });
        }

        this.validationResults.recommendations = recommendations;
    }

    /**
     * Print validation summary
     */
    printSummary() {
        console.log('\n📋 ROSTER QUALITY VALIDATION SUMMARY');
        console.log('=====================================');
        console.log(`Quality Score: ${this.validationResults.quality_score}/100`);
        console.log(`Total Players: ${this.validationResults.total_players}`);
        
        console.log('\n🔍 ISSUES FOUND:');
        Object.entries(this.validationResults.issues).forEach(([category, issues]) => {
            if (issues.length > 0) {
                console.log(`• ${category.replace(/_/g, ' ')}: ${issues.length}`);
            }
        });

        console.log('\n📊 STATISTICS:');
        console.log(`Complete Names: ${this.validationResults.statistics.complete_names_percentage}%`);
        console.log(`Stats Coverage: ${this.validationResults.statistics.stats_coverage_percentage}%`);
        console.log(`Hitters: ${this.validationResults.statistics.players_by_type.hitter || 0}`);
        console.log(`Pitchers: ${this.validationResults.statistics.players_by_type.pitcher || 0}`);

        if (this.validationResults.recommendations.length > 0) {
            console.log('\n🎯 RECOMMENDATIONS:');
            this.validationResults.recommendations.forEach((rec, idx) => {
                console.log(`${idx + 1}. [${rec.priority.toUpperCase()}] ${rec.action} (${rec.count} issues)`);
            });
        }
    }

    /**
     * Save validation report
     */
    saveReport(outputPath = './roster_quality_report.json') {
        console.log(`💾 Saving validation report to ${outputPath}...`);
        try {
            fs.writeFileSync(outputPath, JSON.stringify(this.validationResults, null, 2));
            console.log('✅ Validation report saved');
        } catch (error) {
            console.error('❌ Error saving report:', error.message);
        }
    }

    /**
     * Run complete validation
     */
    run(rosterPath) {
        console.log('🔍 Starting Roster Quality Validation');
        console.log('======================================\n');

        this.validateRoster(rosterPath);
        this.printSummary();
        this.saveReport();

        console.log('\n✅ Validation complete!');
        return this.validationResults;
    }
}

// Execute validation if run directly
if (require.main === module) {
    const validator = new RosterQualityValidator();
    const rosterPath = process.argv[2] || './data/rosters.json';
    validator.run(rosterPath).catch(error => {
        console.error('💥 Validation failed:', error);
        process.exit(1);
    });
}

module.exports = RosterQualityValidator;