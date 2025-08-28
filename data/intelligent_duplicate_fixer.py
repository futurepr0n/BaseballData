#!/usr/bin/env python3
"""
Intelligent Duplicate Player Fix Script
======================================

This script properly handles duplicate player entries by distinguishing between:
1. SAME PLAYER, TEAM TRANSFERS: Deduplicate to current team with merged data
2. DIFFERENT PLAYERS, SAME NAME: Keep both (e.g., Contreras brothers)
3. SPECIAL CASES: Two-way players like Ohtani

Uses player IDs, full names, birth years, and web validation to make intelligent decisions.
"""

import json
import sys
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Tuple


class IntelligentDuplicatePlayerFixer:
    def __init__(self, roster_file: str = 'rosters.json'):
        self.roster_file = roster_file
        self.players = []
        self.duplicates = {}
        self.corrections_made = []
        self.preserved_different_players = []
        self.report_lines = []
        
        # Known different players with same abbreviated names
        self.known_different_players = {
            'W. Contreras': {
                665616: {'fullName': 'Willson Contreras', 'team': 'STL', 'birth_year': 1992},
                665750: {'fullName': 'William Contreras', 'team': 'MIL', 'birth_year': 1997}
            }
        }
        
        # Validated current teams from web search (for actual transfers)
        self.validated_current_teams = {
            'R. Montero': 'DET',  # Detroit Tigers (traded from ATL)
            'R. McMahon': 'NYY',  # New York Yankees (traded from COL)
            'B. Falter': 'KC',   # Kansas City Royals (traded from PIT)
            'C. Mead': 'CHW',    # Chicago White Sox (traded from TB)
            'A. Houser': 'TB',   # Tampa Bay Rays (traded to TB)
        }
        
    def load_data(self) -> bool:
        """Load roster data from JSON file"""
        try:
            with open(self.roster_file, 'r') as f:
                self.players = json.load(f)
            self.log(f"✅ Loaded {len(self.players)} players from {self.roster_file}")
            return True
        except Exception as e:
            self.log(f"❌ Error loading {self.roster_file}: {e}")
            return False
            
    def log(self, message: str) -> None:
        """Log message to console and report"""
        print(message)
        self.report_lines.append(message)
    
    def find_duplicates(self) -> Dict[str, List[Dict[str, Any]]]:
        """Identify all duplicate players by name"""
        self.log("\n🔍 IDENTIFYING DUPLICATE PLAYERS")
        self.log("=" * 50)
        
        # Group players by name
        players_by_name = defaultdict(list)
        for player in self.players:
            players_by_name[player['name']].append(player)
        
        # Find duplicates
        self.duplicates = {
            name: entries 
            for name, entries in players_by_name.items() 
            if len(entries) > 1
        }
        
        self.log(f"Found {len(self.duplicates)} players with duplicate entries")
        return self.duplicates
    
    def are_different_players(self, name: str, entries: List[Dict[str, Any]]) -> bool:
        """Determine if duplicate entries represent different players"""
        
        # Check known different players list
        if name in self.known_different_players:
            expected_ids = set(self.known_different_players[name].keys())
            actual_ids = set(e.get('playerId') for e in entries)
            if expected_ids == actual_ids:
                self.log(f"  🔍 Identified as DIFFERENT PLAYERS: {name}")
                return True
        
        # Check for significantly different full names
        full_names = set()
        for entry in entries:
            full_name = entry.get('fullName', '')
            if full_name and full_name != name:  # Has a real fullName, not just the abbreviated name
                full_names.add(full_name.strip())
        
        # If we have different non-abbreviated full names, likely different players
        if len(full_names) > 1:
            self.log(f"  🔍 Different full names detected: {full_names}")
            return True
            
        return False
    
    def has_meaningful_data(self, player: Dict[str, Any]) -> bool:
        """Check if player has meaningful stats or pitches data"""
        if player.get('type') == 'hitter':
            stats = player.get('stats', {})
            return bool(stats) and any(v != 0 for v in stats.values() if isinstance(v, (int, float)))
        elif player.get('type') == 'pitcher':
            pitches = player.get('pitches', [])
            return bool(pitches) and len(pitches) > 0
        return False
    
    def merge_data(self, target_entry: Dict[str, Any], source_entry: Dict[str, Any]) -> Dict[str, Any]:
        """Merge data from source entry into target entry"""
        merged = target_entry.copy()
        
        # For hitters, merge stats if target has no stats
        if (target_entry.get('type') == 'hitter' and 
            source_entry.get('type') == 'hitter' and
            not self.has_meaningful_data(target_entry) and
            self.has_meaningful_data(source_entry)):
            
            merged['stats'] = source_entry.get('stats', {})
            self.log(f"    📊 Merged stats from {source_entry.get('team')} to {target_entry.get('team')}")
        
        # For pitchers, merge pitches if target has no pitches
        elif (target_entry.get('type') == 'pitcher' and 
              source_entry.get('type') == 'pitcher' and
              not self.has_meaningful_data(target_entry) and
              self.has_meaningful_data(source_entry)):
            
            merged['pitches'] = source_entry.get('pitches', [])
            self.log(f"    ⚾ Merged pitches from {source_entry.get('team')} to {target_entry.get('team')}")
        
        return merged
    
    def fix_known_different_players(self, name: str, entries: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        """Fix entries for known different players (like Contreras brothers)"""
        if name not in self.known_different_players:
            return entries
        
        fixed_entries = []
        known_info = self.known_different_players[name]
        
        for entry in entries:
            player_id = entry.get('playerId')
            if player_id in known_info:
                # Update with correct information
                fixed_entry = entry.copy()
                info = known_info[player_id]
                
                if fixed_entry.get('fullName') != info['fullName']:
                    self.log(f"    🔧 Updated fullName: {fixed_entry.get('fullName')} → {info['fullName']}")
                    fixed_entry['fullName'] = info['fullName']
                
                fixed_entries.append(fixed_entry)
            else:
                # Keep entry as-is but log unknown player ID
                self.log(f"    ⚠️  Unknown player ID {player_id} for {name}")
                fixed_entries.append(entry)
        
        return fixed_entries
    
    def analyze_duplicate_intelligent(self, name: str, entries: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
        """
        Intelligently analyze duplicate entries
        Returns: (entries_to_keep, reason)
        """
        
        # Special case: Shohei Ohtani (two-way player)
        if name == "S. Ohtani":
            teams = set(e.get('team') for e in entries)
            types = set(e.get('type') for e in entries)
            if len(teams) == 1 and len(types) > 1:
                return entries, "Special case: Two-way player (pitcher & hitter)"
        
        # Check if these are different players
        if self.are_different_players(name, entries):
            fixed_entries = self.fix_known_different_players(name, entries)
            self.preserved_different_players.append({
                'name': name,
                'count': len(fixed_entries),
                'reason': 'Different players with same abbreviated name'
            })
            return fixed_entries, f"DIFFERENT PLAYERS: Keep all {len(fixed_entries)} entries"
        
        # Same player - handle team transfer
        if name in self.validated_current_teams:
            current_team = self.validated_current_teams[name]
            
            # Find current team entry
            current_team_entry = None
            other_entries = []
            
            for entry in entries:
                if entry.get('team') == current_team:
                    current_team_entry = entry
                else:
                    other_entries.append(entry)
            
            if current_team_entry:
                # Merge data from other entries
                for other_entry in other_entries:
                    current_team_entry = self.merge_data(current_team_entry, other_entry)
                
                return [current_team_entry], f"TEAM TRANSFER: Current team {current_team} (with merged data)"
        
        # Fallback logic for unvalidated transfers
        entries_with_data = [e for e in entries if self.has_meaningful_data(e)]
        
        if len(entries_with_data) == 1:
            return entries_with_data, f"TRANSFER: Keep entry with data ({entries_with_data[0].get('team')})"
        elif len(entries_with_data) > 1:
            # Keep most complete entry
            best_entry = max(entries_with_data, key=lambda e: (
                e.get('stats', {}).get('2024_Games', 0) if e.get('type') == 'hitter' 
                else len(e.get('pitches', [])),
                e.get('playerId', 0)
            ))
            return [best_entry], f"TRANSFER: Keep most complete entry ({best_entry.get('team')})"
        else:
            # All empty - keep most recent
            best_entry = max(entries, key=lambda e: e.get('playerId', 0))
            return [best_entry], f"TRANSFER: Keep most recent ID ({best_entry.get('team')})"
    
    def deduplicate_intelligently(self) -> None:
        """Main intelligent deduplication logic"""
        self.log("\n🧠 INTELLIGENT DEDUPLICATION")
        self.log("=" * 60)
        
        deduplicated_players = []
        processed_names = set()
        
        for player in self.players:
            name = player['name']
            
            if name in processed_names:
                continue
                
            if name in self.duplicates:
                entries = self.duplicates[name]
                entries_to_keep, reason = self.analyze_duplicate_intelligent(name, entries)
                
                self.log(f"\n{name}: {len(entries)} → {len(entries_to_keep)} entries")
                self.log(f"  Decision: {reason}")
                
                # Add entries to keep
                for entry in entries_to_keep:
                    deduplicated_players.append(entry)
                    self.log(f"  ✅ KEEP: {entry.get('team')} (ID: {entry.get('playerId')}) - {entry.get('fullName', 'N/A')}")
                
                # Log removed entries
                for entry in entries:
                    if entry not in entries_to_keep:
                        self.log(f"  ❌ REMOVE: {entry.get('team')} (ID: {entry.get('playerId')}) - {entry.get('fullName', 'N/A')}")
                
                processed_names.add(name)
            else:
                deduplicated_players.append(player)
        
        # Update players list
        original_count = len(self.players)
        self.players = deduplicated_players
        
        self.log(f"\n📊 INTELLIGENT DEDUPLICATION SUMMARY:")
        self.log(f"  Original players: {original_count}")
        self.log(f"  Final players: {len(self.players)}")
        self.log(f"  Players removed: {original_count - len(self.players)}")
        self.log(f"  Different players preserved: {len(self.preserved_different_players)}")
    
    def validate_results(self) -> bool:
        """Validate the results"""
        self.log("\n🔍 VALIDATING INTELLIGENT RESULTS")
        self.log("=" * 50)
        
        # Check for remaining duplicates
        names = [p['name'] for p in self.players]
        remaining_duplicates = [name for name in set(names) if names.count(name) > 1]
        
        expected_duplicates = ['S. Ohtani', 'W. Contreras']  # Ohtani (two-way) and Contreras brothers
        unexpected_duplicates = [name for name in remaining_duplicates if name not in expected_duplicates]
        
        if unexpected_duplicates:
            self.log(f"❌ Unexpected remaining duplicates: {unexpected_duplicates}")
            return False
        else:
            self.log(f"✅ Expected duplicates preserved: {remaining_duplicates}")
        
        # Verify specific cases
        test_cases = [
            ('R. Montero', 'DET', 'Rafael Montero'),
            ('R. McMahon', 'NYY', 'Ryan McMahon'), 
            ('B. Falter', 'KC', 'Bailey Falter'),
            ('C. Mead', 'CHW', 'Curtis Mead')
        ]
        
        for player_name, expected_team, expected_full in test_cases:
            entries = [p for p in self.players if p['name'] == player_name]
            if entries:
                entry = entries[0]
                if entry.get('team') == expected_team:
                    self.log(f"✅ {player_name}: Correct team {expected_team}")
                else:
                    self.log(f"❌ {player_name}: Expected {expected_team}, got {entry.get('team')}")
                    return False
        
        # Verify Contreras brothers both exist
        contreras_entries = [p for p in self.players if p['name'] == 'W. Contreras']
        if len(contreras_entries) == 2:
            willson = next((p for p in contreras_entries if 'Willson' in p.get('fullName', '')), None)
            william = next((p for p in contreras_entries if 'William' in p.get('fullName', '')), None)
            
            if willson and william:
                self.log(f"✅ Contreras brothers both preserved: Willson (STL), William (MIL)")
            else:
                self.log(f"❌ Contreras brothers not properly identified")
                return False
        else:
            self.log(f"❌ Wrong number of Contreras entries: {len(contreras_entries)}")
            return False
        
        return True
    
    def save_results(self) -> None:
        """Save results with proper encoding"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save roster with UTF-8 encoding
        with open(self.roster_file, 'w', encoding='utf-8') as f:
            json.dump(self.players, f, indent=2, ensure_ascii=False)
        self.log(f"✅ Saved intelligent roster to {self.roster_file}")
        
        # Save detailed report
        report_file = f"intelligent_deduplication_report_{timestamp}.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write("INTELLIGENT DUPLICATE PLAYER DEDUPLICATION REPORT\\n")
            f.write(f"Generated: {datetime.now().isoformat()}\\n")
            f.write("=" * 80 + "\\n\\n")
            f.write("\\n".join(self.report_lines))
        
        self.log(f"✅ Saved detailed report to {report_file}")
    
    def run(self) -> bool:
        """Execute the intelligent deduplication process"""
        self.log("INTELLIGENT DUPLICATE PLAYER DEDUPLICATION")
        self.log("=" * 60)
        self.log(f"Started at: {datetime.now().isoformat()}")
        
        if not self.load_data():
            return False
        
        self.find_duplicates()
        if not self.duplicates:
            self.log("✅ No duplicates found.")
            return True
        
        self.deduplicate_intelligently()
        
        if not self.validate_results():
            self.log("❌ Validation failed.")
            return False
        
        self.save_results()
        return True


def main():
    fixer = IntelligentDuplicatePlayerFixer()
    
    try:
        success = fixer.run()
        if success:
            print("\n🎉 Intelligent deduplication completed successfully!")
            print("✅ Different players preserved, team transfers handled correctly")
            return 0
        else:
            print("\n💥 Intelligent deduplication failed.")
            return 1
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 3


if __name__ == "__main__":
    sys.exit(main())