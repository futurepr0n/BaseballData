#!/usr/bin/env python3
"""
Systematic Review of Severe Roster Corruption Cases

This script categorizes the 150+ severe cases by corruption type and provides 
recommendations for fixing each category.
"""

import json
import sys
from pathlib import Path
from collections import defaultdict

def load_severe_cases():
    """Load severe cases from corruption report"""
    report_file = Path(__file__).parent / "data" / "roster_corruption_fix_report.json"
    with open(report_file, 'r') as f:
        data = json.load(f)
    return data.get('severe_issues', [])

def categorize_severe_cases(severe_cases):
    """Categorize severe cases by corruption type"""
    
    categories = {
        'accent_issues': [],           # Accented names that should match
        'legitimate_different': [],    # Actually different players (wrong assignment)
        'nickname_issues': [],         # Nickname/shortened name issues
        'middle_name_issues': [],      # Middle name or initial differences
        'minor_differences': [],       # Small formatting differences
        'major_corruption': []         # Completely wrong assignments
    }
    
    for case in severe_cases:
        name = case['name']
        full_name = case['fullName']
        team = case['team']
        player_type = case['type']
        
        # Analyze the mismatch
        category = analyze_name_mismatch(name, full_name)
        categories[category].append({
            'name': name,
            'fullName': full_name,
            'team': team,
            'type': player_type,
            'analysis': get_analysis_reason(name, full_name, category)
        })
    
    return categories

def analyze_name_mismatch(name, full_name):
    """Analyze type of name mismatch"""
    
    # Normalize for comparison
    name_lower = name.lower()
    full_lower = full_name.lower()
    
    # Check for accent issues (names that are actually the same player)
    accent_cases = {
        'a. gimenez': 'andrés giménez',
        'a. ibanez': 'andy ibáñez', 
        'a. ramirez': 'josé ramírez',
        'c. narvaez': 'carlos narváez',
        'c. vazquez': 'christian vázquez',
        'e. suarez': 'eugenio suárez',
        'j. dominguez': 'jasson domínguez',
        'j. pena': 'jeremy peña',
        'j. rodriguez': 'julio rodríguez',
        'l. urias': 'luis urías',
        'm. dubon': 'mauricio dubón',
        'r. marchan': 'rafael marchán',
        'v. brujan': 'vidal brujá',
        'y. fernandez': 'yanquiel fernández'
    }
    
    if name_lower in accent_cases and accent_cases[name_lower] == full_lower:
        return 'accent_issues'
    
    # Check for nickname/shortened name issues
    nickname_cases = {
        't. friedl': 'trent grisham'  # This looks wrong - different players
    }
    
    # Extract first letters/syllables for comparison
    name_parts = name_lower.replace('.', '').split()
    full_parts = full_lower.split()
    
    if len(name_parts) >= 1 and len(full_parts) >= 1:
        name_first = name_parts[0]
        full_first = full_parts[0]
        
        # Check if first names could be related (nickname, etc.)
        if name_first[0] == full_first[0] and len(name_parts) > 1 and len(full_parts) > 1:
            name_last = name_parts[-1]
            full_last = full_parts[-1]
            
            # If last names are similar, might be nickname issue
            if name_last == full_last or name_last in full_last or full_last in name_last:
                return 'minor_differences'
    
    # Check for completely different players (major corruption)
    definitely_different = [
        ('a. call', 'jose iglesias'),
        ('b. naylor', 'xander bogaerts'), 
        ('c. abrams', 'jordan westburg'),
        ('i. herrera', 'nick castellanos'),
        ('l. arraez', 'pete crow-armstrong'),
        ('s. frelick', 'j.t. realmuto'),
        # Many more obvious cases
    ]
    
    for wrong_name, wrong_full in definitely_different:
        if name_lower == wrong_name and full_lower == wrong_full:
            return 'major_corruption'
    
    # Default to major corruption for names that don't share any common elements
    return 'major_corruption'

def get_analysis_reason(name, full_name, category):
    """Get human-readable analysis reason"""
    
    reasons = {
        'accent_issues': f"Same player - '{name}' is short form of '{full_name}' with accent differences",
        'legitimate_different': f"Different players incorrectly linked",
        'nickname_issues': f"Possible nickname or shortened name relationship", 
        'middle_name_issues': f"Middle name or initial differences",
        'minor_differences': f"Minor formatting or spelling differences",
        'major_corruption': f"Completely different players - clear data corruption"
    }
    
    return reasons.get(category, "Unknown mismatch type")

