#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    rosterFile: './data/rosters.json',
    batterCSV: './data/stats/custom_batter_2025.csv',
    pitcherCSV: './data/stats/custom_pitcher_2025.csv',
    outputFile: './roster_name_analysis.json'
};

/**
 * Comprehensive roster name analysis system
 * Identifies abbreviated names, potential accent issues, and missing data
 */
class RosterNameAnalyzer {
    constructor() {
        this.roster = [];
        this.batterLookup = new Map();
        this.pitcherLookup = new Map();
        this.analysis = {
            total_players: 0,
            abbreviated_names: [],
            potential_accent_issues: [],
            missing_in_csv: [],
            team_distribution: {},
            position_distribution: { hitters: 0, pitchers: 0 },
            summary: {}
        };
    }

    /**
     * Load roster data from JSON
     */
    loadRosterData() {
        console.log('📊 Loading roster data...');
        try {
            const rosterData = fs.readFileSync(CONFIG.rosterFile, 'utf8');
            this.roster = JSON.parse(rosterData);
            this.analysis.total_players = this.roster.length;
            console.log(`✅ Loaded ${this.roster.length} players from roster`);
        } catch (error) {
            console.error('❌ Error loading roster data:', error.message);
            process.exit(1);
        }
    }

    /**
     * Parse CSV file and create name lookup map
     * @param {string} csvPath - Path to CSV file
     * @param {Map} lookupMap - Map to populate with name data
     */
    loadCSVData(csvPath, lookupMap) {
        console.log(`📁 Loading CSV data from ${csvPath}...`);
        try {
            const csvData = fs.readFileSync(csvPath, 'utf8');
            const lines = csvData.split('\n');
            
            // Skip header line
            for (let i = 1; i < lines.length; i++) {
                const line = lines[i].trim();
                if (!line) continue;
                
                // Parse first column: "last_name, first_name"
                const match = line.match(/^"([^"]+)"/);
                if (match) {
                    const nameField = match[1];
                    const [lastName, firstName] = nameField.split(',').map(s => s.trim());
                    
                    if (lastName && firstName) {
                        const fullName = `${firstName} ${lastName}`;
                        const firstInitial = firstName.charAt(0).toUpperCase();
                        
                        // Create multiple lookup keys for more precise matching
                        const keys = [
                            fullName.toLowerCase(),                              // "maikel garcia"
                            `${firstInitial.toLowerCase()}_${lastName.toLowerCase()}`, // "m_garcia" (first initial + last)
                            lastName.toLowerCase()                              // "garcia" (last name only - lowest priority)
                        ];
                        
                        const playerData = {
                            fullName: fullName,
                            lastName: lastName,
                            firstName: firstName,
                            firstInitial: firstInitial,
                            csvLine: i + 1
                        };
                        
                        keys.forEach(key => {
                            if (!lookupMap.has(key)) {
                                lookupMap.set(key, []);
                            }
                            lookupMap.get(key).push(playerData);
                        });
                    }
                }
            }
            
            console.log(`✅ Loaded ${Math.floor(lookupMap.size / 3)} names from CSV`);
        } catch (error) {
            console.error(`❌ Error loading CSV data from ${csvPath}:`, error.message);
        }
    }

    /**
     * Check if a name appears to be abbreviated (First initial. Last name)
     * @param {string} fullName - Full name to check
     * @returns {boolean}
     */
    isAbbreviatedName(fullName) {
        // Pattern: Single letter followed by period and space, then last name
        // Examples: "R. Suarez", "J. Rodriguez", "M. Smith"
        const abbreviatedPattern = /^[A-Z]\.\s+[A-Za-z]+/;
        return abbreviatedPattern.test(fullName);
    }

    /**
     * Check if a name might have accent/special character issues
     * @param {string} fullName - Full name to check
     * @returns {object} Analysis result
     */
    analyzeAccentIssues(fullName) {
        const issues = [];
        
        // Common Spanish/Latin names that often have accents
        const accentPatterns = [
            { pattern: /jose/i, suggestion: 'José' },
            { pattern: /juan/i, suggestion: 'Juan' },
            { pattern: /luis/i, suggestion: 'Luis' },
            { pattern: /carlos/i, suggestion: 'Carlos' },
            { pattern: /martinez/i, suggestion: 'Martínez' },
            { pattern: /rodriguez/i, suggestion: 'Rodríguez' },
            { pattern: /gonzalez/i, suggestion: 'González' },
            { pattern: /fernandez/i, suggestion: 'Fernández' },
            { pattern: /hernandez/i, suggestion: 'Hernández' },
            { pattern: /perez/i, suggestion: 'Pérez' },
            { pattern: /lopez/i, suggestion: 'López' },
            { pattern: /sanchez/i, suggestion: 'Sánchez' },
            { pattern: /ramirez/i, suggestion: 'Ramírez' },
            { pattern: /jimenez/i, suggestion: 'Jiménez' }
        ];

        for (const { pattern, suggestion } of accentPatterns) {
            if (pattern.test(fullName) && !fullName.includes('í') && !fullName.includes('é') && !fullName.includes('ó')) {
                issues.push({
                    pattern: pattern.source,
                    suggestion: suggestion,
                    confidence: 'medium'
                });
            }
        }

        // Check for names that have non-ASCII characters that might need normalization
        if (/[àáâãäåæçèéêëìíîïñòóôõöøùúûüý]/i.test(fullName)) {
            issues.push({
                pattern: 'contains_accents',
                suggestion: 'Verify accent characters are preserved correctly',
                confidence: 'high'
            });
        }

        return {
            hasIssues: issues.length > 0,
            issues: issues
        };
    }

    /**
     * Attempt to find matching name in CSV data
     * @param {object} player - Player data from roster
     * @returns {object} Match result
     */
    findCSVMatch(player) {
        const { name, fullName, team, type } = player;
        const lookupMap = type === 'pitcher' ? this.pitcherLookup : this.batterLookup;
        
        // Ensure fullName exists
        if (!fullName || !name) {
            return { found: false, match: null, strategy: null, confidence: 'none' };
        }
        
        // Extract first initial from roster name (e.g., "A. Garcia" -> "A")
        const rosterFirstInitial = fullName.charAt(0).toUpperCase();
        const nameParts = name.split(' ');
        const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : '';
        
        if (!lastName) {
            return { found: false, match: null, strategy: null, confidence: 'none' };
        }

        // Priority-ordered matching strategies
        const searchStrategies = [
            {
                key: `${rosterFirstInitial.toLowerCase()}_${lastName.toLowerCase()}`,
                description: 'first_initial_lastname',
                confidence: 'high'
            },
            {
                key: fullName.toLowerCase(),
                description: 'direct_fullname',
                confidence: 'high'
            },
            {
                key: lastName.toLowerCase(),
                description: 'lastname_only',
                confidence: 'low'
            }
        ];

        for (const strategy of searchStrategies) {
            if (lookupMap.has(strategy.key)) {
                const matches = lookupMap.get(strategy.key);
                
                if (Array.isArray(matches)) {
                    // Multiple potential matches - need to validate
                    for (const match of matches) {
                        // For first initial + last name strategy, must match exactly
                        if (strategy.description === 'first_initial_lastname') {
                            if (match.firstInitial === rosterFirstInitial) {
                                return {
                                    found: true,
                                    match: match,
                                    strategy: strategy.description,
                                    confidence: strategy.confidence,
                                    alternatives: matches.length > 1 ? matches.filter(m => m !== match) : []
                                };
                            }
                        }
                        // For last name only, check first initial compatibility
                        else if (strategy.description === 'lastname_only') {
                            if (match.firstInitial === rosterFirstInitial) {
                                return {
                                    found: true,
                                    match: match,
                                    strategy: strategy.description,
                                    confidence: 'medium', // Upgrade confidence if initial matches
                                    alternatives: matches.length > 1 ? matches.filter(m => m !== match) : []
                                };
                            }
                        }
                        // For direct fullname, accept first match
                        else {
                            return {
                                found: true,
                                match: match,
                                strategy: strategy.description,
                                confidence: strategy.confidence,
                                alternatives: matches.length > 1 ? matches.filter(m => m !== match) : []
                            };
                        }
                    }
                    
                    // If no initial-compatible match found for lastname_only, return warning
                    if (strategy.description === 'lastname_only') {
                        return {
                            found: false,
                            match: null,
                            strategy: 'lastname_conflict',
                            confidence: 'none',
                            warning: `Found ${matches.length} players with last name ${lastName} but none match first initial ${rosterFirstInitial}`,
                            alternatives: matches
                        };
                    }
                } else {
                    // Single match (legacy format)
                    return {
                        found: true,
                        match: matches,
                        strategy: strategy.description,
                        confidence: strategy.confidence,
                        alternatives: []
                    };
                }
            }
        }

        return { found: false, match: null, strategy: null, confidence: 'none' };
    }

    /**
     * Analyze all players in the roster
     */
    analyzeRoster() {
        console.log('🔍 Analyzing roster for name issues...');
        
        for (const player of this.roster) {
            const { name, fullName, team, type } = player;
            
            // Track team and position distribution
            this.analysis.team_distribution[team] = (this.analysis.team_distribution[team] || 0) + 1;
            this.analysis.position_distribution[type === 'pitcher' ? 'pitchers' : 'hitters']++;

            // Check for abbreviated names
            if (this.isAbbreviatedName(fullName)) {
                const csvMatch = this.findCSVMatch(player);
                
                this.analysis.abbreviated_names.push({
                    name: name,
                    fullName: fullName,
                    team: team,
                    type: type,
                    csvMatch: csvMatch,
                    suggestedFix: csvMatch.found ? csvMatch.match.fullName : 'NOT_FOUND_IN_CSV'
                });
            }

            // Check for potential accent issues
            const accentAnalysis = this.analyzeAccentIssues(fullName);
            if (accentAnalysis.hasIssues) {
                this.analysis.potential_accent_issues.push({
                    name: name,
                    fullName: fullName,
                    team: team,
                    type: type,
                    issues: accentAnalysis.issues
                });
            }

            // Check if player exists in CSV data
            const csvMatch = this.findCSVMatch(player);
            if (!csvMatch.found) {
                this.analysis.missing_in_csv.push({
                    name: name,
                    fullName: fullName,
                    team: team,
                    type: type,
                    reason: 'No match found in CSV data'
                });
            }
        }

        console.log('✅ Roster analysis complete');
    }

    /**
     * Generate analysis summary
     */
    generateSummary() {
        this.analysis.summary = {
            total_players: this.analysis.total_players,
            abbreviated_names_count: this.analysis.abbreviated_names.length,
            abbreviated_names_percentage: ((this.analysis.abbreviated_names.length / this.analysis.total_players) * 100).toFixed(2),
            potential_accent_issues_count: this.analysis.potential_accent_issues.length,
            missing_in_csv_count: this.analysis.missing_in_csv.length,
            csv_match_rate: (((this.analysis.total_players - this.analysis.missing_in_csv.length) / this.analysis.total_players) * 100).toFixed(2),
            teams_represented: Object.keys(this.analysis.team_distribution).length,
            hitters_count: this.analysis.position_distribution.hitters,
            pitchers_count: this.analysis.position_distribution.pitchers
        };

        // Top teams with most abbreviated names
        const abbreviatedByTeam = {};
        this.analysis.abbreviated_names.forEach(player => {
            abbreviatedByTeam[player.team] = (abbreviatedByTeam[player.team] || 0) + 1;
        });
        
        this.analysis.summary.teams_with_most_abbreviated = Object.entries(abbreviatedByTeam)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([team, count]) => ({ team, count }));
    }

    /**
     * Save analysis results to JSON file
     */
    saveResults() {
        console.log(`💾 Saving analysis results to ${CONFIG.outputFile}...`);
        
        try {
            const analysisData = {
                timestamp: new Date().toISOString(),
                config: CONFIG,
                analysis: this.analysis
            };
            
            fs.writeFileSync(CONFIG.outputFile, JSON.stringify(analysisData, null, 2));
            console.log('✅ Analysis results saved successfully');
        } catch (error) {
            console.error('❌ Error saving analysis results:', error.message);
        }
    }

    /**
     * Print analysis summary to console
     */
    printSummary() {
        console.log('\n📋 ROSTER NAME ANALYSIS SUMMARY');
        console.log('================================');
        console.log(`Total Players: ${this.analysis.summary.total_players}`);
        console.log(`Abbreviated Names: ${this.analysis.summary.abbreviated_names_count} (${this.analysis.summary.abbreviated_names_percentage}%)`);
        console.log(`Potential Accent Issues: ${this.analysis.summary.potential_accent_issues_count}`);
        console.log(`Missing in CSV: ${this.analysis.summary.missing_in_csv_count}`);
        console.log(`CSV Match Rate: ${this.analysis.summary.csv_match_rate}%`);
        console.log(`Teams: ${this.analysis.summary.teams_represented}`);
        console.log(`Hitters: ${this.analysis.summary.hitters_count}, Pitchers: ${this.analysis.summary.pitchers_count}`);

        console.log('\n🏆 TOP TEAMS WITH ABBREVIATED NAMES:');
        this.analysis.summary.teams_with_most_abbreviated.forEach(({ team, count }, idx) => {
            console.log(`${idx + 1}. ${team}: ${count} players`);
        });

        console.log('\n🔧 SAMPLE ABBREVIATED NAMES TO FIX:');
        this.analysis.abbreviated_names.slice(0, 10).forEach(player => {
            console.log(`${player.fullName} (${player.team}) → ${player.suggestedFix}`);
        });

        console.log(`\n📄 Full analysis saved to: ${CONFIG.outputFile}`);
        console.log('💡 Use this data to prioritize roster name corrections.');
    }

    /**
     * Run complete analysis process
     */
    async run() {
        console.log('🚀 Starting Roster Name Analysis');
        console.log('================================\n');

        // Load all data
        this.loadRosterData();
        this.loadCSVData(CONFIG.batterCSV, this.batterLookup);
        this.loadCSVData(CONFIG.pitcherCSV, this.pitcherLookup);

        // Perform analysis
        this.analyzeRoster();
        this.generateSummary();

        // Output results
        this.saveResults();
        this.printSummary();

        console.log('\n✅ Analysis complete!');
    }
}

// Execute analysis if run directly
if (require.main === module) {
    const analyzer = new RosterNameAnalyzer();
    analyzer.run().catch(error => {
        console.error('💥 Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = RosterNameAnalyzer;