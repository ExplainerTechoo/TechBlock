-- TechBlock Supabase Schema Setup Script
-- Run this in your Supabase SQL Editor

-- 1. Profiles Table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  username TEXT UNIQUE,
  role TEXT DEFAULT 'user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public profiles are viewable by everyone"
  ON public.profiles FOR SELECT USING (true);

CREATE POLICY "Users can insert their own profile"
  ON public.profiles FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE USING (auth.uid() = id);

CREATE POLICY "Users can delete their own profile"
  ON public.profiles FOR DELETE USING (auth.uid() = id);

-- 2. User Stats Table
CREATE TABLE IF NOT EXISTS public.user_stats (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  streak_count INTEGER DEFAULT 0,
  points INTEGER DEFAULT 0,
  time_spent_seconds INTEGER DEFAULT 0,
  last_active_at TIMESTAMPTZ DEFAULT NOW(),
  is_flagged BOOLEAN DEFAULT FALSE,
  flag_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for User Stats
ALTER TABLE public.user_stats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "User stats are viewable by everyone"
  ON public.user_stats FOR SELECT USING (true);

CREATE POLICY "Users can insert their own stats"
  ON public.user_stats FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own stats"
  ON public.user_stats FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stats"
  ON public.user_stats FOR DELETE USING (auth.uid() = user_id);

-- 3. Comments Table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Comments
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Comments are viewable by everyone"
  ON public.comments FOR SELECT USING (true);

CREATE POLICY "Users can insert comments"
  ON public.comments FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can delete their own comments"
  ON public.comments FOR DELETE USING (auth.uid() = user_id);
