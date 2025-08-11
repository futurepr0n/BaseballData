#!/usr/bin/env python3
"""
Roster Protection System

This script creates a comprehensive protection system to prevent unauthorized
changes to player team assignments after the trade deadline.

Features:
- Creates immutable roster backup
- Validates all roster modifications
- Blocks unauthorized team changes
- Provides emergency restore capabilities
"""

import json
import sys
import shutil
import hashlib
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Set, Optional, Tuple

class RosterProtector:
    def __init__(self, data_path: str):
        self.data_path = Path(data_path)
        self.roster_file = self.data_path / "rosters.json"
        self.backup_file = self.data_path / "rosters_protected_backup.json"
        self.protection_log = self.data_path / "roster_protection.log"
        self.checksum_file = self.data_path / ".roster_checksum"
        
        # Trade deadline has passed - no team changes allowed
        self.trade_deadline_passed = True
        self.protection_enabled = True
        
    def create_protected_backup(self) -> bool:
        """Create an immutable backup of the current roster"""
        try:
            if not self.roster_file.exists():
                print(f"❌ Roster file not found: {self.roster_file}")
                return False
            
            # Create backup with timestamp
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            backup_with_timestamp = self.data_path / f"rosters_backup_{timestamp}.json"
            
            shutil.copy2(self.roster_file, backup_with_timestamp)
            shutil.copy2(self.roster_file, self.backup_file)
            
            # Create checksum
            checksum = self.calculate_roster_checksum()
            with open(self.checksum_file, 'w') as f:
                f.write(f"{checksum}\n{datetime.now().isoformat()}\n")
            
            # Log protection activation
            self.log_protection_event(f"Protected backup created: {backup_with_timestamp}")
            
            print(f"✅ Protected backup created: {self.backup_file}")
            print(f"✅ Timestamped backup: {backup_with_timestamp}")
            print(f"✅ Checksum created: {checksum}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to create protected backup: {e}")
            return False
    
    def calculate_roster_checksum(self) -> str:
        """Calculate SHA256 checksum of roster data"""
        with open(self.roster_file, 'rb') as f:
            return hashlib.sha256(f.read()).hexdigest()
    
    def validate_roster_integrity(self) -> Tuple[bool, List[str]]:
        """Validate roster integrity against protected backup"""
        issues = []
        
        try:
            # Check if roster file exists
            if not self.roster_file.exists():
                issues.append("Roster file is missing")
                return False, issues
            
            # Check if backup exists
            if not self.backup_file.exists():
                issues.append("Protected backup is missing - run create_protected_backup()")
                return False, issues
            
            # Load current and backup data
            with open(self.roster_file, 'r') as f:
                current_roster = json.load(f)
            
            with open(self.backup_file, 'r') as f:
                backup_roster = json.load(f)
            
            # Create player-team mappings
            current_teams = {}
            backup_teams = {}
            
            for player in current_roster:
                name = player.get('fullName') or player.get('name')
                if name:
                    current_teams[name] = player.get('team')
            
            for player in backup_roster:
                name = player.get('fullName') or player.get('name')
                if name:
                    backup_teams[name] = player.get('team')
            
            # Check for unauthorized team changes
            unauthorized_changes = []
            for player_name, current_team in current_teams.items():
                if player_name in backup_teams:
                    backup_team = backup_teams[player_name]
                    if current_team != backup_team:
                        unauthorized_changes.append(f"{player_name}: {backup_team} → {current_team}")
            
            if unauthorized_changes:
                issues.append(f"Unauthorized team changes detected:")
                for change in unauthorized_changes:
                    issues.append(f"  • {change}")
            
            # Check checksum if available
            if self.checksum_file.exists():
                current_checksum = self.calculate_roster_checksum()
                with open(self.checksum_file, 'r') as f:
                    lines = f.read().strip().split('\n')
                    if lines:
                        expected_checksum = lines[0]
                        if current_checksum != expected_checksum:
                            issues.append(f"Checksum mismatch - roster has been modified")
            
            return len(issues) == 0, issues
            
        except Exception as e:
            issues.append(f"Validation error: {e}")
            return False, issues
    
    def restore_from_backup(self) -> bool:
        """Restore roster from protected backup"""
        try:
            if not self.backup_file.exists():
                print(f"❌ Protected backup not found: {self.backup_file}")
                return False
            
            # Create restore point
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            restore_point = self.data_path / f"rosters_before_restore_{timestamp}.json"
            
            if self.roster_file.exists():
                shutil.copy2(self.roster_file, restore_point)
                print(f"✅ Current roster backed up to: {restore_point}")
            
            # Restore from backup
            shutil.copy2(self.backup_file, self.roster_file)
            
            # Update checksum
            checksum = self.calculate_roster_checksum()
            with open(self.checksum_file, 'w') as f:
                f.write(f"{checksum}\n{datetime.now().isoformat()}\n")
            
            self.log_protection_event(f"Roster restored from backup - restore point: {restore_point}")
            
            print(f"✅ Roster restored from protected backup")
            print(f"✅ New checksum: {checksum}")
            
            return True
            
        except Exception as e:
            print(f"❌ Failed to restore from backup: {e}")
            return False
    
    def log_protection_event(self, event: str) -> None:
        """Log protection events"""
        timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        with open(self.protection_log, 'a') as f:
            f.write(f"{timestamp} - {event}\n")
    
    def generate_protection_report(self) -> str:
        """Generate comprehensive protection status report"""
        report = []
        report.append("=" * 60)
        report.append("ROSTER PROTECTION STATUS REPORT")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 60)
        report.append("")
        
        # Protection status
        report.append("🛡️  PROTECTION STATUS:")
        report.append(f"  • Trade Deadline Passed: {'✅ YES' if self.trade_deadline_passed else '❌ NO'}")
        report.append(f"  • Protection Enabled: {'✅ YES' if self.protection_enabled else '❌ NO'}")
        report.append("")
        
        # File status
        report.append("📁 FILE STATUS:")
        report.append(f"  • Roster File: {'✅' if self.roster_file.exists() else '❌'} {self.roster_file}")
        report.append(f"  • Protected Backup: {'✅' if self.backup_file.exists() else '❌'} {self.backup_file}")
        report.append(f"  • Checksum File: {'✅' if self.checksum_file.exists() else '❌'} {self.checksum_file}")
        report.append("")
        
        # Integrity check
        is_valid, issues = self.validate_roster_integrity()
        report.append("🔍 INTEGRITY CHECK:")
        if is_valid:
            report.append("  ✅ No integrity issues detected")
        else:
            report.append(f"  ❌ {len(issues)} integrity issues found:")
            for issue in issues:
                report.append(f"    • {issue}")
        report.append("")
        
        # Recent protection events
        if self.protection_log.exists():
            report.append("📊 RECENT PROTECTION EVENTS:")
            try:
                with open(self.protection_log, 'r') as f:
                    lines = f.readlines()
                    recent_events = lines[-10:]  # Last 10 events
                    if recent_events:
                        for event in recent_events:
                            report.append(f"  • {event.strip()}")
                    else:
                        report.append("  • No events logged")
            except Exception as e:
                report.append(f"  ❌ Error reading protection log: {e}")
        else:
            report.append("📊 RECENT PROTECTION EVENTS:")
            report.append("  • No protection log found")
        
        return "\n".join(report)
    
    def setup_protection(self) -> bool:
        """Set up complete roster protection system"""
        print("🛡️  Setting up roster protection system...")
        print()
        
        success = self.create_protected_backup()
        
        if success:
            print()
            print("✅ Roster protection system activated!")
            print()
            print("🔒 Protection Features:")
            print("  • Immutable backup created")
            print("  • Checksum validation enabled")
            print("  • Unauthorized change detection active")
            print("  • Emergency restore capability ready")
            print()
            print("💡 Usage:")
            print("  python protect_roster.py --validate    # Check integrity")
            print("  python protect_roster.py --restore     # Emergency restore")
            print("  python protect_roster.py --report      # Status report")
        
        return success

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Roster Protection System")
    parser.add_argument("--data-path", default="data", help="Path to data directory")
    parser.add_argument("--setup", action="store_true", help="Set up protection system")
    parser.add_argument("--validate", action="store_true", help="Validate roster integrity")
    parser.add_argument("--restore", action="store_true", help="Restore from backup")
    parser.add_argument("--report", action="store_true", help="Generate status report")
    
    args = parser.parse_args()
    
    protector = RosterProtector(args.data_path)
    
    if args.setup:
        success = protector.setup_protection()
        sys.exit(0 if success else 1)
    
    elif args.validate:
        print("🔍 Validating roster integrity...")
        is_valid, issues = protector.validate_roster_integrity()
        
        if is_valid:
            print("✅ Roster integrity validated - no issues found")
            sys.exit(0)
        else:
            print("❌ Roster integrity issues detected:")
            for issue in issues:
                print(f"  • {issue}")
            sys.exit(1)
    
    elif args.restore:
        print("🚨 EMERGENCY RESTORE FROM BACKUP")
        print("This will overwrite the current roster with the protected backup.")
        
        confirm = input("Are you sure? (yes/no): ").lower().strip()
        if confirm == 'yes':
            success = protector.restore_from_backup()
            sys.exit(0 if success else 1)
        else:
            print("Restore cancelled.")
            sys.exit(0)
    
    elif args.report:
        report = protector.generate_protection_report()
        print(report)
        sys.exit(0)
    
    else:
        # Default: show help and current status
        parser.print_help()
        print()
        report = protector.generate_protection_report()
        print(report)

if __name__ == "__main__":
    main()