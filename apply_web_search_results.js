#!/usr/bin/env node

const fs = require('fs');

/**
 * Apply web search results to update roster with found full names
 */
class WebSearchResultsApplier {
    constructor() {
        this.corrections = {
            timestamp: new Date().toISOString(),
            applied_corrections: [],
            skipped_players: [],
            validation_warnings: [],
            summary: {}
        };
        
        // Confirmed results from web searches
        this.confirmedResults = [
            {
                current_name: 'A. Martinez',
                team: 'CLE',
                type: 'hitter',
                confirmed_full_name: 'Angel Martinez',
                confidence: 'high',
                source: 'mlb.com/espn.com web search',
                notes: 'Center fielder for Cleveland Guardians, confirmed through multiple sources'
            },
            {
                current_name: 'A. Cox',
                team: 'ATL',
                type: 'pitcher',
                confirmed_full_name: 'Austin Cox',
                confidence: 'high',
                source: 'mlb.com/espn.com web search',
                notes: 'Relief pitcher for Atlanta Braves, jersey #68, left-handed'
            },
            {
                current_name: 'A. Garcia',
                team: 'ARI',
                type: 'hitter',
                confirmed_full_name: 'Aramis Garcia',
                confidence: 'high',
                source: 'user confirmed',
                notes: 'User confirmed this should be Aramis Garcia'
            }
            // Additional confirmed results can be added here
        ];
    }

    /**
     * Load current roster data
     */
    loadRoster(rosterPath = './data/rosters_corrected.json') {
        console.log(`📊 Loading roster from ${rosterPath}...`);
        
        try {
            const rosterData = fs.readFileSync(rosterPath, 'utf8');
            const roster = JSON.parse(rosterData);
            console.log(`✅ Loaded ${roster.length} players from roster`);
            return roster;
        } catch (error) {
            console.error('❌ Error loading roster:', error.message);
            throw error;
        }
    }

    /**
     * Apply confirmed web search results to roster
     */
    applyWebSearchResults(roster) {
        console.log(`🔧 Applying ${this.confirmedResults.length} confirmed web search results...`);
        
        let appliedCount = 0;
        
        for (let i = 0; i < roster.length; i++) {
            const player = roster[i];
            
            // Find matching confirmed result
            const confirmedResult = this.confirmedResults.find(result =>
                result.current_name === player.name &&
                result.team === player.team &&
                result.type === player.type
            );
            
            if (confirmedResult) {
                // Validate the correction
                const validation = this.validateCorrection(player, confirmedResult);
                
                if (validation.valid) {
                    // Apply the correction
                    const originalFullName = player.fullName;
                    roster[i].fullName = confirmedResult.confirmed_full_name;
                    
                    this.corrections.applied_corrections.push({
                        player_name: player.name,
                        team: player.team,
                        type: player.type,
                        original_fullName: originalFullName,
                        corrected_fullName: confirmedResult.confirmed_full_name,
                        confidence: confirmedResult.confidence,
                        source: confirmedResult.source,
                        notes: confirmedResult.notes,
                        validation_warnings: validation.warnings
                    });
                    
                    appliedCount++;
                    console.log(`✅ Applied: ${player.name} → ${confirmedResult.confirmed_full_name} (${player.team})`);
                    
                } else {
                    this.corrections.skipped_players.push({
                        player_name: player.name,
                        team: player.team,
                        reason: 'validation_failed',
                        validation_issues: validation.warnings,
                        suggested_name: confirmedResult.confirmed_full_name
                    });
                    
                    console.log(`⚠️  Skipped: ${player.name} (${player.team}) - validation failed`);
                }
                
                // Track validation warnings
                if (validation.warnings.length > 0) {
                    this.corrections.validation_warnings.push({
                        player: player.name,
                        team: player.team,
                        warnings: validation.warnings
                    });
                }
            }
        }
        
        console.log(`✅ Applied ${appliedCount} web search corrections to roster`);
        return roster;
    }

    /**
     * Validate a web search correction
     */
    validateCorrection(player, confirmedResult) {
        const warnings = [];
        
        // Check first initial consistency
        const playerFirstInitial = player.name.charAt(0).toUpperCase();
        const confirmedFirstInitial = confirmedResult.confirmed_full_name.charAt(0).toUpperCase();
        
        if (playerFirstInitial !== confirmedFirstInitial) {
            warnings.push(`First initial mismatch: ${playerFirstInitial} vs ${confirmedFirstInitial}`);
        }
        
        // Check last name consistency
        const playerLastName = player.name.split(' ').pop().toLowerCase();
        const confirmedLastName = confirmedResult.confirmed_full_name.split(' ').pop().toLowerCase();
        
        if (playerLastName !== confirmedLastName) {
            warnings.push(`Last name mismatch: ${playerLastName} vs ${confirmedLastName}`);
        }
        
        // Check team and type consistency
        if (player.team !== confirmedResult.team) {
            warnings.push(`Team mismatch: ${player.team} vs ${confirmedResult.team}`);
        }
        
        if (player.type !== confirmedResult.type) {
            warnings.push(`Type mismatch: ${player.type} vs ${confirmedResult.type}`);
        }
        
        return {
            valid: warnings.length === 0,
            warnings: warnings
        };
    }

