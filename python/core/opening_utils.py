"""
Opening Utilities - Normalize opening names and families
Python port of src/utils/openingUtils.ts for consistent opening normalization
"""

# ECO Code to Opening Name Mapping
ECO_CODE_MAPPING = {
    # A00-A99: Flank Openings
    'A00': 'Uncommon Opening',
    'A01': 'Nimzowitsch-Larsen Attack',
    'A02': 'Bird Opening',
    'A03': 'Bird Opening',
    'A04': 'Reti Opening',
    'A05': 'Reti Opening',
    'A06': 'Reti Opening',
    'A07': "King's Indian Attack",
    'A08': "King's Indian Attack",
    'A09': 'Reti Opening',
    'A10': 'English Opening',
    'A11': 'English Opening',
    'A12': 'English Opening',
    'A13': 'English Opening',
    'A14': 'English Opening',
    'A15': 'English Opening',
    'A16': 'English Opening',
    'A17': 'English Opening',
    'A18': 'English Opening',
    'A19': 'English Opening',
    'A20': 'English Opening',
    'A21': 'English Opening',
    'A22': 'English Opening',
    'A23': 'English Opening',
    'A24': 'English Opening',
    'A25': 'English Opening',
    'A26': 'English Opening',
    'A27': 'English Opening',
    'A28': 'English Opening',
    'A29': 'English Opening',
    'A30': 'English Opening',
    'A31': 'English Opening',
    'A32': 'English Opening',
    'A33': 'English Opening',
    'A34': 'English Opening',
    'A35': 'English Opening',
    'A36': 'English Opening',
    'A37': 'English Opening',
    'A38': 'English Opening',
    'A39': 'English Opening',
    'A40': "Queen's Pawn Game",
    'A41': "Queen's Pawn Game",
    'A42': 'Modern Defense',
    'A43': 'Old Benoni Defense',
    'A44': 'Old Benoni Defense',
    'A45': "Queen's Pawn Game",
    'A46': "Queen's Pawn Game",
    'A47': "Queen's Indian Defense",
    'A48': "King's Indian Defense",
    'A49': "Queen's Pawn Game",
    'A50': "Queen's Pawn Game",
    'A51': 'Budapest Defense',
    'A52': 'Budapest Defense',
    'A53': 'Old Indian Defense',
    'A54': 'Old Indian Defense',
    'A55': 'Old Indian Defense',
    'A56': 'Benoni Defense',
    'A57': 'Benko Gambit',
    'A58': 'Benko Gambit',
    'A59': 'Benko Gambit',
    'A60': 'Benoni Defense',
    'A61': 'Benoni Defense',
    'A62': 'Benoni Defense',
    'A63': 'Benoni Defense',
    'A64': 'Benoni Defense',
    'A65': 'Benoni Defense',
    'A66': 'Benoni Defense',
    'A67': 'Benoni Defense',
    'A68': 'Benoni Defense',
    'A69': 'Benoni Defense',
    'A70': 'Benoni Defense',
    'A71': 'Benoni Defense',
    'A72': 'Benoni Defense',
    'A73': 'Benoni Defense',
    'A74': 'Benoni Defense',
    'A75': 'Benoni Defense',
    'A76': 'Benoni Defense',
    'A77': 'Benoni Defense',
    'A78': 'Benoni Defense',
    'A79': 'Benoni Defense',
    'A80': 'Dutch Defense',
    'A81': 'Dutch Defense',
    'A82': 'Dutch Defense',
    'A83': 'Dutch Defense',
    'A84': 'Dutch Defense',
    'A85': 'Dutch Defense',
    'A86': 'Dutch Defense',
    'A87': 'Dutch Defense',
    'A88': 'Dutch Defense',
    'A89': 'Dutch Defense',
    'A90': 'Dutch Defense',
    'A91': 'Dutch Defense',
    'A92': 'Dutch Defense',
    'A93': 'Dutch Defense',
    'A94': 'Dutch Defense',
    'A95': 'Dutch Defense',
    'A96': 'Dutch Defense',
    'A97': 'Dutch Defense',
    'A98': 'Dutch Defense',
    'A99': 'Dutch Defense',

    # B00-B99: Semi-Open Games
    'B00': "King's Pawn Game",
    'B01': 'Scandinavian Defense',
    'B02': 'Alekhine Defense',
    'B03': 'Alekhine Defense',
    'B04': 'Alekhine Defense',
    'B05': 'Alekhine Defense',
    'B06': 'Modern Defense',
    'B07': 'Pirc Defense',
    'B08': 'Pirc Defense',
    'B09': 'Pirc Defense',
    'B10': 'Caro-Kann Defense',
    'B11': 'Caro-Kann Defense',
    'B12': 'Caro-Kann Defense',
    'B13': 'Caro-Kann Defense',
    'B14': 'Caro-Kann Defense',
    'B15': 'Caro-Kann Defense',
    'B16': 'Caro-Kann Defense',
    'B17': 'Caro-Kann Defense',
    'B18': 'Caro-Kann Defense',
    'B19': 'Caro-Kann Defense',
    'B20': 'Sicilian Defense',
    'B21': 'Sicilian Defense',
    'B22': 'Sicilian Defense',
    'B23': 'Sicilian Defense',
    'B24': 'Sicilian Defense',
    'B25': 'Sicilian Defense',
    'B26': 'Sicilian Defense',
    'B27': 'Sicilian Defense',
    'B28': 'Sicilian Defense',
    'B29': 'Sicilian Defense',
    'B30': 'Sicilian Defense',
    'B31': 'Sicilian Defense',
    'B32': 'Sicilian Defense',
    'B33': 'Sicilian Defense',
    'B34': 'Sicilian Defense',
    'B35': 'Sicilian Defense',
    'B36': 'Sicilian Defense',
    'B37': 'Sicilian Defense',
    'B38': 'Sicilian Defense',
    'B39': 'Sicilian Defense',
    'B40': 'Sicilian Defense',
    'B41': 'Sicilian Defense',
    'B42': 'Sicilian Defense',
    'B43': 'Sicilian Defense',
    'B44': 'Sicilian Defense',
    'B45': 'Sicilian Defense',
    'B46': 'Sicilian Defense',
    'B47': 'Sicilian Defense',
    'B48': 'Sicilian Defense',
    'B49': 'Sicilian Defense',
    'B50': 'Sicilian Defense',
    'B51': 'Sicilian Defense',
    'B52': 'Sicilian Defense',
    'B53': 'Sicilian Defense',
    'B54': 'Sicilian Defense',
    'B55': 'Sicilian Defense',
    'B56': 'Sicilian Defense',
    'B57': 'Sicilian Defense',
    'B58': 'Sicilian Defense',
    'B59': 'Sicilian Defense',
    'B60': 'Sicilian Defense',
    'B61': 'Sicilian Defense',
    'B62': 'Sicilian Defense',
    'B63': 'Sicilian Defense',
    'B64': 'Sicilian Defense',
    'B65': 'Sicilian Defense',
    'B66': 'Sicilian Defense',
    'B67': 'Sicilian Defense',
    'B68': 'Sicilian Defense',
    'B69': 'Sicilian Defense',
    'B70': 'Sicilian Defense',
    'B71': 'Sicilian Defense',
    'B72': 'Sicilian Defense',
    'B73': 'Sicilian Defense',
    'B74': 'Sicilian Defense',
    'B75': 'Sicilian Defense',
    'B76': 'Sicilian Defense',
    'B77': 'Sicilian Defense',
    'B78': 'Sicilian Defense',
    'B79': 'Sicilian Defense',
    'B80': 'Sicilian Defense',
    'B81': 'Sicilian Defense',
    'B82': 'Sicilian Defense',
    'B83': 'Sicilian Defense',
    'B84': 'Sicilian Defense',
    'B85': 'Sicilian Defense',
    'B86': 'Sicilian Defense',
    'B87': 'Sicilian Defense',
    'B88': 'Sicilian Defense',
    'B89': 'Sicilian Defense',
    'B90': 'Sicilian Defense',
    'B91': 'Sicilian Defense',
    'B92': 'Sicilian Defense',
    'B93': 'Sicilian Defense',
    'B94': 'Sicilian Defense',
    'B95': 'Sicilian Defense',
    'B96': 'Sicilian Defense',
    'B97': 'Sicilian Defense',
    'B98': 'Sicilian Defense',
    'B99': 'Sicilian Defense',

    # C00-C99: Open Games
    'C00': 'French Defense',
    'C01': 'French Defense',
    'C02': 'French Defense',
    'C03': 'French Defense',
    'C04': 'French Defense',
    'C05': 'French Defense',
    'C06': 'French Defense',
    'C07': 'French Defense',
    'C08': 'French Defense',
    'C09': 'French Defense',
    'C10': 'French Defense',
    'C11': 'French Defense',
    'C12': 'French Defense',
    'C13': 'French Defense',
    'C14': 'French Defense',
    'C15': 'French Defense',
    'C16': 'French Defense',
    'C17': 'French Defense',
    'C18': 'French Defense',
    'C19': 'French Defense',
    'C20': "King's Pawn Game",
    'C21': 'Center Game',
    'C22': 'Center Game',
    'C23': "Bishop's Opening",
    'C24': "Bishop's Opening",
    'C25': 'Vienna Game',
    'C26': 'Vienna Game',
    'C27': 'Vienna Game',
    'C28': 'Vienna Game',
    'C29': 'Vienna Game',
    'C30': "King's Gambit",
    'C31': "King's Gambit Declined",
    'C32': "King's Gambit Declined",
    'C33': "King's Gambit",
    'C34': "King's Gambit",
    'C35': "King's Gambit",
    'C36': "King's Gambit",
    'C37': "King's Gambit",
    'C38': "King's Gambit",
    'C39': "King's Gambit",
    'C40': "King's Pawn Game",
    'C41': 'Philidor Defense',
    'C42': 'Petrov Defense',
    'C43': 'Petrov Defense',
    'C44': "King's Pawn Game",
    'C45': 'Scotch Game',
    'C46': 'Three Knights Game',
    'C47': 'Four Knights Game',
    'C48': 'Four Knights Game',
    'C49': 'Four Knights Game',
    'C50': 'Italian Game',
    'C51': 'Evans Gambit',
    'C52': 'Evans Gambit',
    'C53': 'Italian Game',
    'C54': 'Italian Game',
    'C55': 'Italian Game',
    'C56': 'Italian Game',
    'C57': 'Italian Game',
    'C58': 'Italian Game',
    'C59': 'Italian Game',
    'C60': 'Ruy Lopez',
    'C61': 'Ruy Lopez',
    'C62': 'Ruy Lopez',
    'C63': 'Ruy Lopez',
    'C64': 'Ruy Lopez',
    'C65': 'Ruy Lopez',
    'C66': 'Ruy Lopez',
    'C67': 'Ruy Lopez',
    'C68': 'Ruy Lopez',
    'C69': 'Ruy Lopez',
    'C70': 'Ruy Lopez',
    'C71': 'Ruy Lopez',
    'C72': 'Ruy Lopez',
    'C73': 'Ruy Lopez',
    'C74': 'Ruy Lopez',
    'C75': 'Ruy Lopez',
    'C76': 'Ruy Lopez',
    'C77': 'Ruy Lopez',
    'C78': 'Ruy Lopez',
    'C79': 'Ruy Lopez',
    'C80': 'Ruy Lopez',
    'C81': 'Ruy Lopez',
    'C82': 'Ruy Lopez',
    'C83': 'Ruy Lopez',
    'C84': 'Ruy Lopez',
    'C85': 'Ruy Lopez',
    'C86': 'Ruy Lopez',
    'C87': 'Ruy Lopez',
    'C88': 'Ruy Lopez',
    'C89': 'Ruy Lopez',
    'C90': 'Ruy Lopez',
    'C91': 'Ruy Lopez',
    'C92': 'Ruy Lopez',
    'C93': 'Ruy Lopez',
    'C94': 'Ruy Lopez',
    'C95': 'Ruy Lopez',
    'C96': 'Ruy Lopez',
    'C97': 'Ruy Lopez',
    'C98': 'Ruy Lopez',
    'C99': 'Ruy Lopez',

    # D00-D99: Closed Games
    'D00': "Queen's Pawn Game",
    'D01': 'Richter-Veresov Attack',
    'D02': "Queen's Pawn Game",
    'D03': 'Torre Attack',
    'D04': "Queen's Pawn Game",
    'D05': "Queen's Pawn Game",
    'D06': "Queen's Gambit",
    'D07': "Queen's Gambit Declined",
    'D08': "Queen's Gambit Declined",
    'D09': "Queen's Gambit Declined",
    'D10': "Queen's Gambit Declined",
    'D11': "Queen's Gambit Declined",
    'D12': "Queen's Gambit Declined",
    'D13': "Queen's Gambit Declined",
    'D14': "Queen's Gambit Declined",
    'D15': "Queen's Gambit Declined",
    'D16': "Queen's Gambit Declined",
    'D17': "Queen's Gambit Declined",
    'D18': "Queen's Gambit Declined",
    'D19': "Queen's Gambit Declined",
    'D20': "Queen's Gambit Accepted",
    'D21': "Queen's Gambit Accepted",
    'D22': "Queen's Gambit Accepted",
    'D23': "Queen's Gambit Accepted",
    'D24': "Queen's Gambit Accepted",
    'D25': "Queen's Gambit Accepted",
    'D26': "Queen's Gambit Accepted",
    'D27': "Queen's Gambit Accepted",
    'D28': "Queen's Gambit Accepted",
    'D29': "Queen's Gambit Accepted",
    'D30': "Queen's Gambit Declined",
    'D31': "Queen's Gambit Declined",
    'D32': "Queen's Gambit Declined",
    'D33': "Queen's Gambit Declined",
    'D34': "Queen's Gambit Declined",
    'D35': "Queen's Gambit Declined",
    'D36': "Queen's Gambit Declined",
    'D37': "Queen's Gambit Declined",
    'D38': "Queen's Gambit Declined",
    'D39': "Queen's Gambit Declined",
    'D40': "Queen's Gambit Declined",
    'D41': "Queen's Gambit Declined",
    'D42': "Queen's Gambit Declined",
    'D43': "Queen's Gambit Declined",
    'D44': "Queen's Gambit Declined",
    'D45': "Queen's Gambit Declined",
    'D46': "Queen's Gambit Declined",
    'D47': "Queen's Gambit Declined",
    'D48': "Queen's Gambit Declined",
    'D49': "Queen's Gambit Declined",
    'D50': "Queen's Gambit Declined",
    'D51': "Queen's Gambit Declined",
    'D52': "Queen's Gambit Declined",
    'D53': "Queen's Gambit Declined",
    'D54': "Queen's Gambit Declined",
    'D55': "Queen's Gambit Declined",
    'D56': "Queen's Gambit Declined",
    'D57': "Queen's Gambit Declined",
    'D58': "Queen's Gambit Declined",
    'D59': "Queen's Gambit Declined",
    'D60': "Queen's Gambit Declined",
    'D61': "Queen's Gambit Declined",
    'D62': "Queen's Gambit Declined",
    'D63': "Queen's Gambit Declined",
    'D64': "Queen's Gambit Declined",
    'D65': "Queen's Gambit Declined",
    'D66': "Queen's Gambit Declined",
    'D67': "Queen's Gambit Declined",
    'D68': "Queen's Gambit Declined",
    'D69': "Queen's Gambit Declined",
    'D70': 'Grunfeld Defense',
    'D71': 'Grunfeld Defense',
    'D72': 'Grunfeld Defense',
    'D73': 'Grunfeld Defense',
    'D74': 'Grunfeld Defense',
    'D75': 'Grunfeld Defense',
    'D76': 'Grunfeld Defense',
    'D77': 'Grunfeld Defense',
    'D78': 'Grunfeld Defense',
    'D79': 'Grunfeld Defense',
    'D80': 'Grunfeld Defense',
    'D81': 'Grunfeld Defense',
    'D82': 'Grunfeld Defense',
    'D83': 'Grunfeld Defense',
    'D84': 'Grunfeld Defense',
    'D85': 'Grunfeld Defense',
    'D86': 'Grunfeld Defense',
    'D87': 'Grunfeld Defense',
    'D88': 'Grunfeld Defense',
    'D89': 'Grunfeld Defense',
    'D90': 'Grunfeld Defense',
    'D91': 'Grunfeld Defense',
    'D92': 'Grunfeld Defense',
    'D93': 'Grunfeld Defense',
    'D94': 'Grunfeld Defense',
    'D95': 'Grunfeld Defense',
    'D96': 'Grunfeld Defense',
    'D97': 'Grunfeld Defense',
    'D98': 'Grunfeld Defense',
    'D99': 'Grunfeld Defense',

    # E00-E99: Indian Defenses
    'E00': "Queen's Pawn Game",
    'E01': 'Catalan Opening',
    'E02': 'Catalan Opening',
    'E03': 'Catalan Opening',
    'E04': 'Catalan Opening',
    'E05': 'Catalan Opening',
    'E06': 'Catalan Opening',
    'E07': 'Catalan Opening',
    'E08': 'Catalan Opening',
    'E09': 'Catalan Opening',
    'E10': "Queen's Pawn Game",
    'E11': 'Bogo-Indian Defense',
    'E12': "Queen's Indian Defense",
    'E13': "Queen's Indian Defense",
    'E14': "Queen's Indian Defense",
    'E15': "Queen's Indian Defense",
    'E16': "Queen's Indian Defense",
    'E17': "Queen's Indian Defense",
    'E18': "Queen's Indian Defense",
    'E19': "Queen's Indian Defense",
    'E20': 'Nimzo-Indian Defense',
    'E21': 'Nimzo-Indian Defense',
    'E22': 'Nimzo-Indian Defense',
    'E23': 'Nimzo-Indian Defense',
    'E24': 'Nimzo-Indian Defense',
    'E25': 'Nimzo-Indian Defense',
    'E26': 'Nimzo-Indian Defense',
    'E27': 'Nimzo-Indian Defense',
    'E28': 'Nimzo-Indian Defense',
    'E29': 'Nimzo-Indian Defense',
    'E30': 'Nimzo-Indian Defense',
    'E31': 'Nimzo-Indian Defense',
    'E32': 'Nimzo-Indian Defense',
    'E33': 'Nimzo-Indian Defense',
    'E34': 'Nimzo-Indian Defense',
    'E35': 'Nimzo-Indian Defense',
    'E36': 'Nimzo-Indian Defense',
    'E37': 'Nimzo-Indian Defense',
    'E38': 'Nimzo-Indian Defense',
    'E39': 'Nimzo-Indian Defense',
    'E40': 'Nimzo-Indian Defense',
    'E41': 'Nimzo-Indian Defense',
    'E42': 'Nimzo-Indian Defense',
    'E43': 'Nimzo-Indian Defense',
    'E44': 'Nimzo-Indian Defense',
    'E45': 'Nimzo-Indian Defense',
    'E46': 'Nimzo-Indian Defense',
    'E47': 'Nimzo-Indian Defense',
    'E48': 'Nimzo-Indian Defense',
    'E49': 'Nimzo-Indian Defense',
    'E50': 'Nimzo-Indian Defense',
    'E51': 'Nimzo-Indian Defense',
    'E52': 'Nimzo-Indian Defense',
    'E53': 'Nimzo-Indian Defense',
    'E54': 'Nimzo-Indian Defense',
    'E55': 'Nimzo-Indian Defense',
    'E56': 'Nimzo-Indian Defense',
    'E57': 'Nimzo-Indian Defense',
    'E58': 'Nimzo-Indian Defense',
    'E59': 'Nimzo-Indian Defense',
    'E60': "King's Indian Defense",
    'E61': "King's Indian Defense",
    'E62': "King's Indian Defense",
    'E63': "King's Indian Defense",
    'E64': "King's Indian Defense",
    'E65': "King's Indian Defense",
    'E66': "King's Indian Defense",
    'E67': "King's Indian Defense",
    'E68': "King's Indian Defense",
    'E69': "King's Indian Defense",
    'E70': "King's Indian Defense",
    'E71': "King's Indian Defense",
    'E72': "King's Indian Defense",
    'E73': "King's Indian Defense",
    'E74': "King's Indian Defense",
    'E75': "King's Indian Defense",
    'E76': "King's Indian Defense",
    'E77': "King's Indian Defense",
    'E78': "King's Indian Defense",
    'E79': "King's Indian Defense",
    'E80': "King's Indian Defense",
    'E81': "King's Indian Defense",
    'E82': "King's Indian Defense",
    'E83': "King's Indian Defense",
    'E84': "King's Indian Defense",
    'E85': "King's Indian Defense",
    'E86': "King's Indian Defense",
    'E87': "King's Indian Defense",
    'E88': "King's Indian Defense",
    'E89': "King's Indian Defense",
    'E90': "King's Indian Defense",
    'E91': "King's Indian Defense",
    'E92': "King's Indian Defense",
    'E93': "King's Indian Defense",
    'E94': "King's Indian Defense",
    'E95': "King's Indian Defense",
    'E96': "King's Indian Defense",
    'E97': "King's Indian Defense",
    'E98': "King's Indian Defense",
    'E99': "King's Indian Defense",
}


