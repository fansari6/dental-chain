#!/bin/bash
# =============================================================
# ImplantChain — Phase 1 Seed: Device Submissions + ISO Certs
# Devices go through the submission workflow (pending → approve
# via UI as government1). ISO certs go directly to blockchain.
# Run Phase 2 after approving all submissions in the UI.
#
# Usage:
#   bash seed-phase1.sh                        # hits localhost:4000
#   BASE_URL=https://implantchain.dapparchitects.com/api bash seed-phase1.sh
# =============================================================

BASE_URL="${BASE_URL:-http://localhost:4000/api}"
COOKIE_DIR="/tmp/implant_seed"
mkdir -p "$COOKIE_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }

# ── Login helper ─────────────────────────────────────────────────
# Each user gets their own cookie file to avoid session conflicts
login() {
  local user="$1" pass="$2"
  local cookie="$COOKIE_DIR/${user}.cookie"
  rm -f "$cookie"
  local resp
  resp=$(curl -sk -c "$cookie" -b "$cookie" \
    -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}")
  # if echo "$resp" | grep -q "\"username\""; then
  #   info "Logged in as $user"
  #   echo "$cookie"
  if echo "$resp" | grep -q "\"username\""; then
    info "Logged in as $user" >&2
    echo "$cookie"
  else
    echo -e "${RED}Login failed for $user: $resp${NC}" >&2
    echo ""
  fi
}

