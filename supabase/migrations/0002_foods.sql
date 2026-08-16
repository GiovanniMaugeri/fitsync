-- ==========================================
-- FITSYNC - FOODS CATALOG TABLE & RLS
-- ==========================================

-- ------------------------------------------
-- 1. FOODS TABLE
-- ------------------------------------------
CREATE TABLE IF NOT EXISTS public.foods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE, -- NULL means global system food
    name TEXT NOT NULL,
    is_custom BOOLEAN NOT NULL DEFAULT false,
    is_public BOOLEAN NOT NULL DEFAULT true, -- true = Pubblico (visibile a tutti), false = Privato (visibile solo al creatore)
    kcal_100g NUMERIC NOT NULL DEFAULT 0,
    protein_100g NUMERIC NOT NULL DEFAULT 0,
    carbs_100g NUMERIC NOT NULL DEFAULT 0,
    fat_100g NUMERIC NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS Foods
ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view public or own custom foods" ON public.foods;
CREATE POLICY "Users can view public or own custom foods"
    ON public.foods FOR SELECT
    USING (user_id IS NULL OR is_public = true OR user_id = auth.uid());

DROP POLICY IF EXISTS "Users can insert own custom foods" ON public.foods;
CREATE POLICY "Users can insert own custom foods"
    ON public.foods FOR INSERT
    WITH CHECK (user_id = auth.uid() AND is_custom = true);

DROP POLICY IF EXISTS "Users can update own custom foods" ON public.foods;
CREATE POLICY "Users can update own custom foods"
    ON public.foods FOR UPDATE
    USING (user_id = auth.uid() AND is_custom = true);

DROP POLICY IF EXISTS "Users can delete own custom foods" ON public.foods;
CREATE POLICY "Users can delete own custom foods"
    ON public.foods FOR DELETE
    USING (user_id = auth.uid() AND is_custom = true);


-- ------------------------------------------
-- 2. DIET_LOG_ITEMS: NUOVE COLONNE OPZIONALI DI COLLEGAMENTO AL CATALOGO
-- ------------------------------------------
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS food_id UUID REFERENCES public.foods(id) ON DELETE SET NULL;
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS quantity_grams NUMERIC;
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS protein NUMERIC;
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS carbs NUMERIC;
ALTER TABLE public.diet_log_items ADD COLUMN IF NOT EXISTS fat NUMERIC;


