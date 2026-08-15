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
    is_public BOOLEAN NOT NULL DEFAULT true, -- true = Pubblico (visibile a tutti), false = Privato
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assicura che la colonna is_public sia presente per database già esistenti
ALTER TABLE public.exercises ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- RLS Exercises
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public or own custom exercises" ON public.exercises;
CREATE POLICY "Users can view public or own custom exercises" 
    ON public.exercises FOR SELECT 
    USING (user_id IS NULL OR is_public = true OR user_id = auth.uid());

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
    is_public BOOLEAN NOT NULL DEFAULT true, -- true = Pubblica (visibile a tutti), false = Privata (visibile solo al creatore)
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assicura che la colonna is_public sia presente per database già esistenti
ALTER TABLE public.workout_templates ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT true;

-- RLS Workout Templates
ALTER TABLE public.workout_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public or own workout templates" ON public.workout_templates;
CREATE POLICY "Users can view public or own workout templates" 
    ON public.workout_templates FOR SELECT 
    USING (is_public = true OR user_id = auth.uid());

CREATE POLICY "Users can insert own workout templates" 
    ON public.workout_templates FOR INSERT 
    WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own workout templates" 
    ON public.workout_templates FOR UPDATE 
    USING (user_id = auth.uid());

CREATE POLICY "Users can delete own workout templates" 
    ON public.workout_templates FOR DELETE 
    USING (user_id = auth.uid());


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

DROP POLICY IF EXISTS "Users can view template exercises for public or own templates" ON public.template_exercises;
CREATE POLICY "Users can view template exercises for public or own templates" 
    ON public.template_exercises FOR SELECT 
    USING (
        EXISTS (
            SELECT 1 FROM public.workout_templates t 
            WHERE t.id = template_exercises.template_id 
            AND (t.is_public = true OR t.user_id = auth.uid())
        )
    );

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
-- 7. DIET_LOGS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL,
    target_calories INTEGER DEFAULT 2000,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (user_id, date)
);

ALTER TABLE public.diet_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage own diet logs" ON public.diet_logs;
CREATE POLICY "Users can manage own diet logs" 
    ON public.diet_logs FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ------------------------------------------
