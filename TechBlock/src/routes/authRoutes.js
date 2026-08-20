const express = require('express');
const jwt = require('jsonwebtoken');
const UserStore = require('../models/User');
const { verifyToken, JWT_SECRET } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimiter');

const router = express.Router();

// Input validation helpers
function isValidEmail(email) {
  return typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// POST /api/auth/register
router.post('/register', authLimiter, async (req, res, next) => {
  try {
    const { username, email, password, role } = req.body || {};

    if (!username || typeof username !== 'string' || username.trim().length < 3) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Username must be at least 3 characters long.'
      });
    }

    if (!isValidEmail(email)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'A valid email address is required.'
      });
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Password must be at least 6 characters long.'
      });
    }

    const existingUser = await UserStore.findByEmail(email);
    if (existingUser) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'An account with this email address already exists.'
      });
    }

    const user = await UserStore.create({
      username: username.trim(),
      email: email.trim(),
      password,
      role: role === 'admin' ? 'admin' : 'user'
    });

    const token = jwt.sign(
      { id: user.id || user._id, username: user.username, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.status(201).json({
      message: 'User registered successfully',
      token,
      user
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({
        error: 'Conflict',
        message: 'Username or email already taken.'
      });
    }
    next(err);
  }
});

// POST /api/auth/login
router.post('/login', authLimiter, async (req, res, next) => {
  try {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'Email and password are required.'
      });
    }

    const user = await UserStore.findByEmail(email);
    if (!user) {
      // Use generic security message to prevent user enumeration
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password.'
      });
    }

    const isMatch = await UserStore.comparePassword(password, user.password);
    if (!isMatch) {
      return res.status(401).json({
        error: 'Authentication Failed',
        message: 'Invalid email or password.'
      });
    }

    const sanitizedUser = UserStore.sanitize(user);

    const token = jwt.sign(
      { id: sanitizedUser.id || sanitizedUser._id, username: sanitizedUser.username, email: sanitizedUser.email, role: sanitizedUser.role },
      JWT_SECRET,
      { expiresIn: '24h' }
    );

    return res.json({
      message: 'Login successful',
      token,
      user: sanitizedUser
    });
  } catch (err) {
    next(err);
  }
});

// GET /api/auth/me
router.get('/me', verifyToken, async (req, res, next) => {
  try {
    const user = await UserStore.findById(req.user.id);
    if (!user) {
      return res.status(404).json({ error: 'Not Found', message: 'User profile not found.' });
    }
    return res.json({ user });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
