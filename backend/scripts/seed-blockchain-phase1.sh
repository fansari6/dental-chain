#!/bin/bash
# =============================================================
# DentalChain — Phase 1 Seed: Dental Devices + ISO 13485 Certs
# Devices go DIRECTLY to blockchain (no approval workflow).
# ISO certs go directly to blockchain.
# Run Phase 2 after this to create lots and consignments.
#
# Usage:
#   bash seed-phase1.sh                        # hits localhost:4001
#   BASE_URL=https://dentalchain.dapparchitects.com/api bash seed-phase1.sh
# =============================================================

BASE_URL="${BASE_URL:-http://localhost:4001/api}"
COOKIE_DIR="/tmp/dental_seed"
mkdir -p "$COOKIE_DIR"

RED='\033[0;31m'; GREEN='\033[0;32m'; CYAN='\033[0;36m'; YELLOW='\033[1;33m'; NC='\033[0m'
ok()   { echo -e "${GREEN}  ✅ $1${NC}"; }
fail() { echo -e "${RED}  ❌ $1${NC}"; }
info() { echo -e "${CYAN}$1${NC}"; }
warn() { echo -e "${YELLOW}  ⚠ $1${NC}"; }

login() {
  local user="$1" pass="$2"
  local cookie="$COOKIE_DIR/${user//[@.]/_}.cookie"
  rm -f "$cookie"
  local resp
  resp=$(curl -sk -c "$cookie" -b "$cookie" \
    -X POST "$BASE_URL/login" \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$user\",\"password\":\"$pass\"}")
  if echo "$resp" | grep -q "\"username\""; then
    info "Logged in as $user" >&2
    echo "$cookie"
  else
    echo -e "${RED}Login failed for $user: $resp${NC}" >&2
    echo ""
  fi
}

post() {
  local cookie="$1" endpoint="$2" payload="$3"
  curl -sk -b "$cookie" \
    -X POST "$BASE_URL/$endpoint" \
    -H "Content-Type: application/json" \
    -d "$payload"
}

echo ""
echo "════════════════════════════════════════════════════════"
echo "  DentalChain Phase 1 Seed"
echo "  Target: $BASE_URL"
echo "════════════════════════════════════════════════════════"

TODAY=$(date +%Y-%m-%d)
ISO_EXPIRY="2029-12-31"

# ═════════════════════════════════════════════════════════════
# STEP 1 — REGISTER DENTAL DEVICES (as FDA government)
# Devices go directly to blockchain — no approval step needed
# ═════════════════════════════════════════════════════════════
echo ""
info "── Step 1: Registering Dental Devices (FDA → Blockchain) ──"

COOKIE=$(login "j.whitfield@fda.hhs.gov" "FDA@1234")

if [ -n "$COOKIE" ]; then

  # ── Nobel Biocare ─────────────────────────────────────────
  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00885433000001",
    "deviceName":"Nobel Biocare NobelActive 3.5mm x 10mm",
    "manufacturerId":"nobelbiocare",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"3.5mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "NobelActive 3.5x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00885433000002",
    "deviceName":"Nobel Biocare NobelActive 4.0mm x 10mm",
    "manufacturerId":"nobelbiocare",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.0mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "NobelActive 4.0x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00885433000003",
    "deviceName":"Nobel Biocare NobelActive 4.3mm x 13mm",
    "manufacturerId":"nobelbiocare",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.3mm",
    "length":"13mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "NobelActive 4.3x13" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00885433000004",
    "deviceName":"Nobel Biocare NobelParallel CC 4.3mm x 10mm",
    "manufacturerId":"nobelbiocare",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.3mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "NobelParallel CC 4.3x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00885433000005",
    "deviceName":"Nobel Biocare Multi-unit Abutment 17-degree",
    "manufacturerId":"nobelbiocare",
    "deviceType":"abutment",
    "material":"titanium",
    "diameter":"4.0mm",
    "length":"3mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Nobel Multi-unit Abutment" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  # ── Straumann ─────────────────────────────────────────────
  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)07612905000001",
    "deviceName":"Straumann BLX 3.75mm x 10mm",
    "manufacturerId":"straumann",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"3.75mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Straumann BLX 3.75x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)07612905000002",
    "deviceName":"Straumann BLX 4.5mm x 12mm",
    "manufacturerId":"straumann",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.5mm",
    "length":"12mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Straumann BLX 4.5x12" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)07612905000003",
    "deviceName":"Straumann PURE Ceramic 4.1mm x 10mm",
    "manufacturerId":"straumann",
    "deviceType":"implant-post",
    "material":"zirconia",
    "diameter":"4.1mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Straumann PURE Ceramic 4.1x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)07612905000004",
    "deviceName":"Straumann Variobase Abutment 4.5mm",
    "manufacturerId":"straumann",
    "deviceType":"abutment",
    "material":"titanium",
    "diameter":"4.5mm",
    "length":"5.5mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Straumann Variobase Abutment" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  # ── Zimmer Biomet ─────────────────────────────────────────
  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00380740000001",
    "deviceName":"Zimmer Biomet Tapered Screw-Vent 3.7mm x 10mm",
    "manufacturerId":"zimmerbiomet",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"3.7mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Zimmer TSV 3.7x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00380740000002",
    "deviceName":"Zimmer Biomet Tapered Screw-Vent 4.7mm x 12mm",
    "manufacturerId":"zimmerbiomet",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.7mm",
    "length":"12mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Zimmer TSV 4.7x12" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00380740000003",
    "deviceName":"Zimmer Biomet Zirconia Crown 4.0mm",
    "manufacturerId":"zimmerbiomet",
    "deviceType":"crown",
    "material":"zirconia",
    "diameter":"4.0mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "Zimmer Zirconia Crown" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  # ── BioHorizons ───────────────────────────────────────────
  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00812666000001",
    "deviceName":"BioHorizons Tapered Internal 3.8mm x 10mm",
    "manufacturerId":"biohorizons",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"3.8mm",
    "length":"10mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "BioHorizons TI 3.8x10" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00812666000002",
    "deviceName":"BioHorizons Tapered Internal 4.6mm x 12mm",
    "manufacturerId":"biohorizons",
    "deviceType":"implant-post",
    "material":"titanium",
    "diameter":"4.6mm",
    "length":"12mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "BioHorizons TI 4.6x12" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

  resp=$(post "$COOKIE" "device" '{
    "udiDI":"(01)00812666000003",
    "deviceName":"BioHorizons Bone Graft Membrane 20x30mm",
    "manufacturerId":"biohorizons",
    "deviceType":"membrane",
    "material":"collagen",
    "diameter":"20mm",
    "length":"30mm"
  }')
  echo "$resp" | grep -q "udiDI" && ok "BioHorizons Bone Graft Membrane" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"

