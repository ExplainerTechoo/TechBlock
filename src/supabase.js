const { createClient } = require('@supabase/supabase-js');
const WebSocket = require('ws');
const path = require('path');
const fs = require('fs');

// Load environment variables
try {
  require('dotenv').config({ path: path.join(__dirname, '..', '.env') });
} catch (e) {
  // Ignore dotenv errors
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || 'https://xyzappproject.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inh5emFwcHByb2plY3QiLCJyb2xlIjoiYW5vbiIsImlhdCI6MTcwMDA0MDAwMCwiZXhwIjoyMDE1NjE2MDAwfQ.placeholder_key';

const ADMIN_EMAILS = [
  'kartikchobdar775@gmail.com',
  'explainertechoo77@gmail.com',
  'explainertechoo369@gmail.com'
];
const MASTER_ADMIN_PASSWORD = 'Kartik@2008#';

// Create Supabase Client with WebSocket polyfill
let supabase = null;
try {
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true
    },
    realtime: {
      transport: WebSocket
    }
  });
} catch (e) {
  console.error('Supabase Client Init Error:', e);
}

// Custom profanity filter (no external deps - avoids ESM issues)
const abusiveWords = [
  'fuck', 'shit', 'bitch', 'bastard', 'asshole', 'dick', 'cunt', 'pussy',
  'whore', 'slut', 'nigger', 'faggot', 'motherfucker', 'ass', 'damn',
  // Hindi/Urdu slang
  'mc', 'bc', 'chutiya', 'bhosdi', 'bhosdike', 'madarchod', 'behenchod',
  'gand', 'gaand', 'harami', 'saala', 'kutta', 'kamine', 'lavde', 'lund',
  'chod', 'chodna', 'chud', 'chutiya', 'randi', 'betichod', 'bahanchod'
];

const abusiveRegex = new RegExp('\\b(' + abusiveWords.join('|') + ')\\b', 'gi');

function containsAbusiveLanguage(text) {
  if (!text || typeof text !== 'string') return false;
  return abusiveRegex.test(text.toLowerCase().trim());
}

/* ---------------- Auth & User Profile Methods ---------------- */

