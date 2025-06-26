#!/usr/bin/env node

const fs = require('fs');

/**
 * Detect existing name mismatches in corrected roster
 * Identifies cases where first initial from 'name' doesn't match 'fullName'
 */
class NameMismatchDetector {
    constructor() {
        this.mismatches = {
            first_initial_conflicts: [],
            suspicious_patterns: [],
            format_issues: [],
            potential_team_conflicts: []
        };
        this.validTeams = new Set([
            'LAA', 'HOU', 'OAK', 'TOR', 'ATL', 'MIL', 'STL', 'CHC', 'ARI', 'LAD',
            'SF', 'CLE', 'SEA', 'MIA', 'NYM', 'WSH', 'BAL', 'SD', 'PHI', 'PIT',
            'TEX', 'TB', 'BOS', 'CIN', 'COL', 'MIN', 'CHW', 'DET', 'KC', 'NYY'
        ]);
    }

    /**
     * Load and analyze roster for name mismatches
     */
    analyzeRoster(rosterPath = './data/rosters_corrected.json') {
        console.log(`🔍 Analyzing roster for name mismatches: ${rosterPath}`);
        
        try {
            const rosterData = fs.readFileSync(rosterPath, 'utf8');
            const roster = JSON.parse(rosterData);
            
            console.log(`📊 Analyzing ${roster.length} players for mismatches...`);
            
            // Check each player for potential issues
            for (const player of roster) {
                this.checkPlayer(player);
            }
            
            this.generateReport();
            this.saveResults();
            
        } catch (error) {
            console.error('❌ Error analyzing roster:', error.message);
            throw error;
        }
    }

