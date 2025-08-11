#!/usr/bin/env python3
"""
Fix specific roster team assignment issues

This script applies targeted fixes for known incorrect team assignments
based on authoritative sources and recent game data.
"""

import json
import sys
from pathlib import Path
from typing import Dict, List

class RosterFixer:
    def __init__(self, data_path: str):
        self.data_path = Path(data_path)
        self.fixes_applied = []
        
        # Definitive team corrections based on 2025 season
        self.team_corrections = {
            "Paul Goldschmidt": "STL",      # Cardinals first baseman
            "Cody Bellinger": "CHC",        # Cubs outfielder
            "Andrew Vaughn": "CHW",         # White Sox first baseman
            "Willson Contreras": "STL",     # Cardinals catcher
            "William Contreras": "MIL",     # Brewers catcher  
            "Bryan Reynolds": "PIT",        # Pirates outfielder
            "Pete Crow-Armstrong": "CHC",   # Cubs outfielder
            "Christian Yelich": "MIL",      # Brewers outfielder
            "Nico Hoerner": "CHC",          # Cubs infielder
            "Jackson Chourio": "MIL",       # Brewers outfielder
            "Nick Gonzales": "PIT",         # Pirates infielder
            "Henry Davis": "PIT",           # Pirates catcher
            "Brice Turang": "MIL",          # Brewers infielder
            "Aaron Judge": "NYY",           # Yankees outfielder
            "Mookie Betts": "LAD",          # Dodgers outfielder
            "Shohei Ohtani": "LAD",         # Dodgers designated hitter
            "Julio Rodríguez": "SEA"        # Mariners outfielder
        }
        
        # Players to remove duplicates for (keep only the correct team)
        self.remove_duplicates = {
            "Aaron Civale": "MIL",          # Traded to Brewers
            "Freddie Freeman": "LAD"        # Dodgers first baseman
        }
        
    def load_roster_data(self) -> List[Dict]:
        """Load roster data from rosters.json"""
        roster_file = self.data_path / "rosters.json"
        with open(roster_file, 'r') as f:
            return json.load(f)
    
    def save_roster_data(self, roster_data: List[Dict]) -> None:
        """Save roster data back to rosters.json"""
        roster_file = self.data_path / "rosters.json"
        with open(roster_file, 'w') as f:
            json.dump(roster_data, f, indent=2)
    
    def fix_team_assignments(self, roster_data: List[Dict]) -> List[Dict]:
        """Apply team assignment corrections"""
        for player in roster_data:
            full_name = player.get('fullName', '').strip()
            name = player.get('name', '').strip()
            current_team = player.get('team', '').strip()
            
            # Check if this player needs a team correction
            correct_team = None
            for target_name, target_team in self.team_corrections.items():
                if (full_name == target_name or name == target_name or
                    (target_name in full_name and len(full_name) - len(target_name) < 5)):
                    correct_team = target_team
                    break
            
            if correct_team and current_team != correct_team:
                old_team = player['team']
                player['team'] = correct_team
                self.fixes_applied.append(f"Fixed {full_name or name}: {old_team} → {correct_team}")
        
        return roster_data
    
    def remove_duplicate_players(self, roster_data: List[Dict]) -> List[Dict]:
        """Remove duplicate player entries, keeping only the correct team"""
        cleaned_data = []
        seen_players = {}
        
        for player in roster_data:
            full_name = player.get('fullName', '').strip()
            name = player.get('name', '').strip()
            team = player.get('team', '').strip()
            
            # Identify the player
            player_key = full_name or name
            
            if player_key in self.remove_duplicates:
                # Keep only the correct team for this player
                correct_team = self.remove_duplicates[player_key]
                if team == correct_team:
                    if player_key not in seen_players:
                        cleaned_data.append(player)
                        seen_players[player_key] = team
                        self.fixes_applied.append(f"Kept {player_key} with correct team {team}")
                else:
                    self.fixes_applied.append(f"Removed duplicate {player_key} with wrong team {team}")
            else:
                # For non-duplicate players, just add them
                cleaned_data.append(player)
        
        return cleaned_data
    
    def apply_fixes(self) -> bool:
        """Apply all roster fixes"""
        try:
            print("🔧 Loading roster data...")
            roster_data = self.load_roster_data()
            original_count = len(roster_data)
            
            print(f"📊 Loaded {original_count} players")
            
            print("🎯 Applying team assignment corrections...")
            roster_data = self.fix_team_assignments(roster_data)
            
            print("🧹 Removing duplicate players...")
            roster_data = self.remove_duplicate_players(roster_data)
            
            final_count = len(roster_data)
            
            print(f"💾 Saving corrected roster data...")
            self.save_roster_data(roster_data)
            
            print(f"✅ Roster fixes complete!")
            print(f"📊 Player count: {original_count} → {final_count}")
            
            if self.fixes_applied:
                print(f"🔧 Applied {len(self.fixes_applied)} fixes:")
                for fix in self.fixes_applied:
                    print(f"  • {fix}")
            else:
                print("ℹ️ No fixes were needed")
            
            return True
            
        except Exception as e:
            print(f"❌ Error applying fixes: {e}")
            return False

def main():
    if len(sys.argv) > 1:
        data_path = sys.argv[1]
    else:
        data_path = "data"
    
    print("🔧 MLB Roster Team Assignment Fixer")
    print("="*50)
    print(f"📁 Data path: {data_path}")
    print()
    
    fixer = RosterFixer(data_path)
    
    success = fixer.apply_fixes()
    
    if success:
        print()
        print("🎉 All fixes applied successfully!")
        print("💡 Run validate_roster_teams.py to verify the corrections.")
    else:
        print()
        print("❌ Some fixes failed. Check the error messages above.")
        sys.exit(1)

if __name__ == "__main__":
    main()