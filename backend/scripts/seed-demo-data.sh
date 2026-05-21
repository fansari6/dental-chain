# backend/scripts/seed-demo-data.sh
#!/bin/bash
BASE_URL="https://implantchain.dapparchitects.com/api"
COOKIES="/tmp/implant-seed-cookies.txt"
rm -f $COOKIES

echo "════════════════════════════════════════"
echo "  ImplantChain Demo Data Seed"
echo "════════════════════════════════════════"

# ── GOVERNMENT: Register Devices ─────────────────────────────────
echo "Logging in as government1..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"government1","password":"Gov1-1234"}' > /dev/null

echo "Registering devices..."

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00888316419536","deviceName":"Stryker Triathlon Total Knee System",
  "manufacturerId":"stryker","deviceCategory":"orthopedic","deviceType":"joint",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Stryker Triathlon Knee' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00888316013794","deviceName":"Stryker Accolade II Hip Stem",
  "manufacturerId":"stryker","deviceCategory":"orthopedic","deviceType":"joint",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Stryker Accolade II Hip' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00888316523134","deviceName":"Stryker Spine TRITANIUM PL Cage",
  "manufacturerId":"stryker","deviceCategory":"orthopedic","deviceType":"spacer",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ TRITANIUM PL Cage' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00380740991745","deviceName":"Medtronic Micra AV Pacemaker",
  "manufacturerId":"medtronic","deviceCategory":"cardiac","deviceType":"pacemaker",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Medtronic Micra AV' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00380740855801","deviceName":"Medtronic Evoque Tricuspid Valve",
  "manufacturerId":"medtronic","deviceCategory":"cardiac","deviceType":"valve",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"unsafe"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Medtronic Evoque Valve' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00380740037278","deviceName":"Medtronic PRESTIGE LP Cervical Disc",
  "manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"cage",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ PRESTIGE LP Disc' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00380740109159","deviceName":"Medtronic CD HORIZON SOLERA Spinal System",
  "manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"rod",
  "singleUse":"false","sterile":"false","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ CD HORIZON SOLERA' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00380740506561","deviceName":"Medtronic RestoreSensor SCS",
  "manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"stimulator",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ RestoreSensor SCS' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00643169007234","deviceName":"Smith & Nephew JOURNEY II Total Knee",
  "manufacturerId":"smithnephew","deviceCategory":"orthopedic","deviceType":"joint",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Smith Nephew JOURNEY II' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00741570001703","deviceName":"Abbott Confirm Rx Cardiac Monitor",
  "manufacturerId":"abbott","deviceCategory":"cardiac","deviceType":"recorder",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Abbott Confirm Rx' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00888174058651","deviceName":"Ethicon Physiomesh Flexible Composite Mesh",
  "manufacturerId":"ethicon","deviceCategory":"general_surgery","deviceType":"mesh",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"safe"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Ethicon Physiomesh' if 'udiDI' in d else '❌ '+str(d))"

curl -sk -b $COOKIES -X POST $BASE_URL/device -H "Content-Type: application/json" -d '{
  "udiDI":"(01)00888174063068","deviceName":"Allergan Natrelle 410 Tissue Expander",
  "manufacturerId":"allergan","deviceCategory":"general_surgery","deviceType":"tissue_expander",
  "singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"safe"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ Allergan Natrelle 410' if 'udiDI' in d else '❌ '+str(d))"

# ── CLEARANCES ────────────────────────────────────────────────────
echo ""
echo "Issuing clearances..."
CLEARANCE_DATE=$(date +%Y-%m-%d)

for pair in \
  "K193629|(01)00888316419536|510k|stryker" \
  "K181513|(01)00888316013794|510k|stryker" \
  "K211456|(01)00888316523134|510k|stryker" \
  "P160033|(01)00380740991745|PMA|medtronic" \
  "P190009|(01)00380740855801|PMA|medtronic" \
  "P100017|(01)00380740037278|PMA|medtronic" \
  "K180892|(01)00380740109159|510k|medtronic" \
  "P030012|(01)00380740506561|PMA|medtronic" \
  "K201234|(01)00643169007234|510k|smithnephew" \
  "K192001|(01)00741570001703|510k|abbott" \
  "K172456|(01)00888174058651|510k|ethicon" \
  "K189012|(01)00888174063068|510k|allergan"
