#!/bin/bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Copy shared env/enroll/register scripts from ImplantChain
# (same Fabric network, same CA, same org1)
IMPLANT_SCRIPTS="$HOME/Desktop/3-Blockchain-Projects/Latest-4-29-2026/implant-chain/backend/scripts"
source "${IMPLANT_SCRIPTS}/env.sh"

echo "════════════════════════════════════════"
echo "  DentalChain Identity Bootstrap"
echo "════════════════════════════════════════"

echo ""
echo "Step 1: Enrolling CA admin..."
bash "${IMPLANT_SCRIPTS}/enroll-ca-admin.sh"
echo "✅ CA admin enrolled"

echo ""
echo "Step 2: Registering and enrolling identities..."

IDENTITIES=(
  # Platform
  "admin@DentalChainMSP:admin"
  # Government / FDA
  "fda.dental@DentalChainMSP:government"
  # Manufacturers
  "nobelbiocare@DentalChainMSP:manufacturer"
  "straumann@DentalChainMSP:manufacturer"
  "zimmerbiomet@DentalChainMSP:manufacturer"
  "biohorizons@DentalChainMSP:manufacturer"
  # Distributors
  "henry.schein.rep@DentalChainMSP:distributor"
  "patterson.rep@DentalChainMSP:distributor"
  # Dentists
  "dr.sarah.johnson@DentalChainMSP:dentist"
  "dr.michael.chen@DentalChainMSP:dentist"
  # Dental Assistants
  "maria.garcia@DentalChainMSP:dental_assistant"
  "james.park@DentalChainMSP:dental_assistant"
  # Infection Control
  "linda.brooks@DentalChainMSP:infection_control"
  "robert.nguyen@DentalChainMSP:infection_control"
)

for entry in "${IDENTITIES[@]}"; do
  LABEL="${entry%%:*}"
  ROLE="${entry##*:}"
  printf "── %-35s (%s)\n" "$LABEL" "$ROLE"
  bash "${IMPLANT_SCRIPTS}/register.sh" "$LABEL" "$ROLE" 2>/dev/null || true
  bash "${IMPLANT_SCRIPTS}/enroll.sh"   "$LABEL" "$ROLE"
  # Keep only newest key
  KEYSTORE="${TEST_NETWORK_DIR}/organizations/peerOrganizations/org1.example.com/users/${LABEL}@org1.example.com/msp/keystore"
  if [ -d "$KEYSTORE" ]; then
    cd "$KEYSTORE" && ls -t | tail -n +2 | xargs rm -f 2>/dev/null || true
    cd "$SCRIPT_DIR"
  fi
done

echo ""
echo "════════════════════════════════════════"
echo "  ✅ All DentalChain identities ready"
echo "  Remove FABRIC_IDENTITY_OVERRIDE=Admin"
echo "  from .env to use real identities"
echo "════════════════════════════════════════"
