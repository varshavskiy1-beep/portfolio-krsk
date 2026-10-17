# portfolio-krsk backtests — MANIFEST (2026-10-17)

Schema `backtest_equity.v1`, файл `backtests.json` (sha256 fb42243d…bbdc). Проверено portal `src/stitchEquity.js` (клон @8a3ecdd8): все 5 серий ok.

| key | валюта/старт | период | шов | источник | IS/WF | издержки | csv sha256 |
|---|---|---|---|---|---|---|---|
| oac_paper::oac_paper | USD 10000 | 2024-10-24…2026-09-24 (481) | 1 д | WORK@0bc436a0 m1_nav_base.csv | преп-рег, полный период | 5 bps + slip 10/25, BOXX 2 bps, Open t+1 | ff1f1735… |
| desyatka_earn_paper::desyatka_earn_paper | USD 10000 | 2024-10-04…2026-09-28 (496) | 2 д | WORK@6b6ef27871 replay.py, slip 10; повторяет replay_slip10.json точно | IS (канон выбран сеткой на этом окне) | 5 bps + slip 10, Open t+1 | b35524b1… |
| three_robots_okx_nasdaq_1h::paper_block2 | USDT 10000 | 2026-05-01…2026-10-14 (113) | 1 д | WORK@8967c62725 run_block2_livelike_backtest.py, перезапуск (Yahoo 730d) | IS до 2026-09-08 (заморозка), OOS 09-08…10-14 | 3 bps на |Δpos|, без funding | b4e51ee5… |
| cycle_6040_paper::cycle_6040_paper | RUB 1 000 000 | 2016-09-29…2026-09-29 (3653) | 2 д | WORK@bc8e4c1f nav_replica.csv (книга model; replay робота = реплике) | IS | фонды 1,3%/0,9% год., fee 0,10% | 9f17a64a… |
| rf_conservative_comon::rf_conservative_comon | RUB 50 000 | 2019-09-30…2026-09-29 (1755) | 2 д | WORK@67c19d7f golden_account_50k.csv (робот 8ab98f9 побайтно) | IS (половины есть) | 6 bps, целые паи | 9c06cacb… |

Нет серии: v6b1 (look-ahead канона), who_pays ×5 (ждём экспорт деплоера), forts_adr ×2, pump_radar, young_bounce, eth_okx_moex, cny_mom_h360, rf_bonds_rate_cycle, mayak ×4 (см. отчёт, триаж).
