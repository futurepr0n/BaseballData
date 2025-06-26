#!/usr/bin/env node

const fs = require('fs');

/**
 * Extract and display the manual review list in a readable format
 */
function extractManualReview() {
    try {
        const reportData = fs.readFileSync('./roster_correction_report.json', 'utf8');
        const report = JSON.parse(reportData);
        
        const manualReviewList = report.corrections.manual_review_needed;
        
        console.log('📋 PLAYERS REQUIRING MANUAL REVIEW');
        console.log('==================================');
        console.log(`Total: ${manualReviewList.length} players\n`);
        
        // Group by reason
        const groupedByReason = {};
        manualReviewList.forEach(player => {
            if (!groupedByReason[player.reason]) {
                groupedByReason[player.reason] = [];
            }
            groupedByReason[player.reason].push(player);
        });
        
        // Display by category
        Object.entries(groupedByReason).forEach(([reason, players]) => {
            console.log(`\n🔍 ${reason.toUpperCase().replace(/_/g, ' ')} (${players.length} players):`);
            console.log('=' + '='.repeat(50));
            
            players.forEach((player, idx) => {
                console.log(`${(idx + 1).toString().padStart(2)}. ${player.player_name} (${player.team}) - ${player.type}`);
                if (player.validation_issues && player.validation_issues.length > 0) {
                    console.log(`    Issues: ${player.validation_issues.join(', ')}`);
                }
            });
        });
        
        // Save simplified list to file
        const simplifiedList = manualReviewList.map(player => ({
            name: player.player_name,
            team: player.team,
            type: player.type,
            reason: player.reason,
            current_fullName: player.current_fullName
        }));
        
        fs.writeFileSync('./manual_review_list.json', JSON.stringify(simplifiedList, null, 2));
        console.log('\n💾 Simplified list saved to: manual_review_list.json');
        
        // Also create a CSV for easy spreadsheet import
        const csvHeaders = 'Name,Team,Type,Reason,Current FullName\n';
        const csvRows = simplifiedList.map(player => 
            `"${player.name}","${player.team}","${player.type}","${player.reason}","${player.current_fullName}"`
        ).join('\n');
        
        fs.writeFileSync('./manual_review_list.csv', csvHeaders + csvRows);
        console.log('💾 CSV version saved to: manual_review_list.csv');
        
    } catch (error) {
        console.error('❌ Error extracting manual review list:', error.message);
    }
}

// Run extraction
extractManualReview();