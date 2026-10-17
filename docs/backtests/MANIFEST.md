# Дневные бэктесты для склейки «Бэктест и бумага» (portfolio-krsk)

Собрано 2026-10-17 (UTC+7), бэктестер. Только чтение: торговые боты, хост `ihor-eu-bots` и живые счета не трогал, в git ничего не пушил.

Источники, которые проверены:
- portfolio-krsk `master` @ `8a3ecdd8aaf4f310f04a11323a98a7e9c7067806`: `public/data/history.json` (старт бумаги = первая точка ряда), `latest.json`, `src/stitchEquity.js`, `docs/patches/portal-1586bb0.patch`.
- WORK `main` @ `0bc436a0b2062fc3862b12a4e2c291b7f8c828fd` (через GitHub API, read-only) + локальная копия `/workspace/WORK-agents-edit` @ `13ecceaa` (2026-09-19).
- trend-analysis, mstr_boxx, work_finam, macromonitor (деревья файлов через GitHub API).
- Бокс: `/workspace`, `/home/box` (v6b_kit*, cny_*, okx_*, creative_group, grail_lev, visible14_bt, v431_bt и др.).

Схема `backtest_equity.v1` (по `src/stitchEquity.js`): `series["bot_id::account_id"].points = [{t: "YYYY-MM-DD", equity: >0}]`. Последняя точка не позже старта бумаги и разрыв не больше 7 дней (`GAP_DAYS = 7`). Для «год к году» нужно ≥12 месяцев, для средней за 36 месяцев — ≥48.

Итог: **1 «да» из 22** (oac_paper). Остальные 21 — «нет».

| ключ | да/нет | источник + sha | старт. капитал | IS/WF | издержки | первый / последний день | старт бумаги | разрыв | причина «нет» |
|---|---|---|---|---|---|---|---|---|---|
| oac_paper::oac_paper | **да** | WORK@0bc436a `docs/reports/artifacts/opt_top20_member_persist_20260925/m1_nav_base.csv` (blob b78545b8), код `quant/research/opt_top20_e1_honest/m1.py` (blob 9f2771bf), MCfg по умолчанию = «M1 base»; совпадает 1:1 с колонкой «M1 члены топ-20 (честно)» в `equity_occ_window.csv` (blob 124def29), макс. расхождение 0.0. CSV sha256 ff1f1735…beab | 10 000 USD (индекс NAV×10 000, масштаб линейный) | весь период, параметры зафиксированы до прогона (K=15/20, max 10, guard «JPM и BTC > EMA100», иначе ×0,5); отдельный WF в `out_m1.json` есть, но этот ряд — не WF-склейка | комиссия 5 bps + проскальзывание 10 bps ($-оборот ≥200M) / 25 bps; BOXX 2 bps; исполнение Open t+1, полоса ±20% | 2024-10-24 / 2026-09-24 (481 торговый день США) | 2026-09-25 | 1 день | — (оговорки ниже) |
| v6b1::v6b1 | нет | WORK `docs/reports/artifacts/breakout_fib_v6b1_universe_20260904/V6b1_pdh_radar_universe.csv` (sha256 604fec2a…1676) | — | — | — | сделки 2020-02-12…2026-09-04 | 2026-10-15 | 41 день | Это список сделок, а не дневная эквити портфеля; канон бумаги (риск 1%, не больше двух позиций одновременно, без входа в бар выхода) в этом файле не применён. Свечи на боксе кончаются 2026-09-04, так что даже честный прогон даст разрыв 41 день > 7 |
| who_pays::paper_us_eq | нет | — | — | — | — | — | 2026-09-19 | — | Код и бэктест Who-Pays есть только на хосте ботов (`/opt/okx-bots`); ни в репозиториях, ни на боксе прогона нет |
| who_pays::paper_ru_eq | нет | — | — | — | — | — | 2026-09-19 | — | то же |
| who_pays::paper_forts | нет | — | — | — | — | — | 2026-09-19 | — | то же |
| who_pays::paper_crypto_spot | нет | — | — | — | — | — | 2026-09-19 | — | то же |
| who_pays::paper_crypto_perp | нет | — | — | — | — | — | 2026-09-19 | — | то же |
| forts_adr_adaptive::forts_adr_adaptive | нет | — | — | — | — | — | 2026-09-21 | — | Бэктеста ADR soft1_size_adr (плечо 6, стоп 0,75%, цель 1%) на боксе и в репозиториях нет |
| forts_adr_static::forts_adr_static | нет | — | — | — | — | — | 2026-09-19 | — | то же |
| pump_radar::pump_radar | нет | trend-analysis `pump_radar/` — сканер и отчёты, книги с эквити нет | — | — | — | — | 2026-09-18 | — | Нет дневного бэктеста эквити с лимитками ниже закрытия |
| three_robots_okx_nasdaq_1h::paper_block2 | нет | WORK `docs/reports/artifacts/blocks_prelive_working_20260907/paper_logs/block2/equity_curve.csv` (sha256 c62f91e4…cda8), `block2_equity.csv` (sha256 084b03d0…7195) | индекс 1.0 | — | — | 2026-06-12 / 2026-09-04 (часовой) | 2026-10-15 | 41 день | Разрыв 41 день > 7. Продлить можно, только заново скачав часовые данные OKX и Yahoo (на диске их нет). Кроме того, история SPCX-perp начинается с 2026-06, так что даже после продления ряд будет короче года |
| young_bounce_combo::young_bounce_combo | нет | — | — | — | — | — | 2026-09-23 | — | Бэктеста нет нигде |
| desyatka_earn_paper::desyatka_earn_paper | нет | trend-analysis `analysis/results/opt_top10_uw_earn_skip.json` (blob daa8175d) и restore10/regime | — | — | — | 2023-10-10…2026-09-09 (только метрики) | 2026-09-30 | 21 день | В JSON только метрики, дневной кривой нет; конец 2026-09-09 даёт разрыв 21 день; данных UW на боксе нет, перезапустить нельзя |
| cycle_6040_paper::cycle_6040_paper | нет | — | — | — | — | — | 2026-10-01 | — | Бэктеста правила cycle_53477 (DIVD/SBLB/LQDT) нигде нет |
| rf_conservative_comon::rf_conservative_comon | нет | — | — | — | — | — | 2026-10-01 | — | Бэктеста SBRB/LQDT 90/10 + SBMX нигде нет |
| eth_okx_moex::eth_okx_moex | нет | — | — | — | — | — | 2026-10-13 | — | Бэктеста «ETH OKX 1h → фьючерс ETH MOEX» нигде нет |
| cny_mom_h360::cny_mom_h360 | нет | — | — | — | — | — | 2026-10-12 | — | Бэктеста «Юань 360» нет (на боксе есть только часовые свечи CNY в `cny_jumps/data/h1_cny_front.parquet`, сам прогон — нет; новую стратегию не писал) |
| rf_bonds_rate_cycle::rf_bonds_rate_cycle | нет | — | — | — | — | — | 2026-10-09 | — | Бэктеста OBLG/SBRB 80/20 + CR нигде нет |
| mayak_imoex_lowvol10::mayak_imoex_lowvol10 | нет | — | — | — | — | — | 2026-10-06 | — | Дневного ряда бумажного движка нет. `mayak_10y_series.csv` и `track_2020_daily.csv` из записки не нашлись ни на боксе, ни в репозиториях, к которым есть доступ. `MAYAK.md` в trend-analysis — это другой «Маяк» (режим ROSN R-25) |
| mayak_imoex_mom10::mayak_imoex_mom10 | нет | — | — | — | — | — | 2026-10-06 | — | то же |
| mayak_imoex_mom10_lev15::mayak_imoex_mom10_lev15 | нет | — | — | — | — | — | 2026-10-06 | — | то же |
| mayak_imoex_mom10_lev2::mayak_imoex_mom10_lev2 | нет | — | — | — | — | — | 2026-10-06 | — | то же |