async function loginUser(email, password) {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable' };
  try {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { ok: false, error: error.message };

    const user = data.user;
    const profile = await getProfile(user.id);
    return {
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        username: profile ? profile.username : null,
        role: profile ? profile.role : 'user'
      }
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function signUpUser(email, password, username) {
  if (!supabase) return { ok: false, error: 'Supabase client unavailable' };
  try {
    // Check unique username first
    if (username) {
      const isUnique = await checkUsernameUnique(username);
      if (!isUnique) return { ok: false, error: 'Username is already taken' };
    }

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { ok: false, error: error.message };

    const user = data.user;
    if (user) {
      if (username) {
        await createProfile(user.id, user.email, username);
      }
      return {
        ok: true,
        user: {
          id: user.id,
          email: user.email,
          username: username || null,
          role: 'user'
        }
      };
    }
    return { ok: false, error: 'Signup failed to create user' };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getProfile(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single();
    if (error) return null;
    return data;
  } catch (e) {
    return null;
  }
}

async function checkUsernameUnique(username) {
  if (!supabase || !username) return true;
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('username')
      .ilike('username', username.trim());
    if (error || !data) return true;
    return data.length === 0;
  } catch (e) {
    return true;
  }
}

async function setUsername(userId, email, username) {
  if (!supabase || !userId || !username) return { ok: false, error: 'Invalid parameters' };
  const cleanUser = username.trim();
  if (cleanUser.length < 3) return { ok: false, error: 'Username must be at least 3 characters' };

  const unique = await checkUsernameUnique(cleanUser);
  if (!unique) return { ok: false, error: 'Username is already taken. Please choose another.' };

  try {
    const existing = await getProfile(userId);
    let res;
    if (existing) {
      res = await supabase.from('profiles').update({ username: cleanUser, updated_at: new Date() }).eq('id', userId);
    } else {
      res = await supabase.from('profiles').insert([{ id: userId, email, username: cleanUser, role: 'user' }]);
    }

    if (res.error) return { ok: false, error: res.error.message };
    return { ok: true, username: cleanUser };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function createProfile(userId, email, username) {
  if (!supabase || !userId) return;
  try {
    await supabase.from('profiles').upsert([
      { id: userId, email, username: username || null, role: 'user', updated_at: new Date() }
    ]);
  } catch (e) {}
}

async function deleteUserAccount(userId) {
  if (!supabase || !userId) return { ok: false, error: 'Invalid user session' };
  try {
    // 1. Delete user stats
    await supabase.from('user_stats').delete().eq('user_id', userId);
    // 2. Delete comments
    await supabase.from('comments').delete().eq('user_id', userId);
    // 3. Delete profile
    await supabase.from('profiles').delete().eq('id', userId);
    // 4. Delete auth user if RPC / admin deletion is available
    try {
      await supabase.auth.admin.deleteUser(userId);
    } catch (e) {}

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ---------------- User Stats & Persistence ---------------- */

async function syncUserStats(userId, stats) {
  if (!supabase || !userId) return { ok: false, error: 'No user ID' };

  const { streakCount = 0, points = 0, timeSpentSeconds = 0 } = stats;
  
  // Anti-cheat / Anomaly Detection
  // Example: points-to-time ratio anomaly (e.g. > 1000 points with < 300 seconds spent, or > 5 points per second)
  let isFlagged = false;
  let flagReason = null;

  if (timeSpentSeconds > 0) {
    const ratio = points / (timeSpentSeconds / 60); // points per minute
    if (ratio > 50) { // Unrealistic spike (>50 pts/min)
      isFlagged = true;
      flagReason = `High points-to-time ratio (${Math.round(ratio)} pts/min)`;
    }
  } else if (points > 100) {
    isFlagged = true;
    flagReason = 'Points accumulated without app time usage';
  }

  try {
    const payload = {
      user_id: userId,
      streak_count: streakCount,
      points: points,
      time_spent_seconds: timeSpentSeconds,
      last_active_at: new Date(),
      updated_at: new Date()
    };

    if (isFlagged) {
      payload.is_flagged = true;
      payload.flag_reason = flagReason;
    }

    const { data, error } = await supabase
      .from('user_stats')
      .upsert([payload]);

    if (error) return { ok: false, error: error.message };
    return { ok: true, isFlagged, flagReason };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getUserStats(userId) {
  if (!supabase || !userId) return null;
  try {
    const { data, error } = await supabase
      .from('user_stats')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return {
      streakCount: data.streak_count || 0,
      points: data.points || 0,
      timeSpentSeconds: data.time_spent_seconds || 0,
      lastActiveAt: data.last_active_at,
      isFlagged: data.is_flagged || false,
      flagReason: data.flag_reason || null
    };
  } catch (e) {
    return null;
  }
}

/* ---------------- Comments System ---------------- */

async function getComments() {
  if (!supabase) return [];
  try {
    const { data, error } = await supabase
      .from('comments')
      .select('id, user_id, username, content, created_at')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error || !data) return [];
    return data;
  } catch (e) {
    return [];
  }
}

async function addComment(userId, username, content) {
  if (!content || !content.trim()) return { ok: false, error: 'Comment cannot be empty' };

  // Profanity / Abuse Filter Check
  if (containsAbusiveLanguage(content)) {
    return {
      ok: false,
      abusive: true,
      error: 'Abusive language is strictly prohibited.'
    };
  }

  if (!supabase) return { ok: false, error: 'Supabase client unavailable' };

  try {
    const { data, error } = await supabase
      .from('comments')
      .insert([
        {
          user_id: userId || null,
          username: username || 'Anonymous',
          content: content.trim(),
          created_at: new Date()
        }
      ])
      .select();

    if (error) return { ok: false, error: error.message };
    return { ok: true, comment: data[0] };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

/* ---------------- Admin Dashboard Features ---------------- */

function verifyAdminCredentials(email, password) {
  if (!email || !password) return false;
  const cleanEmail = email.trim().toLowerCase();
  const isAdminEmail = ADMIN_EMAILS.includes(cleanEmail);
  const isMasterPasswordMatch = password === MASTER_ADMIN_PASSWORD;
  return isAdminEmail && isMasterPasswordMatch;
}

async function getAdminAnalytics(adminEmail, masterPassword) {
  if (!verifyAdminCredentials(adminEmail, masterPassword)) {
    return { ok: false, error: 'Unauthorized: Invalid Admin Credentials or Master Password' };
  }

  if (!supabase) return { ok: false, error: 'Supabase client unavailable' };

  try {
    // 1. Get all profiles
    const { data: profiles, error: pErr } = await supabase
      .from('profiles')
      .select('id, email, username, role, created_at');

    // 2. Get all stats
    const { data: stats, error: sErr } = await supabase
      .from('user_stats')
      .select('*');

    const totalRegisteredUsers = profiles ? profiles.length : 0;
    
    let totalTimeSpentSeconds = 0;
    let totalPointsAccumulated = 0;
    const usersList = [];
    const leaderboardList = [];

    const statsMap = new Map();
    if (stats) {
      stats.forEach(s => statsMap.set(s.user_id, s));
    }

    if (profiles) {
      profiles.forEach(p => {
        const uStat = statsMap.get(p.id) || {};
        const streak = uStat.streak_count || 0;
        const pts = uStat.points || 0;
        const timeSec = uStat.time_spent_seconds || 0;
        const isFlagged = uStat.is_flagged || false;
        const flagReason = uStat.flag_reason || null;

        totalTimeSpentSeconds += timeSec;
        totalPointsAccumulated += pts;

        const userObj = {
          id: p.id,
          username: p.username || 'No Username',
          email: p.email, // Visible ONLY to Admin
          streaks: streak,
          points: pts,
          timeSpentSeconds: timeSec,
          formattedTimeSpent: formatTimeSpent(timeSec),
          isFlagged,
          flagReason,
          createdAt: p.created_at
        };

        usersList.push(userObj);

        // Leaderboard entry (uses ONLY username for public)
        leaderboardList.push({
          username: p.username || 'Anonymous',
          streaks: streak,
          points: pts,
          timeSpentSeconds: timeSec,
          isFlagged
        });
      });
    }

    // Sort leaderboard by points descending
    leaderboardList.sort((a, b) => b.points - a.points || b.streaks - a.streaks);

    return {
      ok: true,
      analytics: {
        totalRegisteredUsers,
        totalTimeSpentSeconds,
        formattedTotalTimeSpent: formatTimeSpent(totalTimeSpentSeconds),
        totalPointsAccumulated,
        activeUserTrends: {
          todayActive: profiles ? profiles.filter(p => isToday(new Date(p.created_at))).length : 0,
          totalFlaggedUsers: usersList.filter(u => u.isFlagged).length
        }
      },
      userTable: usersList,
      leaderboard: leaderboardList
    };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

async function getPublicLeaderboard() {
  if (!supabase) return [];
  try {
    const { data: profiles } = await supabase.from('profiles').select('id, username');
    const { data: stats } = await supabase.from('user_stats').select('user_id, streak_count, points, time_spent_seconds, is_flagged');

    if (!profiles || !stats) return [];

    const statsMap = new Map();
    stats.forEach(s => statsMap.set(s.user_id, s));

    const list = profiles.map(p => {
      const s = statsMap.get(p.id) || {};
      return {
        username: p.username || 'Anonymous User', // ONLY username exposed, NO email
        streaks: s.streak_count || 0,
        points: s.points || 0,
        timeSpentSeconds: s.time_spent_seconds || 0,
        isFlagged: s.is_flagged || false
      };
    });

    list.sort((a, b) => b.points - a.points || b.streaks - a.streaks);
    return list.slice(0, 50);
  } catch (e) {
    return [];
  }
}

/* ---------------- Helper functions ---------------- */

function formatTimeSpent(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  if (hrs > 0) return `${hrs}h ${mins}m`;
  return `${mins}m`;
}

function isToday(date) {
  const today = new Date();
  return date.getDate() === today.getDate() &&
    date.getMonth() === today.getMonth() &&
    date.getFullYear() === today.getFullYear();
}

module.exports = {
  ADMIN_EMAILS,
  MASTER_ADMIN_PASSWORD,
  containsAbusiveLanguage,
  verifyAdminCredentials,
  loginUser,
  signUpUser,
  getProfile,
  checkUsernameUnique,
  setUsername,
  deleteUserAccount,
  syncUserStats,
  getUserStats,
  getComments,
  addComment,
  getAdminAnalytics,
  getPublicLeaderboard
};
