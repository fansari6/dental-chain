COOKIE="/tmp/seed.cookie"
BASE="http://localhost:4000/api"

login() {
  curl -sk -c $COOKIE -b $COOKIE -X POST $BASE/login \
    -H "Content-Type: application/json" \
    -d "{\"username\":\"$1\",\"password\":\"$2\"}" > /dev/null
}

post() {
  curl -sk -b $COOKIE -X POST $BASE/$1 \
    -H "Content-Type: application/json" \
    -d "$2"
}

# Devices
login government1 Gov1-1234

post device '{"udiDI":"(01)00888316013794","deviceName":"Stryker Accolade II Hip Stem","manufacturerId":"stryker","deviceCategory":"orthopedic","deviceType":"joint","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00888316523134","deviceName":"Stryker Spine TRITANIUM PL Cage","manufacturerId":"stryker","deviceCategory":"orthopedic","deviceType":"spacer","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00380740991745","deviceName":"Medtronic Micra AV Pacemaker","manufacturerId":"medtronic","deviceCategory":"cardiac","deviceType":"pacemaker","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00380740855801","deviceName":"Medtronic Evoque Tricuspid Valve","manufacturerId":"medtronic","deviceCategory":"cardiac","deviceType":"valve","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"unsafe"}'
post device '{"udiDI":"(01)00380740037278","deviceName":"Medtronic PRESTIGE LP Cervical Disc","manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"cage","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00380740109159","deviceName":"Medtronic CD HORIZON SOLERA Spinal System","manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"rod","singleUse":"false","sterile":"false","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00380740506561","deviceName":"Medtronic RestoreSensor SCS","manufacturerId":"medtronic","deviceCategory":"neurosurgery","deviceType":"stimulator","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00643169007234","deviceName":"Smith & Nephew JOURNEY II Total Knee","manufacturerId":"smithnephew","deviceCategory":"orthopedic","deviceType":"joint","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00741570001703","deviceName":"Abbott Confirm Rx Cardiac Monitor","manufacturerId":"abbott","deviceCategory":"cardiac","deviceType":"recorder","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"conditional"}'
post device '{"udiDI":"(01)00888174058651","deviceName":"Ethicon Physiomesh Flexible Composite Mesh","manufacturerId":"ethicon","deviceCategory":"general_surgery","deviceType":"mesh","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"safe"}'
post device '{"udiDI":"(01)00888174063068","deviceName":"Allergan Natrelle 410 Tissue Expander","manufacturerId":"allergan","deviceCategory":"general_surgery","deviceType":"tissue_expander","singleUse":"true","sterile":"true","containsLatex":"false","mriSafe":"safe"}'

echo "Devices done"

# Clearances
TODAY=$(date +%Y-%m-%d)
post clearance "{\"clearanceNumber\":\"K193629\",\"udiDI\":\"(01)00888316419536\",\"manufacturerId\":\"stryker\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Total knee arthroplasty\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K181513\",\"udiDI\":\"(01)00888316013794\",\"manufacturerId\":\"stryker\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Total hip arthroplasty\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K211456\",\"udiDI\":\"(01)00888316523134\",\"manufacturerId\":\"stryker\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Spinal fusion\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"P160033\",\"udiDI\":\"(01)00380740991745\",\"manufacturerId\":\"medtronic\",\"clearanceType\":\"PMA\",\"indicationsForUse\":\"Cardiac pacing\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"P190009\",\"udiDI\":\"(01)00380740855801\",\"manufacturerId\":\"medtronic\",\"clearanceType\":\"PMA\",\"indicationsForUse\":\"Tricuspid valve replacement\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"P100017\",\"udiDI\":\"(01)00380740037278\",\"manufacturerId\":\"medtronic\",\"clearanceType\":\"PMA\",\"indicationsForUse\":\"Cervical disc replacement\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K180892\",\"udiDI\":\"(01)00380740109159\",\"manufacturerId\":\"medtronic\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Spinal fixation\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"P030012\",\"udiDI\":\"(01)00380740506561\",\"manufacturerId\":\"medtronic\",\"clearanceType\":\"PMA\",\"indicationsForUse\":\"Spinal cord stimulation\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K201234\",\"udiDI\":\"(01)00643169007234\",\"manufacturerId\":\"smithnephew\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Total knee arthroplasty\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K192001\",\"udiDI\":\"(01)00741570001703\",\"manufacturerId\":\"abbott\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Cardiac monitoring\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K172456\",\"udiDI\":\"(01)00888174058651\",\"manufacturerId\":\"ethicon\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Hernia repair\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"
post clearance "{\"clearanceNumber\":\"K189012\",\"udiDI\":\"(01)00888174063068\",\"manufacturerId\":\"allergan\",\"clearanceType\":\"510k\",\"indicationsForUse\":\"Breast reconstruction\",\"clearanceDate\":\"$TODAY\",\"expiryDate\":\"\"}"