do
  NUM=$(echo $pair | cut -d'|' -f1)
  UDI=$(echo $pair | cut -d'|' -f2)
  TYPE=$(echo $pair | cut -d'|' -f3)
  MFG=$(echo $pair | cut -d'|' -f4)
  RESULT=$(curl -sk -b $COOKIES -X POST $BASE_URL/clearance -H "Content-Type: application/json" \
    -d "{\"clearanceNumber\":\"$NUM\",\"udiDI\":\"$UDI\",\"manufacturerId\":\"$MFG\",
         \"clearanceType\":\"$TYPE\",\"indicationsForUse\":\"Indicated for surgical use\",
         \"clearanceDate\":\"$CLEARANCE_DATE\",\"expiryDate\":\"\"}")
  echo $RESULT | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ '+d.get('clearanceNumber','') if 'clearanceNumber' in d else '❌ $NUM: '+str(d))"
done

# ── ISO 13485 CERTS ───────────────────────────────────────────────
echo ""
echo "Issuing ISO 13485 certificates..."
ISO_EXPIRY="2029-04-18"

for cert in \
  "ISO13485-BSI-STR-001|stryker|Stryker Kalamazoo Manufacturing|2825 Airview Blvd, Kalamazoo, MI 49002|Design and manufacture of orthopedic implants" \
  "ISO13485-TUV-MDT-001|medtronic|Medtronic Minneapolis Manufacturing|710 Medtronic Pkwy, Minneapolis, MN 55432|Design and manufacture of cardiac, neurosurgical and spinal implants" \
  "ISO13485-BSI-SNS-001|smithnephew|Smith+Nephew Memphis Manufacturing|1450 Brooks Rd, Memphis, TN 38116|Design and manufacture of orthopedic implants" \
  "ISO13485-BSI-ABT-001|abbott|Abbott Sylmar Manufacturing|15900 Valley View Ct, Sylmar, CA 91342|Design and manufacture of cardiac monitoring devices" \
  "ISO13485-SGS-ETH-001|ethicon|Ethicon Somerville Manufacturing|US Route 22, Somerville, NJ 08876|Design and manufacture of surgical mesh products" \
  "ISO13485-TUV-ALG-001|allergan|Allergan Irvine Manufacturing|2525 Dupont Dr, Irvine, CA 92612|Design and manufacture of tissue expanders and breast implants"
do
  CERTID=$(echo $cert | cut -d'|' -f1)
  MFG=$(echo $cert | cut -d'|' -f2)
  FAC=$(echo $cert | cut -d'|' -f3)
  ADDR=$(echo $cert | cut -d'|' -f4)
  SCOPE=$(echo $cert | cut -d'|' -f5)
  curl -sk -b $COOKIES -X POST $BASE_URL/iso13485 -H "Content-Type: application/json" \
    -d "{\"certId\":\"$CERTID\",\"manufacturerId\":\"$MFG\",
         \"facilityName\":\"$FAC\",\"facilityAddress\":\"$ADDR\",
         \"scope\":\"$SCOPE\",\"certBody\":\"BSI Group\",
         \"issueDate\":\"$CLEARANCE_DATE\",\"expiryDate\":\"$ISO_EXPIRY\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ $CERTID' if 'certId' in d else '❌ $CERTID: '+str(d))"
done

# ── STRYKER: Create and release lots ─────────────────────────────
echo ""
echo "Logging in as stryker..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"stryker","password":"Stryker@1234"}' > /dev/null

MFG_DATE=$(date +%Y-%m-%d)
EXP_DATE="2028-04-18"

echo "Creating Stryker lots..."
for lotdata in \
  "LOT-STK-KNEE-001|(01)00888316419536|K193629|ISO13485-BSI-STR-001|2024STKK001A" \
  "LOT-STK-HIP-001|(01)00888316013794|K181513|ISO13485-BSI-STR-001|2024STKH001A" \
  "LOT-STK-CAGE-001|(01)00888316523134|K211456|ISO13485-BSI-STR-001|2024STKC001A"
do
  LOTID=$(echo $lotdata | cut -d'|' -f1)
  UDI=$(echo $lotdata | cut -d'|' -f2)
  CLR=$(echo $lotdata | cut -d'|' -f3)
  CERT=$(echo $lotdata | cut -d'|' -f4)
  LOTNUM=$(echo $lotdata | cut -d'|' -f5)
  curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
    -d "{\"lotId\":\"$LOTID\",\"udiDI\":\"$UDI\",\"clearanceNumber\":\"$CLR\",
         \"certId\":\"$CERT\",\"lotNumber\":\"$LOTNUM\",
         \"manufacturingDate\":\"$MFG_DATE\",\"expiryDate\":\"$EXP_DATE\",
         \"sterileExpiryDate\":\"\",\"quantity\":\"100\",
         \"storageConditions\":\"Store at room temperature\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ '+d.get('lotId','') if 'lotId' in d else '❌ $LOTID: '+str(d))"
  curl -sk -b $COOKIES -X POST $BASE_URL/lot/$LOTID/release \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"
