const express = require('express');
const BlockStore = require('../models/Block');
const { verifyToken } = require('../middleware/auth');

const router = express.Router();

// Require authentication for all block storage operations
router.use(verifyToken);

// POST /api/blocks - Create a new storage block
router.post('/', async (req, res, next) => {
  try {
    const { title, data, tags } = req.body || {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Block title is required.'
      });
    }

    if (data === undefined || data === null) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Block payload data is required.'
      });
    }

    const block = await BlockStore.create({
      title: title.trim(),
      data,
      ownerId: req.user.id,
      tags: Array.isArray(tags) ? tags : []
    });

    return res.status(201).json({
      message: 'Storage block created successfully',
      block
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/blocks - List all blocks for the authenticated user
router.get('/', async (req, res, next) => {
  try {
    const blocks = await BlockStore.findByOwner(req.user.id);
    return res.json({
      count: blocks.length,
      blocks
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/blocks/search - Search user's storage blocks
router.get('/search/query', async (req, res, next) => {
  try {
    const { q } = req.query;
    const blocks = await BlockStore.search(req.user.id, q || '');
    return res.json({
      query: q || '',
      count: blocks.length,
      blocks
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/blocks/:id - Retrieve specific block details
router.get('/:id', async (req, res, next) => {
  try {
    const block = await BlockStore.findById(req.params.id);
    if (!block) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Storage block not found.'
      });
    }

    // Owner authorization check
    if (block.ownerId !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({
        error: 'Forbidden',
        message: 'Access denied. You do not own this storage block.'
      });
    }

    return res.json({ block });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/blocks/:id - Delete a storage block
router.delete('/:id', async (req, res, next) => {
  try {
    const block = await BlockStore.findById(req.params.id);
    if (!block) {
      return res.status(404).json({
        error: 'Not Found',
        message: 'Storage block not found.'
      });
    }

    await BlockStore.delete(req.params.id, req.user.id);
    return res.json({
      message: 'Storage block deleted successfully',
      id: req.params.id
    });
  } catch (err) {
    if (err.status === 403) {
      return res.status(403).json({
        error: 'Forbidden',
        message: err.message
      });
    }
    next(err);
  }
});

module.exports = router;
