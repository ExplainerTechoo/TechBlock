const crypto = require('crypto');

// In-memory fallback store for Storage Blocks
const inMemoryBlocks = new Map();
let blockCounter = 1;

class BlockStore {
  static isMongoConnected() {
    const mongoose = require('mongoose');
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  static calculateChecksum(payload) {
    const str = typeof payload === 'string' ? payload : JSON.stringify(payload || '');
    return crypto.createHash('sha256').update(str).digest('hex');
  }

  static async create({ title, data, ownerId, tags = [] }) {
    const payloadStr = typeof data === 'string' ? data : JSON.stringify(data || '');
    const checksum = this.calculateChecksum(payloadStr);
    const sizeBytes = Buffer.byteLength(payloadStr, 'utf8');

    if (this.isMongoConnected()) {
      const MongoBlock = require('./MongoBlockModel');
      const block = new MongoBlock({
        title,
        data: payloadStr,
        checksum,
        sizeBytes,
        ownerId,
        tags: Array.isArray(tags) ? tags : []
      });
      await block.save();
      return block.toObject();
    }

    const id = `blk_${blockCounter++}_${Date.now()}`;
    const block = {
      _id: id,
      id,
      title: title || 'Untitled Block',
      data: payloadStr,
      checksum,
      sizeBytes,
      ownerId,
      tags: Array.isArray(tags) ? tags : [],
      createdAt: new Date().toISOString()
    };

    inMemoryBlocks.set(id, block);
    return { ...block };
  }

  static async findByOwner(ownerId) {
    if (this.isMongoConnected()) {
      const MongoBlock = require('./MongoBlockModel');
      const blocks = await MongoBlock.find({ ownerId }).sort({ createdAt: -1 });
      return blocks.map(b => b.toObject());
    }

    const results = [];
    for (const b of inMemoryBlocks.values()) {
      if (b.ownerId === ownerId) {
        results.push({ ...b });
      }
    }
    return results.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  }

  static async findById(id) {
    if (this.isMongoConnected()) {
      const MongoBlock = require('./MongoBlockModel');
      const b = await MongoBlock.findById(id);
      return b ? b.toObject() : null;
    }

    const b = inMemoryBlocks.get(id);
    return b ? { ...b } : null;
  }

  static async delete(id, ownerId) {
    const block = await this.findById(id);
    if (!block) return null;

    if (block.ownerId !== ownerId) {
      const err = new Error('Unauthorized: You do not own this block');
      err.status = 403;
      throw err;
    }

    if (this.isMongoConnected()) {
      const MongoBlock = require('./MongoBlockModel');
      await MongoBlock.findByIdAndDelete(id);
      return true;
    }

    inMemoryBlocks.delete(id);
    return true;
  }

  static async search(ownerId, query) {
    const all = await this.findByOwner(ownerId);
    if (!query) return all;

    const q = query.toLowerCase();
    return all.filter(b => 
      b.title.toLowerCase().includes(q) ||
      b.data.toLowerCase().includes(q) ||
      (b.tags && b.tags.some(t => t.toLowerCase().includes(q)))
    );
  }

  static clearInMemory() {
    inMemoryBlocks.clear();
    blockCounter = 1;
  }
}

module.exports = BlockStore;
