const bcrypt = require('bcryptjs');

// In-memory fallback store for users
const inMemoryUsers = new Map();
let userCounter = 1;

class UserStore {
  static isMongoConnected() {
    const mongoose = require('mongoose');
    return mongoose.connection && mongoose.connection.readyState === 1;
  }

  static async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return await bcrypt.hash(password, salt);
  }

  static async comparePassword(candidatePassword, hashedPassword) {
    return await bcrypt.compare(candidatePassword, hashedPassword);
  }

  static sanitize(user) {
    if (!user) return null;
    const obj = typeof user.toObject === 'function' ? user.toObject() : { ...user };
    delete obj.password;
    delete obj.__v;
    return obj;
  }

  static async create({ username, email, password, role = 'user' }) {
    const hashedPassword = await this.hashPassword(password);
    
    if (this.isMongoConnected()) {
      const MongoUser = require('./MongoUserModel');
      const user = new MongoUser({
        username,
        email: email.toLowerCase(),
        password: hashedPassword,
        role
      });
      await user.save();
      return this.sanitize(user);
    }

    // Check duplicate email / username in memory
    for (const u of inMemoryUsers.values()) {
      if (u.email.toLowerCase() === email.toLowerCase()) {
        const err = new Error('Email already registered');
        err.code = 11000;
        throw err;
      }
      if (u.username.toLowerCase() === username.toLowerCase()) {
        const err = new Error('Username already taken');
        err.code = 11000;
        throw err;
      }
    }

    const id = `usr_${userCounter++}_${Date.now()}`;
    const user = {
      _id: id,
      id,
      username,
      email: email.toLowerCase(),
      password: hashedPassword,
      role,
      createdAt: new Date().toISOString()
    };

    inMemoryUsers.set(id, user);
    return this.sanitize(user);
  }

  static async findByEmail(email) {
    const cleanEmail = (email || '').toLowerCase();

    if (this.isMongoConnected()) {
      const MongoUser = require('./MongoUserModel');
      return await MongoUser.findOne({ email: cleanEmail });
    }

    for (const u of inMemoryUsers.values()) {
      if (u.email.toLowerCase() === cleanEmail) {
        return { ...u };
      }
    }
    return null;
  }

  static async findById(id) {
    if (this.isMongoConnected()) {
      const MongoUser = require('./MongoUserModel');
      const u = await MongoUser.findById(id);
      return u ? this.sanitize(u) : null;
    }

    const u = inMemoryUsers.get(id);
    return u ? this.sanitize(u) : null;
  }

  static clearInMemory() {
    inMemoryUsers.clear();
    userCounter = 1;
  }
}

module.exports = UserStore;
