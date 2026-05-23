#!/usr/bin/env bash
# =============================================================
# DentalChain — Phase 2 Seed: Clearances, Lots + Consignments
# Run AFTER seed-blockchain-phase1.sh
# =============================================================

BASE_URL="${BASE_URL:-http://localhost:4001/api}"
CDIR="/tmp/dental_seed_p2"
mkdir -p "$CDIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }

do_login() {
  local USER="$1" PASS="$2" CFILE="$CDIR/${USER//[@.]/_}.cookie"
  rm -f "$CFILE"
  local R
  R=$(curl -sk -c "$CFILE" -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")
  if echo "$R" | grep -q '"username"'; then
    echo "$CFILE"
  else
    echo ""
    echo -e "${RED}  Login failed for $USER${NC}" >&2
  fi
}

post() {
  local CFILE="$1" EP="$2" DATA="$3"
  curl -sk -b "$CFILE" -X POST "$BASE_URL/$EP" \
    -H "Content-Type: application/json" -d "$DATA"
}

echo ""
echo "════════════════════════════════════════════════════════"
echo "  DentalChain Phase 2 Seed"
echo "  Target: $BASE_URL"
echo "════════════════════════════════════════════════════════"

TODAY=$(date +%Y-%m-%d)
EXP="2028-12-31"

# ── Verify devices on chain ───────────────────────────────────
info "Checking devices are on-chain..."
GCOOKIE=$(do_login "j.whitfield@fda.hhs.gov" "FDA@1234")
DC=$(curl -sk -b "$GCOOKIE" "$BASE_URL/assets/devices" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "${DC:-0}" -lt 10 ] 2>/dev/null; then
  fail "Only $DC devices on-chain. Run seed-blockchain-phase1.sh first."; exit 1
fi
ok "$DC devices confirmed on-chain"

# ═══════════════════════════════════════════════════
# STEP 1 — FDA CLEARANCES
# ═══════════════════════════════════════════════════
echo ""; info "── Step 1: FDA Clearances ──"

for entry in \
  "K221001|(01)00885433000001|510k|nobelbiocare|Single tooth dental implant replacement" \
  "K221002|(01)00885433000002|510k|nobelbiocare|Single tooth dental implant replacement" \
  "K221003|(01)00885433000003|510k|nobelbiocare|Single tooth dental implant replacement" \
  "K221004|(01)00885433000004|510k|nobelbiocare|Multiple tooth dental implant replacement" \
  "K221005|(01)00885433000005|510k|nobelbiocare|Full arch dental restoration" \
  "K221006|(01)07612905000001|510k|straumann|Single tooth dental implant replacement" \
  "K221007|(01)07612905000002|510k|straumann|Single tooth dental implant replacement" \
  "K221008|(01)07612905000003|510k|straumann|Zirconia single tooth implant replacement" \
  "K221009|(01)07612905000004|510k|straumann|Implant prosthetic component" \
  "K221010|(01)00380740000001|510k|zimmerbiomet|Single tooth dental implant replacement" \
  "K221011|(01)00380740000002|510k|zimmerbiomet|Single tooth dental implant replacement" \
  "K221012|(01)00380740000003|510k|zimmerbiomet|Implant supported crown restoration" \
  "K221013|(01)00812666000001|510k|biohorizons|Single tooth dental implant replacement" \
  "K221014|(01)00812666000002|510k|biohorizons|Single tooth dental implant replacement" \
  "K221015|(01)00812666000003|510k|biohorizons|Guided bone regeneration membrane"
do
  IFS='|' read -r CNUM UDI TYPE MFR IFU <<< "$entry"
  R=$(post "$GCOOKIE" "clearance" "{
    \"clearanceNumber\":\"$CNUM\",
    \"udiDI\":\"$UDI\",
    \"manufacturerId\":\"$MFR\",
    \"clearanceType\":\"$TYPE\",
    \"indicationsForUse\":\"$IFU\",
    \"clearanceDate\":\"$TODAY\",
    \"expiryDate\":\"$EXP\"
  }")
  echo "$R" | grep -q "clearanceNumber" && ok "$CNUM → $UDI" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
done

# ═══════════════════════════════════════════════════
# STEP 2 — LOTS
# ═══════════════════════════════════════════════════
echo ""; info "── Step 2: Device Lots ──"

# Nobel Biocare lots
NBC=$(do_login "compliance@nobelbiocare.com" "Nobel@1234")
if [ -n "$NBC" ]; then
  for entry in \
    "LOT-NBC-2024-001|(01)00885433000001|K221001|ISO13485-TUV-NBC-001|NBC-3.5-10-2024A|2024-01-15|50" \
    "LOT-NBC-2024-002|(01)00885433000002|K221002|ISO13485-TUV-NBC-001|NBC-4.0-10-2024A|2024-01-15|75" \
    "LOT-NBC-2024-003|(01)00885433000003|K221003|ISO13485-TUV-NBC-001|NBC-4.3-13-2024A|2024-02-01|60" \
    "LOT-NBC-2024-004|(01)00885433000004|K221004|ISO13485-TUV-NBC-001|NBC-PC-4.3-2024A|2024-02-01|40" \
    "LOT-NBC-2024-005|(01)00885433000005|K221005|ISO13485-TUV-NBC-001|NBC-ABT-17-2024A|2024-03-01|30"
  do
    IFS='|' read -r LOTID UDI CLR CERT LOTNUM MFGDATE QTY <<< "$entry"
    R=$(post "$NBC" "lot" "{
      \"lotId\":\"$LOTID\",
      \"udiDI\":\"$UDI\",
      \"clearanceNumber\":\"$CLR\",
      \"certId\":\"$CERT\",
      \"lotNumber\":\"$LOTNUM\",
      \"manufacturingDate\":\"$MFGDATE\",
      \"expiryDate\":\"$EXP\",
      \"sterileExpiryDate\":\"$EXP\",
      \"quantity\":$QTY,
      \"storageConditions\":\"Store at room temperature 15-30C, away from moisture\"
    }")
    echo "$R" | grep -q "lotId" && ok "Created $LOTID ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"

    # QC Release each lot
    R=$(post "$NBC" "lot/$LOTID/release" "{\"qcNotes\":\"All quality checks passed. Sterility verified. Ready for distribution.\"}")
    echo "$R" | grep -q "active" && ok "Released $LOTID" || warn "Release failed for $LOTID"
  done
fi

# Straumann lots
STR=$(do_login "compliance@straumann.com" "Straumann@1234")
if [ -n "$STR" ]; then
  for entry in \
    "LOT-STR-2024-001|(01)07612905000001|K221006|ISO13485-BSI-STR-001|STR-BLX-3.75-2024A|2024-01-20|60" \
    "LOT-STR-2024-002|(01)07612905000002|K221007|ISO13485-BSI-STR-001|STR-BLX-4.5-2024A|2024-01-20|60" \
    "LOT-STR-2024-003|(01)07612905000003|K221008|ISO13485-BSI-STR-001|STR-PURE-4.1-2024A|2024-02-15|30" \
    "LOT-STR-2024-004|(01)07612905000004|K221009|ISO13485-BSI-STR-001|STR-VB-4.5-2024A|2024-02-15|50"
  do
    IFS='|' read -r LOTID UDI CLR CERT LOTNUM MFGDATE QTY <<< "$entry"
    R=$(post "$STR" "lot" "{
      \"lotId\":\"$LOTID\",
      \"udiDI\":\"$UDI\",
      \"clearanceNumber\":\"$CLR\",
      \"certId\":\"$CERT\",
      \"lotNumber\":\"$LOTNUM\",
      \"manufacturingDate\":\"$MFGDATE\",
      \"expiryDate\":\"$EXP\",
      \"sterileExpiryDate\":\"$EXP\",
      \"quantity\":$QTY,
      \"storageConditions\":\"Store at room temperature 15-30C\"
    }")
    echo "$R" | grep -q "lotId" && ok "Created $LOTID ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
    R=$(post "$STR" "lot/$LOTID/release" "{\"qcNotes\":\"Quality release approved. Sterility confirmed.\"}")
    echo "$R" | grep -q "active" && ok "Released $LOTID" || warn "Release failed for $LOTID"
  done
fi

# Zimmer Biomet lots
ZBD=$(do_login "compliance@zimmerbiomet.com" "Zimmer@1234")
if [ -n "$ZBD" ]; then
  for entry in \
    "LOT-ZBD-2024-001|(01)00380740000001|K221010|ISO13485-BSI-ZBD-001|ZBD-TSV-3.7-2024A|2024-01-10|55" \
    "LOT-ZBD-2024-002|(01)00380740000002|K221011|ISO13485-BSI-ZBD-001|ZBD-TSV-4.7-2024A|2024-01-10|55" \
    "LOT-ZBD-2024-003|(01)00380740000003|K221012|ISO13485-BSI-ZBD-001|ZBD-ZRC-4.0-2024A|2024-02-01|40"
  do
    IFS='|' read -r LOTID UDI CLR CERT LOTNUM MFGDATE QTY <<< "$entry"
    R=$(post "$ZBD" "lot" "{
      \"lotId\":\"$LOTID\",
      \"udiDI\":\"$UDI\",
      \"clearanceNumber\":\"$CLR\",
      \"certId\":\"$CERT\",
      \"lotNumber\":\"$LOTNUM\",
      \"manufacturingDate\":\"$MFGDATE\",
      \"expiryDate\":\"$EXP\",
      \"sterileExpiryDate\":\"$EXP\",
      \"quantity\":$QTY,
      \"storageConditions\":\"Store at room temperature 15-30C\"
    }")
    echo "$R" | grep -q "lotId" && ok "Created $LOTID ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
    R=$(post "$ZBD" "lot/$LOTID/release" "{\"qcNotes\":\"QC release approved.\"}")
    echo "$R" | grep -q "active" && ok "Released $LOTID" || warn "Release failed for $LOTID"
  done
fi

# BioHorizons lots
BHZ=$(do_login "compliance@biohorizons.com" "BioH@1234")
if [ -n "$BHZ" ]; then
  for entry in \
    "LOT-BHZ-2024-001|(01)00812666000001|K221013|ISO13485-SGS-BHZ-001|BHZ-TI-3.8-2024A|2024-01-25|65" \
    "LOT-BHZ-2024-002|(01)00812666000002|K221014|ISO13485-SGS-BHZ-001|BHZ-TI-4.6-2024A|2024-01-25|65" \
    "LOT-BHZ-2024-003|(01)00812666000003|K221015|ISO13485-SGS-BHZ-001|BHZ-MEM-2024A|2024-02-10|25"
  do
    IFS='|' read -r LOTID UDI CLR CERT LOTNUM MFGDATE QTY <<< "$entry"
    R=$(post "$BHZ" "lot" "{
      \"lotId\":\"$LOTID\",
      \"udiDI\":\"$UDI\",
      \"clearanceNumber\":\"$CLR\",
      \"certId\":\"$CERT\",
      \"lotNumber\":\"$LOTNUM\",
      \"manufacturingDate\":\"$MFGDATE\",
      \"expiryDate\":\"$EXP\",
      \"sterileExpiryDate\":\"$EXP\",
      \"quantity\":$QTY,
      \"storageConditions\":\"Store at room temperature 15-30C\"
    }")
    echo "$R" | grep -q "lotId" && ok "Created $LOTID ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
    R=$(post "$BHZ" "lot/$LOTID/release" "{\"qcNotes\":\"QC release approved.\"}")
    echo "$R" | grep -q "active" && ok "Released $LOTID" || warn "Release failed for $LOTID"
  done
fi

# ═══════════════════════════════════════════════════
# STEP 3 — CONSIGNMENTS
# ═══════════════════════════════════════════════════
echo ""; info "── Step 3: Consignments ──"

# Henry Schein rep → Smile Dental Group + Advanced Implant Center
HS=$(do_login "m.webb@henryschein.com" "Schein@1234")
if [ -n "$HS" ]; then
  for entry in \
    "CONS-HS-001|LOT-NBC-2024-001|Smile Dental Group|10|Operatory 1 - Cabinet A" \
    "CONS-HS-002|LOT-NBC-2024-002|Smile Dental Group|15|Operatory 1 - Cabinet A" \
    "CONS-HS-003|LOT-NBC-2024-003|Smile Dental Group|10|Operatory 2 - Cabinet B" \
    "CONS-HS-004|LOT-STR-2024-001|Smile Dental Group|12|Operatory 1 - Cabinet B" \
    "CONS-HS-005|LOT-STR-2024-002|Smile Dental Group|12|Operatory 2 - Cabinet A" \
    "CONS-HS-006|LOT-NBC-2024-002|Advanced Implant Center|20|Surgical Suite - Tray 1" \
    "CONS-HS-007|LOT-NBC-2024-003|Advanced Implant Center|15|Surgical Suite - Tray 1" \
    "CONS-HS-008|LOT-NBC-2024-004|Advanced Implant Center|10|Surgical Suite - Tray 2" \
    "CONS-HS-009|LOT-STR-2024-001|Advanced Implant Center|15|Surgical Suite - Tray 2" \
    "CONS-HS-010|LOT-STR-2024-003|Advanced Implant Center|8|Surgical Suite - Cabinet"
  do
    IFS='|' read -r COID LOTID PRACTICE QTY LOC <<< "$entry"
    R=$(post "$HS" "consignment" "{
      \"consignmentId\":\"$COID\",
      \"lotId\":\"$LOTID\",
      \"practiceId\":\"$PRACTICE\",
      \"quantity\":$QTY,
      \"location\":\"$LOC\"
    }")
    echo "$R" | grep -q "consignmentId" && ok "$COID → $PRACTICE ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
  done
fi

# Patterson rep → Family Dentistry Plus + Aspen Dental Orlando
PT=$(do_login "s.kowalski@patterson.com" "Patterson@1234")
if [ -n "$PT" ]; then
  for entry in \
    "CONS-PT-001|LOT-ZBD-2024-001|Family Dentistry Plus|10|Treatment Room 1 - Cabinet" \
    "CONS-PT-002|LOT-ZBD-2024-002|Family Dentistry Plus|10|Treatment Room 2 - Cabinet" \
    "CONS-PT-003|LOT-BHZ-2024-001|Family Dentistry Plus|8|Treatment Room 1 - Cabinet" \
    "CONS-PT-004|LOT-ZBD-2024-001|Aspen Dental - Orlando|15|Surgical Suite - Tray 1" \
    "CONS-PT-005|LOT-ZBD-2024-002|Aspen Dental - Orlando|15|Surgical Suite - Tray 1" \
    "CONS-PT-006|LOT-BHZ-2024-001|Aspen Dental - Orlando|20|Surgical Suite - Tray 2" \
    "CONS-PT-007|LOT-BHZ-2024-002|Aspen Dental - Orlando|20|Surgical Suite - Tray 2" \
    "CONS-PT-008|LOT-BHZ-2024-003|Aspen Dental - Orlando|10|Supply Room - Shelf A"
  do
    IFS='|' read -r COID LOTID PRACTICE QTY LOC <<< "$entry"
    R=$(post "$PT" "consignment" "{
      \"consignmentId\":\"$COID\",
      \"lotId\":\"$LOTID\",
      \"practiceId\":\"$PRACTICE\",
      \"quantity\":$QTY,
      \"location\":\"$LOC\"
    }")
    echo "$R" | grep -q "consignmentId" && ok "$COID → $PRACTICE ($QTY units)" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
  done
fi

# ═══════════════════════════════════════════════════
# SUMMARY
# ═══════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Phase 2 Seed Complete"
echo ""

ACOOKIE=$(do_login "admin@dentalchain.com" "Admin@1234")
if [ -n "$ACOOKIE" ]; then
  LOTS=$(curl -sk -b "$ACOOKIE" "$BASE_URL/assets/lots" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  CONS=$(curl -sk -b "$ACOOKIE" "$BASE_URL/assets/consignments" | \
    python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
  echo "  Lots on blockchain:         $LOTS"
  echo "  Consignments on blockchain: $CONS"
fi

echo ""
echo "  Next: Log in as a dentist and record implants!"
echo "════════════════════════════════════════════════════════"
echo ""

rm -rf "$CDIR"
