-- ==========================================
-- FITSYNC - FOODS CATALOG CLEANUP (prima revisione manuale)
-- ==========================================

-- ------------------------------------------
-- 1. RINOMINE (6)
-- ------------------------------------------
UPDATE public.foods SET name = 'Pane' WHERE id = '0cbd6efb-85b0-4e57-808a-e99e162e684f'; -- era: Pane comune
UPDATE public.foods SET name = 'Latte' WHERE id = 'c1e81c71-02f3-46d8-815a-f2fe4f87b288'; -- era: Latte di vacca intero
UPDATE public.foods SET name = 'Latte parzialmente scremato' WHERE id = 'f901742a-f6fd-4df7-ad4a-10a432243732'; -- era: Latte di vacca parzialmente scremato
UPDATE public.foods SET name = 'Latte scremato' WHERE id = '96682a74-2492-475a-83df-ab660c7409d5'; -- era: Latte di vacca scremato
UPDATE public.foods SET name = 'Mozzarella' WHERE id = '22574768-63eb-4014-9a67-1a5ca44e17d0'; -- era: Mozzarella di vacca
UPDATE public.foods SET name = 'Banane' WHERE id = 'b9bbfa60-818e-4432-853e-396726d6d9b0'; -- era: Banane fresche

-- ------------------------------------------
-- 2. ELIMINAZIONI (62)
-- Sicure: diet_log_items.food_id ha ON DELETE SET NULL, i log storici
-- mantengono nome/calorie/macro gia congelati, perdono solo il collegamento.
-- ------------------------------------------
DELETE FROM public.foods WHERE id IN (
    '3ed94787-22d2-4b1c-9abd-9d31098144e7', -- Riso brillato (crudo)
    '8d97e67c-e94e-44f9-9d2d-60f773864320', -- Riso integrale (crudo)
    '40a07848-c5f9-4c31-a29b-210913cd67e6', -- Orzo perlato (crudo)
    'd015f4b2-e663-4fcb-b2b8-f17ffa725f1d', -- Quinoa (cruda)
    'ecf7d4c4-d81d-4b47-8226-b430638d4382', -- Pane di segale
    '1b7b50ec-a6ad-41f8-929a-4033279cb279', -- Pane carasau
    '1456accb-ec35-4ab5-883b-dd38b2c053e0', -- Fette biscottate
    '8f0b02e3-04cb-4073-8b8c-35ee98f7254e', -- Polenta pronta (cotta)
    '06ddc53c-7133-4f4f-87cd-e7fc2ad89855', -- Tortellini freschi (ripieno carne)
    '42da49a7-a521-468d-bdc4-81f38f92c30a', -- Polpo (crudo)
    '020c934f-2a73-4ae4-bc3a-68195757cca9', -- Speck
    'ef0e77d7-d323-4f19-bb8d-fcb62299dc68', -- Wurstel (pollo/tacchino)
    '94e7f1a9-efb5-4e3d-b9b9-ec69667af8ea', -- Tofu
    '17e98a20-0132-40ac-acf8-8b663ccc5d22', -- Seitan
    '32d3a4de-357a-4aac-ad02-ff9fb927988e', -- Tempeh
    'b96388ac-fc18-4e07-b08f-75d3660e4358', -- Barretta proteica
    '947ec3ff-ff8b-45b2-867c-cc2ac7ca6630', -- Fagioli azuki secchi
    '647b3073-cabd-4770-8dd3-0ef6c61611f4', -- Fave fresche
    '3f239c2d-bcb7-4b07-89ec-30865794c426', -- Lupini (ammollati)
    '6b85f57a-28bb-4944-95a0-f568bb12addd', -- Latte di soia
    '720edb42-86e2-4805-a9a3-54772d60504f', -- Latte di mandorla
    '7b8d5ab1-d68c-4c7b-ae6f-d86368840a45', -- Latte condensato zuccherato
    '78cc521b-88b2-4da2-88e4-efeb350ce1c7', -- Fiocchi di latte (cottage)
    'b6d8db86-6539-4b60-98d7-a9f70ab428a7', -- Feta
    'f0909699-1260-415c-a3bd-9a889a65590d', -- Kefir
    '82d6ad86-49f9-4ff5-b17e-613a501460ee', -- Skyr
    '602e6145-0e8a-42c2-abcf-f771cd5fe373', -- Kiwi
    '5ea76830-edde-4ff4-8836-c83fc88fbe2d', -- Prugne
    '104e1788-ecc3-4894-aa26-23fa0b6542d3', -- Fichi freschi
    '3fed1509-a324-4989-924a-8882bcefc3f9', -- Limoni (polpa)
    '9838a0ca-df7a-478a-922b-6aeb95e69815', -- Lamponi
    'fce5c4d7-34f3-4a84-92c7-05efc7368e00', -- Noci pecan
    '602e29c4-248a-4d0d-956a-cde7442bb17f', -- Fichi secchi
    '8d553c9f-a515-4bc1-9a3b-acb3cf5ea468', -- Prugne secche
    'e9d94517-b996-4e21-ad48-6f580afc8e90', -- Radicchio
    '855aee1e-e55f-486e-b7c6-8a0393b6a1db', -- Asparagi
    '3a1a9f64-deb3-400c-8e0f-6b74a8fba854', -- Rape
    'e3c1b192-4f4e-45f2-be7c-1c88b6858af6', -- Porri
    '3f717e5f-0267-4dad-84d8-3bdc781e7b3e', -- Ravanelli
    '808cb44f-8983-4cdf-b055-d0d7cf5cf3fc', -- Germogli di soia
    '018905ab-3095-4d58-bd82-1a01fc34b27c', -- Aceto balsamico
    '58cca2e2-5032-4fe0-b4c4-c25cf4e46114', -- Zucchero (saccarosio)
    'cc7f43ba-16db-45d4-b1af-f4a2894aefe4', -- Biscotti secchi (frollini)
    '210b24e6-b9e7-45e4-a168-82fc26c36a3c', -- Gelato alla crema
    'f3120708-61ae-4195-b945-a2fc9949111f', -- Gelato alla frutta (sorbetto)
    '67b95eb9-88a7-4589-ab01-b09fd7fc644a', -- Torta margherita
    '4575a3eb-7951-4c3b-b15e-55117609479a', -- Croissant
    '7c98089f-6824-4857-b651-fb178f2f92bd', -- Barretta ai cereali
    '11fb3747-2e41-4c1e-be37-8b730706f39f', -- Bevanda sportiva isotonica
    'c30a3b7e-2e82-4f8e-a391-2f1be3f97fe1', -- Succo d'arancia
    '571f0700-39e5-45ab-ae78-f68685023c3a', -- Succo di mela
    '7cc10e2b-2be8-46f8-9194-d38d709689ab', -- Cola
    '19edd07e-598d-4a2d-8c94-c3a85ded8704', -- Birra chiara
    '9de35967-a462-42ce-8774-75b9d2d16016', -- Vino rosso
    '197087f3-828c-4225-afc8-ee6277608a48', -- Crema spalmabile alle nocciole
    'ac9c588f-e8e9-4d58-906f-6e245a0e3906', -- Marshmallow
    '8b4d71cf-c247-465e-985a-1764991e5136', -- Wafer alla crema
    '3265e7bd-45c2-40b9-82c5-15a3f82d027e', -- Focaccia
    '37af07f7-53e7-4a93-b722-436f5b1761d5', -- Tortilla di mais
    '20b2d4b6-bb4f-452a-b21c-99723b0e5924', -- Tortilla di frumento
    '38c61591-c740-4897-8dde-a19f9aa1f186', -- Frappè / milkshake
    '2212c9ce-e311-4f8b-ab1f-bf499615a0bb' -- Energy drink
);

