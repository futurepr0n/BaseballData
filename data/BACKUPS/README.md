# Roster Backups Directory

## Reference Files

### PRIMARY REFERENCE
- **rosters_REFERENCE_CLEAN.json** - The golden/reference copy of clean roster data
  - 121 corruption fixes applied
  - Single accented characters (no Unicode escapes)
  - UTF-8 encoded
  - Use this as the master reference

### BACKUP TYPES
- **rosters_clean_YYYY-MM-DD_HH-MM-SS.json** - Timestamped backups
- **rosters_daily_YYYY-MM-DD.json** - Daily snapshots (overwrites)
- **rosters_POST_CORRUPTION_FIX_YYYY-MM-DD.json** - Archive of post-fix state

## Corruption Fix Summary
- **Total fixes applied:** 121
- **Web researched:** 26 (verified from MLB sources)
- **Logically deduced:** 95 (common baseball name patterns)
- **Remaining issues:** 28 (minor accent variations)

## Usage
1. Use `rosters_REFERENCE_CLEAN.json` as your master reference
2. Timestamped backups for point-in-time recovery
3. Daily backups for regular snapshots
4. Check metadata files for detailed backup information

Created: 2025-08-15_12-38-25
Total players: 1323