def get_opening_name_from_eco_code(eco_code: str) -> str:
    """Convert ECO code to opening name"""
    if not eco_code or not isinstance(eco_code, str):
        return 'Unknown'

    # Clean the ECO code (remove any extra characters)
    clean_eco_code = eco_code.strip().upper()

    # Check if it's a valid ECO code format (A00-E99)
    import re
    if not re.match(r'^[A-E]\d{2}$', clean_eco_code):
        return eco_code  # Return original if not a valid ECO code

    return ECO_CODE_MAPPING.get(clean_eco_code, eco_code)


def normalize_opening_name(opening: str) -> str:
    """
    Normalize opening name to family name for consistent grouping.
    This is the critical function that consolidates variations into families.

    Examples:
    - "Sicilian Defense, Najdorf Variation" -> "Sicilian Defense"
    - "Italian Game, Classical Variation" -> "Italian Game"
    - "Queen's Gambit Declined, Orthodox Defense" -> "Queen's Gambit Declined"
    """
    if not opening or opening == 'Unknown':
        return 'Unknown'

    # First check if it's an ECO code
    eco_name = get_opening_name_from_eco_code(opening)
    if eco_name != opening:
        return eco_name

    # Common opening family mappings
    opening_families = {
        # King's Pawn Openings
        'Sicilian Defense': 'Sicilian Defense',
        'Sicilian': 'Sicilian Defense',
        'French Defense': 'French Defense',
        'French': 'French Defense',
        'Caro-Kann Defense': 'Caro-Kann Defense',
        'Caro-Kann': 'Caro-Kann Defense',
        'Scandinavian Defense': 'Scandinavian Defense',
        'Scandinavian': 'Scandinavian Defense',
        'Alekhine Defense': 'Alekhine Defense',
        'Alekhine': 'Alekhine Defense',
        'Pirc Defense': 'Pirc Defense',
        'Pirc': 'Pirc Defense',
        'Modern Defense': 'Modern Defense',
        'Modern': 'Modern Defense',

        # Queen's Pawn Openings
        "Queen's Gambit": "Queen's Gambit",
        "Queen's Gambit Declined": "Queen's Gambit Declined",
        "Queen's Gambit Accepted": "Queen's Gambit Accepted",
        'Slav Defense': 'Slav Defense',
        'Slav': 'Slav Defense',
        'Nimzo-Indian Defense': 'Nimzo-Indian Defense',
        'Nimzo-Indian': 'Nimzo-Indian Defense',
        "Queen's Indian Defense": "Queen's Indian Defense",
        "Queen's Indian": "Queen's Indian Defense",
        "King's Indian Defense": "King's Indian Defense",
        "King's Indian": "King's Indian Defense",
        'Grunfeld Defense': 'Grunfeld Defense',
        'Grunfeld': 'Grunfeld Defense',
        'Benoni Defense': 'Benoni Defense',
        'Benoni': 'Benoni Defense',
        'Old Indian Defense': 'Old Indian Defense',
        'Old Indian': 'Old Indian Defense',
        'Budapest Defense': 'Budapest Defense',
        'Budapest': 'Budapest Defense',
        'Dutch Defense': 'Dutch Defense',
        'Dutch': 'Dutch Defense',

        # English Opening
        'English Opening': 'English Opening',
        'English': 'English Opening',

        # Reti Opening
        'Reti Opening': 'Reti Opening',
        'Reti': 'Reti Opening',

        # Other Openings
        'Ruy Lopez': 'Ruy Lopez',
        'Italian Game': 'Italian Game',
        'Italian': 'Italian Game',
        'Two Knights Defense': 'Two Knights Defense',
        'Two Knights': 'Two Knights Defense',
        'Petrov Defense': 'Petrov Defense',
        'Petrov': 'Petrov Defense',
        'Philidor Defense': 'Philidor Defense',
        'Philidor': 'Philidor Defense',
        'Vienna Game': 'Vienna Game',
        'Vienna': 'Vienna Game',
        "King's Gambit": "King's Gambit",
        'Evans Gambit': 'Evans Gambit',
        'Evans': 'Evans Gambit',
        'Scotch Game': 'Scotch Game',
        'Scotch': 'Scotch Game',
        'Four Knights Game': 'Four Knights Game',
        'Four Knights': 'Four Knights Game',
        'Three Knights Game': 'Three Knights Game',
        'Three Knights': 'Three Knights Game',
        "King's Pawn Game": "King's Pawn Game",
        "Queen's Pawn Game": "Queen's Pawn Game",
        'Torre Attack': 'Torre Attack',
        'London System': 'London System',
        'London': 'London System',
        'Catalan Opening': 'Catalan Opening',
        'Catalan': 'Catalan Opening',
        'Bogo-Indian Defense': 'Bogo-Indian Defense',
        'Bogo-Indian': 'Bogo-Indian Defense',
        'Center Game': 'Center Game',
        "Bishop's Opening": "Bishop's Opening",
        'Bird Opening': 'Bird Opening',
        'Bird': 'Bird Opening',
        'Nimzowitsch-Larsen Attack': 'Nimzowitsch-Larsen Attack',
        'Trompowsky Attack': 'Trompowsky Attack',
        'Trompowsky': 'Trompowsky Attack',
    }

    # Try to find exact match first
    if opening in opening_families:
        return opening_families[opening]

    # Try to find partial match - this handles variations
    # e.g., "Sicilian Defense, Najdorf Variation" contains "Sicilian Defense"
    opening_lower = opening.lower()
    for key, value in opening_families.items():
        key_lower = key.lower()
        if key_lower in opening_lower or opening_lower.startswith(key_lower):
            return value

    # If no match found, try to extract the base opening name before comma or colon
    # This handles cases like "Opening Name: Variation" or "Opening Name, Variation"
    if ',' in opening:
        base_opening = opening.split(',')[0].strip()
        # Try matching again with the base
        if base_opening in opening_families:
            return opening_families[base_opening]
        for key, value in opening_families.items():
            if key.lower() in base_opening.lower():
                return value
        return base_opening

    if ':' in opening:
        base_opening = opening.split(':')[0].strip()
        if base_opening in opening_families:
            return opening_families[base_opening]
        for key, value in opening_families.items():
            if key.lower() in base_opening.lower():
                return value
        return base_opening

    # If no match found, return the original opening name
    return opening