    /**
     * Create updated roster with web search results
     */
    createUpdatedRoster(roster, outputPath = './data/rosters_web_updated.json') {
        console.log(`💾 Saving updated roster to ${outputPath}...`);
        
        try {
            fs.writeFileSync(outputPath, JSON.stringify(roster, null, 2));
            console.log('✅ Updated roster saved successfully');
        } catch (error) {
            console.error('❌ Error saving updated roster:', error.message);
        }
    }

    /**
     * Generate summary report
     */
    generateSummary() {
        this.corrections.summary = {
            total_confirmed_results: this.confirmedResults.length,
            applied_corrections: this.corrections.applied_corrections.length,
            skipped_players: this.corrections.skipped_players.length,
            validation_warnings: this.corrections.validation_warnings.length,
            success_rate: ((this.corrections.applied_corrections.length / this.confirmedResults.length) * 100).toFixed(2)
        };
        
        // Breakdown by source
        const bySources = {};
        this.corrections.applied_corrections.forEach(correction => {
            bySources[correction.source] = (bySources[correction.source] || 0) + 1;
        });
        this.corrections.summary.corrections_by_source = bySources;
    }

    /**
     * Save correction report
     */
    saveReport(reportPath = './web_search_corrections_report.json') {
        console.log(`📋 Saving correction report to ${reportPath}...`);
        
        try {
            fs.writeFileSync(reportPath, JSON.stringify(this.corrections, null, 2));
            console.log('✅ Correction report saved successfully');
        } catch (error) {
            console.error('❌ Error saving correction report:', error.message);
        }
    }

    /**
     * Print summary to console
     */
    printSummary() {
        console.log('\n📋 WEB SEARCH CORRECTIONS SUMMARY');
        console.log('=================================');
        console.log(`Confirmed Results Available: ${this.corrections.summary.total_confirmed_results}`);
        console.log(`Applied Corrections: ${this.corrections.summary.applied_corrections}`);
        console.log(`Skipped Players: ${this.corrections.summary.skipped_players}`);
        console.log(`Success Rate: ${this.corrections.summary.success_rate}%`);
        
        if (this.corrections.applied_corrections.length > 0) {
            console.log('\n✅ APPLIED CORRECTIONS:');
            this.corrections.applied_corrections.forEach((correction, idx) => {
                console.log(`${idx + 1}. ${correction.player_name} → ${correction.corrected_fullName} (${correction.team}, ${correction.confidence})`);
                if (correction.notes) {
                    console.log(`   Notes: ${correction.notes}`);
                }
            });
        }
        
        if (this.corrections.skipped_players.length > 0) {
            console.log('\n⚠️  SKIPPED PLAYERS:');
            this.corrections.skipped_players.forEach((player, idx) => {
                console.log(`${idx + 1}. ${player.player_name} (${player.team}) - ${player.reason}`);
                if (player.validation_issues.length > 0) {
                    console.log(`   Issues: ${player.validation_issues.join(', ')}`);
                }
            });
        }
        
        console.log('\n📊 CORRECTIONS BY SOURCE:');
        Object.entries(this.corrections.summary.corrections_by_source).forEach(([source, count]) => {
            console.log(`• ${source}: ${count} corrections`);
        });
        
        console.log('\n🎯 NEXT STEPS:');
        console.log('1. Review the updated roster: data/rosters_web_updated.json');
        console.log('2. Validate the corrections using validation tools');
        console.log('3. Continue web searching for remaining players');
        console.log('4. Replace original roster when satisfied with results');
    }

    /**
     * Add more confirmed results from manual research
     */
    addConfirmedResult(currentName, team, type, confirmedFullName, source, notes) {
        this.confirmedResults.push({
            current_name: currentName,
            team: team,
            type: type,
            confirmed_full_name: confirmedFullName,
            confidence: 'high',
            source: source,
            notes: notes
        });
        
        console.log(`➕ Added confirmed result: ${currentName} → ${confirmedFullName} (${team})`);
    }

    /**
     * Run complete application process
     */
    run(rosterPath) {
        console.log('🚀 Applying Web Search Results to Roster');
        console.log('=========================================\n');
        
        try {
            // Load roster
            const roster = this.loadRoster(rosterPath);
            
            // Apply web search results
            const updatedRoster = this.applyWebSearchResults(roster);
            
            // Generate summary
            this.generateSummary();
            
            // Save results
            this.createUpdatedRoster(updatedRoster);
            this.saveReport();
            
            // Print summary
            this.printSummary();
            
            console.log('\n✅ Web search results application complete!');
            
        } catch (error) {
            console.error('💥 Application process failed:', error.message);
            throw error;
        }
    }
}

// Execute if run directly
if (require.main === module) {
    const applier = new WebSearchResultsApplier();
    const rosterPath = process.argv[2] || './data/rosters_corrected.json';
    
    // Example of how to add more confirmed results
    // applier.addConfirmedResult('B. Cook', 'PIT', 'hitter', 'Bryan Cook', 'web_search', 'Found through MLB roster search');
    
    applier.run(rosterPath).catch(error => {
        console.error('💥 Application failed:', error);
        process.exit(1);
    });
}

module.exports = WebSearchResultsApplier;