#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
    rosterFile: './data/rosters.json',
    analysisFile: './roster_name_analysis.json',
    outputFile: './data/rosters_corrected.json',
    backupFile: './data/rosters_backup.json',
    correctionReport: './roster_correction_report.json'
};

/**
 * Roster name correction system
 * Uses analysis data to automatically fix abbreviated names and accent issues
 */
class RosterNameCorrector {
    constructor() {
        this.roster = [];
        this.analysis = null;
        this.corrections = {
            total_corrections: 0,
            automated_fixes: [],
            manual_review_needed: [],
            accent_corrections: [],
            validation_warnings: [],
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
            console.log(`✅ Loaded ${this.roster.length} players from roster`);
        } catch (error) {
            console.error('❌ Error loading roster data:', error.message);
            process.exit(1);
        }
    }

    /**
     * Load analysis results
     */
    loadAnalysisData() {
        console.log('🔍 Loading analysis data...');
        try {
            const analysisData = fs.readFileSync(CONFIG.analysisFile, 'utf8');
            this.analysis = JSON.parse(analysisData);
            console.log(`✅ Loaded analysis with ${this.analysis.analysis.abbreviated_names.length} abbreviated names`);
        } catch (error) {
            console.error('❌ Error loading analysis data:', error.message);
            console.error('💡 Run analyze_roster_names.js first to generate analysis data');
            process.exit(1);
        }
    }

    /**
     * Create backup of original roster file
     */
    createBackup() {
        console.log('💾 Creating backup of original roster...');
        try {
            fs.copyFileSync(CONFIG.rosterFile, CONFIG.backupFile);
            console.log(`✅ Backup created: ${CONFIG.backupFile}`);
        } catch (error) {
            console.error('❌ Error creating backup:', error.message);
            process.exit(1);
        }
    }

    /**
     * Validate a correction before applying
     * @param {object} original - Original player data
     * @param {object} correction - Correction data from analysis
     * @returns {object} Validation result
     */
    validateCorrection(original, correction) {
        const warnings = [];

        // Check if the correction makes sense
        const originalLastName = original.name.split(' ').pop().toLowerCase();
        const correctedLastName = correction.suggestedFix.split(' ').pop().toLowerCase();

        if (originalLastName !== correctedLastName) {
            warnings.push(`Last name mismatch: ${originalLastName} vs ${correctedLastName}`);
        }

        // Check confidence level
        if (correction.csvMatch.confidence === 'none') {
            warnings.push('No CSV match found - requires manual review');
        }

        // Check for multiple possible matches (ambiguous cases)
        if (correction.csvMatch.strategy && correction.csvMatch.strategy.length < 4) {
            warnings.push('Short matching strategy - may be ambiguous');
        }

        return {
            valid: warnings.length === 0 || (warnings.length === 1 && warnings[0].includes('Short matching')),
            warnings: warnings,
            confidence: correction.csvMatch.confidence
        };
    }

    /**
     * Apply corrections to roster data
     */
    applyCorrections() {
        console.log('🔧 Applying corrections to roster...');

        // Create lookup map for quick access
        const correctionMap = new Map();
        this.analysis.analysis.abbreviated_names.forEach(abbrev => {
            const key = `${abbrev.name}_${abbrev.team}_${abbrev.type}`;
            correctionMap.set(key, abbrev);
        });

        // Process each player in roster
        for (let i = 0; i < this.roster.length; i++) {
            const player = this.roster[i];
            const lookupKey = `${player.name}_${player.team}_${player.type}`;
            
            if (correctionMap.has(lookupKey)) {
                const correction = correctionMap.get(lookupKey);
                const validation = this.validateCorrection(player, correction);

                if (validation.valid && correction.csvMatch.found && 
                    correction.suggestedFix !== 'NOT_FOUND_IN_CSV' &&
                    correction.csvMatch.confidence !== 'none') {
                    
                    // Apply the correction
                    const originalFullName = player.fullName;
                    this.roster[i].fullName = correction.suggestedFix;
                    
                    this.corrections.automated_fixes.push({
                        player_name: player.name,
                        team: player.team,
                        type: player.type,
                        original_fullName: originalFullName,
                        corrected_fullName: correction.suggestedFix,
                        confidence: correction.csvMatch.confidence,
                        csv_line: correction.csvMatch.match.csvLine,
                        validation_warnings: validation.warnings
                    });

                    this.corrections.total_corrections++;
                } else {
                    // Needs manual review
                    this.corrections.manual_review_needed.push({
                        player_name: player.name,
                        team: player.team,
                        type: player.type,
                        current_fullName: player.fullName,
                        suggested_fix: correction.suggestedFix,
                        csv_found: correction.csvMatch.found,
                        confidence: correction.csvMatch.confidence,
                        validation_issues: validation.warnings,
                        reason: correction.csvMatch.found ? 'validation_failed' : 'no_csv_match'
                    });
                }

                // Track validation warnings
                if (validation.warnings.length > 0) {
                    this.corrections.validation_warnings.push({
                        player: player.name,
                        warnings: validation.warnings
                    });
                }
            }
        }

        console.log(`✅ Applied ${this.corrections.total_corrections} corrections`);
        console.log(`⚠️  ${this.corrections.manual_review_needed.length} players need manual review`);
    }

