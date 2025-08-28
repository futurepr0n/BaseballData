#!/usr/bin/env python3
"""
Corrected Duplicate Players Fix Script
=====================================

This script properly handles duplicate player entries by:
1. Keeping the player's CURRENT team (validated via web search results)
2. Merging statistical data from previous team entries into current team
3. Preserving all meaningful data while maintaining current team accuracy

Known Current Teams (from web search validation):
- R. Montero: Detroit Tigers (traded from Atlanta)
- R. McMahon: New York Yankees (traded from Colorado) ✓
- B. Falter: Kansas City Royals (traded from Pittsburgh)
- C. Mead: Chicago White Sox (traded from Tampa Bay)
"""

import json
import sys
from datetime import datetime
from collections import defaultdict
from typing import Dict, List, Any, Tuple


class CorrectedDuplicatePlayerFixer:
    def __init__(self, roster_file: str = 'rosters.json'):
        self.roster_file = roster_file
        self.players = []
        self.duplicates = {}
        self.corrections_made = []
        self.report_lines = []
        
        # Verified current teams from web search
        self.validated_current_teams = {
            'R. Montero': 'DET',  # Detroit Tigers (traded from ATL)
            'R. McMahon': 'NYY',  # New York Yankees (traded from COL) - Already correct
            'B. Falter': 'KC',   # Kansas City Royals (traded from PIT)  
            'C. Mead': 'CHW',    # Chicago White Sox (traded from TB)
            'A. Houser': 'TB',   # Tampa Bay Rays (traded to TB for C. Mead)
            'S. Ohtani': 'LAD',  # Special case - keep both pitcher and hitter entries
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
            self.log(f"  📊 Merged stats from {source_entry.get('team')} to {target_entry.get('team')}")
        
        # For pitchers, merge pitches if target has no pitches
        elif (target_entry.get('type') == 'pitcher' and 
              source_entry.get('type') == 'pitcher' and
              not self.has_meaningful_data(target_entry) and
              self.has_meaningful_data(source_entry)):
            
            merged['pitches'] = source_entry.get('pitches', [])
            self.log(f"  ⚾ Merged pitches from {source_entry.get('team')} to {target_entry.get('team')}")
        
        # Always preserve the most complete fullName
        if source_entry.get('fullName') and len(source_entry.get('fullName', '')) > len(target_entry.get('fullName', '')):
            merged['fullName'] = source_entry.get('fullName')
        
        return merged
    
    def analyze_duplicate_corrected(self, name: str, entries: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
        """
        Analyze duplicate with proper team validation
        Returns: (entries_to_keep, reason)
        """
        
        # Special case: Shohei Ohtani (keep both pitcher and hitter)
        if name == "S. Ohtani":
            teams = set(e.get('team') for e in entries)
            types = set(e.get('type') for e in entries)
            if len(teams) == 1 and len(types) > 1:
                return entries, "Special case: Two-way player (pitcher & hitter)"
        
        # Check if we have validated current team info
        if name in self.validated_current_teams:
            current_team = self.validated_current_teams[name]
            
            # Find entry matching current team
            current_team_entry = None
            other_entries = []
            
            for entry in entries:
                if entry.get('team') == current_team:
                    current_team_entry = entry
                else:
                    other_entries.append(entry)
            
            if current_team_entry:
                # Merge data from other entries into current team entry
                for other_entry in other_entries:
                    current_team_entry = self.merge_data(current_team_entry, other_entry)
                
                return [current_team_entry], f"Current team validated: {current_team} (with merged data)"
        
        # Fallback to original logic for unvalidated players
        entries_with_data = [e for e in entries if self.has_meaningful_data(e)]
        
        if len(entries_with_data) == 1:
            return entries_with_data, f"Keep entry with data ({entries_with_data[0].get('team')})"
        elif len(entries_with_data) > 1:
            best_entry = max(entries_with_data, key=lambda e: (
                e.get('stats', {}).get('2024_Games', 0) if e.get('type') == 'hitter' 
                else len(e.get('pitches', [])),
                e.get('playerId', 0)
            ))
            return [best_entry], f"Keep most complete entry ({best_entry.get('team')})"
        else:
            best_entry = max(entries, key=lambda e: e.get('playerId', 0))
            return [best_entry], f"All empty - keep recent ID ({best_entry.get('team')})"
    
    def deduplicate_players_corrected(self) -> None:
        """Main corrected deduplication logic"""
        self.log("\n🔧 CORRECTED DEDUPLICATION WITH TEAM VALIDATION")
        self.log("=" * 60)
        
        # Create new list of deduplicated players
        deduplicated_players = []
        processed_names = set()
        
        for player in self.players:
            name = player['name']
            
            if name in processed_names:
                continue
                
            if name in self.duplicates:
                # Handle duplicate with corrected logic
                entries = self.duplicates[name]
                entries_to_keep, reason = self.analyze_duplicate_corrected(name, entries)
                
                self.log(f"\n{name}: {len(entries)} -> {len(entries_to_keep)} entries")
                self.log(f"  Reason: {reason}")
                
                # Track what we changed
                if name in self.validated_current_teams:
                    correction = {
                        'player': name,
                        'validated_team': self.validated_current_teams[name],
                        'entries_before': len(entries),
                        'entries_after': len(entries_to_keep),
                        'action': reason
                    }
                    self.corrections_made.append(correction)
                
                # Add entries to keep
                for entry in entries_to_keep:
                    deduplicated_players.append(entry)
                    self.log(f"  ✅ KEEP: {entry.get('team')} (ID: {entry.get('playerId')})")
                
                # Log removed entries
                for entry in entries:
                    if entry not in entries_to_keep:
                        self.log(f"  ❌ REMOVE: {entry.get('team')} (ID: {entry.get('playerId')})")
                
                processed_names.add(name)
            else:
                # No duplicate, keep as-is
                deduplicated_players.append(player)
        
        # Update players list
        original_count = len(self.players)
        self.players = deduplicated_players
        
        self.log(f"\n📊 CORRECTED DEDUPLICATION SUMMARY:")
        self.log(f"  Original players: {original_count}")
        self.log(f"  Deduplicated players: {len(self.players)}")
        self.log(f"  Team validations made: {len(self.corrections_made)}")
    
    def save_results(self) -> None:
        """Save corrected results"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save deduplicated roster with proper UTF-8 encoding
        with open(self.roster_file, 'w', encoding='utf-8') as f:
            json.dump(self.players, f, indent=2, ensure_ascii=False)
        self.log(f"✅ Saved corrected roster to {self.roster_file}")
        
        # Save corrections report
        corrections_file = f"team_validation_corrections_{timestamp}.json"
        with open(corrections_file, 'w', encoding='utf-8') as f:
            json.dump({
                'timestamp': datetime.now().isoformat(),
                'validated_teams': self.validated_current_teams,
                'corrections_made': self.corrections_made,
                'total_players': len(self.players)
            }, f, indent=2, ensure_ascii=False)
        
        self.log(f"✅ Saved corrections report to {corrections_file}")
        
        # Save detailed report
        report_file = f"corrected_deduplication_report_{timestamp}.txt"
        with open(report_file, 'w', encoding='utf-8') as f:
            f.write(f"CORRECTED DUPLICATE PLAYER DEDUPLICATION REPORT\\n")
            f.write(f"Generated: {datetime.now().isoformat()}\\n")
            f.write("=" * 80 + "\\n\\n")
            f.write("\\n".join(self.report_lines))
            
            f.write(f"\\n\\nVALIDATED TEAM CHANGES:\\n")
            f.write("-" * 40 + "\\n")
            for correction in self.corrections_made:
                f.write(f"Player: {correction['player']}\\n")
                f.write(f"Validated Team: {correction['validated_team']}\\n")
                f.write(f"Action: {correction['action']}\\n")
                f.write("-" * 40 + "\\n")
        
        self.log(f"✅ Saved detailed report to {report_file}")
    
    def validate_results(self) -> bool:
        """Validate the corrected results"""
        self.log("\\n🔍 VALIDATING CORRECTED RESULTS")
        self.log("=" * 50)
        
        # Check for remaining duplicates
        names = [p['name'] for p in self.players]
        remaining_duplicates = [name for name in set(names) if names.count(name) > 1]
        
        if remaining_duplicates:
            allowed_duplicates = ['S. Ohtani']
            unexpected_duplicates = [name for name in remaining_duplicates if name not in allowed_duplicates]
            
            if unexpected_duplicates:
                self.log(f"❌ Unexpected remaining duplicates: {unexpected_duplicates}")
                return False
            else:
                self.log(f"✅ Only expected duplicates remain: {remaining_duplicates}")
        
        # Verify specific cases are correct
        for player_name, expected_team in [('R. Montero', 'DET'), ('R. McMahon', 'NYY'), 
                                          ('B. Falter', 'KC'), ('C. Mead', 'CHW')]:
            player_entries = [p for p in self.players if p['name'] == player_name]
            if player_entries:
                actual_team = player_entries[0].get('team')
                if actual_team == expected_team:
                    self.log(f"✅ {player_name}: Correct team {expected_team}")
                else:
                    self.log(f"❌ {player_name}: Expected {expected_team}, got {actual_team}")
                    return False
        
        self.log(f"✅ Total players: {len(self.players)}")
        return True
    
    def run(self) -> bool:
        """Execute the complete corrected deduplication process"""
        self.log("CORRECTED DUPLICATE PLAYER DEDUPLICATION SCRIPT")
        self.log("=" * 60)
        self.log(f"Started at: {datetime.now().isoformat()}")
        
        if not self.load_data():
            return False
        
        self.find_duplicates()
        if not self.duplicates:
            self.log("✅ No duplicates found. Nothing to fix.")
            return True
        
        self.deduplicate_players_corrected()
        
        if not self.validate_results():
            self.log("❌ Validation failed. Check results manually.")
            return False
        
        self.save_results()
        return True


def main():
    """Main entry point"""
    fixer = CorrectedDuplicatePlayerFixer()
    
    try:
        success = fixer.run()
        if success:
            print("\\n🎉 Corrected deduplication completed successfully!")
            print("✅ Teams validated via web search and data merged appropriately")
            return 0
        else:
            print("\\n💥 Corrected deduplication failed. Check the logs above.")
            return 1
    except Exception as e:
        print(f"\\n💥 Unexpected error: {e}")
        return 3


if __name__ == "__main__":
    sys.exit(main())