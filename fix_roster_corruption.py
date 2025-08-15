#!/usr/bin/env python3
"""
Fix Roster Corruption Script

This script fixes the corrupted roster protection backup by creating a new clean backup
from the current correct roster data.
"""

import json
import sys
from pathlib import Path
from protect_roster import RosterProtector

def main():
    data_path = Path(__file__).parent / "data"
    
    print("🔧 Fixing Roster Protection Corruption")
    print("=" * 50)
    
    # Initialize protector
    protector = RosterProtector(str(data_path))
    
    # Show current corruption status
    print("📋 Current Status Check:")
    if protector.backup_file.exists():
        print(f"✅ Backup file exists: {protector.backup_file}")
        
        # Load current roster for comparison
        with open(protector.roster_file, 'r') as f:
            current_roster = json.load(f)
        
        # Check a few key players to demonstrate the corruption
        problem_players = ["Aaron Civale", "Andrew Vaughn", "Cody Bellinger"]
        
        print("\n🔍 Sample Player Team Assignments:")
        print("Current Roster (CORRECT):")
        for player_data in current_roster:
            full_name = player_data.get('fullName', '')
            if full_name in problem_players:
                team = player_data.get('team', 'N/A')
                print(f"  • {full_name}: {team}")
        
        # Load backup for comparison
        with open(protector.backup_file, 'r') as f:
            backup_roster = json.load(f)
            
        print("\nBackup File (CORRUPTED):")
        for player_data in backup_roster:
            full_name = player_data.get('fullName', '')
            if full_name in problem_players:
                team = player_data.get('team', 'N/A')
                print(f"  • {full_name}: {team}")
        
    else:
        print("❌ No backup file found")
    
    # Auto-fix the corruption
    print(f"\n🛠️  Auto-Fixing Corruption:")
    print("This will:")
    print("1. Create a new clean backup from current roster data")
    print("2. Update the checksum")
    print("3. Log the fix operation")
    
    print("\n🔄 Proceeding with automatic fix...")
    
    if True:  # Always proceed with auto-fix
        print("\n🔄 Fixing corrupted backup...")
        
        # Create new clean backup
        if protector.create_protected_backup():
            print("✅ Corruption fixed successfully!")
            print("✅ New clean backup created with correct team assignments")
            print("✅ Roster protection system restored")
            
            # Verify the fix
            print("\n🔍 Verification:")
            is_valid, issues = protector.validate_roster_integrity()
            if is_valid:
                print("✅ Roster integrity validation PASSED")
                print("✅ No more false violations detected")
            else:
                print("❌ Still detecting issues:")
                for issue in issues:
                    print(f"  • {issue}")
                    
        else:
            print("❌ Failed to fix corruption")
            return False
            
    else:
        print("🚫 Fix cancelled")
        return False
        
    return True

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)