    /**
     * Apply accent corrections based on analysis
     */
    applyAccentCorrections() {
        console.log('🌍 Checking for accent corrections...');

        const accentIssues = this.analysis.analysis.potential_accent_issues;
        
        for (const issue of accentIssues) {
            // For now, just log these for manual review
            // Future enhancement could include automated accent corrections
            this.corrections.accent_corrections.push({
                player_name: issue.name,
                team: issue.team,
                current_fullName: issue.fullName,
                potential_issues: issue.issues,
                action: 'manual_review_suggested'
            });
        }

        console.log(`📝 Identified ${accentIssues.length} potential accent issues for review`);
    }

    /**
     * Generate correction summary
     */
    generateSummary() {
        this.corrections.summary = {
            total_players_processed: this.roster.length,
            total_corrections_applied: this.corrections.total_corrections,
            automated_fixes_count: this.corrections.automated_fixes.length,
            manual_review_count: this.corrections.manual_review_needed.length,
            accent_issues_count: this.corrections.accent_corrections.length,
            validation_warnings_count: this.corrections.validation_warnings.length,
            success_rate: ((this.corrections.total_corrections / this.analysis.analysis.abbreviated_names.length) * 100).toFixed(2),
            timestamp: new Date().toISOString()
        };

        // Breakdown by confidence level
        const byConfidence = {};
        this.corrections.automated_fixes.forEach(fix => {
            byConfidence[fix.confidence] = (byConfidence[fix.confidence] || 0) + 1;
        });
        this.corrections.summary.corrections_by_confidence = byConfidence;

        // Top teams corrected
        const byTeam = {};
        this.corrections.automated_fixes.forEach(fix => {
            byTeam[fix.team] = (byTeam[fix.team] || 0) + 1;
        });
        this.corrections.summary.top_teams_corrected = Object.entries(byTeam)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 5)
            .map(([team, count]) => ({ team, count }));
    }

    /**
     * Save corrected roster to file
     */
    saveCorrectedRoster() {
        console.log(`💾 Saving corrected roster to ${CONFIG.outputFile}...`);
        try {
            fs.writeFileSync(CONFIG.outputFile, JSON.stringify(this.roster, null, 2));
            console.log('✅ Corrected roster saved successfully');
        } catch (error) {
            console.error('❌ Error saving corrected roster:', error.message);
        }
    }

    /**
     * Save correction report
     */
    saveCorrectionReport() {
        console.log(`📋 Saving correction report to ${CONFIG.correctionReport}...`);
        try {
            const report = {
                timestamp: new Date().toISOString(),
                config: CONFIG,
                corrections: this.corrections
            };
            fs.writeFileSync(CONFIG.correctionReport, JSON.stringify(report, null, 2));
            console.log('✅ Correction report saved successfully');
        } catch (error) {
            console.error('❌ Error saving correction report:', error.message);
        }
    }

    /**
     * Print correction summary to console
     */
    printSummary() {
        console.log('\n📋 ROSTER CORRECTION SUMMARY');
        console.log('============================');
        console.log(`Total Players Processed: ${this.corrections.summary.total_players_processed}`);
        console.log(`Automated Corrections: ${this.corrections.summary.automated_fixes_count}`);
        console.log(`Manual Review Needed: ${this.corrections.summary.manual_review_count}`);
        console.log(`Accent Issues Found: ${this.corrections.summary.accent_issues_count}`);
        console.log(`Success Rate: ${this.corrections.summary.success_rate}%`);

        console.log('\n🏆 TOP TEAMS CORRECTED:');
        this.corrections.summary.top_teams_corrected.forEach(({ team, count }, idx) => {
            console.log(`${idx + 1}. ${team}: ${count} players`);
        });

        console.log('\n🔧 SAMPLE CORRECTIONS APPLIED:');
        this.corrections.automated_fixes.slice(0, 10).forEach(fix => {
            console.log(`${fix.original_fullName} → ${fix.corrected_fullName} (${fix.team}, ${fix.confidence})`);
        });

        if (this.corrections.manual_review_needed.length > 0) {
            console.log('\n⚠️  MANUAL REVIEW NEEDED:');
            this.corrections.manual_review_needed.slice(0, 5).forEach(manual => {
                console.log(`${manual.player_name} (${manual.team}) - ${manual.reason}`);
            });
            if (this.corrections.manual_review_needed.length > 5) {
                console.log(`... and ${this.corrections.manual_review_needed.length - 5} more`);
            }
        }

        console.log('\n📁 FILES CREATED:');
        console.log(`✓ Corrected roster: ${CONFIG.outputFile}`);
        console.log(`✓ Original backup: ${CONFIG.backupFile}`);
        console.log(`✓ Correction report: ${CONFIG.correctionReport}`);
        
        console.log('\n🚀 NEXT STEPS:');
        console.log('1. Review the correction report for manual fixes needed');
        console.log('2. Test the corrected roster in your application');
        console.log('3. Replace original roster file when satisfied');
        console.log('4. Consider accent corrections in the manual review list');
    }

    /**
     * Run complete correction process
     */
    async run() {
        console.log('🚀 Starting Roster Name Correction');
        console.log('==================================\n');

        // Load data
        this.loadRosterData();
        this.loadAnalysisData();

        // Create backup
        this.createBackup();

        // Apply corrections
        this.applyCorrections();
        this.applyAccentCorrections();

        // Generate results
        this.generateSummary();
        this.saveCorrectedRoster();
        this.saveCorrectionReport();

        // Output summary
        this.printSummary();

        console.log('\n✅ Correction process complete!');
    }
}

// Execute correction if run directly
if (require.main === module) {
    const corrector = new RosterNameCorrector();
    corrector.run().catch(error => {
        console.error('💥 Correction failed:', error);
        process.exit(1);
    });
}

module.exports = RosterNameCorrector;