def identify_a00_opening_from_moves(pgn: str) -> str:
    """
    Identify specific A00 opening from PGN moves.
    A00 is a catch-all ECO code for irregular first moves.
    This function identifies the specific opening based on White's first move.

    Returns the specific opening name, or 'Uncommon Opening' if unidentified.
    """
    if not pgn:
        return 'Uncommon Opening'

    # Extract first move from PGN
    # PGN format: "1. e4 e5 2. Nf3..." or with headers "[Event "..."]\n\n1. e4..."
    lines = pgn.split('\n')
    moves_started = False
    first_move = None

    for line in lines:
        line = line.strip()
        # Skip headers and empty lines
        if not line or line.startswith('['):
            continue
        # Found the moves section
        if line and not line.startswith('['):
            moves_started = True
            # Extract first move (e.g., "1. b4" or "1. Nc3")
            # Handle formats: "1. b4" or "1.b4" or just "b4"
            import re
            # Match pattern: optional "1." or "1 " followed by the move
            match = re.search(r'(?:1\.\s*|1\s+)?([a-hNBRQK][a-h1-8x+#=NBRQ-]+)', line)
            if match:
                first_move = match.group(1)
                break

    if not first_move:
        return 'Uncommon Opening'

    # Map first moves to specific A00 openings
    first_move_clean = first_move.replace('x', '').replace('+', '').replace('#', '')

    a00_openings = {
        'b4': 'Polish Opening',      # 1.b4 (also called Sokolsky Opening)
        'Nc3': 'Van Geet Opening',   # 1.Nc3
        'a3': "Anderssen's Opening", # 1.a3
        'a4': 'Ware Opening',        # 1.a4
        'g3': 'Hungarian Opening',   # 1.g3 (also called Benko Opening)
        'g4': 'Grob Opening',        # 1.g4 (also called Spike Opening)
        'Nh3': 'Amar Opening',       # 1.Nh3 (also called Paris Opening)
        'Na3': 'Durkin Opening',     # 1.Na3 (also called Sodium Attack)
        'e3': "Van't Kruijs Opening", # 1.e3
        'h3': 'Clemenz Opening',     # 1.h3
        'h4': 'Desprez Opening',     # 1.h4
        'f3': 'Barnes Opening',      # 1.f3
        'c3': 'Saragossa Opening',   # 1.c3
        'd3': 'Mieses Opening',      # 1.d3
        'b3': 'Nimzowitsch-Larsen Attack', # 1.b3
        'Nf3': 'Zukertort Opening',  # 1.Nf3 (if not followed by standard continuations)
    }

    return a00_openings.get(first_move_clean, 'Uncommon Opening')


