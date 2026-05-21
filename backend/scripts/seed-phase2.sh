#!/usr/bin/env bash
# =============================================================
# ImplantChain — Phase 2 Seed: Clearances, Lots + Consignments
# Run AFTER government has approved all device submissions.
# =============================================================

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
CDIR="/tmp/implant_seed_p2"
mkdir -p "$CDIR"

GREEN='\033[0;32m'; RED='\033[0;31m'; CYAN='\033[0;36m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
warn() { echo -e "${RED}  ⚠ $1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }

# Inline login — no function, no captured output confusion
do_login() {
  local USER="$1" PASS="$2" CFILE="$CDIR/$1.cookie"
  rm -f "$CFILE"
  local R
  R=$(curl -sk -c "$CFILE" -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$USER\",\"password\":\"$PASS\"}")
  if echo "$R" | grep -q '"username"'; then
    echo "$CFILE"
  else
    echo ""
    echo -e "${RED}  Login failed for $USER: $R${NC}" >&2
  fi
}

post() {
  local CFILE="$1" EP="$2" DATA="$3"
  curl -sk -b "$CFILE" -X POST "$BASE_URL/$EP" \
    -H "Content-Type: application/json" -d "$DATA"
}

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ImplantChain Phase 2 Seed"
echo "  Target: $BASE_URL"
echo "════════════════════════════════════════════════════════"

TODAY=$(date +%Y-%m-%d)
EXP="2028-12-31"

# ── Verify devices on chain ───────────────────────────────────
info "Checking devices are on-chain..."
GCOOKIE="$CDIR/government1.cookie"
rm -f "$GCOOKIE"
curl -sk -c "$GCOOKIE" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"government1","password":"Gov1-1234"}' > /dev/null
DC=$(curl -sk -b "$GCOOKIE" "$BASE_URL/assets/devices" | \
  python3 -c "import sys,json; d=json.load(sys.stdin); print(len(d))" 2>/dev/null)
if [ "${DC:-0}" -lt 12 ] 2>/dev/null; then
  echo -e "${RED}Only $DC devices on-chain. Approve all submissions first.${NC}"; exit 1
fi
ok "$DC devices confirmed on-chain"

# ═══════════════════════════
# STEP 1 — CLEARANCES
# ═══════════════════════════
echo ""; info "── Step 1: Regulatory Clearances ──"

# Re-login government1 fresh
rm -f "$GCOOKIE"
curl -sk -c "$GCOOKIE" -X POST "$BASE_URL/login" \
  -H "Content-Type: application/json" \
  -d '{"username":"government1","password":"Gov1-1234"}' > /dev/null
info "Logged in as government1"

for entry in \
  "K193629|(01)00888316419536|510k|stryker|Total knee arthroplasty" \
  "K181513|(01)00888316013794|510k|stryker|Total hip arthroplasty" \
  "K211456|(01)00888316523134|510k|stryker|Interbody spinal fusion" \
  "P160033|(01)00380740991745|PMA|medtronic|Cardiac pacing for AV block" \
  "P190009|(01)00380740855801|PMA|medtronic|Tricuspid valve replacement" \
  "P100017|(01)00380740037278|PMA|medtronic|Cervical disc replacement" \
  "K180892|(01)00380740109159|510k|medtronic|Posterior spinal fixation" \
  "P030012|(01)00380740506561|PMA|medtronic|Spinal cord stimulation" \
  "K201234|(01)00643169007234|510k|smithnephew|Total knee arthroplasty" \
  "K192001|(01)00741570001703|510k|abbott|Cardiac monitoring" \
  "K172456|(01)00888174058651|510k|ethicon|Soft tissue repair" \
  "K189012|(01)00888174063068|510k|allergan|Tissue expansion"
do
  NUM=$(echo "$entry" | cut -d'|' -f1)
  UDI=$(echo "$entry" | cut -d'|' -f2)
  TYPE=$(echo "$entry" | cut -d'|' -f3)
  MFG=$(echo "$entry"  | cut -d'|' -f4)
  IND=$(echo "$entry"  | cut -d'|' -f5)
  R=$(post "$GCOOKIE" "clearance" \
    "{\"clearanceNumber\":\"$NUM\",\"udiDI\":\"$UDI\",\"manufacturerId\":\"$MFG\",\"clearanceType\":\"$TYPE\",\"indicationsForUse\":\"$IND\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}")
  echo "$R" | grep -q "clearanceNumber" \
    && ok "$NUM ($TYPE)" \
    || warn "$NUM: $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
done

# ═══════════════════════════
# STEP 2 — LOTS
# ═══════════════════════════
echo ""; info "── Step 2: Device Lots ──"

# Stryker
SC="$CDIR/stryker.cookie"; rm -f "$SC"
curl -sk -c "$SC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"stryker","password":"Stryker@1234"}' > /dev/null
info "Logged in as stryker"
for ld in \
  "LOT-STK-KNEE-001|(01)00888316419536|K193629|ISO13485-BSI-STR-001|2024STKK001A" \
  "LOT-STK-HIP-001|(01)00888316013794|K181513|ISO13485-BSI-STR-001|2024STKH001A" \
  "LOT-STK-CAGE-001|(01)00888316523134|K211456|ISO13485-BSI-STR-001|2024STKC001A"