    /**
     * Check individual player for various mismatch patterns
     */
    checkPlayer(player) {
        const { name, fullName, team, type } = player;
        
        if (!name || !fullName) return;
        
        // Extract components
        const nameFirstChar = name.charAt(0).toUpperCase();
        const fullNameFirstChar = fullName.charAt(0).toUpperCase();
        
        // Check 1: First initial mismatch
        if (nameFirstChar !== fullNameFirstChar) {
            this.mismatches.first_initial_conflicts.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                nameFirstChar: nameFirstChar,
                fullNameFirstChar: fullNameFirstChar,
                severity: 'high'
            });
        }
        
        // Check 2: Suspicious patterns (common mismatches)
        this.checkSuspiciousPatterns(player);
        
        // Check 3: Format issues
        this.checkFormatIssues(player);
        
        // Check 4: Team context issues
        this.checkTeamContext(player);
    }

    /**
     * Check for suspicious name patterns that indicate potential mismatches
     */
    checkSuspiciousPatterns(player) {
        const { name, fullName, team, type } = player;
        
        // Pattern 1: Different last names
        const nameLastName = name.split(' ').pop().toLowerCase();
        const fullNameLastName = fullName.split(' ').pop().toLowerCase();
        
        if (nameLastName !== fullNameLastName) {
            this.mismatches.suspicious_patterns.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'last_name_mismatch',
                nameLastName: nameLastName,
                fullNameLastName: fullNameLastName,
                severity: 'high'
            });
        }
        
        // Pattern 2: Full name appears to be for different player type
        // (e.g., common pitcher name assigned to hitter)
        const commonPitcherNames = ['pedro', 'jose', 'carlos', 'luis', 'miguel'];
        const commonHitterNames = ['mike', 'alex', 'chris', 'david', 'juan'];
        
        const firstNameLower = fullName.split(' ')[0].toLowerCase();
        
        if (type === 'hitter' && commonPitcherNames.includes(firstNameLower) && 
            !name.toLowerCase().includes(firstNameLower)) {
            this.mismatches.suspicious_patterns.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'type_name_mismatch',
                severity: 'medium'
            });
        }
        
        // Pattern 3: Multiple players with same full name but different teams
        // (This requires cross-referencing, implemented in checkTeamContext)
    }

    /**
     * Check for format issues that indicate problems
     */
    checkFormatIssues(player) {
        const { name, fullName, team, type } = player;
        
        // Issue 1: Full name still abbreviated (missed by previous analysis)
        if (/^[A-Z]\.\s+[A-Za-z]+/.test(fullName)) {
            this.mismatches.format_issues.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'still_abbreviated',
                severity: 'medium'
            });
        }
        
        // Issue 2: Full name has unusual formatting
        if (fullName.includes('  ') || fullName.match(/^[a-z]/) || fullName.includes('..')) {
            this.mismatches.format_issues.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'format_anomaly',
                severity: 'low'
            });
        }
        
        // Issue 3: Name and fullName are identical but abbreviated
        if (name === fullName && /^[A-Z]\.\s+/.test(name)) {
            this.mismatches.format_issues.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'identical_abbreviated',
                severity: 'high'
            });
        }
    }

    /**
     * Check for team-related context issues
     */
    checkTeamContext(player) {
        const { name, fullName, team, type } = player;
        
        // Create lookup for duplicate names
        // (This is a simplified check - full implementation would require roster-wide analysis)
        
        // Issue 1: Invalid team
        if (!this.validTeams.has(team)) {
            this.mismatches.potential_team_conflicts.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'invalid_team',
                severity: 'high'
            });
        }
        
        // Issue 2: Common cross-team confusion patterns
        // (e.g., players with similar names from different teams)
        const commonConfusions = [
            { lastName: 'garcia', teams: ['ARI', 'KC', 'TOR'] },
            { lastName: 'rodriguez', teams: ['CLE', 'SEA', 'SF'] },
            { lastName: 'martinez', teams: ['CLE', 'HOU', 'BOS'] }
        ];
        
        const playerLastName = fullName.split(' ').pop().toLowerCase();
        const confusion = commonConfusions.find(c => c.lastName === playerLastName);
        
        if (confusion && confusion.teams.includes(team)) {
            this.mismatches.potential_team_conflicts.push({
                name: name,
                fullName: fullName,
                team: team,
                type: type,
                issue: 'potential_cross_team_confusion',
                confusionGroup: confusion,
                severity: 'medium'
            });
        }
    }

    /**
     * Generate comprehensive report
     */
    generateReport() {
        console.log('\n🚨 ROSTER NAME MISMATCH ANALYSIS');
        console.log('=================================');
        
        const totalIssues = Object.values(this.mismatches)
            .reduce((sum, issues) => sum + issues.length, 0);
            
        console.log(`Total Issues Found: ${totalIssues}\n`);
        
        // Report by category
        Object.entries(this.mismatches).forEach(([category, issues]) => {
            if (issues.length > 0) {
                console.log(`🔍 ${category.toUpperCase().replace(/_/g, ' ')} (${issues.length} issues):`);
                console.log('=' + '='.repeat(50));
                
                issues.forEach((issue, idx) => {
                    console.log(`${(idx + 1).toString().padStart(2)}. ${issue.name} → ${issue.fullName} (${issue.team}, ${issue.type})`);
                    
                    if (issue.nameFirstChar && issue.fullNameFirstChar) {
                        console.log(`    First Initial: "${issue.nameFirstChar}" → "${issue.fullNameFirstChar}"`);
                    }
                    
                    if (issue.nameLastName && issue.fullNameLastName) {
                        console.log(`    Last Name: "${issue.nameLastName}" → "${issue.fullNameLastName}"`);
                    }
                    
                    if (issue.issue) {
                        console.log(`    Issue: ${issue.issue} (${issue.severity})`);
                    }
                    
                    if (issue.confusionGroup) {
                        console.log(`    Potential Confusion: ${issue.confusionGroup.teams.join(', ')}`);
                    }
                    
                    console.log('');
                });
            }
        });
        
        // Summary
        const highSeverity = Object.values(this.mismatches)
            .flat()
            .filter(issue => issue.severity === 'high').length;
            
        console.log('\n📊 SEVERITY BREAKDOWN:');
        console.log(`High Priority: ${highSeverity} issues`);
        console.log(`Total Issues: ${totalIssues} issues`);
        
        if (highSeverity > 0) {
            console.log('\n⚠️  HIGH PRIORITY ISSUES REQUIRE IMMEDIATE ATTENTION!');
        }
    }

    /**
     * Save results to file
     */
    saveResults() {
        const report = {
            timestamp: new Date().toISOString(),
            summary: {
                total_issues: Object.values(this.mismatches).reduce((sum, issues) => sum + issues.length, 0),
                high_severity: Object.values(this.mismatches).flat().filter(issue => issue.severity === 'high').length,
                categories: Object.fromEntries(
                    Object.entries(this.mismatches).map(([cat, issues]) => [cat, issues.length])
                )
            },
            mismatches: this.mismatches
        };
        
        const outputFile = './roster_mismatch_analysis.json';
        fs.writeFileSync(outputFile, JSON.stringify(report, null, 2));
        console.log(`\n💾 Detailed analysis saved to: ${outputFile}`);
        
        // Also create a simple CSV for quick review
        const allIssues = Object.values(this.mismatches).flat();
        const csvHeaders = 'Name,FullName,Team,Type,Issue,Severity,FirstInitialName,FirstInitialFull\n';
        const csvRows = allIssues.map(issue => 
            `"${issue.name}","${issue.fullName}","${issue.team}","${issue.type}","${issue.issue || 'first_initial_mismatch'}","${issue.severity}","${issue.nameFirstChar || ''}","${issue.fullNameFirstChar || ''}"`
        ).join('\n');
        
        const csvFile = './roster_mismatch_analysis.csv';
        fs.writeFileSync(csvFile, csvHeaders + csvRows);
        console.log(`💾 CSV analysis saved to: ${csvFile}`);
    }

    /**
     * Run complete analysis
     */
    run(rosterPath) {
        console.log('🔍 Starting Roster Name Mismatch Detection');
        console.log('==========================================\n');
        
        this.analyzeRoster(rosterPath);
        
        console.log('\n✅ Mismatch analysis complete!');
        return this.mismatches;
    }
}

// Execute analysis if run directly
if (require.main === module) {
    const detector = new NameMismatchDetector();
    const rosterPath = process.argv[2] || './data/rosters_corrected.json';
    
    detector.run(rosterPath).catch(error => {
        console.error('💥 Analysis failed:', error);
        process.exit(1);
    });
}

module.exports = NameMismatchDetector;