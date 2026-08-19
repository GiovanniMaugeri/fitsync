-- ==========================================
-- FITSYNC - AGGIUNTA FRUTTI AL CATALOGO
-- ==========================================
-- Nuovi frutti freschi selezionati dopo revisione tramite
-- tools/foods-catalog-new-fruits.html (ricerca CREA/USDA).

INSERT INTO public.foods (id, name, is_custom, user_id, kcal_100g, protein_100g, carbs_100g, fat_100g) VALUES
('a983fc80-f16c-42e2-8177-dd454b45458d', 'Kiwi', false, NULL, 44, 1.2, 8.6, 0.5),
('5aac30ec-6636-46b2-a9c6-890d6ca04c4e', 'Susine (prugne fresche)', false, NULL, 42, 0.5, 9.5, 0.1),
('c5927d8a-0769-434e-a658-868f96834b3d', 'Fichi freschi', false, NULL, 47, 1.1, 10.4, 0.2),
('3c5566e0-b341-49c3-a1d0-19b052284d4f', 'Lamponi', false, NULL, 35, 1.2, 4.7, 0.4),
('2f1c6824-2842-4e05-9034-c0ccfe62e00e', 'Nespole', false, NULL, 47, 0.4, 12.1, 0.2),
('649b2c2e-7665-439d-97ff-94c5a606d1ee', 'Mirtilli rossi (cranberry)', false, NULL, 46, 0.4, 12.2, 0.1),
('74b5ba67-c153-4a36-acd9-f22be2765225', 'Amarene (ciliegie acide)', false, NULL, 50, 1, 12.2, 0.3),
('0a675000-b76f-438c-9b30-e66bc3f4f4dd', 'Cocco fresco (polpa)', false, NULL, 354, 3.3, 15.2, 33.5),
('99d69833-4602-46f4-a7bf-700d1c5278d1', 'Clementine', false, NULL, 47, 0.9, 11.7, 0.2),
('de7abd3f-9017-44dd-9a6d-6a6dd0fe1ae2', 'Frutto della passione (maracuja)', false, NULL, 97, 2.2, 23.4, 0.7),
('75dfcd02-ebe0-47ec-a76b-7a700bd4eb88', 'Guava', false, NULL, 68, 2.6, 14.3, 0.5),
('d78efe47-0ca7-475a-9072-405a8b91e98f', 'Frutto del drago (pitaya)', false, NULL, 57, 0.4, 15.2, 0.1),
('72193788-8215-4377-9fe3-a96ce81a5fad', 'Giuggiole', false, NULL, 79, 1.2, 20.2, 0.2),
('0bfcbf92-d2d5-4e0f-8c9e-037bdcd7be71', 'Fico d''India', false, NULL, 41, 0.7, 9.6, 0.5)
ON CONFLICT (id) DO NOTHING;