def identify_opening_from_pgn_moves(pgn: str, user_color: str = 'white') -> tuple[str, str]:
    """
    Identify chess opening from PGN moves.
    Returns tuple: (opening_name, eco_code)

    Args:
        pgn: PGN string containing the game
        user_color: The color the user played ('white' or 'black')

    Returns:
        Tuple of (opening_name, eco_code) where eco_code can be None
    """
    import chess
    import chess.pgn
    from io import StringIO

    try:
        pgn_io = StringIO(pgn)
        game = chess.pgn.read_game(pgn_io)

        if not game:
            return "Unknown Opening", None

        # Extract first 6 moves
        moves = []
        board = game.board()
        for move in game.mainline_moves():
            moves.append(board.san(move))
            board.push(move)
            if len(moves) >= 6:
                break

        if len(moves) < 2:
            return "Unknown Opening", None

        # Convert to lowercase for matching
        first_moves = [m.lower() for m in moves[:6]]

        # Check for specific openings
        # Italian Game: 1.e4 e5 2.Nf3 Nc6 3.Bc4
        if len(first_moves) >= 5:
            if (first_moves[0] in ['e4', 'e2e4'] and
                first_moves[1] in ['e5', 'e7e5'] and
                first_moves[2] in ['nf3', 'g1f3']):

                # Philidor Defense: 1.e4 e5 2.Nf3 d6
                if len(first_moves) >= 4 and first_moves[3] in ['d6', 'd7d6']:
                    # But if White plays Bc4, it's still Italian Game from White's perspective
                    if len(first_moves) >= 5 and first_moves[4] in ['bc4', 'f1c4']:
                        return "Italian Game", "C50"
                    return "Philidor Defense", "C41"

                # Italian Game: 1.e4 e5 2.Nf3 Nc6 3.Bc4
                if (len(first_moves) >= 5 and
                    first_moves[3] in ['nc6', 'b8c6'] and
                    first_moves[4] in ['bc4', 'f1c4']):
                    return "Italian Game", "C50"

                # Ruy Lopez: 1.e4 e5 2.Nf3 Nc6 3.Bb5
                if (len(first_moves) >= 5 and
                    first_moves[3] in ['nc6', 'b8c6'] and
                    first_moves[4] in ['bb5', 'f1b5']):
                    return "Ruy Lopez", "C60"

                # Scotch Game: 1.e4 e5 2.Nf3 Nc6 3.d4
                if (len(first_moves) >= 5 and
                    first_moves[3] in ['nc6', 'b8c6'] and
                    first_moves[4] in ['d4', 'd2d4']):
                    return "Scotch Game", "C45"

                # Petrov Defense: 1.e4 e5 2.Nf3 Nf6
                if len(first_moves) >= 4 and first_moves[3] in ['nf6', 'g8f6']:
                    return "Petrov Defense", "C42"

        # General Open Game (1.e4 e5)
        if len(first_moves) >= 2:
            if (first_moves[0] in ['e4', 'e2e4'] and
                first_moves[1] in ['e5', 'e7e5']):
                return "King's Pawn Game", "C20"
            elif first_moves[0] in ['e4', 'e2e4']:
                if first_moves[1] in ['c5', 'c7c5']:
                    return "Sicilian Defense", "B20"
                elif first_moves[1] in ['e6', 'e7e6']:
                    return "French Defense", "C00"
                elif first_moves[1] in ['c6', 'c7c6']:
                    return "Caro-Kann Defense", "B10"
                elif first_moves[1] in ['d5', 'd7d5']:
                    return "Scandinavian Defense", "B01"
                elif first_moves[1] in ['nf6', 'g8f6']:
                    return "Alekhine Defense", "B02"

        return "Unknown Opening", None

    except Exception as e:
        print(f"Error identifying opening from moves: {e}")
        return "Unknown Opening", None