do
  LID=$(echo "$ld"|cut -d'|' -f1); UDI=$(echo "$ld"|cut -d'|' -f2)
  CLR=$(echo "$ld"|cut -d'|' -f3); CRT=$(echo "$ld"|cut -d'|' -f4); LN=$(echo "$ld"|cut -d'|' -f5)
  R=$(post "$SC" "lot" "{\"lotId\":\"$LID\",\"udiDI\":\"$UDI\",\"clearanceNumber\":\"$CLR\",\"certId\":\"$CRT\",\"lotNumber\":\"$LN\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
  echo "$R" | grep -q "lotId" && ok "$LID created" || warn "$LID: $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
  R2=$(post "$SC" "lot/$LID/release" '{"qcNotes":"QC passed"}')
  echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null
done

# Medtronic
MC="$CDIR/medtronic.cookie"; rm -f "$MC"
curl -sk -c "$MC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"medtronic","password":"Medtronic@1234"}' > /dev/null
info "Logged in as medtronic"
for ld in \
  "LOT-MDT-PCE-001|(01)00380740991745|P160033|ISO13485-TUV-MDT-001|2024MDTP001A" \
  "LOT-MDT-VLV-001|(01)00380740855801|P190009|ISO13485-TUV-MDT-001|2024MDTV001A" \
  "LOT-MDT-DSC-001|(01)00380740037278|P100017|ISO13485-TUV-MDT-001|2024MDTD001A" \
  "LOT-MDT-ROD-001|(01)00380740109159|K180892|ISO13485-TUV-MDT-001|2024MDTR001A" \
  "LOT-MDT-SCS-001|(01)00380740506561|P030012|ISO13485-TUV-MDT-001|2024MDTS001A"
do
  LID=$(echo "$ld"|cut -d'|' -f1); UDI=$(echo "$ld"|cut -d'|' -f2)
  CLR=$(echo "$ld"|cut -d'|' -f3); CRT=$(echo "$ld"|cut -d'|' -f4); LN=$(echo "$ld"|cut -d'|' -f5)
  R=$(post "$MC" "lot" "{\"lotId\":\"$LID\",\"udiDI\":\"$UDI\",\"clearanceNumber\":\"$CLR\",\"certId\":\"$CRT\",\"lotNumber\":\"$LN\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
  echo "$R" | grep -q "lotId" && ok "$LID created" || warn "$LID: $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
  R2=$(post "$MC" "lot/$LID/release" '{"qcNotes":"QC passed"}')
  echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null
done

# Smith & Nephew
SNC="$CDIR/smithnephew.cookie"; rm -f "$SNC"
curl -sk -c "$SNC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"smithnephew","password":"Smith@1234"}' > /dev/null
info "Logged in as smithnephew"
R=$(post "$SNC" "lot" "{\"lotId\":\"LOT-SNS-KNEE-001\",\"udiDI\":\"(01)00643169007234\",\"clearanceNumber\":\"K201234\",\"certId\":\"ISO13485-BSI-SNS-001\",\"lotNumber\":\"2024SNSK001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
echo "$R" | grep -q "lotId" && ok "LOT-SNS-KNEE-001 created" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
R2=$(post "$SNC" "lot/LOT-SNS-KNEE-001/release" '{"qcNotes":"QC passed"}')
echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null

# Abbott
AC="$CDIR/abbott.cookie"; rm -f "$AC"
curl -sk -c "$AC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"abbott","password":"Abbott@1234"}' > /dev/null
info "Logged in as abbott"
R=$(post "$AC" "lot" "{\"lotId\":\"LOT-ABT-MON-001\",\"udiDI\":\"(01)00741570001703\",\"clearanceNumber\":\"K192001\",\"certId\":\"ISO13485-BSI-ABT-001\",\"lotNumber\":\"2024ABTM001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
echo "$R" | grep -q "lotId" && ok "LOT-ABT-MON-001 created" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
R2=$(post "$AC" "lot/LOT-ABT-MON-001/release" '{"qcNotes":"QC passed"}')
echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null

# Ethicon
EC="$CDIR/ethicon.cookie"; rm -f "$EC"
curl -sk -c "$EC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"ethicon","password":"Ethicon@1234"}' > /dev/null
info "Logged in as ethicon"
R=$(post "$EC" "lot" "{\"lotId\":\"LOT-ETH-MSH-001\",\"udiDI\":\"(01)00888174058651\",\"clearanceNumber\":\"K172456\",\"certId\":\"ISO13485-SGS-ETH-001\",\"lotNumber\":\"2024ETHM001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
echo "$R" | grep -q "lotId" && ok "LOT-ETH-MSH-001 created" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
R2=$(post "$EC" "lot/LOT-ETH-MSH-001/release" '{"qcNotes":"QC passed"}')
echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null

# Allergan
ALC="$CDIR/allergan.cookie"; rm -f "$ALC"
curl -sk -c "$ALC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"allergan","password":"Allergan@1234"}' > /dev/null
info "Logged in as allergan"
R=$(post "$ALC" "lot" "{\"lotId\":\"LOT-ALL-EXP-001\",\"udiDI\":\"(01)00888174063068\",\"clearanceNumber\":\"K189012\",\"certId\":\"ISO13485-TUV-ALG-001\",\"lotNumber\":\"2024ALLE001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"$EXP\",\"sterileExpiryDate\":\"$EXP\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}")
echo "$R" | grep -q "lotId" && ok "LOT-ALL-EXP-001 created" || warn "$(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
R2=$(post "$ALC" "lot/LOT-ALL-EXP-001/release" '{"qcNotes":"QC passed"}')
echo "$R2" | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d.get('error','?')))" 2>/dev/null

# ═══════════════════════════
# STEP 3 — CONSIGNMENTS
# ═══════════════════════════
echo ""; info "── Step 3: Consignments ──"

# rep-memorial
RMC="$CDIR/rep-memorial.cookie"; rm -f "$RMC"
curl -sk -c "$RMC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"rep-memorial","password":"Rep-Mem@1234"}' > /dev/null
info "Memorial Hospital consignments..."
for cd in \
  "CONS-MEM-KNEE-001|LOT-STK-KNEE-001|Memorial Hospital|20|OR Suite 1 - Orthopedic Cart" \
  "CONS-MEM-HIP-001|LOT-STK-HIP-001|Memorial Hospital|15|OR Suite 1 - Orthopedic Cart" \
  "CONS-MEM-CAGE-001|LOT-STK-CAGE-001|Memorial Hospital|10|OR Suite 2 - Spine Cart" \
  "CONS-MEM-DISC-001|LOT-MDT-DSC-001|Memorial Hospital|8|OR Suite 2 - Spine Cart" \
  "CONS-MEM-ROD-001|LOT-MDT-ROD-001|Memorial Hospital|20|OR Suite 2 - Spine Implant Cabinet" \
  "CONS-MEM-PCE-001|LOT-MDT-PCE-001|Memorial Hospital|5|Cardiac OR - Pacemaker Storage" \
  "CONS-MEM-VLV-001|LOT-MDT-VLV-001|Memorial Hospital|3|Cardiac OR - Valve Storage" \
  "CONS-MEM-MON-001|LOT-ABT-MON-001|Memorial Hospital|6|Cardiac OR - Monitor Storage" \
  "CONS-MEM-SCS-001|LOT-MDT-SCS-001|Memorial Hospital|4|Neuro OR - Stimulator Cabinet" \
  "CONS-MEM-MSH-001|LOT-ETH-MSH-001|Memorial Hospital|15|General Surgery Supply Room"
do
  CID=$(echo "$cd"|cut -d'|' -f1); LID=$(echo "$cd"|cut -d'|' -f2)
  HOSP=$(echo "$cd"|cut -d'|' -f3); QTY=$(echo "$cd"|cut -d'|' -f4); LOC=$(echo "$cd"|cut -d'|' -f5)
  R=$(post "$RMC" "consignment" "{\"consignmentId\":\"$CID\",\"lotId\":\"$LID\",\"hospitalId\":\"$HOSP\",\"quantity\":\"$QTY\",\"location\":\"$LOC\"}")
  echo "$R" | grep -q "consignmentId" && ok "$CID" || warn "$CID: $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
done

# rep-university
RUC="$CDIR/rep-university.cookie"; rm -f "$RUC"
curl -sk -c "$RUC" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"rep-university","password":"Rep-Uni@1234"}' > /dev/null
info "University Hospital consignments..."
for cd in \
  "CONS-UNI-KNEE-001|LOT-SNS-KNEE-001|University Hospital|20|Orthopedic OR - Main Cart" \
  "CONS-UNI-HIP-001|LOT-STK-HIP-001|University Hospital|10|Orthopedic OR - Hip Implant Shelf"
do
  CID=$(echo "$cd"|cut -d'|' -f1); LID=$(echo "$cd"|cut -d'|' -f2)
  HOSP=$(echo "$cd"|cut -d'|' -f3); QTY=$(echo "$cd"|cut -d'|' -f4); LOC=$(echo "$cd"|cut -d'|' -f5)
  R=$(post "$RUC" "consignment" "{\"consignmentId\":\"$CID\",\"lotId\":\"$LID\",\"hospitalId\":\"$HOSP\",\"quantity\":\"$QTY\",\"location\":\"$LOC\"}")
  echo "$R" | grep -q "consignmentId" && ok "$CID" || warn "$CID: $(echo $R | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","?"))' 2>/dev/null)"
done

# ═══════════════════════════
# FINAL STATS
# ═══════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Final Stats"
echo "════════════════════════════════════════════════════════"
rm -f "$GCOOKIE"
curl -sk -c "$GCOOKIE" -X POST "$BASE_URL/login" -H "Content-Type: application/json" \
  -d '{"username":"government1","password":"Gov1-1234"}' > /dev/null
curl -sk -b "$GCOOKIE" "$BASE_URL/assets/stats" | python3 -m json.tool
echo "════════════════════════════════════════════════════════"

rm -rf "$CDIR"
