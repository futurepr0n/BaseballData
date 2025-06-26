# Roster Name Normalization & Maintenance System

## Overview

This document outlines the comprehensive system for maintaining high-quality roster data in the BaseballData repository. The system addresses abbreviated names, accent/character encoding issues, and provides ongoing data quality assurance.

## System Components

### 1. Analysis Tools

#### `analyze_roster_names.js`
**Purpose**: Identifies and categorizes name quality issues in roster data

**Key Features**:
- Detects abbreviated names (format: "X. LastName")
- Identifies potential accent/special character issues
- Cross-references with CSV data sources for corrections
- Generates comprehensive analysis report with team/position breakdowns

**Usage**:
```bash
node analyze_roster_names.js
```

**Output**: `roster_name_analysis.json` with detailed issue categorization

#### `validate_roster_quality.js`
**Purpose**: Ongoing quality validation and monitoring

**Key Features**:
- Validates data integrity (missing fields, duplicates, invalid teams)
- Calculates quality score (0-100)
- Provides actionable recommendations
- Tracks data completeness and coverage statistics

**Usage**:
```bash
node validate_roster_quality.js [roster_file_path]
```

**Output**: `roster_quality_report.json` with validation results

### 2. Correction Tools

#### `correct_roster_names.js`
**Purpose**: Automated correction of identified name issues

**Key Features**:
- Applies corrections based on CSV data matches
- Validates corrections before applying
- Creates backup of original data
- Generates detailed correction report
- Handles both automated fixes and manual review cases

**Usage**:
```bash
node correct_roster_names.js
```

**Output**: 
- `data/rosters_corrected.json` - Updated roster data
- `data/rosters_backup.json` - Original data backup
- `roster_correction_report.json` - Detailed correction log

## Data Sources Integration

### CSV Data Sources
- **`custom_batter_2025.csv`**: Contains complete names for hitters
- **`custom_pitcher_2025.csv`**: Contains complete names for pitchers

**Format**: First column contains "last_name, first_name" which provides the authoritative full name data.

### Matching Strategy
The system uses multiple matching strategies with confidence scoring:
1. **Direct full name match** (high confidence)
2. **Last name only match** (medium confidence)
3. **Remove middle initials** (medium confidence)
4. **First and last name only** (medium confidence)

## Quality Metrics

### Success Rates (Current Implementation)
- **Automated Correction Rate**: 79.62% (375/471 abbreviated names)
- **CSV Match Rate**: 87.95% (157 missing from CSV)
- **Overall Quality Score**: Calculated based on total issues vs total players

### Issue Categories
1. **Abbreviated Names**: "R. Suarez" format requiring expansion
2. **Accent Issues**: Spanish names missing proper accent marks
3. **Missing Fields**: Players lacking required data
4. **Duplicates**: Same player appearing multiple times
5. **Invalid Teams**: Non-standard team abbreviations
6. **Format Issues**: Double spaces, case problems, encoding corruption

## Workflow Processes

### Initial Data Cleanup (One-time)
```bash
# 1. Analyze current state
node analyze_roster_names.js

# 2. Apply automated corrections
node correct_roster_names.js

# 3. Validate results
node validate_roster_quality.js ./data/rosters_corrected.json

# 4. Manual review of remaining issues
# Review roster_correction_report.json for manual fixes needed

# 5. Replace original file when satisfied
cp data/rosters_corrected.json data/rosters.json
```

### Ongoing Maintenance (Regular)
```bash
# Weekly/Monthly quality check
node validate_roster_quality.js

# After new CSV data updates
node analyze_roster_names.js
node correct_roster_names.js
```

### New Player Addition Process
1. **Add player to roster.json with complete fullName**
2. **Run validation**: `node validate_roster_quality.js`
3. **Address any issues identified**
4. **Commit changes with validation report**

## Manual Review Guidelines

### Players Not Found in CSV
- Research player using official MLB sources
- Check for name variations (nicknames, alternate spellings)
- Verify team assignment and position
- Update manually with authoritative source

