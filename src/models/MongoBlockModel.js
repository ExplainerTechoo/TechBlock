const mongoose = require('mongoose');

const blockSchema = new mongoose.Schema({
  title: { type: String, required: true },
  data: { type: String, required: true },
  checksum: { type: String, required: true },
  sizeBytes: { type: Number, required: true },
  ownerId: { type: String, required: true, index: true },
  tags: [{ type: String }],
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.models.Block || mongoose.model('Block', blockSchema);