done

# ── MEDTRONIC: Create and release lots ───────────────────────────
echo ""
echo "Logging in as medtronic..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"medtronic","password":"Medtronic@1234"}' > /dev/null

echo "Creating Medtronic lots..."
for lotdata in \
  "LOT-MDT-PCE-001|(01)00380740991745|P160033|ISO13485-TUV-MDT-001|2024MDTP001A" \
  "LOT-MDT-VLV-001|(01)00380740855801|P190009|ISO13485-TUV-MDT-001|2024MDTV001A" \
  "LOT-MDT-DSC-001|(01)00380740037278|P100017|ISO13485-TUV-MDT-001|2024MDTD001A" \
  "LOT-MDT-ROD-001|(01)00380740109159|K180892|ISO13485-TUV-MDT-001|2024MDTR001A" \
  "LOT-MDT-SCS-001|(01)00380740506561|P030012|ISO13485-TUV-MDT-001|2024MDTS001A"
do
  LOTID=$(echo $lotdata | cut -d'|' -f1)
  UDI=$(echo $lotdata | cut -d'|' -f2)
  CLR=$(echo $lotdata | cut -d'|' -f3)
  CERT=$(echo $lotdata | cut -d'|' -f4)
  LOTNUM=$(echo $lotdata | cut -d'|' -f5)
  curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
    -d "{\"lotId\":\"$LOTID\",\"udiDI\":\"$UDI\",\"clearanceNumber\":\"$CLR\",
         \"certId\":\"$CERT\",\"lotNumber\":\"$LOTNUM\",
         \"manufacturingDate\":\"$MFG_DATE\",\"expiryDate\":\"$EXP_DATE\",
         \"sterileExpiryDate\":\"\",\"quantity\":\"100\",
         \"storageConditions\":\"Store at room temperature\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ '+d.get('lotId','') if 'lotId' in d else '❌ $LOTID: '+str(d))"
  curl -sk -b $COOKIES -X POST $BASE_URL/lot/$LOTID/release \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"
done

# ── SMITH & NEPHEW ────────────────────────────────────────────────
echo ""
echo "Logging in as smithnephew..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"smithnephew","password":"Smith@1234"}' > /dev/null

curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
  -d '{"lotId":"LOT-SNS-KNEE-001","udiDI":"(01)00643169007234","clearanceNumber":"K201234",
       "certId":"ISO13485-BSI-SNS-001","lotNumber":"2024SNSK001A",
       "manufacturingDate":"'"$MFG_DATE"'","expiryDate":"'"$EXP_DATE"'",
       "sterileExpiryDate":"","quantity":"100","storageConditions":"Store at room temperature"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ LOT-SNS-KNEE-001' if 'lotId' in d else '❌ '+str(d))"
curl -sk -b $COOKIES -X POST $BASE_URL/lot/LOT-SNS-KNEE-001/release \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"

# ── ABBOTT ────────────────────────────────────────────────────────
echo ""
echo "Logging in as abbott..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"abbott","password":"Abbott@1234"}' > /dev/null

curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
  -d '{"lotId":"LOT-ABT-MON-001","udiDI":"(01)00741570001703","clearanceNumber":"K192001",
       "certId":"ISO13485-BSI-ABT-001","lotNumber":"2024ABTM001A",
       "manufacturingDate":"'"$MFG_DATE"'","expiryDate":"'"$EXP_DATE"'",
       "sterileExpiryDate":"","quantity":"100","storageConditions":"Store at room temperature"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ LOT-ABT-MON-001' if 'lotId' in d else '❌ '+str(d))"
curl -sk -b $COOKIES -X POST $BASE_URL/lot/LOT-ABT-MON-001/release \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"

# ── ETHICON ───────────────────────────────────────────────────────
echo ""
echo "Logging in as ethicon..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"ethicon","password":"Ethicon@1234"}' > /dev/null

curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
  -d '{"lotId":"LOT-ETH-MSH-001","udiDI":"(01)00888174058651","clearanceNumber":"K172456",
       "certId":"ISO13485-SGS-ETH-001","lotNumber":"2024ETHM001A",
       "manufacturingDate":"'"$MFG_DATE"'","expiryDate":"'"$EXP_DATE"'",
       "sterileExpiryDate":"","quantity":"100","storageConditions":"Store at room temperature"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ LOT-ETH-MSH-001' if 'lotId' in d else '❌ '+str(d))"
curl -sk -b $COOKIES -X POST $BASE_URL/lot/LOT-ETH-MSH-001/release \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"

# ── ALLERGAN ──────────────────────────────────────────────────────
echo ""
echo "Logging in as allergan..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"allergan","password":"Allergan@1234"}' > /dev/null

curl -sk -b $COOKIES -X POST $BASE_URL/lot -H "Content-Type: application/json" \
  -d '{"lotId":"LOT-ALL-EXP-001","udiDI":"(01)00888174063068","clearanceNumber":"K189012",
       "certId":"ISO13485-TUV-ALG-001","lotNumber":"2024ALLE001A",
       "manufacturingDate":"'"$MFG_DATE"'","expiryDate":"'"$EXP_DATE"'",
       "sterileExpiryDate":"","quantity":"100","storageConditions":"Store at room temperature"}' \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ LOT-ALL-EXP-001' if 'lotId' in d else '❌ '+str(d))"
curl -sk -b $COOKIES -X POST $BASE_URL/lot/LOT-ALL-EXP-001/release \
  | python3 -c "import sys,json; d=json.load(sys.stdin); print('  ✅ QC released' if d.get('status')=='active' else '  ❌ '+str(d))"

# ── CONSIGNMENTS ──────────────────────────────────────────────────
echo ""
echo "Logging in as rep-memorial..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rep-memorial","password":"Rep-Mem@1234"}' > /dev/null

echo "Creating Memorial Hospital consignments..."
for cdata in \
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
  CID=$(echo $cdata | cut -d'|' -f1)
  LID=$(echo $cdata | cut -d'|' -f2)
  HOSP=$(echo $cdata | cut -d'|' -f3)
  QTY=$(echo $cdata | cut -d'|' -f4)
  LOC=$(echo $cdata | cut -d'|' -f5)
  curl -sk -b $COOKIES -X POST $BASE_URL/consignment -H "Content-Type: application/json" \
    -d "{\"consignmentId\":\"$CID\",\"lotId\":\"$LID\",\"hospitalId\":\"$HOSP\",
         \"quantity\":\"$QTY\",\"location\":\"$LOC\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ $CID' if 'consignmentId' in d else '❌ $CID: '+str(d))"
done

echo ""
echo "Logging in as rep-university..."
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"rep-university","password":"Rep-Uni@1234"}' > /dev/null

echo "Creating University Hospital consignments..."
for cdata in \
  "CONS-UNI-KNEE-001|LOT-SNS-KNEE-001|University Hospital|20|Orthopedic OR - Main Cart" \
  "CONS-UNI-HIP-001|LOT-STK-HIP-001|University Hospital|10|Orthopedic OR - Hip Implant Shelf"
do
  CID=$(echo $cdata | cut -d'|' -f1)
  LID=$(echo $cdata | cut -d'|' -f2)
  HOSP=$(echo $cdata | cut -d'|' -f3)
  QTY=$(echo $cdata | cut -d'|' -f4)
  LOC=$(echo $cdata | cut -d'|' -f5)
  curl -sk -b $COOKIES -X POST $BASE_URL/consignment -H "Content-Type: application/json" \
    -d "{\"consignmentId\":\"$CID\",\"lotId\":\"$LID\",\"hospitalId\":\"$HOSP\",
         \"quantity\":\"$QTY\",\"location\":\"$LOC\"}" \
    | python3 -c "import sys,json; d=json.load(sys.stdin); print('✅ $CID' if 'consignmentId' in d else '❌ $CID: '+str(d))"
done

echo ""
echo "════════════════════════════════════════"
echo "  Final stats:"
curl -sk -c $COOKIES -b $COOKIES -X POST $BASE_URL/login \
  -H "Content-Type: application/json" \
  -d '{"username":"government1","password":"Gov1-1234"}' > /dev/null
curl -sk -b $COOKIES $BASE_URL/assets/stats | python3 -m json.tool
echo "════════════════════════════════════════"