-- ------------------------------------------
-- SEED DATA: DEFAULT GLOBAL FOODS
-- Generato da src/app/core/data/default-foods.json — non modificare a mano,
-- rilanciare `npm run gen:seed:foods` dopo aver modificato il JSON.
-- ------------------------------------------
-- BEGIN GENERATED FOODS SEED
INSERT INTO public.foods (id, name, is_custom, user_id, kcal_100g, protein_100g, carbs_100g, fat_100g) VALUES
('b5b056dd-87a1-4dc8-9b24-f0f2f94703c9', 'Pasta di semola (cruda)', false, NULL, 341, 13.5, 72.7, 1.2),
('a98c26f5-22ce-446b-91d4-40cb517b5789', 'Pasta all''uovo (cruda)', false, NULL, 358, 12.5, 71.7, 3.7),
('2bb35449-2963-4e85-9ab5-b94034c0470a', 'Pasta integrale (cruda)', false, NULL, 319, 13.4, 66.2, 2.9),
('3ed94787-22d2-4b1c-9abd-9d31098144e7', 'Riso brillato (crudo)', false, NULL, 334, 6.7, 80.4, 0.4),
('406ef40f-189d-4ecb-bed1-38cf80087a63', 'Riso basmati (crudo)', false, NULL, 349, 7.5, 77, 0.6),
('8d97e67c-e94e-44f9-9d2d-60f773864320', 'Riso integrale (crudo)', false, NULL, 337, 7.5, 74.8, 2.7),
('80ca3524-75b0-4988-936c-0fa52dd2cfb1', 'Farro (crudo)', false, NULL, 335, 15, 67.1, 2.5),
('40a07848-c5f9-4c31-a29b-210913cd67e6', 'Orzo perlato (crudo)', false, NULL, 328, 10.4, 72.5, 1.5),
('91238d95-f717-4ac3-8a30-3a3535ed2dc8', 'Avena, fiocchi', false, NULL, 379, 13.5, 62.6, 6.5),
('d015f4b2-e663-4fcb-b2b8-f17ffa725f1d', 'Quinoa (cruda)', false, NULL, 368, 14.1, 64.2, 6.1),
('a2b86631-1020-4567-ae1a-e7988e09fa05', 'Cous cous (crudo)', false, NULL, 376, 12.8, 77.4, 1.1),
('0cbd6efb-85b0-4e57-808a-e99e162e684f', 'Pane comune', false, NULL, 289, 7.7, 62.1, 1),
('775b9ffc-a733-4b8a-94da-25aac2907efe', 'Pane integrale', false, NULL, 224, 9, 41, 1.7),
('ecf7d4c4-d81d-4b47-8226-b430638d4382', 'Pane di segale', false, NULL, 220, 7.9, 45.8, 1.1),
('1b7b50ec-a6ad-41f8-929a-4033279cb279', 'Pane carasau', false, NULL, 353, 11.7, 74, 2),
('30fbdb17-2393-4699-87c6-23ac94423957', 'Piadina', false, NULL, 300, 8, 50, 8),
('9ff2fd9a-8dc5-4cf4-b82e-aafb645c7b78', 'Grissini', false, NULL, 431, 10.7, 74.3, 8.9),
('1456accb-ec35-4ab5-883b-dd38b2c053e0', 'Fette biscottate', false, NULL, 408, 10.4, 76.8, 6.6),
('4eac2c80-3b32-4ee7-97ac-882767f2d215', 'Farina di grano tenero tipo 00', false, NULL, 340, 11, 74, 1),
('2ce8c21d-817e-4433-9081-88ee73c818b3', 'Farina di mais (fumetto)', false, NULL, 351, 8.7, 75.9, 3.4),
('8f0b02e3-04cb-4073-8b8c-35ee98f7254e', 'Polenta pronta (cotta)', false, NULL, 70, 1.7, 15, 0.5),
('8a67ec42-7441-4502-a4f8-34cc4d2800b7', 'Cracker', false, NULL, 438, 10, 65, 15),
('56438c1f-668f-43d2-8f4f-2992102eaa43', 'Muesli', false, NULL, 374, 9.5, 66, 7),
('e6715d25-a399-4d06-8628-e0fff0361015', 'Corn flakes', false, NULL, 357, 8, 84, 0.9),
('d4ed7ba1-e438-41db-bfd2-5885bd2241da', 'Gnocchi di patate (freschi)', false, NULL, 140, 3, 28, 1),
('06ddc53c-7133-4f4f-87cd-e7fc2ad89855', 'Tortellini freschi (ripieno carne)', false, NULL, 280, 12, 40, 7),
('11ec6b4f-0a8f-43be-a1a2-8c86105f2fa3', 'Petto di pollo (crudo)', false, NULL, 100, 23.3, 0, 0.8),
('fb3bd4db-2808-4e34-afcc-660cb51678cd', 'Coscia di pollo (cruda, con pelle)', false, NULL, 216, 17, 0, 15.6),
('fae7e320-7bce-48c1-8c15-31542b74e6f3', 'Petto di tacchino (crudo)', false, NULL, 104, 24, 0, 0.7),
('a83bb56c-e646-44e9-8b30-886250d4b64f', 'Fesa di tacchino (affettata)', false, NULL, 104, 22, 1, 1.5),
('43b49018-db6d-4136-9386-d508479a26ce', 'Anatra (cruda)', false, NULL, 135, 19, 0, 6.5),
('797008d4-6900-4347-90c7-aac09932fc0c', 'Manzo, taglio magro (crudo)', false, NULL, 129, 21.3, 0, 4.4),
('e4fc2347-84a4-454e-8f81-d5dcccebfe7e', 'Vitello, taglio magro (crudo)', false, NULL, 109, 20.7, 0, 2.8),
('942e6a31-c78b-4d56-8d75-55ffc0e71093', 'Maiale, lonza (cruda)', false, NULL, 143, 21.3, 0, 6),
('dcecbbc5-d30f-4e20-84a4-1e2c1d91c34e', 'Agnello (crudo)', false, NULL, 162, 18, 0, 9.9),
('f6b67778-5f97-41da-b52c-158cdaca0b2f', 'Coniglio (crudo)', false, NULL, 118, 21, 0, 3.5),
('6a37e061-4327-4fc3-ab73-f3aab0643d65', 'Salmone (crudo)', false, NULL, 208, 20, 0, 13.6),
('4176c7bf-4466-4b4c-9b4b-5f1586ee8a74', 'Tonno (crudo)', false, NULL, 159, 21.5, 0.1, 8.1),
('b2566b20-313b-41ba-9723-1f7df2225d9e', 'Tonno al naturale (sgocciolato)', false, NULL, 112, 25, 0, 0.8),
('b34a1893-8ec4-4af8-a964-9e3a763ab30f', 'Merluzzo / Nasello (crudo)', false, NULL, 82, 17.8, 0, 0.7),
('03c8c700-e8eb-477f-b71f-0a6ee675531f', 'Orata (cruda)', false, NULL, 121, 20, 0, 4.5),
('b40d67ee-3a93-4682-921b-140d24f32ad5', 'Branzino (crudo)', false, NULL, 82, 16.5, 0, 1.6),
('e5bc4471-7523-47b7-bd45-906a491a687a', 'Sgombro (crudo)', false, NULL, 205, 18.6, 0, 13.9),
('d6a07c79-c443-4652-aa17-2f6307233168', 'Alici / Acciughe (fresche)', false, NULL, 96, 16.8, 0, 3.4),
('b9b6dc86-22c1-4100-a575-5e8d36219837', 'Gamberi (crudi)', false, NULL, 71, 13.6, 0.9, 1.2),
('87c5ad01-0b83-4df2-b291-93328265ac53', 'Cozze (crude, sgusciate)', false, NULL, 84, 11.7, 3.4, 2.7),
('1efe9b44-5d64-42dd-a7ec-19b7bc01039e', 'Calamari (crudi)', false, NULL, 68, 13, 1.2, 1),
('42da49a7-a521-468d-bdc4-81f38f92c30a', 'Polpo (crudo)', false, NULL, 57, 10.6, 1.4, 1),
('b97735a7-d103-4b32-8227-972f1f795387', 'Uova di gallina (intere)', false, NULL, 128, 12.4, 0, 8.7),
('adf80998-00f5-4216-a59d-05969a6a75cf', 'Albume d''uovo', false, NULL, 48, 10.9, 0.7, 0.2),
('d01db3f0-939c-455a-87ff-71f3154409bc', 'Tuorlo d''uovo', false, NULL, 315, 16, 0.6, 27),
('79a47f3a-e9c4-4bf0-85dc-c10dd75d3789', 'Prosciutto crudo, parte magra', false, NULL, 159, 27.9, 0, 5.4),
('2a6cd2f9-f46f-4b40-a6d8-f9106a9dd268', 'Prosciutto cotto', false, NULL, 132, 20.5, 0.8, 5),
('70ee66ab-a0a0-42e6-8553-72568270895e', 'Bresaola', false, NULL, 151, 32, 0.4, 2.6),
('020c934f-2a73-4ae4-bc3a-68195757cca9', 'Speck', false, NULL, 216, 25.9, 0.5, 12),
('82c571b4-5616-446c-b3d5-34b04ec83ee3', 'Salame Milano', false, NULL, 380, 25, 1, 31),
('2df13043-9849-46f3-ba88-8499157bc441', 'Mortadella', false, NULL, 288, 15.7, 3, 24),
('ef0e77d7-d323-4f19-bb8d-fcb62299dc68', 'Wurstel (pollo/tacchino)', false, NULL, 220, 12, 3, 18),
('a2b13cf9-f79c-4aca-82aa-ffa00ef1a702', 'Pancetta', false, NULL, 379, 9, 0, 39),
('94e7f1a9-efb5-4e3d-b9b9-ec69667af8ea', 'Tofu', false, NULL, 76, 8.1, 0.7, 4.8),
('17e98a20-0132-40ac-acf8-8b663ccc5d22', 'Seitan', false, NULL, 118, 21, 4, 1.5),
('32d3a4de-357a-4aac-ad02-ff9fb927988e', 'Tempeh', false, NULL, 190, 19, 9, 11),
('82af4215-92c5-4676-8f37-5cc84e04c7bc', 'Whey protein (polvere)', false, NULL, 380, 78, 6, 5),
('b96388ac-fc18-4e07-b08f-75d3660e4358', 'Barretta proteica', false, NULL, 350, 30, 30, 10),
('1acb56e4-1574-48f4-8494-67be242e99eb', 'Lenticchie secche', false, NULL, 319, 22.7, 51.1, 1),
('107cf058-83ff-49ba-82af-3a1b7e498cb1', 'Ceci secchi', false, NULL, 316, 19.6, 54.3, 6),
('da96f1b2-fe28-428f-87f6-303f1bd66e99', 'Fagioli borlotti secchi', false, NULL, 313, 21.8, 47.5, 1.4),
('a51b5518-084b-4b5d-8cd5-ebf515a07a5f', 'Fagioli cannellini secchi', false, NULL, 333, 23.4, 49.2, 1.6),
('6e74471a-29a7-40c4-b63c-a4ed175fe98c', 'Fagioli neri secchi', false, NULL, 341, 21.6, 62.4, 1.4),
('947ec3ff-ff8b-45b2-867c-cc2ac7ca6630', 'Fagioli azuki secchi', false, NULL, 329, 19.9, 62.9, 0.5),
('d3501484-9bd2-4d24-b188-b7729a032b5e', 'Piselli freschi', false, NULL, 81, 5.4, 12.6, 0.4),
('b47c17c4-4957-4a4a-ae2f-5849882eb433', 'Piselli secchi', false, NULL, 328, 21.7, 52.4, 1.9),
('647b3073-cabd-4770-8dd3-0ef6c61611f4', 'Fave fresche', false, NULL, 72, 4.8, 8.3, 0.6),
('4b5fdb59-c4a3-4771-b409-56389514df29', 'Soia, semi secchi', false, NULL, 335, 36.9, 22, 17.7),
('fc312ab6-df1e-4d55-ba82-e10f9473dadc', 'Edamame', false, NULL, 122, 11.9, 8.9, 5.2),
('3f239c2d-bcb7-4b07-89ec-30865794c426', 'Lupini (ammollati)', false, NULL, 119, 15.6, 8, 3.5),
('abf94858-d637-46f9-8954-a83a7bb36eb4', 'Hummus di ceci', false, NULL, 177, 7.9, 14.6, 9.6),
('c1e81c71-02f3-46d8-815a-f2fe4f87b288', 'Latte di vacca intero', false, NULL, 64, 3.3, 4.9, 3.6),
('f901742a-f6fd-4df7-ad4a-10a432243732', 'Latte di vacca parzialmente scremato', false, NULL, 46, 3.5, 4.9, 1.6),
('96682a74-2492-475a-83df-ab660c7409d5', 'Latte di vacca scremato', false, NULL, 36, 3.4, 5, 0.2),
('6b85f57a-28bb-4944-95a0-f568bb12addd', 'Latte di soia', false, NULL, 32, 3.3, 0.8, 1.8),
('720edb42-86e2-4805-a9a3-54772d60504f', 'Latte di mandorla', false, NULL, 24, 0.5, 3, 1.1),
('7b8d5ab1-d68c-4c7b-ae6f-d86368840a45', 'Latte condensato zuccherato', false, NULL, 321, 7.9, 54.4, 8.7),
('e4d005b6-e680-4813-b546-11c9c4dd6139', 'Yogurt intero bianco', false, NULL, 66, 3.5, 4.3, 3.6),
('aedbb214-f415-4d6f-b3ab-90162b2ad8ff', 'Yogurt magro bianco', false, NULL, 44, 3.9, 5.7, 0.3),
('d2bab6c6-21fe-40e6-b78b-b423b219c376', 'Yogurt alla frutta', false, NULL, 92, 3.5, 15, 1.5),
('661c96d1-9f8f-4746-8515-0bff8479cb11', 'Yogurt greco intero', false, NULL, 97, 5.7, 4, 6.5),
('31eb2be3-c9c3-48b3-96c4-89f3401507a7', 'Yogurt greco 0%', false, NULL, 59, 10, 3.6, 0.4),
('22574768-63eb-4014-9a67-1a5ca44e17d0', 'Mozzarella di vacca', false, NULL, 253, 18.7, 0.7, 19.5),
('8941c8b8-c301-452d-883f-7dc23ca7edf3', 'Mozzarella di bufala', false, NULL, 288, 16.7, 0.4, 24.4),
('c21d1665-5ec2-4d67-a2f8-fab268e47866', 'Parmigiano Reggiano DOP', false, NULL, 397, 32.4, 0, 29.7),
('3ed70e8b-c87b-4051-98ca-90fd22c7f5e5', 'Grana Padano', false, NULL, 384, 33, 0, 28),
('1bee8103-0ced-4997-a72e-2ce6019f5c1b', 'Ricotta vaccina', false, NULL, 146, 8.8, 3.5, 10.9),
('78cc521b-88b2-4da2-88e4-efeb350ce1c7', 'Fiocchi di latte (cottage)', false, NULL, 98, 12, 3, 4.3),
('a0251486-2036-41cc-9cfd-51e148e592b4', 'Formaggio spalmabile fresco', false, NULL, 253, 5.8, 4, 24),
('0db22ff7-6911-46ff-9e2c-cb7e20122085', 'Mascarpone', false, NULL, 450, 4.5, 4, 47),
('390089b5-e4f9-42d8-9e50-80d64092cf83', 'Gorgonzola', false, NULL, 324, 19, 2.2, 26.9),
('d8341bd9-0eb3-4800-9ed4-66b069f809e5', 'Provolone', false, NULL, 351, 25.6, 2.1, 26.6),
('112186ae-9274-411c-bfd4-8a80c43cc25d', 'Emmental', false, NULL, 380, 28, 1.5, 29),
('b6d8db86-6539-4b60-98d7-a9f70ab428a7', 'Feta', false, NULL, 264, 14.2, 4.1, 21.3),
('da172bdc-9f04-4287-924d-a14ec4d62868', 'Burro', false, NULL, 758, 0.6, 1, 83.4),
('c081075d-9100-4543-8d2c-766dd8b28e1d', 'Panna da cucina', false, NULL, 337, 2.3, 3.4, 35),
('f0909699-1260-415c-a3bd-9a889a65590d', 'Kefir', false, NULL, 41, 3.3, 4, 1),
('82d6ad86-49f9-4ff5-b17e-613a501460ee', 'Skyr', false, NULL, 63, 11, 4, 0.2),
('b9bbfa60-818e-4432-853e-396726d6d9b0', 'Banane fresche', false, NULL, 76, 1.2, 17.4, 0.3),
('92c81af4-c1bb-4eb5-859c-e8be3b045a9e', 'Mele', false, NULL, 52, 0.3, 13.8, 0.2),
('dd346cb1-aa97-4aae-8072-715609ec9227', 'Pere', false, NULL, 57, 0.4, 13.7, 0.1),
('c1b0c091-df38-42ca-ad84-6bd309c7f5dd', 'Arance', false, NULL, 34, 0.7, 7.8, 0.2),
('8b0ca530-ae2e-42e6-b581-4299e8cb4d4d', 'Mandarini', false, NULL, 53, 0.8, 12.2, 0.3),
('d61774ae-82a4-438f-aa9e-d938af03d4fb', 'Pompelmo', false, NULL, 30, 0.7, 6.5, 0.2),
('602e6145-0e8a-42c2-abcf-f771cd5fe373', 'Kiwi', false, NULL, 51, 1.2, 10.5, 0.5),
('42aa1ca5-3bc5-40d5-941c-66628d2b447a', 'Fragole', false, NULL, 27, 0.9, 5.3, 0.4),
('2acadcbb-eee4-4e37-b701-35cc72298605', 'Uva', false, NULL, 61, 0.5, 15.6, 0.1),
('b88188ed-5b4a-4591-94ce-6673ca474eb6', 'Ananas', false, NULL, 40, 0.5, 10, 0.2),
('c2c6a2ce-4bc8-4a91-b1ba-d6c92320f003', 'Pesche', false, NULL, 27, 0.9, 6, 0.1),
('004348d7-69a9-41aa-b204-f1c1592cac92', 'Albicocche', false, NULL, 28, 0.9, 6.2, 0.1),
('5ea76830-edde-4ff4-8836-c83fc88fbe2d', 'Prugne', false, NULL, 42, 0.5, 9.9, 0.1),
('655645bb-fc32-45ba-897a-4b80aee216a1', 'Ciliegie', false, NULL, 38, 1, 8, 0.1),
('2583ae7a-3925-4c14-9e8f-d4bf3b847c4f', 'Melone', false, NULL, 33, 0.8, 7.3, 0.2),
('d8bdd46c-0b8f-425f-bfb7-2f4415328500', 'Anguria', false, NULL, 16, 0.5, 3.4, 0.2),
('104e1788-ecc3-4894-aa26-23fa0b6542d3', 'Fichi freschi', false, NULL, 47, 1, 10, 0.3),
('17122c97-4dec-4262-8fb4-af5fc86f8ff2', 'Melograno', false, NULL, 63, 1.7, 14, 0.3),
('ccc20d19-3bda-4e23-ace4-9cdac6dcb67d', 'Cachi', false, NULL, 65, 0.8, 15.9, 0.2),
('d93de54f-b258-46dd-b712-e123a04aa718', 'Avocado', false, NULL, 160, 2, 1.8, 14.7),
('6f257a0a-daa3-434d-acb5-5b18af999512', 'Mango', false, NULL, 60, 0.6, 14, 0.4),
('074594e8-7b66-44fd-80f9-0ee2ac40ae84', 'Papaya', false, NULL, 39, 0.6, 8.3, 0.1),
('3fed1509-a324-4989-924a-8882bcefc3f9', 'Limoni (polpa)', false, NULL, 29, 0.9, 2.5, 0.3),
('9838a0ca-df7a-478a-922b-6aeb95e69815', 'Lamponi', false, NULL, 33, 1.2, 5.4, 0.5),
('3293d8e8-9888-4047-82a4-67ed093b2502', 'Mirtilli', false, NULL, 42, 0.7, 8.6, 0.4),
('d200b8e9-3911-4649-9a60-a02a13da7d2c', 'More', false, NULL, 36, 1.4, 6.2, 0.5),
('035482c6-9382-404b-8710-45b49ceaab77', 'Mandorle secche', false, NULL, 575, 21.2, 21.7, 49.9),
('61955d3f-1bf0-4f0d-8f18-24cc65ff5492', 'Noci secche', false, NULL, 654, 15.2, 13.7, 65.2),
('bcc0bce4-3dd4-4919-934d-3014c6e56512', 'Nocciole secche', false, NULL, 628, 14.1, 17, 60.8),
('07d2a3b2-6821-4eb7-82e0-b8d633a7cb31', 'Pistacchi secchi', false, NULL, 562, 20.6, 27.2, 45.3),
('630f24bc-3b3e-496c-9827-2e64adbbf217', 'Anacardi secchi', false, NULL, 553, 18.2, 30.2, 43.9),
('fce5c4d7-34f3-4a84-92c7-05efc7368e00', 'Noci pecan', false, NULL, 691, 9.2, 13.9, 72),
('7254b706-4b1d-4f4e-9c45-d5b3e0f51106', 'Uvetta (uva passa)', false, NULL, 299, 3.1, 68.1, 0.5),
('8b38e682-05db-460b-b0c5-86de1fd26bde', 'Datteri secchi', false, NULL, 282, 2.5, 63.9, 0.4),
('602e29c4-248a-4d0d-956a-cde7442bb17f', 'Fichi secchi', false, NULL, 249, 3.5, 58.9, 0.9),
('8d553c9f-a515-4bc1-9a3b-acb3cf5ea468', 'Prugne secche', false, NULL, 240, 2.2, 53, 0.4),
('a90eff42-cbdc-4249-9e25-89744c789827', 'Pomodori', false, NULL, 19, 1, 3.5, 0.2),
('30d775d6-2f90-4697-be75-0c9aa8084d96', 'Zucchine', false, NULL, 11, 1.2, 1.4, 0.1),
('9ce09b21-4804-4271-b263-d23f07cbca82', 'Melanzane', false, NULL, 18, 1, 2.6, 0.2),
('e669e86b-f36f-490c-8917-f6efa7d8e749', 'Peperoni', false, NULL, 22, 0.9, 4.2, 0.3),
('a8ed126c-2ddc-435a-9b01-6cafebe6d7e6', 'Carote', false, NULL, 35, 1.1, 7.6, 0.2),
('ef240bac-62bf-4742-a696-37605b8ed64e', 'Patate', false, NULL, 77, 2.1, 17.6, 0.1),
('b58e8659-29bc-4038-9847-1738b212852c', 'Patate dolci', false, NULL, 86, 1.6, 20.1, 0.1),
('da9493b7-60f9-462d-93ba-7194ff0a4a32', 'Cipolle', false, NULL, 26, 1.1, 5.7, 0.2),
('1efc9d3b-2911-4cb0-b260-da667b57302b', 'Aglio', false, NULL, 41, 6, 8.4, 0.3),
('57030b4b-741b-41f6-9980-680e77db2817', 'Broccoli', false, NULL, 27, 3, 2.9, 0.4),
('998d6d85-5fc8-44b3-b183-0b614fd4a982', 'Cavolfiore', false, NULL, 25, 3.2, 2.5, 0.2),
('adc7c004-6ad9-471c-bcf0-299811fc31ea', 'Spinaci', false, NULL, 23, 2.9, 1, 0.4),
('29fea2fb-aeca-4050-91ba-37aa7bec8612', 'Lattuga', false, NULL, 19, 1.8, 2.2, 0.4),
('c1aa71e8-79d7-41e4-9d52-eebe49fc8df9', 'Rucola', false, NULL, 25, 2.6, 2.1, 0.7),
('e9d94517-b996-4e21-ad48-6f580afc8e90', 'Radicchio', false, NULL, 13, 1.3, 1.6, 0.2),
('c864f564-274b-4618-a07f-3757929f193c', 'Finocchi', false, NULL, 9, 1.2, 1.3, 0.2),
('7ee617f6-6bfa-4c5d-a3b2-f311fb031976', 'Sedano', false, NULL, 20, 1, 3.1, 0.2),
('2963af2a-dd81-416a-a75e-8933bf0d4911', 'Cetrioli', false, NULL, 12, 0.7, 1.8, 0.1),
('c5047132-5729-4adc-8f96-a547bef051da', 'Fagiolini', false, NULL, 22, 1.9, 2.7, 0.2),
('855aee1e-e55f-486e-b7c6-8a0393b6a1db', 'Asparagi', false, NULL, 24, 3.4, 2, 0.2),
('f942f698-f75c-436a-9c6b-d581fa767e1b', 'Carciofi', false, NULL, 24, 2.7, 2.5, 0.2),
('d10ff5be-e17f-4499-8ebe-5e2d92e270be', 'Funghi champignon', false, NULL, 22, 3.1, 1.4, 0.3),
('02678b66-8ffe-4281-a50f-872b260806f4', 'Zucca', false, NULL, 18, 1.1, 3.5, 0.1),
('ebfe5464-89ee-4613-85e1-528b3c09befd', 'Cavolo verza', false, NULL, 27, 2.4, 3, 0.4),
('e703f3c7-06f8-4751-b756-f1f4e85b8bc9', 'Cavolo cappuccio', false, NULL, 26, 1.4, 4.3, 0.2),
('3a1a9f64-deb3-400c-8e0f-6b74a8fba854', 'Rape', false, NULL, 26, 0.9, 4.7, 0.2),
('ebff0712-26ba-4574-a874-937cf01f5b94', 'Barbabietola', false, NULL, 44, 1.6, 8.8, 0.1),
('e3c1b192-4f4e-45f2-be7c-1c88b6858af6', 'Porri', false, NULL, 29, 2.1, 4.6, 0.3),
('0a18b9a3-b8cc-4636-afc1-21019283cd12', 'Mais dolce', false, NULL, 86, 3.4, 19, 1.2),
('c4c61057-42c9-451e-9b7f-af8a26e9be2e', 'Olive verdi/nere', false, NULL, 145, 1, 4, 15),
('3f717e5f-0267-4dad-84d8-3bdc781e7b3e', 'Ravanelli', false, NULL, 17, 0.8, 2.1, 0.1),
('808cb44f-8983-4cdf-b055-d0d7cf5cf3fc', 'Germogli di soia', false, NULL, 30, 3, 3, 0.5),
('506f098d-ac60-4cfe-ba20-e67ce3afc24d', 'Olio extravergine di oliva', false, NULL, 899, 0, 0, 99.9),
('58204cdc-8fd4-4715-ac7a-17c7208b4e1c', 'Olio di semi di girasole', false, NULL, 899, 0, 0, 99.9),
('90b281b8-ba59-46a4-b884-b5c7d6c92ddc', 'Olio di cocco', false, NULL, 862, 0, 0, 99.1),
('f93874e0-7608-46da-a301-9a04206c61f5', 'Margarina', false, NULL, 717, 0.2, 0.6, 79.8),
('b6450856-313c-4973-a6b0-cfad0b0894bd', 'Maionese', false, NULL, 680, 1.1, 2.5, 74),
('018905ab-3095-4d58-bd82-1a01fc34b27c', 'Aceto balsamico', false, NULL, 88, 0.5, 17, 0),
('8db9e656-ad1d-491f-bd0b-850eb0a9e9dc', 'Miele', false, NULL, 304, 0.3, 80.3, 0),
('58cca2e2-5032-4fe0-b4c4-c25cf4e46114', 'Zucchero (saccarosio)', false, NULL, 392, 0, 99.6, 0),
('1ea347bb-62c9-46ed-bc2a-160152382e01', 'Marmellata', false, NULL, 224, 0.4, 55, 0.1),
('60d76899-d78c-405b-8243-91490455d4ac', 'Salsa di soia', false, NULL, 60, 6, 8, 0.1),
('8109b8e5-7ef4-47b5-93cf-8996f71bf979', 'Ketchup', false, NULL, 101, 1.7, 24, 0.2),
('f21f0893-84de-4569-8fbe-06fb0c8ce14f', 'Senape', false, NULL, 108, 6, 8, 6),
('2559a845-3db1-4584-8917-6ad16d971de5', 'Cioccolato fondente 70%', false, NULL, 598, 7.8, 34, 42),
('2169f072-47c6-45a2-be39-178135c4cc5b', 'Cioccolato al latte', false, NULL, 535, 7.7, 56, 30),
('cc7f43ba-16db-45d4-b1af-f4a2894aefe4', 'Biscotti secchi (frollini)', false, NULL, 450, 6.5, 70, 16),
('dfcddfb7-d90b-4770-a6b8-eb07cc3e1e44', 'Patatine fritte in busta', false, NULL, 536, 6.6, 53, 33),
('2b00d5ed-978d-4e32-a8e3-614ea924af8f', 'Popcorn (senza sale/burro)', false, NULL, 387, 12, 78, 4.5),
('210b24e6-b9e7-45e4-a168-82fc26c36a3c', 'Gelato alla crema', false, NULL, 216, 4, 24, 11),
('f3120708-61ae-4195-b945-a2fc9949111f', 'Gelato alla frutta (sorbetto)', false, NULL, 130, 0.5, 30, 0.2),
('67b95eb9-88a7-4589-ab01-b09fd7fc644a', 'Torta margherita', false, NULL, 371, 6, 55, 14),
('4575a3eb-7951-4c3b-b15e-55117609479a', 'Croissant', false, NULL, 406, 8, 46, 20),
('7c98089f-6824-4857-b651-fb178f2f92bd', 'Barretta ai cereali', false, NULL, 380, 6, 65, 10),
('11fb3747-2e41-4c1e-be37-8b730706f39f', 'Bevanda sportiva isotonica', false, NULL, 24, 0, 6, 0),
('c30a3b7e-2e82-4f8e-a391-2f1be3f97fe1', 'Succo d''arancia', false, NULL, 45, 0.7, 10.4, 0.2),
('571f0700-39e5-45ab-ae78-f68685023c3a', 'Succo di mela', false, NULL, 46, 0.1, 11.3, 0.1),
('7cc10e2b-2be8-46f8-9194-d38d709689ab', 'Cola', false, NULL, 42, 0, 10.6, 0),
('19edd07e-598d-4a2d-8c94-c3a85ded8704', 'Birra chiara', false, NULL, 42, 0.5, 3.5, 0),
('9de35967-a462-42ce-8774-75b9d2d16016', 'Vino rosso', false, NULL, 85, 0.1, 0.3, 0),
('565aa4ff-27ca-4d0a-86e6-fac143c3a5c6', 'Caffè nero (senza zucchero)', false, NULL, 1, 0.1, 0, 0),
('bc2fb304-f64f-41a6-a312-1db7df36ea16', 'Tè (senza zucchero)', false, NULL, 1, 0, 0.2, 0),
('2b1cdf7d-771b-4635-b6a3-933458c28ce5', 'Cacao amaro in polvere', false, NULL, 355, 24, 11.5, 24),
('197087f3-828c-4225-afc8-ee6277608a48', 'Crema spalmabile alle nocciole', false, NULL, 539, 6, 57, 31),
('ac9c588f-e8e9-4d58-906f-6e245a0e3906', 'Marshmallow', false, NULL, 318, 1.8, 81, 0.2),
('8b4d71cf-c247-465e-985a-1764991e5136', 'Wafer alla crema', false, NULL, 522, 6.5, 61, 28),
('77ac31dc-cbd3-48d7-be8b-c62a71992fdb', 'Taralli', false, NULL, 460, 9, 65, 18),
('5f896fc6-3e2e-4781-a04e-1f09b6709d1e', 'Pizza margherita', false, NULL, 271, 11, 33, 10),
('3265e7bd-45c2-40b9-82c5-15a3f82d027e', 'Focaccia', false, NULL, 290, 7.5, 47, 8),
('37af07f7-53e7-4a93-b722-436f5b1761d5', 'Tortilla di mais', false, NULL, 218, 5.7, 45, 2.5),
('20b2d4b6-bb4f-452a-b21c-99723b0e5924', 'Tortilla di frumento', false, NULL, 310, 8.5, 50, 8),
('38c61591-c740-4897-8dde-a19f9aa1f186', 'Frappè / milkshake', false, NULL, 130, 3.5, 18, 4.5),
('2212c9ce-e311-4f8b-ab1f-bf499615a0bb', 'Energy drink', false, NULL, 45, 0, 11, 0)
ON CONFLICT (id) DO NOTHING;
-- END GENERATED FOODS SEED