def generate_fix_recommendations(categories):
    """Generate fix recommendations for each category"""
    
    recommendations = {}
    
    # Accent issues - these can be automatically fixed
    if categories['accent_issues']:
        recommendations['accent_issues'] = {
            'action': 'AUTO_FIX',
            'description': 'These are the same players with accent differences - safe to auto-fix',
            'script': 'Can be added to known_mappings in fix script',
            'count': len(categories['accent_issues'])
        }
    
    # Major corruption - need manual research
    if categories['major_corruption']:
        recommendations['major_corruption'] = {
            'action': 'MANUAL_RESEARCH',
            'description': 'Completely different players - need manual research for correct names',
            'script': 'Research each player individually and add to known_mappings',
            'count': len(categories['major_corruption'])
        }
    
    # Minor differences - review and fix
    if categories['minor_differences']:
        recommendations['minor_differences'] = {
            'action': 'REVIEW_AND_FIX',
            'description': 'Likely same players with formatting differences - review and fix',
            'script': 'Quick research to confirm, then add to known_mappings',
            'count': len(categories['minor_differences'])
        }
    
    return recommendations

def main():
    print("🔍 SYSTEMATIC REVIEW OF SEVERE CORRUPTION CASES")
    print("=" * 60)
    
    # Load severe cases
    severe_cases = load_severe_cases()
    print(f"📊 Total severe cases to review: {len(severe_cases)}")
    
    # Categorize cases
    categories = categorize_severe_cases(severe_cases)
    
    # Generate recommendations
    recommendations = generate_fix_recommendations(categories)
    
    # Print detailed analysis
    print(f"\n📋 CATEGORIZATION RESULTS:")
    print("=" * 40)
    
    for category, cases in categories.items():
        if cases:
            print(f"\n🏷️  {category.upper().replace('_', ' ')} ({len(cases)} cases):")
            
            # Show first 5 examples
            for i, case in enumerate(cases[:5]):
                print(f"   {i+1}. {case['name']} → '{case['fullName']}' ({case['team']}, {case['type']})")
                print(f"      Analysis: {case['analysis']}")
            
            if len(cases) > 5:
                print(f"   ... and {len(cases) - 5} more cases")
    
    # Print recommendations
    print(f"\n💡 FIX RECOMMENDATIONS:")
    print("=" * 40)
    
    for category, rec in recommendations.items():
        print(f"\n🎯 {category.upper().replace('_', ' ')} ({rec['count']} cases):")
        print(f"   Action: {rec['action']}")
        print(f"   Description: {rec['description']}")
        print(f"   Implementation: {rec['script']}")
    
    # Detailed breakdown for accent issues (these are safe to auto-fix)
    if categories['accent_issues']:
        print(f"\n✅ ACCENT ISSUES - SAFE TO AUTO-FIX:")
        print("=" * 40)
        accent_mappings = {}
        
        for case in categories['accent_issues']:
            accent_mappings[case['name']] = case['fullName']
            print(f"   '{case['name']}' → '{case['fullName']}' ({case['team']})")
        
        print(f"\n📝 Add these to known_mappings in fix script:")
        for name, full_name in accent_mappings.items():
            print(f"   '{name}': '{full_name}',")
    
    # Summary
    total_auto_fix = len(categories['accent_issues'])
    total_manual = len(categories['major_corruption']) + len(categories['minor_differences'])
    
    print(f"\n📊 SUMMARY:")
    print(f"   ✅ Can auto-fix: {total_auto_fix} cases (accent issues)")
    print(f"   🔍 Need manual research: {total_manual} cases")
    print(f"   📋 Total: {len(severe_cases)} cases")
    
    print(f"\n🎯 NEXT STEPS:")
    print("1. ✅ Add accent issue mappings to fix script (safe)")
    print("2. 🔍 Research major corruption cases individually") 
    print("3. 📝 Update known_mappings with research results")
    print("4. 🔄 Re-run comprehensive fix script")

if __name__ == "__main__":
    main()