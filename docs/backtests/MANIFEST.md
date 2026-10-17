# portfolio-krsk backtests — MANIFEST (2026-10-17, пакет 2)

Schema `backtest_equity.v1`, `backtests.json` sha256 1d72cc20…2268. Проверено portal `src/stitchEquity.js` (клон @8a3ecdd8): все 8 серий ok.

| key | валюта/старт | период | шов | источник | IS/WF | издержки | csv sha256 |
|---|---|---|---|---|---|---|---|
| oac_paper::oac_paper | USD 10 000 | 2024-10-24…2026-09-24 (481) | 1 д | WORK@0bc436a0 m1_nav_base.csv | параметры заданы заранее, весь период | 5 б.п. + проскальзывание 10/25 б.п., BOXX 2 б.п., Open t+1 | ff1f1735… |
| desyatka_earn_paper::desyatka_earn_paper | USD 10 000 | 2024-10-04…2026-09-28 (496) | 2 д | WORK@6b6ef27871 replay.py, slip 10 | IS | 5 б.п. + 10 б.п., Open t+1 | b35524b1… |
| three_robots_okx_nasdaq_1h::paper_block2 | USDT 10 000 | 2026-05-01…2026-10-14 (113) | 1 д | WORK@8967c62725 run_block2_livelike_backtest.py, перезапуск | IS до 09-08, OOS 09-08…10-14 | 3 б.п. на \|Δpos\|; funding нет (см. ниже) | b4e51ee5… |
| cycle_6040_paper::cycle_6040_paper | RUB 1 000 000 | 2016-09-29…2026-09-29 (3653) | 2 д | WORK@bc8e4c1f nav_replica.csv | IS | фонды 1,3%/0,9% год., комиссия 0,10% | 9f17a64a… |
| rf_conservative_comon::rf_conservative_comon | RUB 50 000 | 2019-09-30…2026-09-29 (1755) | 2 д | WORK@67c19d7f golden_account_50k.csv | IS | 6 б.п., целые паи | 9c06cacb… |
| rf_bonds_rate_cycle::rf_bonds_rate_cycle | RUB 300 000 | 2019-06-21…2026-10-09, недельно (378) | 0 д | WORK@a752acc replay бота = эталон | IS (половины: 10,6% / 15,6% CAGR) | 12 б.п. облигации, 5 б.п. юань | 0be637ef… |
| eth_okx_moex::eth_okx_moex | RUB 300 000 | 2025-11-18…2026-10-10 (299) | 3 д | WORK@8b2d974c same_bar_hourly.csv, пересчёт со сдвигом знака на 1 час | IS | 2 б.п. на сторону, плечо 0,5 | ccdea652… |
| cny_mom_h360::cny_mom_h360 | RUB 300 000 | 2022-08-15…2026-10-09 (1053) | 3 д | пересчёт по ТЗ и коду WORK@ed937322 на ISS (лента 718/718) | IS | 1,47 б.п. на сторону + шаг 0,001; LQDT | 9b6ffe13… |

## Предупреждения
- **rf_bonds_rate_cycle:** в history.json первая точка бумаги равна 2,441925 (NAV на 1 ₽), дальше идёт 300 909 ₽. stitchEquity продолжает бумагу от уровня бэктеста, поэтому после склейки бумага показывает ~9·10¹⁰ ₽. Данные бумаги не правились. Пока эту точку не уберут, карточку показывать нельзя.
- **paper_block2:** бумажная книга `quant/bots/three_robots_live/paper_okx.py` (ветка block2-already-aligned-side-7605) не списывает ни funding, ни комиссию. Ряд оставлен как есть: 3 б.п., без funding. Бэктест и бумага расходятся по издержкам.
- **eth_okx_moex:** дробные контракты, без ГО и LQDT (дисконт на хосте неизвестен); перевод в рубли через ход фьючерса в процентах.
- **cny_mom_h360:** часы выходных исключены, как в ленте прогрева бота: с ними знак 14.10 расходится с бумагой, без них бумага 13–16.10 повторяется с точностью ~0,2%. Пай LQDT учтён как доход на весь капитал.

## Нет серии
v6b1: в каноне заглядывание вперёд, честный пересчёт не делался. who_pays ×5: ждём экспорт. mayak ×4, forts_adr ×2, young_bounce_combo, pump_radar — причины в отчёте пакета 2.
