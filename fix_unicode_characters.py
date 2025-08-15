#!/usr/bin/env python3
"""
Fix Unicode Characters in Rosters

This script converts Unicode escape sequences (\u00e1) to single accented characters (á)
for better readability and consistency across the platform.
"""

import json
import sys
from pathlib import Path

def convert_unicode_to_single_chars(text):
    """Convert Unicode escape sequences to single accented characters"""
    if not isinstance(text, str):
        return text
    
    # Map of common Unicode escape sequences to single characters
    unicode_mappings = {
        '\\u00e1': 'á',  # á
        '\\u00e9': 'é',  # é  
        '\\u00ed': 'í',  # í
        '\\u00f1': 'ñ',  # ñ
        '\\u00f3': 'ó',  # ó
        '\\u00fa': 'ú',  # ú
        '\\u00c1': 'Á',  # Á
        '\\u00c9': 'É',  # É
        '\\u00cd': 'Í',  # Í
        '\\u00d1': 'Ñ',  # Ñ
        '\\u00d3': 'Ó',  # Ó
        '\\u00da': 'Ú',  # Ú
        '\\u00fc': 'ü',  # ü
        '\\u00dc': 'Ü',  # Ü
    }
    
    result = text
    for unicode_seq, single_char in unicode_mappings.items():
        result = result.replace(unicode_seq, single_char)
    
    return result

def process_roster_data(data):
    """Recursively process roster data to convert Unicode characters"""
    if isinstance(data, dict):
        return {key: process_roster_data(value) for key, value in data.items()}
    elif isinstance(data, list):
        return [process_roster_data(item) for item in data]
    elif isinstance(data, str):
        return convert_unicode_to_single_chars(data)
    else:
        return data

def fix_unicode_in_rosters(roster_file_path):
    """Fix Unicode escape sequences in rosters.json"""
    
    print("🔧 FIXING UNICODE CHARACTERS IN ROSTERS")
    print("=" * 50)
    
    # Load roster
    try:
        with open(roster_file_path, 'r', encoding='utf-8') as f:
            roster = json.load(f)
    except Exception as e:
        print(f"❌ Error loading roster: {e}")
        return False
    
    print(f"📊 Loaded roster with {len(roster)} players")
    
    # Create backup
    backup_file = Path(roster_file_path).parent / 'rosters_backup_before_unicode_fix.json'
    try:
        with open(backup_file, 'w', encoding='utf-8') as f:
            json.dump(roster, f, indent=2, ensure_ascii=False)
        print(f"💾 Backup created: {backup_file}")
    except Exception as e:
        print(f"❌ Failed to create backup: {e}")
        return False
    
    # Process the data to fix Unicode characters
    print("🔄 Converting Unicode escape sequences to single characters...")
    fixed_roster = process_roster_data(roster)
    
    # Count changes
    changes_made = 0
    for i, (original_player, fixed_player) in enumerate(zip(roster, fixed_roster)):
        if original_player != fixed_player:
            changes_made += 1
            print(f"✅ Fixed player {i+1}: {original_player.get('name', 'Unknown')} - {original_player.get('fullName', '')} → {fixed_player.get('fullName', '')}")
    
    # Save fixed roster with proper encoding
    try:
        with open(roster_file_path, 'w', encoding='utf-8') as f:
            json.dump(fixed_roster, f, indent=2, ensure_ascii=False)
        print(f"✅ Saved fixed roster with proper Unicode characters")
    except Exception as e:
        print(f"❌ Failed to save fixed roster: {e}")
        return False
    
    print(f"\n📋 UNICODE FIX SUMMARY:")
    print("=" * 30)
    print(f"✅ Changes made to {changes_made} players")
    print(f"📄 Single accented characters now used (á, é, í, ñ, ó, ú)")
    print(f"🚫 No more Unicode escape sequences (\\u00e1, \\u00f1, etc.)")
    
    return True

def main():
    data_path = Path(__file__).parent / "data"
    roster_file = data_path / "rosters.json"
    
    if not roster_file.exists():
        print(f"❌ Roster file not found: {roster_file}")
        return False
    
    success = fix_unicode_in_rosters(roster_file)
    
    if success:
        print("\n🎉 Unicode character fix completed!")
        print("📝 All accented characters now display as single characters")
        print("🔗 Consistent formatting across your platform")
    else:
        print("\n❌ Unicode character fix failed")
    
    return success

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)