-- 8. DIET_MEALS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_meals (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    diet_log_id UUID NOT NULL REFERENCES public.diet_logs(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    order_index INTEGER NOT NULL DEFAULT 0
);

-- Assicura che user_id sia presente anche per tabelle già create
ALTER TABLE public.diet_meals ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.diet_meals ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage diet meals for own logs" ON public.diet_meals;
DROP POLICY IF EXISTS "Users can manage own diet meals" ON public.diet_meals;
CREATE POLICY "Users can manage own diet meals" 
    ON public.diet_meals FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ------------------------------------------
-- 9. DIET_LOG_ITEMS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.diet_log_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    meal_id UUID NOT NULL REFERENCES public.diet_meals(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    calories INTEGER NOT NULL DEFAULT 0,
    amount_note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Assicura che user_id sia presente anche per tabelle già create
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE;

ALTER TABLE public.diet_log_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can manage food items for own meals" ON public.diet_log_items;
DROP POLICY IF EXISTS "Users can manage own diet log items" ON public.diet_log_items;
CREATE POLICY "Users can manage own diet log items" 
    ON public.diet_log_items FOR ALL 
    USING (user_id = auth.uid())
    WITH CHECK (user_id = auth.uid());


-- ------------------------------------------
-- SEED DATA: DEFAULT GLOBAL EXERCISES
-- Generato da src/app/core/data/default-exercises.json — non modificare a mano,
-- rilanciare `npm run gen:seed` dopo aver modificato il JSON.
-- ------------------------------------------
-- BEGIN GENERATED EXERCISES SEED
INSERT INTO public.exercises (id, name, category, equipment, is_custom, user_id) VALUES
-- Petto
('d8970cee-e3d6-4dd0-ab09-c569f3f750f2', 'Panca Piana con Bilanciere', 'Petto', 'Bilanciere', false, NULL),
('d9a5c5c4-fe5b-44c2-b380-adc5aacda21f', 'Panca Inclinata con Manubri', 'Petto', 'Manubri', false, NULL),
('ebc33cb9-539d-41f9-bdae-e163dfa09762', 'Dip alle Parallele', 'Petto', 'Corpo Libero', false, NULL),
('c8714d09-e448-4a60-baec-6e82092d27a4', 'Croci ai Cavi', 'Petto', 'Cavi', false, NULL),

-- Schiena
('73c1430b-8c79-490c-bd37-8174fe0beee8', 'Stacco da Terra (Deadlift)', 'Schiena', 'Bilanciere', false, NULL),
('d95f12cc-c0fa-4e29-b172-1ce437fb03f9', 'Trazioni alla Sbarra (Pull-up)', 'Schiena', 'Corpo Libero', false, NULL),
('8cc14caa-ee32-4042-ac72-f059125d4d03', 'Lat Machine Avanti', 'Schiena', 'Macchina', false, NULL),
('085593f7-7472-43f6-85f5-a672f7e93719', 'Pulley Basso', 'Schiena', 'Cavi', false, NULL),
('36e581ac-1306-4b76-87ad-410a6aef3ab0', 'Rematore con Bilanciere', 'Schiena', 'Bilanciere', false, NULL),

-- Gambe
('9db7902f-dd5f-4ea8-8617-71dfc66f0fcb', 'Squat con Bilanciere', 'Gambe', 'Bilanciere', false, NULL),
('95ebce18-a76a-440e-84be-3a07bf0d37a0', 'Leg Press 45°', 'Gambe', 'Macchina', false, NULL),
('f35fd411-5022-4e1b-884a-7eb3438ec20c', 'Affondi Camminati con Manubri', 'Gambe', 'Manubri', false, NULL),
('781e167f-d8ee-45b7-8c5f-9a7828395674', 'Leg Extension', 'Gambe', 'Macchina', false, NULL),
('461c4269-f5bd-4440-85e1-24fd7c8820dc', 'Leg Curl Sdraiato', 'Gambe', 'Macchina', false, NULL),
('7752da0c-aa55-4dae-8a64-84a461febd4e', 'Calf Raise In Piedi', 'Gambe', 'Macchina', false, NULL),

-- Spalle
('9759a35a-c2a2-4096-9422-cffcc25b0a38', 'Military Press', 'Spalle', 'Bilanciere', false, NULL),
('a4bc39b7-8d68-47fc-94f3-f619f19b13bb', 'Lento Avanti con Manubri', 'Spalle', 'Manubri', false, NULL),
('9f6634fb-ae52-4055-bacc-236082644880', 'Alzate Laterali con Manubri', 'Spalle', 'Manubri', false, NULL),
('661d2322-266d-4ffa-992f-62dd6fa0d3db', 'Alzate Posteriori a 90°', 'Spalle', 'Manubri', false, NULL),

-- Bicipiti
('11c3fe8e-7b82-4791-b862-4f0152dcdb6e', 'Curl Alternato con Manubri', 'Bicipiti', 'Manubri', false, NULL),
('8fab3d46-ba8d-4866-a7d1-7864b127ada0', 'Curl con Bilanciere EZ', 'Bicipiti', 'Bilanciere', false, NULL),

-- Tricipiti
('63fa0bc9-0773-4d09-8843-b44df47a1946', 'French Press panca piana', 'Tricipiti', 'Bilanciere', false, NULL),
('1f77326a-0fc1-4a02-b646-1df719087f03', 'Pushdown Tricipiti al Cavo', 'Tricipiti', 'Cavi', false, NULL),

-- Core
('098506fa-10b5-4e23-a9ae-cdee10375a11', 'Crunch su Tappetino', 'Core', 'Corpo Libero', false, NULL),
('00dd5fdd-76cf-4823-bfd3-0d88cff2fbc0', 'Plank Addominale', 'Core', 'Corpo Libero', false, NULL),
('8391ec26-3a48-422a-899a-1710cb72f18a', 'Leg Raise alla Sbarra', 'Core', 'Corpo Libero', false, NULL)
ON CONFLICT (id) DO NOTHING;
-- END GENERATED EXERCISES SEED
