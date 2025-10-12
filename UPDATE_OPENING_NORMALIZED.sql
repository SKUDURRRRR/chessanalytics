-- Update opening_normalized to use better normalization
-- This maps common opening variations to their normalized names

-- Caro-Kann variations
UPDATE games 
SET opening_normalized = 'Caro-Kann Defense'
WHERE (opening_family LIKE '%Caro-Kann%' OR opening LIKE '%Caro-Kann%' OR opening_family = 'B10' OR opening_family = 'B12' OR opening_family = 'B13' OR opening_family = 'B14' OR opening_family = 'B15' OR opening_family = 'B16' OR opening_family = 'B17' OR opening_family = 'B18' OR opening_family = 'B19')
  AND opening_normalized != 'Caro-Kann Defense';

-- King's Indian variations
UPDATE games 
SET opening_normalized = 'King''s Indian Defense'
WHERE (opening_family LIKE '%King''s Indian%' OR opening LIKE '%King''s Indian%' OR opening_family LIKE '%Kings Indian%' OR opening LIKE '%Kings Indian%' OR opening_family IN ('E60', 'E61', 'E62', 'E63', 'E64', 'E65', 'E66', 'E67', 'E68', 'E69', 'E70', 'E71', 'E72', 'E73', 'E74', 'E75', 'E76', 'E77', 'E78', 'E79', 'E80', 'E81', 'E82', 'E83', 'E84', 'E85', 'E86', 'E87', 'E88', 'E89', 'E90', 'E91', 'E92', 'E93', 'E94', 'E95', 'E96', 'E97', 'E98', 'E99'))
  AND opening_normalized != 'King''s Indian Defense';

-- Sicilian variations
UPDATE games 
SET opening_normalized = 'Sicilian Defense'
WHERE (opening_family LIKE '%Sicilian%' OR opening LIKE '%Sicilian%' OR opening_family LIKE 'B2%' OR opening_family LIKE 'B3%' OR opening_family LIKE 'B4%')
  AND opening_normalized != 'Sicilian Defense';

-- Italian Game variations  
UPDATE games 
SET opening_normalized = 'Italian Game'
WHERE (opening_family LIKE '%Italian%' OR opening LIKE '%Italian%' OR opening_family IN ('C50', 'C51', 'C52', 'C53', 'C54', 'C55'))
  AND opening_normalized != 'Italian Game';

-- French Defense variations
UPDATE games 
SET opening_normalized = 'French Defense'
WHERE (opening_family LIKE '%French%' OR opening LIKE '%French%' OR opening_family LIKE 'C0%' OR opening_family LIKE 'C1%')
  AND opening_normalized != 'French Defense';

-- Ruy Lopez / Spanish Opening
UPDATE games 
SET opening_normalized = 'Ruy Lopez'
WHERE (opening_family LIKE '%Ruy Lopez%' OR opening LIKE '%Ruy Lopez%' OR opening_family LIKE '%Spanish%' OR opening LIKE '%Spanish%' OR opening_family LIKE 'C6%' OR opening_family LIKE 'C7%' OR opening_family LIKE 'C8%' OR opening_family LIKE 'C9%')
  AND opening_normalized != 'Ruy Lopez';

-- Queen's Gambit
UPDATE games 
SET opening_normalized = 'Queen''s Gambit'
WHERE (opening_family LIKE '%Queen''s Gambit%' OR opening LIKE '%Queen''s Gambit%' OR opening_family LIKE '%Queens Gambit%' OR opening LIKE '%Queens Gambit%' OR opening_family LIKE 'D3%' OR opening_family LIKE 'D4%' OR opening_family LIKE 'D5%' OR opening_family LIKE 'D6%')
  AND opening_normalized != 'Queen''s Gambit';

-- King's Gambit
UPDATE games 
SET opening_normalized = 'King''s Gambit'
WHERE (opening_family LIKE '%King''s Gambit%' OR opening LIKE '%King''s Gambit%' OR opening_family LIKE '%Kings Gambit%' OR opening LIKE '%Kings Gambit%' OR opening_family LIKE 'C3%')
  AND opening_normalized != 'King''s Gambit';

-- English Opening
UPDATE games 
SET opening_normalized = 'English Opening'
WHERE (opening_family LIKE '%English%' OR opening LIKE '%English%' OR opening_family LIKE 'A1%' OR opening_family LIKE 'A2%' OR opening_family LIKE 'A3%')
  AND opening_normalized != 'English Opening';

-- Verify changes
SELECT opening_normalized, COUNT(*) as count
FROM games
GROUP BY opening_normalized
ORDER BY count DESC
LIMIT 20;

