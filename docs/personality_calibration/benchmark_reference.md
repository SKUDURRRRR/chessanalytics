# Personality Calibration Benchmark Reference

This document establishes target trait expectations for a core set of reference players spanning multiple eras and playing styles. These benchmarks will anchor calibration work so numerical scores better reflect historically accepted reputations.

## Methodology

- **Trait scale**: 0–100 (platform default). Ranges below represent the band in which calibrated scores should land after tuning.
- **Evidence**: Drawn from tournament records, annotated game collections, and scholarly commentary. Representative sources are listed per player for traceability.
- **Game mix guidance**: When assembling calibration datasets, aim for 40–60 classical or high-quality rapid games per player, balanced across colors and peak years.

## Benchmark Table

| Player | Era / Peak Years | Tactical | Positional | Aggressive | Patient | Novelty | Staleness | Style Notes & References |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Magnus Carlsen | 2010s–present | 80–85 | 88–94 | 58–66 | 72–80 | 60–68 | 46–54 | Universal grinder with endgame edge; mixes structures but rarely forces speculative sacrifices. (Carlsen & Agdestein, *Play Magnus*; Shipov commentary on 2013 WCC)
| Viswanathan Anand | 1995–2015 | 78–84 | 82–90 | 64–72 | 70–78 | 62–70 | 50–58 | Rapid-fire calculation plus classical structures; deep opening prep without extreme novelty. (Kasparov, *My Great Predecessors V*; Anand & Nunn, *My Best Games*)
| Hikaru Nakamura | 2005–present | 82–90 | 70–78 | 78–86 | 52–60 | 72–80 | 38–46 | Aggressive initiative seeker with wide opening repertoire, especially in faster time controls. (New In Chess Yearbook profiles; Nakamura streams analysis)
| Fabiano Caruana | 2012–present | 84–90 | 86–92 | 62–70 | 68–76 | 66–74 | 48–56 | Deep preparation and accurate calculation; attacks emerge from precise preparation rather than speculative sacrifices. (ChessBase annotations; Caruana, *Road to the Top*)
| Ding Liren | 2015–present | 78–84 | 86–92 | 60–68 | 70–78 | 64–72 | 48–56 | Solid positional press with tactical awareness; balanced opening variety. (Chessable course notes; Ding commentary from 2023 WCC)
| Hou Yifan | 2010–2020 | 74–82 | 82–90 | 60–68 | 68–76 | 66–74 | 46–54 | Classical positional style with prepared attacking lines; versatile repertoire. (Hou, *My Academy* lectures; FIDE Grand Prix reports)
| Garry Kasparov | 1985–2005 | 90–96 | 82–90 | 88–94 | 54–62 | 78–86 | 36–44 | Relentless initiative, cutting-edge opening novelty. (Kasparov, *My Great Predecessors*; Dorfman, *The Method in Chess*)
| Mikhail Tal | 1957–1962 | 94–98 | 70–78 | 92–98 | 40–50 | 80–88 | 30–40 | Sacrificial tactics, high-risk; constant novelty in dynamic openings. (Tal, *The Life and Games of Mikhail Tal*; Koblencs analysis)
| Bobby Fischer | 1958–1972 | 90–96 | 88–94 | 72–80 | 66–74 | 70–78 | 54–62 | Universal but principled repertoire centered on 1.e4/ Najdorf; innovative but loyal to chosen systems. (Fischer, *My 60 Memorable Games*; Kasparov, *MGPII*)
| José Raúl Capablanca | 1910–1930 | 70–78 | 94–98 | 52–60 | 82–90 | 48–56 | 64–72 | Positional/endgame dominance, minimal speculative play; limited novelty emphasis. (Capablanca, *Chess Fundamentals*; Reinfeld biographies)
| Anatoly Karpov | 1970–1990 | 76–84 | 92–98 | 50–58 | 84–92 | 56–64 | 60–68 | Prophylactic, patient style with restrained aggression; consistent openings. (Karpov, *My 300 Best Games*; Timman commentary)
| Tigran Petrosian | 1958–1970 | 72–80 | 90–96 | 42–50 | 86–94 | 54–62 | 66–74 | Defensive virtuoso; favors exchange sacrifices for blockade, repeats strategic systems. (Petrosian, *Python Strategy*; Kotov analysis)
| Mikhail Botvinnik | 1940–1960 | 82–88 | 90–96 | 60–68 | 78–86 | 62–70 | 56–64 | Scientific preparation, strategic battles; balanced aggression. (Botvinnik, *One Hundred Selected Games*; Kasparov MGPI)
| Paul Morphy | 1857–1860 | 92–98 | 72–80 | 88–96 | 46–54 | 82–90 | 34–42 | Romantic-era attacking play, pioneering opening ideas against limited opposition variety. (Lawson biography; Morphy game collections)
| Judit Polgár | 1990–2010 | 88–94 | 78–86 | 86–94 | 48–56 | 74–82 | 40–48 | Tactical aggression, high initiative, broad repertoire. (Polgár, *How I Beat Fischer’s Record*; New In Chess articles)

## Usage Guidelines

1. **Calibration Targeting** – After each formula iteration, compute radar scores for these players. Successful tuning keeps each trait within the indicated bands, prioritizing aggressive/patient and novelty/staleness ranges that best reflect historical consensus.
2. **Dataset Composition** – When re-analyzing, favor classical games, excluding exhibitions with unusual formats. Include both sides of match play (e.g., WCC games) to capture authentic style.
3. **Exception Handling** – If data scarcity (e.g., Morphy) causes instability, document confidence level and adjust weighting in summary analytics.

## References

- Garry Kasparov, *My Great Predecessors* I–V (Everyman Chess, 2003–2006)
- Mikhail Tal, *The Life and Games of Mikhail Tal* (Cadogan, 1997)
- José R. Capablanca, *Chess Fundamentals* (1911) and annotated game collections
- Bobby Fischer, *My 60 Memorable Games* (1969)
- Judit Polgár, *How I Beat Fischer’s Record* (Quality Chess, 2012)
- GM analyses from ChessBase / New In Chess Yearbooks (various issues)
- Contemporary WCC and elite tournament commentary (official bulletins, FIDE reports)
