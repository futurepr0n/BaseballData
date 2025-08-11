#!/usr/bin/env python3
"""
Roster Team Assignment Validation Script

This script validates player team assignments in rosters.json against authoritative sources:
1. Recent daily game data (most authoritative)
2. Known major league player team assignments
3. Consistency checks for duplicate players

Usage:
    python validate_roster_teams.py [--fix] [--verbose]
"""

import json
import sys
import os
import argparse
from pathlib import Path
from typing import Dict, List, Set, Optional, Tuple
from collections import defaultdict, Counter
import re
from datetime import datetime, timedelta

class RosterValidator:
    def __init__(self, data_path: str):
        self.data_path = Path(data_path)
        self.errors = []
        self.warnings = []
        self.fixes_applied = []
        
        # Known correct team assignments (authoritative source)
        self.known_correct_teams = {
            "Bryan Reynolds": "PIT",
            "Willson Contreras": "STL", 
            "William Contreras": "MIL",
            "Pete Crow-Armstrong": "CHC",
            "Christian Yelich": "MIL",
            "Julio Rodríguez": "SEA",
            "Aaron Judge": "NYY",
            "Mookie Betts": "LAD",
            "Shohei Ohtani": "LAD",
            "Paul Goldschmidt": "STL",
            "Cody Bellinger": "CHC",
            "Nico Hoerner": "CHC",
            "Jackson Chourio": "MIL",
            "Andrew Vaughn": "CHW",
            "Nick Gonzales": "PIT",
            "Henry Davis": "PIT",
            "Brice Turang": "MIL"
        }
        
    def load_roster_data(self) -> List[Dict]:
        """Load roster data from rosters.json"""
        roster_file = self.data_path / "rosters.json"
        if not roster_file.exists():
            raise FileNotFoundError(f"Roster file not found: {roster_file}")
            
        with open(roster_file, 'r') as f:
            return json.load(f)
    
    def load_recent_game_data(self) -> Dict[str, str]:
        """Load player-team assignments from recent daily game data"""
        player_teams = {}
        
        # Look for recent game data files (last 7 days)
        game_data_dir = self.data_path / "2025" / "august"
        
        if not game_data_dir.exists():
            self.warnings.append(f"Game data directory not found: {game_data_dir}")
            return player_teams
        
        # Get recent game files
        game_files = list(game_data_dir.glob("august_*.json"))
        
        # Sort by date and take the most recent ones
        recent_files = sorted(game_files, reverse=True)[:7]  # Last 7 days
        
        for game_file in recent_files:
            try:
                with open(game_file, 'r') as f:
                    game_data = json.load(f)
                
                if isinstance(game_data, dict) and 'players' in game_data:
                    for player in game_data['players']:
                        if isinstance(player, dict):
                            name = player.get('name', '').strip()
                            team = player.get('team', '').strip()
                            full_name = player.get('fullName', '').strip()
                            
                            if name and team:
                                player_teams[name] = team
                                if full_name and full_name != name:
                                    player_teams[full_name] = team
                                    
            except Exception as e:
                self.warnings.append(f"Error loading game data from {game_file}: {e}")
        
        return player_teams
    
    def normalize_name(self, name: str) -> str:
        """Normalize player name for consistent matching"""
        if not name:
            return ""
        return re.sub(r'\s+', ' ', name.strip())
    
    def validate_known_players(self, roster_data: List[Dict]) -> None:
        """Validate known major league players against expected teams"""
        roster_lookup = {}
        
        # Create lookup dictionary
        for player in roster_data:
            name = player.get('name', '').strip()
            full_name = player.get('fullName', '').strip()
            team = player.get('team', '').strip()
            
            if name:
                roster_lookup[name] = team
            if full_name:
                roster_lookup[full_name] = team
        
        # Check known players
        for player_name, expected_team in self.known_correct_teams.items():
            found_team = None
            
            # Try different name variations
            variations = [
                player_name,
                player_name.split()[-1] + ", " + " ".join(player_name.split()[:-1]) if ' ' in player_name else player_name
            ]
            
            for variation in variations:
                if variation in roster_lookup:
                    found_team = roster_lookup[variation]
                    break
            
            if not found_team:
                self.errors.append(f"Player not found in roster: {player_name}")
            elif found_team != expected_team:
                self.errors.append(f"TEAM MISMATCH: {player_name} - Expected: {expected_team}, Found: {found_team}")
    
    def validate_against_game_data(self, roster_data: List[Dict]) -> None:
        """Validate roster teams against recent game data"""
        game_data_teams = self.load_recent_game_data()
        
        if not game_data_teams:
            self.warnings.append("No recent game data found for validation")
            return
        
        mismatches = []
        
        for player in roster_data:
            name = player.get('name', '').strip()
            full_name = player.get('fullName', '').strip()  
            roster_team = player.get('team', '').strip()
            
            # Check against game data
            game_team = None
            if full_name and full_name in game_data_teams:
                game_team = game_data_teams[full_name]
            elif name and name in game_data_teams:
                game_team = game_data_teams[name]
            
            if game_team and game_team != roster_team:
                mismatches.append({
                    'name': full_name or name,
                    'roster_team': roster_team,
                    'game_team': game_team
                })
        
        if mismatches:
            self.warnings.append(f"Found {len(mismatches)} team mismatches with recent game data:")
            for mismatch in mismatches[:10]:  # Show first 10
                self.warnings.append(f"  {mismatch['name']}: roster={mismatch['roster_team']}, games={mismatch['game_team']}")
    
    def check_duplicate_players(self, roster_data: List[Dict]) -> None:
        """Check for duplicate player entries with different teams"""
        player_teams = defaultdict(set)
        
        for player in roster_data:
            name = player.get('name', '').strip()
            full_name = player.get('fullName', '').strip()
            team = player.get('team', '').strip()
            
            if full_name and team:
                player_teams[full_name].add(team)
            elif name and team:
                player_teams[name].add(team)
        
        # Find players with multiple teams
        duplicates = [(name, teams) for name, teams in player_teams.items() if len(teams) > 1]
        
        if duplicates:
            self.warnings.append(f"Found {len(duplicates)} players with multiple team assignments:")
            for name, teams in duplicates[:10]:  # Show first 10
                self.warnings.append(f"  {name}: {', '.join(sorted(teams))}")
    
    def analyze_team_distribution(self, roster_data: List[Dict]) -> None:
        """Analyze team player distribution for anomalies"""
        team_counts = Counter()
        
        for player in roster_data:
            team = player.get('team', '').strip()
            if team:
                team_counts[team] += 1
        
        # Expected range: 25-45 players per team (rough estimate)
        anomalous_teams = []
        for team, count in team_counts.items():
            if count < 20 or count > 60:
                anomalous_teams.append((team, count))
        
        if anomalous_teams:
            self.warnings.append("Teams with unusual player counts (may indicate corruption):")
            for team, count in sorted(anomalous_teams):
                self.warnings.append(f"  {team}: {count} players")
    
    def generate_report(self) -> str:
        """Generate validation report"""
        report = []
        report.append("=" * 60)
        report.append("ROSTER TEAM ASSIGNMENT VALIDATION REPORT")
        report.append(f"Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report.append("=" * 60)
        report.append("")
        
        if self.errors:
            report.append(f"🔴 ERRORS FOUND ({len(self.errors)}):")
            for error in self.errors:
                report.append(f"  • {error}")
            report.append("")
        else:
            report.append("✅ No critical errors found")
            report.append("")
        
        if self.warnings:
            report.append(f"⚠️  WARNINGS ({len(self.warnings)}):")
            for warning in self.warnings:
                report.append(f"  • {warning}")
            report.append("")
        else:
            report.append("✅ No warnings")
            report.append("")
        
        if self.fixes_applied:
            report.append(f"🔧 FIXES APPLIED ({len(self.fixes_applied)}):")
            for fix in self.fixes_applied:
                report.append(f"  • {fix}")
            report.append("")
        
        return "\n".join(report)
    
    def validate(self, verbose: bool = False) -> bool:
        """Run full validation suite"""
        try:
            roster_data = self.load_roster_data()
            
            if verbose:
                print(f"Loaded {len(roster_data)} players from roster")
            
            # Run validation checks
            self.validate_known_players(roster_data)
            self.validate_against_game_data(roster_data)
            self.check_duplicate_players(roster_data)
            self.analyze_team_distribution(roster_data)
            
            return len(self.errors) == 0
            
        except Exception as e:
            self.errors.append(f"Validation failed: {e}")
            return False

def main():
    parser = argparse.ArgumentParser(description="Validate roster team assignments")
    parser.add_argument("--data-path", default="data", help="Path to data directory")
    parser.add_argument("--verbose", "-v", action="store_true", help="Verbose output")
    parser.add_argument("--report-file", help="Save report to file")
    
    args = parser.parse_args()
    
    # Resolve data path
    if os.path.isabs(args.data_path):
        data_path = args.data_path
    else:
        data_path = os.path.join(os.path.dirname(__file__), args.data_path)
    
    validator = RosterValidator(data_path)
    
    print("🔍 Validating roster team assignments...")
    print(f"📁 Data path: {data_path}")
    print()
    
    success = validator.validate(verbose=args.verbose)
    
    # Generate and display report
    report = validator.generate_report()
    print(report)
    
    # Save report to file if requested
    if args.report_file:
        with open(args.report_file, 'w') as f:
            f.write(report)
        print(f"Report saved to: {args.report_file}")
    
    # Exit with error code if validation failed
    sys.exit(0 if success else 1)

if __name__ == "__main__":
    main()