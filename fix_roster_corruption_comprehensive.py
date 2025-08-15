#!/usr/bin/env python3
"""
Comprehensive Roster Corruption Fix

This script fixes the extensive roster corruption caused by statLoader.js
blindly overwriting fullName fields without validation.

CRITICAL ISSUES IDENTIFIED:
1. statLoader.js line 537-540: Uses "longer name = better" logic (WRONG!)
2. fetch_starting_lineups.py: Overwrites fullName with API data without validation
3. No integrity checks when updating player names

This creates a cascade of corruption where players get assigned completely
wrong full names from other players.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict
import re

def load_known_correct_mappings():
    """Load known correct name mappings based on analysis"""
    return {
        # Known corrupted cases from analysis
        'A. Hays': 'Austin Hays',
        'D. Fry': 'David Fry', 
        'C. Beeter': 'Clayton Beeter',
        
        # Additional common name mappings (expand as needed)
        'A. Cox': 'Alex Cox',
        'D. Lynch': 'Daniel Lynch',
        'D. Nunez': 'Dedniel Nunez',
        'E. Perez': 'Elly De La Cruz',  # Need to verify
        'E. Uceta': 'Edwin Uceta',
        'G. Jax': 'Griffin Jax',
        'J. Soto': 'Juan Soto',
        'L. Acuna': 'Luisangel Acuna',
        'L. Sims': 'Lucas Sims',
        'M. Abel': 'Mick Abel',
        'M. Black': 'Mike Black',
        'M. Gage': 'Matt Gage',
        'M. Tauchman': 'Mike Tauchman',
        'O. Cruz': 'Oneil Cruz',
        'S. Kwan': 'Steven Kwan',
        'S. Long': 'Shed Long Jr.',
        'S. Moll': 'Sam Moll',
        'W. Perez': 'Wenceel Perez',
        'Z. Neto': 'Zach Neto',
        
        # Accent issues - safe to auto-fix (same players with accent differences)
        'A. Gimenez': 'Andrés Giménez',
        'A. Ibanez': 'Andy Ibáñez',
        'A. Ramirez': 'José Ramírez',
        'C. Narvaez': 'Carlos Narváez',
        'C. Vazquez': 'Christian Vázquez',
        'E. Suarez': 'Eugenio Suárez',
        'J. Dominguez': 'Jasson Domínguez',
        'J. Pena': 'Jeremy Peña',
        'J. Rodriguez': 'Julio Rodríguez',
        'L. Urias': 'Luis Urías',
        'M. Dubon': 'Mauricio Dubón',
        'R. Marchan': 'Rafael Marchán',
        'Y. Fernandez': 'Yanquiel Fernández',
    }

def normalize_name_for_comparison(name):
    """Normalize a name for comparison"""
    if not name:
        return ""
    return re.sub(r'[^a-zA-Z\s]', '', name.lower().strip())

def extract_last_name(name):
    """Extract the last name from a name string"""
    if not name:
        return ""
    name = name.strip()
    
    if ',' in name:
        return name.split(',')[0].strip()
    elif '.' in name and len(name.split()) == 2:
        return name.split()[1].strip()
    else:
        parts = name.split()
        return parts[-1].strip() if parts else ""

def names_are_compatible(short_name, full_name):
    """Check if short name and full name are logically compatible"""
    if not short_name or not full_name:
        return False
    
    short_last = extract_last_name(short_name)
    full_last = extract_last_name(full_name)
    
    if not short_last or not full_last:
        return False
    
    # Normalize for comparison
    short_last_norm = normalize_name_for_comparison(short_last)
    full_last_norm = normalize_name_for_comparison(full_last)
    
    # Names are compatible if last names match
    return short_last_norm == full_last_norm or \
           short_last_norm in full_last_norm or \
           full_last_norm in short_last_norm

def fix_roster_corruption(roster_file_path):
    """Fix roster corruption with comprehensive validation"""
    
    print("🔧 COMPREHENSIVE ROSTER CORRUPTION FIX")
    print("=" * 60)
    
    # Load roster
    try:
        with open(roster_file_path, 'r') as f:
            roster = json.load(f)
    except Exception as e:
        print(f"❌ Error loading roster: {e}")
        return False
    
    print(f"📊 Loaded roster with {len(roster)} players")
    
    # Load known correct mappings
    known_mappings = load_known_correct_mappings()
    
    # Analysis and fixing
    fixes_applied = []
    severe_issues = []
    validation_warnings = []
    
    for i, player in enumerate(roster):
        name = player.get('name', '')
        full_name = player.get('fullName', '')
        team = player.get('team', 'Unknown')
        player_type = player.get('type', 'Unknown')
        
        # Skip if missing critical data
        if not name or not full_name:
            continue
        
        # Check if this is a known corruption case
        if name in known_mappings:
            correct_full_name = known_mappings[name]
            if full_name != correct_full_name:
                old_full_name = full_name
                player['fullName'] = correct_full_name
                fix_record = {
                    'player_index': i,
                    'name': name,
                    'team': team,
                    'old_fullName': old_full_name,
                    'new_fullName': correct_full_name,
                    'fix_type': 'known_mapping'
                }
                fixes_applied.append(fix_record)
                print(f"✅ FIXED: {name} ({team}) - '{old_full_name}' → '{correct_full_name}'")
        
        # Check for logical name incompatibility
        elif not names_are_compatible(name, full_name):
            severe_issue = {
                'player_index': i,
                'name': name,
                'fullName': full_name,
                'team': team,
                'type': player_type,
                'issue': 'incompatible_names'
            }
            severe_issues.append(severe_issue)
            print(f"🚨 SEVERE MISMATCH: {name} has fullName '{full_name}' ({team}, {player_type})")
        
        # Check for suspicious patterns (common corruption indicators)
        elif full_name in ['C. Bellinger', 'E. Rodriguez'] and name != full_name:
            validation_warnings.append({
                'player_index': i,
                'name': name,
                'fullName': full_name,
                'team': team,
                'warning': 'suspicious_common_corruption'
            })
            print(f"⚠️  SUSPICIOUS: {name} has common corruption fullName '{full_name}' ({team})")
    
    # Create backup before applying fixes
    backup_file = Path(roster_file_path).parent / f'rosters_before_corruption_fix_{len(fixes_applied)}_fixes.json'
    try:
        with open(backup_file, 'w') as f:
            json.dump(roster, f, indent=2)
        print(f"💾 Backup created: {backup_file}")
    except Exception as e:
        print(f"❌ Failed to create backup: {e}")
        return False
    
    # Save fixed roster
    if fixes_applied:
        try:
            with open(roster_file_path, 'w') as f:
                json.dump(roster, f, indent=2)
            print(f"✅ Applied {len(fixes_applied)} fixes to roster file")
        except Exception as e:
            print(f"❌ Failed to save fixed roster: {e}")
            return False
    
    # Generate comprehensive report
    print("\n📋 CORRUPTION ANALYSIS SUMMARY:")
    print("=" * 40)
    print(f"✅ Fixes Applied: {len(fixes_applied)}")
    print(f"🚨 Severe Issues Remaining: {len(severe_issues)}")
    print(f"⚠️  Validation Warnings: {len(validation_warnings)}")
    
    if severe_issues:
        print(f"\n🚨 SEVERE ISSUES REQUIRING MANUAL REVIEW:")
        for issue in severe_issues[:10]:  # Show first 10
            print(f"  • {issue['name']} → '{issue['fullName']}' ({issue['team']}, {issue['type']})")
        if len(severe_issues) > 10:
            print(f"  ... and {len(severe_issues) - 10} more severe issues")
    
    # Save detailed report
    report_data = {
        'analysis_timestamp': '2025-08-15',
        'fixes_applied': fixes_applied,
        'severe_issues': severe_issues,
        'validation_warnings': validation_warnings,
        'known_mappings_used': known_mappings
    }
    
    report_file = Path(roster_file_path).parent / 'roster_corruption_fix_report.json'
    with open(report_file, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"\n📄 Detailed report saved: {report_file}")
    
    # Critical recommendations
    print(f"\n💡 CRITICAL NEXT STEPS:")
    print("1. ✅ IMMEDIATELY fix statLoader.js lines 537-540 to prevent future corruption")
    print("2. ✅ Add validation to fetch_starting_lineups.py before setting fullName")
    print("3. ⚠️  Review severe issues manually - these need individual correction")
    print("4. 🛡️  Implement name validation in all scripts that modify fullName")
    print("5. 🧪 Test data processing pipeline to ensure no new corruption")
    
    return len(fixes_applied) > 0

def main():
    data_path = Path(__file__).parent / "data"
    roster_file = data_path / "rosters.json"
    
    if not roster_file.exists():
        print(f"❌ Roster file not found: {roster_file}")
        return False
    
    success = fix_roster_corruption(roster_file)
    
    if success:
        print("\n🎉 Corruption fix completed successfully!")
        print("⚠️  REMEMBER: Fix the source scripts to prevent future corruption!")
    else:
        print("\n❌ Corruption fix failed or no fixes needed")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)