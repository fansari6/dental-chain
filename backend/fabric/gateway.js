import * as grpc from '@grpc/grpc-js';
import { connect, hash, signers } from '@hyperledger/fabric-gateway';
import * as crypto from 'node:crypto';
import { promises as fs } from 'node:fs';
import * as path from 'node:path';

const CHANNEL_NAME   = process.env.FABRIC_CHANNEL   || 'mychannel';
const CHAINCODE_NAME = process.env.FABRIC_CHAINCODE  || 'dental';
const MSP_ID         = process.env.FABRIC_MSP_ID     || 'Org1MSP';
const PEER_HOST      = process.env.FABRIC_PEER_HOST  || 'localhost';
const PEER_PORT      = process.env.FABRIC_PEER_PORT  || '7051';
const PEER_ENDPOINT  = `${PEER_HOST}:${PEER_PORT}`;
const IDENTITY_OVERRIDE = process.env.FABRIC_IDENTITY_OVERRIDE || null;
const TEST_NETWORK_DIR = process.env.TEST_NETWORK_DIR || '/tmp/fabric-placeholder';

const PEER_TLS_CERT_PATH = path.join(
  TEST_NETWORK_DIR,
  'organizations/peerOrganizations/org1.example.com',
  'peers/peer0.org1.example.com/tls/ca.crt'
);

function mspPath(identityLabel) {
  return path.join(
    TEST_NETWORK_DIR,
    'organizations/peerOrganizations/org1.example.com/users',
    `${identityLabel}@org1.example.com/msp`
  );
}

async function getFirstFile(dir) {
  const files = await fs.readdir(dir);
  if (!files.length) throw new Error(`No files found in ${dir}`);
  return path.join(dir, files[0]);
}

async function newGrpcClient() {
  const tlsCert = await fs.readFile(PEER_TLS_CERT_PATH);
  const credentials = grpc.credentials.createSsl(tlsCert);
  return new grpc.Client(PEER_ENDPOINT, credentials, {
    'grpc.ssl_target_name_override': 'peer0.org1.example.com',
  });
}

async function loadIdentity(identityLabel) {
  // In local dev, override with Admin identity if set
  if (IDENTITY_OVERRIDE) identityLabel = IDENTITY_OVERRIDE;
  const msp      = mspPath(identityLabel);
  const certFile = await getFirstFile(path.join(msp, 'signcerts'));
  const keyFile  = await getFirstFile(path.join(msp, 'keystore'));
  const cert     = await fs.readFile(certFile);
  const keyPem   = await fs.readFile(keyFile);
  return { cert, privateKey: crypto.createPrivateKey(keyPem) };
}

/**
 * Extracts a human-readable message from Fabric Gateway errors.
 *
 * The Fabric Gateway SDK (EndorseError, SubmitError) puts the chaincode
 * error message in err.details — an array of { address, message, mspId }.
 * The message field contains "chaincode response 500, <reason>".
 */
export function parseFabricError(err) {
  // EndorseError / SubmitError — details is an array on the error itself
  if (Array.isArray(err?.details) && err.details.length > 0) {
    for (const detail of err.details) {
      const msg = detail?.message || '';
      // "chaincode response 500, <reason>"
      const cc = msg.match(/chaincode response \d+,\s*(.+)/);
      if (cc) return cc[1].trim();
      if (msg) return msg;
    }
  }

  // Fallback — parse err.message string
  const message = typeof err === 'string' ? err : (err?.message || String(err));
  const cc = message.match(/chaincode response \d+,\s*(.+)/);
  if (cc) return cc[1].trim();
  const nested = message.match(/error="chaincode response \d+,\s*(.+?)"/);
  if (nested) return nested[1].trim();

  return 'Transaction failed — check that all inputs are valid and referenced assets exist on the ledger.';
}

export async function submitTransaction(identityLabel, fnName, ...args) {
  const client = await newGrpcClient();
  try {
    const { cert, privateKey } = await loadIdentity(identityLabel);
    const gateway = connect({
      client,
      identity: { mspId: MSP_ID, credentials: cert },
      signer:   signers.newPrivateKeySigner(privateKey),
      hash:     hash.sha256,
    });
    try {
      const network  = gateway.getNetwork(CHANNEL_NAME);
      const contract = network.getContract(CHAINCODE_NAME);
      const result   = await contract.submitTransaction(fnName, ...args.map(String));
      return JSON.parse(Buffer.from(result).toString());
    } finally {
      gateway.close();
    }
  } finally {
    client.close();
  }
}

export async function evaluateTransaction(identityLabel, fnName, ...args) {
  const client = await newGrpcClient();
  try {
    const { cert, privateKey } = await loadIdentity(identityLabel);
    const gateway = connect({
      client,
      identity: { mspId: MSP_ID, credentials: cert },
      signer:   signers.newPrivateKeySigner(privateKey),
      hash:     hash.sha256,
    });
    try {
      const network  = gateway.getNetwork(CHANNEL_NAME);
      const contract = network.getContract(CHAINCODE_NAME);
      const result   = await contract.evaluateTransaction(fnName, ...args.map(String));
      return JSON.parse(Buffer.from(result).toString());
    } finally {
      gateway.close();
    }
  } finally {
    client.close();
  }
}
