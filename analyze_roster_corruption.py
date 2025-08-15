#!/usr/bin/env python3
"""
Comprehensive Roster Corruption Analysis Script

This script identifies all name/fullName mismatches in the rosters.json file
and helps identify the root cause of the corruption.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict, Counter
import re

def normalize_name_for_comparison(name):
    """Normalize a name for comparison (remove punctuation, lowercase)"""
    if not name:
        return ""
    return re.sub(r'[^a-zA-Z\s]', '', name.lower().strip())

def extract_last_name(name):
    """Extract the last name from a name string"""
    if not name:
        return ""
    # Handle formats like "A. Hays", "Austin Hays", "Hays, Austin"
    name = name.strip()
    
    if ',' in name:
        # Format: "Last, First"
        return name.split(',')[0].strip()
    elif '.' in name and len(name.split()) == 2:
        # Format: "A. Last"
        return name.split()[1].strip()
    else:
        # Format: "First Last" or "First Middle Last"
        parts = name.split()
        return parts[-1].strip() if parts else ""

def names_should_match(short_name, full_name):
    """Check if short name and full name should logically match"""
    if not short_name or not full_name:
        return False
    
    short_last = extract_last_name(short_name)
    full_last = extract_last_name(full_name)
    
    if not short_last or not full_last:
        return False
    
    # Normalize for comparison
    short_last_norm = normalize_name_for_comparison(short_last)
    full_last_norm = normalize_name_for_comparison(full_last)
    
    # Names should match if last names are similar
    return short_last_norm == full_last_norm or \
           short_last_norm in full_last_norm or \
           full_last_norm in short_last_norm

def analyze_roster_corruption(roster_file_path):
    """Analyze roster corruption and generate detailed report"""
    
    print("🔍 Comprehensive Roster Corruption Analysis")
    print("=" * 60)
    print()
    
    # Load roster data
    try:
        with open(roster_file_path, 'r') as f:
            roster = json.load(f)
    except Exception as e:
        print(f"❌ Error loading roster file: {e}")
        return False
    
    print(f"📊 Total players in roster: {len(roster)}")
    print()
    
    # Analyze corruption patterns
    mismatches = []
    corruption_patterns = defaultdict(list)
    fullname_frequency = Counter()
    
    for i, player in enumerate(roster):
        name = player.get('name', '')
        full_name = player.get('fullName', '')
        team = player.get('team', 'Unknown')
        player_type = player.get('type', 'Unknown')
        
        # Count fullName frequency
        if full_name:
            fullname_frequency[full_name] += 1
        
        # Check for name/fullName mismatch
        if name and full_name:
            if not names_should_match(name, full_name):
                mismatch = {
                    'index': i,
                    'name': name,
                    'fullName': full_name,
                    'team': team,
                    'type': player_type,
                    'playerId': player.get('playerId', 'N/A')
                }
                mismatches.append(mismatch)
                corruption_patterns[full_name].append(name)
    
    print("🚨 CORRUPTION ANALYSIS RESULTS")
    print("=" * 40)
    print(f"Total mismatches found: {len(mismatches)}")
    print()
    
    # Show most frequent corruption patterns
    print("📊 MOST FREQUENT INCORRECT FULLNAMES:")
    suspicious_fullnames = {name: count for name, count in fullname_frequency.items() 
                          if count > 5}  # Names appearing more than 5 times are suspicious
    
    for fullname, count in sorted(suspicious_fullnames.items(), key=lambda x: x[1], reverse=True):
        if fullname in corruption_patterns:
            affected_names = list(set(corruption_patterns[fullname]))
            print(f"  🔥 '{fullname}' appears {count} times, incorrectly assigned to:")
            for affected_name in affected_names[:10]:  # Show first 10
                print(f"     • {affected_name}")
            if len(affected_names) > 10:
                print(f"     ... and {len(affected_names) - 10} more")
            print()
    
    # Show specific examples of severe mismatches
    print("🎯 SEVERE MISMATCH EXAMPLES:")
    print("(Cases where names are completely different)")
    print()
    
    severe_examples = []
    for mismatch in mismatches:
        name_last = extract_last_name(mismatch['name'])
        full_last = extract_last_name(mismatch['fullName'])
        
        # Check if completely different (no common characters)
        if name_last and full_last:
            name_norm = normalize_name_for_comparison(name_last)
            full_norm = normalize_name_for_comparison(full_last)
            
            # No overlap in normalized names = severe mismatch
            if not any(char in full_norm for char in name_norm):
                severe_examples.append(mismatch)
    
    # Show worst examples
    for example in severe_examples[:20]:  # Show first 20 severe cases
        print(f"  ❌ '{example['name']}' has fullName '{example['fullName']}' "
              f"({example['type']}, {example['team']})")
    
    if len(severe_examples) > 20:
        print(f"  ... and {len(severe_examples) - 20} more severe mismatches")
    
    print()
    print("🔧 RECOMMENDED CORRECTIONS:")
    print("=" * 30)
    
    # Generate correction suggestions
    corrections = []
    
    # Known correct mappings (you'll need to expand this)
    known_corrections = {
        'A. Hays': 'Austin Hays',
        'D. Fry': 'David Fry', 
        'C. Beeter': 'Clayton Beeter',
        'C. Bellinger': 'Cody Bellinger',  # This should only be for the actual Cody Bellinger
    }
    
    for mismatch in mismatches:
        name = mismatch['name']
        if name in known_corrections:
            corrections.append({
                'name': name,
                'current_fullName': mismatch['fullName'],
                'correct_fullName': known_corrections[name],
                'team': mismatch['team'],
                'index': mismatch['index']
            })
    
    print("Immediate corrections needed:")
    for correction in corrections:
        print(f"  🔧 {correction['name']} ({correction['team']}):")
        print(f"     Current: '{correction['current_fullName']}'")
        print(f"     Should be: '{correction['correct_fullName']}'")
        print()
    
    # Save detailed report
    report_data = {
        'analysis_timestamp': '2025-08-15',
        'total_players': len(roster),
        'total_mismatches': len(mismatches),
        'severe_mismatches': len(severe_examples),
        'corruption_patterns': dict(corruption_patterns),
        'fullname_frequency': dict(fullname_frequency),
        'mismatches': mismatches,
        'suggested_corrections': corrections
    }
    
    report_file = Path(roster_file_path).parent / 'roster_corruption_analysis.json'
    with open(report_file, 'w') as f:
        json.dump(report_data, f, indent=2)
    
    print(f"📄 Detailed analysis saved to: {report_file}")
    print()
    print("🚨 CRITICAL FINDINGS:")
    print(f"  • {len(mismatches)} total name/fullName mismatches")
    print(f"  • {len(severe_examples)} severe mismatches (completely different names)")
    print(f"  • {len(suspicious_fullnames)} fullNames appear suspiciously often")
    print()
    print("💡 NEXT STEPS:")
    print("  1. Review the corruption patterns above")
    print("  2. Identify which scripts modify fullName fields")
    print("  3. Create automated correction script")
    print("  4. Implement safeguards to prevent future corruption")
    
    return True

def main():
    data_path = Path(__file__).parent / "data"
    roster_file = data_path / "rosters.json"
    
    if not roster_file.exists():
        print(f"❌ Roster file not found: {roster_file}")
        return False
    
    return analyze_roster_corruption(roster_file)

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)