### Accent Corrections
Common patterns requiring manual verification:
- Jose → José
- Martinez → Martínez  
- Rodriguez → Rodríguez
- Gonzalez → González
- Hernandez → Hernández
- Perez → Pérez

### Validation Warnings
Address in order of priority:
1. **Critical**: Missing required fields
2. **High**: Invalid teams, abbreviated names
3. **Medium**: Duplicates, format issues
4. **Low**: Special character inconsistencies

## Integration with Application

### BaseballTracker Integration
- Roster data is consumed by React application via dataService
- Player identification relies on name + team combination
- Full names are displayed in UI components
- Search functionality depends on complete name data

### Data Pipeline Dependencies
- CSV data sources must be updated before running corrections
- Changes to roster.json require application restart for cache refresh
- Team abbreviations must match across all data sources

## Automation Recommendations

### CI/CD Integration
```yaml
# Suggested GitHub Actions workflow
name: Roster Data Quality Check
on:
  pull_request:
    paths: ['data/rosters.json']
  
jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - name: Validate Roster Quality
        run: node validate_roster_quality.js
      - name: Check Quality Score
        run: |
          SCORE=$(cat roster_quality_report.json | jq '.quality_score')
          if [ $SCORE -lt 90 ]; then
            echo "Quality score $SCORE below threshold"
            exit 1
          fi
```

### Scheduled Maintenance
```bash
# Cron job for weekly quality checks
0 9 * * 1 cd /path/to/BaseballData && node validate_roster_quality.js && git add . && git commit -m "Weekly roster quality report"
```

## Error Handling

### Common Issues & Solutions

**Issue**: "Player not found in CSV"
**Solution**: Check if player is recent addition, traded, or has name variations

**Issue**: "Last name mismatch"  
**Solution**: Verify player identity, check for recent name changes

**Issue**: "Encoding corruption"
**Solution**: Re-enter name with proper character encoding

**Issue**: "Duplicate players"
**Solution**: Check for trades, determine most current entry, merge stats if needed

### Recovery Procedures

**Corrupted roster.json**:
1. Restore from `data/rosters_backup.json`
2. Re-run correction process
3. Validate before committing

**Failed correction process**:
1. Check CSV data integrity
2. Verify file permissions
3. Review error logs for specific issues
4. Manual intervention if needed

## Future Enhancements

### Planned Improvements
1. **Real-time validation** during roster updates
2. **Machine learning** for name matching accuracy
3. **Integration with MLB API** for authoritative player data
4. **Automated accent correction** based on player origin
5. **Cross-season player tracking** for career continuity

### Monitoring Dashboard
Consider building a web interface to:
- Display quality metrics over time
- Show correction success rates
- Highlight manual review queue
- Track data completeness by team

## File Structure

```
BaseballData/
├── data/
│   ├── rosters.json                 # Main roster data
│   ├── rosters_backup.json          # Backup created by correction script
│   ├── rosters_corrected.json       # Output from correction process
│   └── stats/
│       ├── custom_batter_2025.csv   # Source data for hitters
│       └── custom_pitcher_2025.csv  # Source data for pitchers
├── analyze_roster_names.js          # Analysis tool
├── correct_roster_names.js          # Correction tool  
├── validate_roster_quality.js       # Validation tool
├── roster_name_analysis.json        # Analysis output
├── roster_correction_report.json    # Correction output
├── roster_quality_report.json       # Validation output
└── ROSTER_MAINTENANCE_SYSTEM.md     # This documentation
```

## Contact & Support

For issues with the roster maintenance system:
1. Check validation reports for specific error details
2. Review this documentation for standard procedures
3. Examine backup files for data recovery
4. Test corrections on backup data before applying to production

## Version History

- **v1.0**: Initial implementation with analysis and correction tools
- **v1.1**: Added validation tool and comprehensive reporting
- **v1.2**: Enhanced matching strategies and confidence scoring
- **v1.3**: Integrated accent detection and special character handling

---

*Last Updated: June 25, 2025*  
*System Status: Active - 79.62% automated correction rate achieved*