echo "Clearances done"

# ISO certs — login as each manufacturer
login stryker Stryker@1234
post iso13485 '{"certId":"ISO13485-BSI-STR-001","manufacturerId":"stryker","facilityName":"Stryker Kalamazoo","facilityAddress":"2825 Airview Blvd, Kalamazoo, MI","scope":"Orthopedic implants","certBody":"BSI Group","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

login medtronic Medtronic@1234
post iso13485 '{"certId":"ISO13485-TUV-MDT-001","manufacturerId":"medtronic","facilityName":"Medtronic Minneapolis","facilityAddress":"710 Medtronic Pkwy, Minneapolis, MN","scope":"Cardiac and neuro implants","certBody":"TUV SUD","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

login smithnephew Smith@1234
post iso13485 '{"certId":"ISO13485-BSI-SNS-001","manufacturerId":"smithnephew","facilityName":"Smith+Nephew Memphis","facilityAddress":"1450 Brooks Rd, Memphis, TN","scope":"Orthopedic implants","certBody":"BSI Group","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

login abbott Abbott@1234
post iso13485 '{"certId":"ISO13485-BSI-ABT-001","manufacturerId":"abbott","facilityName":"Abbott Sylmar","facilityAddress":"15900 Valley View Ct, Sylmar, CA","scope":"Cardiac monitoring","certBody":"BSI Group","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

login ethicon Ethicon@1234
post iso13485 '{"certId":"ISO13485-SGS-ETH-001","manufacturerId":"ethicon","facilityName":"Ethicon Somerville","facilityAddress":"US Route 22, Somerville, NJ","scope":"Surgical mesh","certBody":"SGS","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

login allergan Allergan@1234
post iso13485 '{"certId":"ISO13485-TUV-ALG-001","manufacturerId":"allergan","facilityName":"Allergan Irvine","facilityAddress":"2525 Dupont Dr, Irvine, CA","scope":"Tissue expanders","certBody":"TUV SUD","issueDate":"2024-01-01","expiryDate":"2029-04-18"}'

echo "ISO certs done"

# Lots
login stryker Stryker@1234
post lot "{\"lotId\":\"LOT-STK-KNEE-001\",\"udiDI\":\"(01)00888316419536\",\"clearanceNumber\":\"K193629\",\"certId\":\"ISO13485-BSI-STR-001\",\"lotNumber\":\"2024STKK001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-STK-KNEE-001/release '{}'
post lot "{\"lotId\":\"LOT-STK-HIP-001\",\"udiDI\":\"(01)00888316013794\",\"clearanceNumber\":\"K181513\",\"certId\":\"ISO13485-BSI-STR-001\",\"lotNumber\":\"2024STKH001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-STK-HIP-001/release '{}'
post lot "{\"lotId\":\"LOT-STK-CAGE-001\",\"udiDI\":\"(01)00888316523134\",\"clearanceNumber\":\"K211456\",\"certId\":\"ISO13485-BSI-STR-001\",\"lotNumber\":\"2024STKC001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-STK-CAGE-001/release '{}'

login medtronic Medtronic@1234
post lot "{\"lotId\":\"LOT-MDT-PCE-001\",\"udiDI\":\"(01)00380740991745\",\"clearanceNumber\":\"P160033\",\"certId\":\"ISO13485-TUV-MDT-001\",\"lotNumber\":\"2024MDTP001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-MDT-PCE-001/release '{}'
post lot "{\"lotId\":\"LOT-MDT-VLV-001\",\"udiDI\":\"(01)00380740855801\",\"clearanceNumber\":\"P190009\",\"certId\":\"ISO13485-TUV-MDT-001\",\"lotNumber\":\"2024MDTV001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-MDT-VLV-001/release '{}'
post lot "{\"lotId\":\"LOT-MDT-DSC-001\",\"udiDI\":\"(01)00380740037278\",\"clearanceNumber\":\"P100017\",\"certId\":\"ISO13485-TUV-MDT-001\",\"lotNumber\":\"2024MDTD001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-MDT-DSC-001/release '{}'
post lot "{\"lotId\":\"LOT-MDT-ROD-001\",\"udiDI\":\"(01)00380740109159\",\"clearanceNumber\":\"K180892\",\"certId\":\"ISO13485-TUV-MDT-001\",\"lotNumber\":\"2024MDTR001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-MDT-ROD-001/release '{}'
post lot "{\"lotId\":\"LOT-MDT-SCS-001\",\"udiDI\":\"(01)00380740506561\",\"clearanceNumber\":\"P030012\",\"certId\":\"ISO13485-TUV-MDT-001\",\"lotNumber\":\"2024MDTS001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-MDT-SCS-001/release '{}'

