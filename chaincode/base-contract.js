'use strict';
const { Contract } = require('fabric-contract-api');

/**
 * BaseContract — shared chaincode functions
 * Extended by ImplantContract and DentalContract
 */
class BaseContract extends Contract {

  // ── Caller identity ───────────────────────────────────────────
  _getCallerInfo(ctx) {
    const id = ctx.clientIdentity;
    return {
      mspId:  id.getMSPID(),
      role:   id.getAttributeValue('role'),
      userId: id.getAttributeValue('hf.EnrollmentID'),
    };
  }

  _checkRole(ctx, allowedRoles) {
    const { role, userId } = this._getCallerInfo(ctx);
    if (!allowedRoles.includes(role)) {
      throw new Error(
        `Access denied: '${userId}' has role '${role}' but needs one of [${allowedRoles.join(', ')}]`,
      );
    }
  }

  // ── Asset helpers ─────────────────────────────────────────────
  async _putAsset(ctx, key, data) {
    await ctx.stub.putState(key, Buffer.from(JSON.stringify(data)));
    return data;
  }

  async _getAsset(ctx, key) {
    const data = await ctx.stub.getState(key);
    if (!data || data.length === 0) throw new Error(`Asset not found: ${key}`);
    return JSON.parse(data.toString());
  }

  async _exists(ctx, key) {
    const data = await ctx.stub.getState(key);
    return data && data.length > 0;
  }

  async _getAllByRange(ctx, startKey, endKey) {
    const results = [];
    const iterator = await ctx.stub.getStateByRange(startKey, endKey);
    let next = await iterator.next();
    while (!next.done) {
      if (next.value && next.value.value) {
        try {
          results.push(JSON.parse(next.value.value.toString('utf8')));
        } catch (e) {
          console.error(`Skipping malformed record: ${e.message}`);
        }
      }
      next = await iterator.next();
    }
    await iterator.close();
    return results;
  }

  async _getHistory(ctx, key) {
    const results = [];
    const iterator = await ctx.stub.getHistoryForKey(key);
    let next = await iterator.next();
    while (!next.done) {
      const record = {
        txId: next.value.txId,
        timestamp: (() => {
          try {
            const ts = next.value.timestamp;
            if (!ts) return null;
            const seconds = ts.seconds?.low ?? ts.seconds ?? 0;
            return new Date(Number(seconds) * 1000).toISOString();
          } catch { return null; }
        })(),
        isDelete: next.value.isDelete,
        value: null,
      };
      if (!next.value.isDelete && next.value.value) {
        try {
          record.value = JSON.parse(next.value.value.toString('utf8'));
        } catch (e) {
          record.value = next.value.value.toString('utf8');
        }
      }
      results.push(record);
      next = await iterator.next();
    }
    await iterator.close();
    return results;
  }
}

module.exports = { BaseContract };
