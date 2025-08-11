#!/usr/bin/env python3
"""
Daily Roster Validation Script

This script runs daily validation checks and prevents unauthorized roster modifications.
It should be integrated into the daily automation pipeline to catch roster corruption early.
"""

import json
import sys
import os
from pathlib import Path
from datetime import datetime
from protect_roster import RosterProtector

def main():
    # Get the directory where this script is located
    script_dir = Path(__file__).parent
    data_path = script_dir / "data"
    
    print(f"🔍 Daily Roster Validation - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    protector = RosterProtector(str(data_path))
    
    # 1. Check if protection system is set up
    if not protector.backup_file.exists():
        print("⚠️  Protection system not initialized!")
        print("🔧 Setting up protection system...")
        if protector.setup_protection():
            print("✅ Protection system initialized")
        else:
            print("❌ Failed to initialize protection system")
            return False
    
    # 2. Validate roster integrity
    print("\n🔍 Checking roster integrity...")
    is_valid, issues = protector.validate_roster_integrity()
    
    if is_valid:
        print("✅ Roster integrity validated - no unauthorized changes detected")
        protector.log_protection_event("Daily validation passed - no issues")
        return True
    else:
        print("🚨 ROSTER INTEGRITY VIOLATION DETECTED!")
        print()
        for issue in issues:
            print(f"  ❌ {issue}")
        
        # Log the violation
        protector.log_protection_event(f"Daily validation FAILED - {len(issues)} issues detected")
        
        print()
        print("🛠️  RECOMMENDED ACTIONS:")
        print("  1. Review the detected changes")
        print("  2. If changes are unauthorized, run: python protect_roster.py --restore")
        print("  3. If changes are legitimate, update the protected backup")
        print()
        
        # Ask if we should auto-restore (useful for cron jobs)
        if os.getenv('ROSTER_AUTO_RESTORE', '').lower() == 'true':
            print("🔧 AUTO_RESTORE enabled - restoring from backup...")
            if protector.restore_from_backup():
                print("✅ Roster automatically restored from backup")
                return True
            else:
                print("❌ Auto-restore failed")
                return False
        
        return False

if __name__ == "__main__":
    success = main()
    sys.exit(0 if success else 1)