login smithnephew Smith@1234
post lot "{\"lotId\":\"LOT-SNS-KNEE-001\",\"udiDI\":\"(01)00643169007234\",\"clearanceNumber\":\"K201234\",\"certId\":\"ISO13485-BSI-SNS-001\",\"lotNumber\":\"2024SNSK001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-SNS-KNEE-001/release '{}'

login abbott Abbott@1234
post lot "{\"lotId\":\"LOT-ABT-MON-001\",\"udiDI\":\"(01)00741570001703\",\"clearanceNumber\":\"K192001\",\"certId\":\"ISO13485-BSI-ABT-001\",\"lotNumber\":\"2024ABTM001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-ABT-MON-001/release '{}'

login ethicon Ethicon@1234
post lot "{\"lotId\":\"LOT-ETH-MSH-001\",\"udiDI\":\"(01)00888174058651\",\"clearanceNumber\":\"K172456\",\"certId\":\"ISO13485-SGS-ETH-001\",\"lotNumber\":\"2024ETHM001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-ETH-MSH-001/release '{}'

login allergan Allergan@1234
post lot "{\"lotId\":\"LOT-ALL-EXP-001\",\"udiDI\":\"(01)00888174063068\",\"clearanceNumber\":\"K189012\",\"certId\":\"ISO13485-TUV-ALG-001\",\"lotNumber\":\"2024ALLE001A\",\"manufacturingDate\":\"$TODAY\",\"expiryDate\":\"2028-04-18\",\"sterileExpiryDate\":\"\",\"quantity\":\"100\",\"storageConditions\":\"Store at room temperature\"}"
post lot/LOT-ALL-EXP-001/release '{}'

echo "Lots done"

# Consignments
login rep-memorial Rep-Mem@1234
post consignment '{"consignmentId":"CONS-MEM-KNEE-001","lotId":"LOT-STK-KNEE-001","hospitalId":"Memorial Hospital","quantity":"20","location":"OR Suite 1 - Orthopedic Cart"}'
post consignment '{"consignmentId":"CONS-MEM-HIP-001","lotId":"LOT-STK-HIP-001","hospitalId":"Memorial Hospital","quantity":"15","location":"OR Suite 1 - Orthopedic Cart"}'
post consignment '{"consignmentId":"CONS-MEM-CAGE-001","lotId":"LOT-STK-CAGE-001","hospitalId":"Memorial Hospital","quantity":"10","location":"OR Suite 2 - Spine Cart"}'
post consignment '{"consignmentId":"CONS-MEM-DISC-001","lotId":"LOT-MDT-DSC-001","hospitalId":"Memorial Hospital","quantity":"8","location":"OR Suite 2 - Spine Cart"}'
post consignment '{"consignmentId":"CONS-MEM-ROD-001","lotId":"LOT-MDT-ROD-001","hospitalId":"Memorial Hospital","quantity":"20","location":"OR Suite 2 - Spine Implant Cabinet"}'
post consignment '{"consignmentId":"CONS-MEM-PCE-001","lotId":"LOT-MDT-PCE-001","hospitalId":"Memorial Hospital","quantity":"5","location":"Cardiac OR - Pacemaker Storage"}'
post consignment '{"consignmentId":"CONS-MEM-VLV-001","lotId":"LOT-MDT-VLV-001","hospitalId":"Memorial Hospital","quantity":"3","location":"Cardiac OR - Valve Storage"}'
post consignment '{"consignmentId":"CONS-MEM-MON-001","lotId":"LOT-ABT-MON-001","hospitalId":"Memorial Hospital","quantity":"6","location":"Cardiac OR - Monitor Storage"}'
post consignment '{"consignmentId":"CONS-MEM-SCS-001","lotId":"LOT-MDT-SCS-001","hospitalId":"Memorial Hospital","quantity":"4","location":"Neuro OR - Stimulator Cabinet"}'
post consignment '{"consignmentId":"CONS-MEM-MSH-001","lotId":"LOT-ETH-MSH-001","hospitalId":"Memorial Hospital","quantity":"15","location":"General Surgery Supply Room"}'

login rep-university Rep-Uni@1234
post consignment '{"consignmentId":"CONS-UNI-KNEE-001","lotId":"LOT-SNS-KNEE-001","hospitalId":"University Hospital","quantity":"20","location":"Orthopedic OR - Main Cart"}'
post consignment '{"consignmentId":"CONS-UNI-HIP-001","lotId":"LOT-STK-HIP-001","hospitalId":"University Hospital","quantity":"10","location":"Orthopedic OR - Hip Implant Shelf"}'

echo "Consignments done"

echo "Verifying final stats..."
login government1 Gov1-1234
curl -s -b $COOKIE http://localhost:4000/api/assets/stats | python3 -m json.tool