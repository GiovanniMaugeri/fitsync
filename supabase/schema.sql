-- ==========================================
-- FITSYNC - SUPABASE POSTGRESQL SCHEMA & RLS
-- ==========================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ------------------------------------------
-- 1. PROFILES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    username TEXT UNIQUE,
    full_name TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Profiles
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own profile" 
    ON public.profiles FOR SELECT 
    USING (auth.uid() = id);

CREATE POLICY "Users can insert own profile" 
    ON public.profiles FOR INSERT 
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile" 
    ON public.profiles FOR UPDATE 
    USING (auth.uid() = id);

-- Automatically create profile entry on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, full_name, avatar_url)
    VALUES (
        new.id, 
        new.raw_user_meta_data->>'full_name', 
        new.raw_user_meta_data->>'avatar_url'
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- ------------------------------------------
-- 2. EXERCISES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL means global system exercise
    name TEXT NOT NULL,
    category TEXT NOT NULL, -- Petto, Schiena, Gambe, Braccia, Spalle, Core
    equipment TEXT,         -- Bilanciere, Manubri, Cavi, Macchina, Corpo Libero
    is_custom BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Exercises
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

-- Users can read global exercises (user_id IS NULL) OR their own custom exercises
CREATE POLICY "Users can view public or own custom exercises" 
    ON public.exercises FOR SELECT 
    USING (user_id IS NULL OR user_id = auth.uid());

CREATE POLICY "Users can insert own custom exercises" 
    ON public.exercises FOR INSERT 
    WITH CHECK (user_id = auth.uid() AND is_custom = true);

CREATE POLICY "Users can update own custom exercises" 
    ON public.exercises FOR UPDATE 
    USING (user_id = auth.uid() AND is_custom = true);

CREATE POLICY "Users can delete own custom exercises" 
    ON public.exercises FOR DELETE 
    USING (user_id = auth.uid() AND is_custom = true);


-- ------------------------------------------
-- 3. WORKOUT_TEMPLATES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_templates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Workout Templates
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout templates" 
    ON public.workout_templates FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ------------------------------------------
-- 4. TEMPLATE_EXERCISES TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.template_exercises (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    template_id UUID NOT NULL REFERENCES public.workout_templates(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
    order_index INTEGER NOT NULL,
    target_sets INTEGER DEFAULT 3,
    target_reps INTEGER DEFAULT 10,
    rest_time_seconds INTEGER DEFAULT 90
);

-- RLS Template Exercises
ALTER TABLE public.template_exercises ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage template exercises for their own templates" 
    ON public.template_exercises FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.workout_templates t 
            WHERE t.id = template_exercises.template_id 
            AND t.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workout_templates t 
            WHERE t.id = template_exercises.template_id 
            AND t.user_id = auth.uid()
        )
    );


-- ------------------------------------------
-- 5. WORKOUT_SESSIONS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    template_id UUID REFERENCES public.workout_templates(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    start_time TIMESTAMPTZ NOT NULL DEFAULT now(),
    end_time TIMESTAMPTZ,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Workout Sessions
ALTER TABLE public.workout_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own workout sessions" 
    ON public.workout_sessions FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ------------------------------------------
-- 6. WORKOUT_SETS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.workout_sets (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    session_id UUID NOT NULL REFERENCES public.workout_sessions(id) ON DELETE CASCADE,
    exercise_id UUID NOT NULL REFERENCES public.exercises(id) ON DELETE RESTRICT,
    set_number INTEGER NOT NULL,
    reps INTEGER NOT NULL,
    weight NUMERIC NOT NULL,
    rpe NUMERIC,
    is_completed BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Workout Sets
ALTER TABLE public.workout_sets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage workout sets for their own sessions" 
    ON public.workout_sets FOR ALL 
    USING (
        EXISTS (
            SELECT 1 FROM public.workout_sessions s 
            WHERE s.id = workout_sets.session_id 
            AND s.user_id = auth.uid()
        )
    )
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.workout_sessions s 
            WHERE s.id = workout_sets.session_id 
            AND s.user_id = auth.uid()
        )
    );


-- ------------------------------------------
-- SEED DATA: DEFAULT GLOBAL EXERCISES
-- ------------------------------------------
INSERT INTO public.exercises (name, category, equipment, is_custom, user_id) VALUES
-- Petto
('Panca Piana con Bilanciere', 'Petto', 'Bilanciere', false, NULL),
('Panca Inclinata con Manubri', 'Petto', 'Manubri', false, NULL),
('Dip alle Parallele', 'Petto', 'Corpo Libero', false, NULL),
('Croci ai Cavi', 'Petto', 'Cavi', false, NULL),

-- Schiena
('Stacco da Terra (Deadlift)', 'Schiena', 'Bilanciere', false, NULL),
('Trazioni alla Sbarra (Pull-up)', 'Schiena', 'Corpo Libero', false, NULL),
('Lat Machine Avanti', 'Schiena', 'Macchina', false, NULL),
('Pulley Basso', 'Schiena', 'Cavi', false, NULL),
('Rematore con Bilanciere', 'Schiena', 'Bilanciere', false, NULL),

-- Gambe
('Squat con Bilanciere', 'Gambe', 'Bilanciere', false, NULL),
('Leg Press 45°', 'Gambe', 'Macchina', false, NULL),
('Affondi Camminati con Manubri', 'Gambe', 'Manubri', false, NULL),
('Leg Extension', 'Gambe', 'Macchina', false, NULL),
('Leg Curl Sdraiato', 'Gambe', 'Macchina', false, NULL),
('Calf Raise In Piedi', 'Gambe', 'Macchina', false, NULL),

-- Spalle
('Military Press', 'Spalle', 'Bilanciere', false, NULL),
('Lento Avanti con Manubri', 'Spalle', 'Manubri', false, NULL),
('Alzate Laterali con Manubri', 'Spalle', 'Manubri', false, NULL),
('Alzate Posteriori a 90°', 'Spalle', 'Manubri', false, NULL),

-- Braccia
('Curl Alternato con Manubri', 'Braccia', 'Manubri', false, NULL),
('Curl con Bilanciere EZ', 'Braccia', 'Bilanciere', false, NULL),
('French Press panca piana', 'Braccia', 'Bilanciere', false, NULL),
('Pushdown Tricipiti al Cavo', 'Braccia', 'Cavi', false, NULL),

-- Core
('Crunch su Tappetino', 'Core', 'Corpo Libero', false, NULL),
('Plank Addominale', 'Core', 'Corpo Libero', false, NULL),
('Leg Raise alla Sbarra', 'Core', 'Corpo Libero', false, NULL)
ON CONFLICT DO NOTHING;
