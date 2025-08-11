#!/bin/bash
#
# Setup Roster Protection System
#
# This script sets up comprehensive roster protection to prevent unauthorized
# team changes after the trade deadline has passed.
#

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Helper functions
log_info() { echo -e "${BLUE}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_success() { echo -e "${GREEN}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_warning() { echo -e "${YELLOW}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }
log_error() { echo -e "${RED}[$(date '+%Y-%m-%d %H:%M:%S')]${NC} $1"; }

# Get script directory
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" &> /dev/null && pwd )"

log_info "🛡️  Setting up MLB Roster Protection System"
log_info "=============================================="
log_info "   📍 Location: $SCRIPT_DIR"
echo

# 1. Set up protection system
log_info "🔧 STEP 1: Initialize Protection System"
cd "$SCRIPT_DIR"
if python protect_roster.py --setup; then
    log_success "   ✅ Protection system initialized"
else
    log_error "   ❌ Failed to initialize protection system"
    exit 1
fi
echo

# 2. Test validation
log_info "🔍 STEP 2: Test Validation System"
if python validate_daily_roster.py; then
    log_success "   ✅ Validation system working"
else
    log_error "   ❌ Validation system failed"
    exit 1
fi
echo

# 3. Make scripts executable
log_info "⚙️  STEP 3: Set Script Permissions"
chmod +x protect_roster.py
chmod +x validate_daily_roster.py
log_success "   ✅ Scripts made executable"
echo

# 4. Generate status report
log_info "📊 STEP 4: Generate Status Report"
python protect_roster.py --report
echo

# 5. Integration instructions
log_info "🔗 STEP 5: Integration Instructions"
echo
echo -e "${GREEN}✅ Roster Protection System Setup Complete!${NC}"
echo
echo "🔒 Protection Features Activated:"
echo "  • Immutable roster backup created"
echo "  • SHA256 checksum validation"
echo "  • Daily integrity checks"
echo "  • Emergency restore capability"
echo "  • Comprehensive audit logging"
echo
echo "🛠️  Integration Status:"
echo "  • Daily automation updated with roster checks"
echo "  • Auto-restore can be enabled with ROSTER_AUTO_RESTORE=true"
echo
echo "💡 Usage Commands:"
echo "  python protect_roster.py --validate     # Check integrity"
echo "  python protect_roster.py --restore      # Emergency restore"
echo "  python protect_roster.py --report       # Status report"
echo "  python validate_daily_roster.py         # Daily validation"
echo
echo "🚨 Emergency Response:"
echo "  If roster corruption is detected:"
echo "  1. Review the changes in the validation output"
echo "  2. If unauthorized: python protect_roster.py --restore"
echo "  3. If legitimate: recreate backup with --setup"
echo
echo "📝 Log Files:"
echo "  • data/roster_protection.log - Protection events"
echo "  • data/.roster_checksum - Integrity checksum"
echo "  • data/rosters_protected_backup.json - Immutable backup"
echo

log_success "🎉 Setup complete! Roster is now protected from unauthorized changes."