# ── POST helper ──────────────────────────────────────────────────
post() {
  local cookie="$1" endpoint="$2" payload="$3"
  curl -sk -b "$cookie" \
    -X POST "$BASE_URL/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo ""
echo "════════════════════════════════════════════════════════"
echo "  ImplantChain Phase 1 Seed"
echo "  Target: $BASE_URL"
echo "════════════════════════════════════════════════════════"

TODAY=$(date +%Y-%m-%d)
ISO_EXPIRY="2029-12-31"

# ═════════════════════════════════════════════════════════════
# STEP 1 — MANUFACTURER DEVICE SUBMISSIONS
# Each manufacturer submits their own devices.
# These land in device_submissions table with status=pending.
# Government approves via UI → device written to blockchain.
# ═════════════════════════════════════════════════════════════
echo ""
info "── Step 1: Device Submissions (manufacturer → pending) ──"

# ── Stryker ──────────────────────────────────────────────────
COOKIE=$(login stryker "Stryker@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00888316419536",
    "deviceName":"Stryker Triathlon Total Knee System",
    "deviceCategory":"orthopedic","deviceType":"joint",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Left Knee","Right Knee"],
    "indications":"Total knee arthroplasty in skeletally mature patients with osteoarthritis"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Stryker Triathlon Knee submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00888316013794",
    "deviceName":"Stryker Accolade II Hip Stem",
    "deviceCategory":"orthopedic","deviceType":"joint",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Left Hip","Right Hip"],
    "indications":"Total hip arthroplasty in patients with hip joint disease"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Stryker Accolade II Hip submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00888316523134",
    "deviceName":"Stryker Spine TRITANIUM PL Cage",
    "deviceCategory":"orthopedic","deviceType":"spacer",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["L3/L4","L4/L5","L5/S1","Cervical Spine (C1-C7)"],
    "indications":"Interbody spinal fusion at one or two levels"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Stryker TRITANIUM PL Cage submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ── Medtronic ─────────────────────────────────────────────────
COOKIE=$(login medtronic "Medtronic@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00380740991745",
    "deviceName":"Medtronic Micra AV Pacemaker",
    "deviceCategory":"cardiac","deviceType":"pacemaker",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Right Ventricle","Left Ventricle"],
    "indications":"Permanent cardiac pacing in patients with AV block or sinus node dysfunction"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Medtronic Micra AV submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00380740855801",
    "deviceName":"Medtronic Evoque Tricuspid Valve",
    "deviceCategory":"cardiac","deviceType":"valve",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"unsafe",
    "bodyLocations":["Tricuspid Valve"],
    "indications":"Transcatheter tricuspid valve replacement for severe symptomatic tricuspid regurgitation"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Medtronic Evoque Valve submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00380740037278",
    "deviceName":"Medtronic PRESTIGE LP Cervical Disc",
    "deviceCategory":"neurosurgery","deviceType":"cage",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Cervical Spine (C1-C7)"],
    "indications":"Cervical disc replacement at one level from C3 to C7"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Medtronic PRESTIGE LP Disc submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00380740109159",
    "deviceName":"Medtronic CD HORIZON SOLERA Spinal System",
    "deviceCategory":"neurosurgery","deviceType":"rod",
    "singleUse":false,"sterile":false,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Cervical Spine (C1-C7)","Thoracic Spine (T1-T12)","Lumbar Spine (L1-L5)"],
    "indications":"Posterior spinal fixation for degenerative disc disease, fracture, deformity"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Medtronic CD HORIZON SOLERA submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00380740506561",
    "deviceName":"Medtronic RestoreSensor SCS",
    "deviceCategory":"neurosurgery","deviceType":"stimulator",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Lumbar Spine (L1-L5)","Thoracic Spine (T1-T12)"],
    "indications":"Spinal cord stimulation for chronic intractable pain of the trunk and limbs"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Medtronic RestoreSensor SCS submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ── Smith & Nephew ────────────────────────────────────────────
COOKIE=$(login smithnephew "Smith@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00643169007234",
    "deviceName":"Smith & Nephew JOURNEY II Total Knee",
    "deviceCategory":"orthopedic","deviceType":"joint",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Left Knee","Right Knee"],
    "indications":"Total knee arthroplasty for relief of pain and improved function"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Smith & Nephew JOURNEY II submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ── Abbott ────────────────────────────────────────────────────
COOKIE=$(login abbott "Abbott@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00741570001703",
    "deviceName":"Abbott Confirm Rx Cardiac Monitor",
    "deviceCategory":"cardiac","deviceType":"recorder",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"conditional",
    "bodyLocations":["Left Ventricle","Right Ventricle"],
    "indications":"Continuous cardiac monitoring for detection of arrhythmias"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Abbott Confirm Rx submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ── Ethicon ───────────────────────────────────────────────────
COOKIE=$(login ethicon "Ethicon@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00888174058651",
    "deviceName":"Ethicon Physiomesh Flexible Composite Mesh",
    "deviceCategory":"general_surgery","deviceType":"mesh",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"safe",
    "bodyLocations":["Abdomen","Pelvis","Groin - Left","Groin - Right"],
    "indications":"Repair or reinforcement of soft tissue defects including hernia"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Ethicon Physiomesh submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ── Allergan ──────────────────────────────────────────────────
COOKIE=$(login allergan "Allergan@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "device-submissions" '{
    "udiDI":"(01)00888174063068",
    "deviceName":"Allergan Natrelle 410 Tissue Expander",
    "deviceCategory":"general_surgery","deviceType":"tissue_expander",
    "singleUse":true,"sterile":true,"containsLatex":false,"mriSafe":"safe",
    "bodyLocations":["Left Breast","Right Breast"],
    "indications":"Tissue expansion prior to breast reconstruction following mastectomy"
  }')
  echo "$resp" | grep -q "udi_di" && ok "Allergan Natrelle 410 submitted" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ═════════════════════════════════════════════════════════════
# STEP 2 — ISO 13485 CERTIFICATES
# Manufacturers upload directly to blockchain (no approval needed)
# ═════════════════════════════════════════════════════════════
echo ""
info "── Step 2: ISO 13485 Certificates (direct to blockchain) ──"

COOKIE=$(login stryker "Stryker@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-BSI-STR-001\",
    \"manufacturerId\":\"stryker\",
    \"facilityName\":\"Stryker Kalamazoo Manufacturing\",
    \"facilityAddress\":\"2825 Airview Blvd, Kalamazoo, MI 49002\",
    \"scope\":\"Design and manufacture of orthopedic joint replacement implants\",
    \"certBody\":\"BSI Group\",
    \"issueDate\":\"2024-01-15\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Stryker ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

COOKIE=$(login medtronic "Medtronic@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-TUV-MDT-001\",
    \"manufacturerId\":\"medtronic\",
    \"facilityName\":\"Medtronic Minneapolis Manufacturing\",
    \"facilityAddress\":\"710 Medtronic Pkwy, Minneapolis, MN 55432\",
    \"scope\":\"Design and manufacture of cardiac, neurosurgical and spinal implants\",
    \"certBody\":\"TUV SUD\",
    \"issueDate\":\"2024-02-01\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Medtronic ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

COOKIE=$(login smithnephew "Smith@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-BSI-SNS-001\",
    \"manufacturerId\":\"smithnephew\",
    \"facilityName\":\"Smith+Nephew Memphis Manufacturing\",
    \"facilityAddress\":\"1450 Brooks Rd, Memphis, TN 38116\",
    \"scope\":\"Design and manufacture of orthopedic implants and instruments\",
    \"certBody\":\"BSI Group\",
    \"issueDate\":\"2024-01-20\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Smith & Nephew ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

COOKIE=$(login abbott "Abbott@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-BSI-ABT-001\",
    \"manufacturerId\":\"abbott\",
    \"facilityName\":\"Abbott Sylmar Manufacturing\",
    \"facilityAddress\":\"15900 Valley View Ct, Sylmar, CA 91342\",
    \"scope\":\"Design and manufacture of cardiac monitoring and diagnostic devices\",
    \"certBody\":\"BSI Group\",
    \"issueDate\":\"2024-03-01\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Abbott ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

COOKIE=$(login ethicon "Ethicon@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-SGS-ETH-001\",
    \"manufacturerId\":\"ethicon\",
    \"facilityName\":\"Ethicon Somerville Manufacturing\",
    \"facilityAddress\":\"US Route 22, Somerville, NJ 08876\",
    \"scope\":\"Design and manufacture of surgical mesh and wound closure products\",
    \"certBody\":\"SGS\",
    \"issueDate\":\"2024-01-10\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Ethicon ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

COOKIE=$(login allergan "Allergan@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-TUV-ALG-001\",
    \"manufacturerId\":\"allergan\",
    \"facilityName\":\"Allergan Irvine Manufacturing\",
    \"facilityAddress\":\"2525 Dupont Dr, Irvine, CA 92612\",
    \"scope\":\"Design and manufacture of tissue expanders and breast implants\",
    \"certBody\":\"TUV SUD\",
    \"issueDate\":\"2024-02-15\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Allergan ISO 13485 cert uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ═════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Phase 1 Seed Complete"
echo ""
echo "  Next steps:"
echo "  1. Login as government1 in the UI"
echo "  2. Go to Government → Devices tab"
echo "  3. Approve all 12 pending device submissions"
echo "  4. Go to Government → Clearances tab"
echo "  5. Issue clearances for each approved device"
echo "  6. Run seed-phase2.sh to create lots and consignments"
echo "════════════════════════════════════════════════════════"
echo ""

# Show pending submission count
COOKIE=$(login government1 "Gov1-1234")
if [ -n "$COOKIE" ]; then
  COUNT=$(curl -sk -b "$COOKIE" "$BASE_URL/device-submissions" | python3 -c "
import sys, json
data = json.load(sys.stdin)
pending = [d for d in data if d.get('status') == 'pending']
print(f'Pending submissions: {len(pending)}/12')
for d in pending:
    print(f'  - {d[\"udi_di\"]} | {d[\"device_name\"]} | {d[\"manufacturer_id\"]}')
" 2>/dev/null)
  echo "$COUNT"
fi

# Cleanup cookie files
rm -rf "$COOKIE_DIR"