## oac_paper — проверки и оговорки
- Дневной ряд, 481 строка, торговые дни США. NaN нет, нулей нет, даты уникальны и возрастают. Самый длинный календарный пропуск 4 дня (2025-01-21, праздники).
- Самый большой дневной ход +8,8% 2025-04-09 — это реальный день рынка (отмена тарифов), не артефакт. Минимум −5,8%.
- Прогон через портальный `stitchEquity` (код из репозитория, ряд из history.json): `ok=true`, стык 2026-09-24 → 2026-09-25, 25 месяцев, 13 столбиков «год к году», `sma36 = null`: ряда меньше 48 месяцев, средняя за 3 года не соберётся.
- Правила m1.py совпадают с описанием бумажного бота в latest.json и паспорте: топ-20 OCC, раз в неделю до 10 имён с ≥15 из 20 сессий, по 10%, при JPM или BTC ниже EMA100 — 5% на имя, остаток в BOXX. Код самого бумажного бота я не видел (он на хосте), поэтому совпадение подтверждено по правилам, а не по коду.
- Продлить назад до ~2022-09 не могу: m1.py читает `/tmp/e1_honest/occ_panel_all.parquet` (OCC за 2024-09…), на боксе этих данных нет. `m1_proxy10y_navs.csv` строится по обороту акций, а не по OCC, то есть это другая книга, и в склейку я его не ставил.

## Файлы
- `oac_paper__oac_paper.csv`: date,equity
- `backtests.json`: черновик `backtest_equity.v1` с одним рядом `oac_paper::oac_paper` (points `{t, equity}` плюс справочные поля currency/initial_equity/source/costs; портал читает только `points`)
