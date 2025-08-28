#!/usr/bin/env python3
"""
Fix Duplicate Players Script
============================

This script identifies and removes duplicate player entries in rosters.json,
preserving data integrity while eliminating mid-season transfer duplicates.

Strategy:
1. Keep Shohei Ohtani's dual entries (pitcher & hitter on same team)
2. For team transfers: Keep entry with data, remove empty duplicates
3. For all empty duplicates: Keep most recent team entry
4. Generate detailed report and mapping files
"""

import json
import sys
from datetime import datetime
from collections import defaultdict, OrderedDict
from typing import Dict, List, Any, Tuple


class DuplicatePlayerFixer:
    def __init__(self, roster_file: str = 'rosters.json'):
        self.roster_file = roster_file
        self.players = []
        self.duplicates = {}
        self.removed_players = []
        self.player_id_mapping = {}
        self.report_lines = []
        self.progress_file = 'deduplication_progress.json'
        
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
    
    def save_progress(self) -> None:
        """Save current progress to resume if interrupted"""
        progress = {
            'timestamp': datetime.now().isoformat(),
            'total_players': len(self.players),
            'duplicates_found': len(self.duplicates),
            'players_removed': len(self.removed_players),
            'status': 'in_progress'
        }
        
        with open(self.progress_file, 'w') as f:
            json.dump(progress, f, indent=2)
    
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
        
        self.log(f"Found {len(self.duplicates)} players with duplicate entries:")
        for name, entries in sorted(self.duplicates.items()):
            self.log(f"  - {name}: {len(entries)} entries")
            
        self.save_progress()
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
    
    def analyze_duplicate(self, name: str, entries: List[Dict[str, Any]]) -> Tuple[List[Dict[str, Any]], str]:
        """
        Analyze a duplicate set and determine which entries to keep
        Returns: (entries_to_keep, reason)
        """
        
        # Special case: Shohei Ohtani (keep both pitcher and hitter)
        if name == "S. Ohtani":
            teams = set(e.get('team') for e in entries)
            types = set(e.get('type') for e in entries)
            if len(teams) == 1 and len(types) > 1:
                return entries, "Special case: Two-way player (pitcher & hitter)"
        
        # Find entries with meaningful data
        entries_with_data = [e for e in entries if self.has_meaningful_data(e)]
        entries_without_data = [e for e in entries if not self.has_meaningful_data(e)]
        
        if len(entries_with_data) == 1:
            # One has data, others are empty - keep the one with data
            return entries_with_data, f"Keep entry with data ({entries_with_data[0].get('team')})"
            
        elif len(entries_with_data) > 1:
            # Multiple entries with data - keep the most complete one
            # Prioritize by: 1) Games played (hitters), 2) Number of pitches (pitchers), 3) Most recent ID
            best_entry = max(entries_with_data, key=lambda e: (
                e.get('stats', {}).get('2024_Games', 0) if e.get('type') == 'hitter' 
                else len(e.get('pitches', [])),
                e.get('playerId', 0)
            ))
            return [best_entry], f"Keep most complete entry ({best_entry.get('team')})"
            
        else:
            # All entries are empty - keep the one with highest playerId (most recent)
            best_entry = max(entries, key=lambda e: e.get('playerId', 0))
            return [best_entry], f"All empty - keep most recent ID ({best_entry.get('team')})"
    
    def deduplicate_players(self) -> None:
        """Main deduplication logic"""
        self.log("\n🔧 DEDUPLICATING PLAYERS")
        self.log("=" * 50)
        
        # Create new list of deduplicated players
        deduplicated_players = []
        
        # Process players, handling duplicates
        processed_names = set()
        
        for player in self.players:
            name = player['name']
            
            if name in processed_names:
                continue  # Already processed as part of duplicate set
                
            if name in self.duplicates:
                # Handle duplicate
                entries = self.duplicates[name]
                entries_to_keep, reason = self.analyze_duplicate(name, entries)
                
                self.log(f"\n{name}: {len(entries)} -> {len(entries_to_keep)} entries")
                self.log(f"  Reason: {reason}")
                
                # Add entries to keep
                for entry in entries_to_keep:
                    deduplicated_players.append(entry)
                    self.log(f"  ✅ KEEP: {entry.get('team')} (ID: {entry.get('playerId')})")
                
                # Track removed entries
                for entry in entries:
                    if entry not in entries_to_keep:
                        self.removed_players.append(entry)
                        self.log(f"  ❌ REMOVE: {entry.get('team')} (ID: {entry.get('playerId')})")
                
                # Create mapping for all playerIds
                for entry in entries:
                    kept_entry = entries_to_keep[0] if entries_to_keep else None
                    self.player_id_mapping[entry.get('playerId')] = {
                        'original_team': entry.get('team'),
                        'kept': entry in entries_to_keep,
                        'mapped_to_id': kept_entry.get('playerId') if kept_entry else None,
                        'mapped_to_team': kept_entry.get('team') if kept_entry else None,
                        'reason': reason
                    }
                
                processed_names.add(name)
            else:
                # No duplicate, keep as-is
                deduplicated_players.append(player)
        
        # Update players list
        original_count = len(self.players)
        self.players = deduplicated_players
        self.log(f"\n📊 DEDUPLICATION SUMMARY:")
        self.log(f"  Original players: {original_count}")
        self.log(f"  Deduplicated players: {len(self.players)}")
        self.log(f"  Players removed: {len(self.removed_players)}")
        
        self.save_progress()
    
    def save_results(self) -> None:
        """Save all results to files"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Save deduplicated roster
        with open(self.roster_file, 'w') as f:
            json.dump(self.players, f, indent=2)
        self.log(f"✅ Saved deduplicated roster to {self.roster_file}")
        
        # Save player ID mapping
        mapping_file = f"player_id_mapping_{timestamp}.json"
        with open(mapping_file, 'w') as f:
            json.dump(self.player_id_mapping, f, indent=2)
        self.log(f"✅ Saved player ID mapping to {mapping_file}")
        
        # Save detailed report
        report_file = f"deduplication_report_{timestamp}.txt"
        with open(report_file, 'w') as f:
            f.write(f"DUPLICATE PLAYER DEDUPLICATION REPORT\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write("=" * 80 + "\n\n")
            f.write("\n".join(self.report_lines))
            f.write(f"\n\nREMOVED PLAYERS DETAILS:\n")
            f.write("-" * 40 + "\n")
            for player in self.removed_players:
                f.write(f"Name: {player.get('name')}\n")
                f.write(f"Team: {player.get('team')}\n")
                f.write(f"Player ID: {player.get('playerId')}\n")
                f.write(f"Type: {player.get('type')}\n")
                f.write("-" * 40 + "\n")
        
        self.log(f"✅ Saved detailed report to {report_file}")
        
        # Update progress as complete
        progress = {
            'timestamp': datetime.now().isoformat(),
            'total_players': len(self.players),
            'duplicates_found': len(self.duplicates),
            'players_removed': len(self.removed_players),
            'status': 'completed',
            'files_created': [mapping_file, report_file]
        }
        
        with open(self.progress_file, 'w') as f:
            json.dump(progress, f, indent=2)
        
        self.log(f"✅ Process completed successfully!")
    
    def validate_results(self) -> bool:
        """Validate the deduplicated results"""
        self.log("\n🔍 VALIDATING RESULTS")
        self.log("=" * 50)
        
        # Check for remaining duplicates
        names = [p['name'] for p in self.players]
        remaining_duplicates = [name for name in set(names) if names.count(name) > 1]
        
        if remaining_duplicates:
            # Allow Ohtani to remain as duplicate (pitcher & hitter)
            allowed_duplicates = ['S. Ohtani']
            unexpected_duplicates = [name for name in remaining_duplicates if name not in allowed_duplicates]
            
            if unexpected_duplicates:
                self.log(f"❌ Unexpected remaining duplicates: {unexpected_duplicates}")
                return False
            else:
                self.log(f"✅ Only expected duplicates remain: {remaining_duplicates}")
        else:
            self.log("✅ No duplicate names found")
        
        # Check JSON validity
        try:
            json.dumps(self.players)
            self.log("✅ JSON structure is valid")
        except Exception as e:
            self.log(f"❌ JSON validation failed: {e}")
            return False
        
        # Check data integrity
        total_players = len(self.players)
        players_with_ids = len([p for p in self.players if p.get('playerId')])
        
        self.log(f"✅ Total players: {total_players}")
        self.log(f"✅ Players with IDs: {players_with_ids}")
        
        if players_with_ids != total_players:
            self.log(f"⚠️  Warning: {total_players - players_with_ids} players missing playerIds")
        
        return True
    
    def run(self) -> bool:
        """Execute the complete deduplication process"""
        self.log("DUPLICATE PLAYER DEDUPLICATION SCRIPT")
        self.log("=" * 60)
        self.log(f"Started at: {datetime.now().isoformat()}")
        
        # Step 1: Load data
        if not self.load_data():
            return False
        
        # Step 2: Find duplicates
        self.find_duplicates()
        if not self.duplicates:
            self.log("✅ No duplicates found. Nothing to fix.")
            return True
        
        # Step 3: Deduplicate
        self.deduplicate_players()
        
        # Step 4: Validate
        if not self.validate_results():
            self.log("❌ Validation failed. Check results manually.")
            return False
        
        # Step 5: Save results
        self.save_results()
        
        return True


def main():
    """Main entry point"""
    fixer = DuplicatePlayerFixer()
    
    try:
        success = fixer.run()
        if success:
            print("\n🎉 Deduplication completed successfully!")
            return 0
        else:
            print("\n💥 Deduplication failed. Check the logs above.")
            return 1
    except KeyboardInterrupt:
        print("\n⚠️  Process interrupted. Progress saved to deduplication_progress.json")
        fixer.save_progress()
        return 2
    except Exception as e:
        print(f"\n💥 Unexpected error: {e}")
        return 3


if __name__ == "__main__":
    sys.exit(main())