fi

# ═════════════════════════════════════════════════════════════
# STEP 2 — ISO 13485 CERTIFICATES
# Each manufacturer uploads their own cert
# ═════════════════════════════════════════════════════════════
echo ""
info "── Step 2: ISO 13485 Certificates (direct to blockchain) ──"

# Nobel Biocare
COOKIE=$(login "compliance@nobelbiocare.com" "Nobel@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-TUV-NBC-001\",
    \"manufacturerId\":\"nobelbiocare\",
    \"facilityName\":\"Nobel Biocare USA LLC\",
    \"facilityAddress\":\"22715 Savi Ranch Pkwy, Yorba Linda, CA 92887\",
    \"scope\":\"Design and manufacture of dental implants, prosthetic components and instruments\",
    \"certBody\":\"TUV SUD\",
    \"issueDate\":\"2024-01-15\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Nobel Biocare ISO 13485 uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# Straumann
COOKIE=$(login "compliance@straumann.com" "Straumann@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-BSI-STR-001\",
    \"manufacturerId\":\"straumann\",
    \"facilityName\":\"Straumann USA LLC\",
    \"facilityAddress\":\"60 Minuteman Road, Andover, MA 01810\",
    \"scope\":\"Design and manufacture of dental implant systems and regenerative products\",
    \"certBody\":\"BSI Group\",
    \"issueDate\":\"2024-02-01\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Straumann ISO 13485 uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# Zimmer Biomet
COOKIE=$(login "compliance@zimmerbiomet.com" "Zimmer@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-BSI-ZBD-001\",
    \"manufacturerId\":\"zimmerbiomet\",
    \"facilityName\":\"Zimmer Biomet Dental\",
    \"facilityAddress\":\"1900 Aston Ave, Carlsbad, CA 92008\",
    \"scope\":\"Design and manufacture of dental implants and prosthetic components\",
    \"certBody\":\"BSI Group\",
    \"issueDate\":\"2024-01-20\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "Zimmer Biomet ISO 13485 uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# BioHorizons
COOKIE=$(login "compliance@biohorizons.com" "BioH@1234")
if [ -n "$COOKIE" ]; then
  resp=$(post "$COOKIE" "iso13485" "{
    \"certId\":\"ISO13485-SGS-BHZ-001\",
    \"manufacturerId\":\"biohorizons\",
    \"facilityName\":\"BioHorizons Implant Systems Inc\",
    \"facilityAddress\":\"2300 Riverchase Galleria, Birmingham, AL 35244\",
    \"scope\":\"Design and manufacture of dental implants, abutments and surgical instruments\",
    \"certBody\":\"SGS\",
    \"issueDate\":\"2024-03-01\",
    \"expiryDate\":\"$ISO_EXPIRY\"
  }")
  echo "$resp" | grep -q "certId" && ok "BioHorizons ISO 13485 uploaded" || warn "$(echo $resp | python3 -c 'import sys,json; d=json.load(sys.stdin); print(d.get("error","unknown"))' 2>/dev/null)"
fi

# ═════════════════════════════════════════════════════════════
# SUMMARY
# ═════════════════════════════════════════════════════════════
echo ""
echo "════════════════════════════════════════════════════════"
echo "  Phase 1 Seed Complete"
echo ""
echo "  Next steps:"
echo "  1. Login as j.whitfield@fda.hhs.gov in the UI"
echo "  2. Go to Government → Clearances"
echo "  3. Issue FDA clearances for each device"
echo "  4. Run seed-phase2.sh to create lots and consignments"
echo "════════════════════════════════════════════════════════"
echo ""

# Show device count
COOKIE=$(login "admin@dentalchain.com" "Admin@1234")
if [ -n "$COOKIE" ]; then
  COUNT=$(curl -sk -b "$COOKIE" "$BASE_URL/assets/devices" | python3 -c "
import sys, json
data = json.load(sys.stdin)
print(f'Devices on blockchain: {len(data)}')
for d in data:
    print(f'  - {d[\"udiDI\"]} | {d[\"deviceName\"]}')
" 2>/dev/null)
  echo "$COUNT"
fi

rm -rf "$COOKIE_DIR"
