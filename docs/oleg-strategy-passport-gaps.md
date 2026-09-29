# Записка Олегу: чего не хватает для точных паспортов стратегий

Дата аудита: 2026-09-29. Репозиторий: `portfolio-krsk` (кабинет https://portfolio-krsk.vercel.app).

## Что это за файл

Это **не** описание алгоритмов и **не** результаты тестов. Это список пробелов: что кабинет уже знает достоверно и какие файлы/поля нужно приложить, чтобы паспорт перестал писать «нет данных».

Правило кабинета: неизвестное значение в интерфейсе = `нет данных`. Догадки и «похоже на…» в UI не попадают.

В этом репозитории **нет** исходников ботов, конфигов, журналов сделок теста, walk-forward окон, overlay/эталона. Снимки `public/data/latest.json` и `public/data/history.json` — бумажный учёт кабинета, их этот PR не меняет.

Если полный алгоритм живёт во внешнем репозитории (Macromonitor / сервер equity-ro / отдельные боты) — пришлите путь или выгрузку. Выдумывать по имени бота нельзя.

---

## Стратегии и счета на дашборде

Сейчас 9 стратегий (`bot_id`) и 13 счетов (`account_id`):

| # | bot_id | account_id | валюта кабинета | стартовый капитал в снимке |
|---|--------|------------|-----------------|----------------------------|
| 1 | `v6b1` | `v6b1` | USDT | 10 000 |
| 2 | `grail_b20_3x` | `grail_b20_3x` | USDT | 10 000 |
| 3 | `who_pays` | `paper_us_eq` | USD | нет данных (поле пустое) |
| 4 | `who_pays` | `paper_ru_eq` | RUB | нет данных |
| 5 | `who_pays` | `paper_forts` | RUB | нет данных |
| 6 | `who_pays` | `paper_crypto_spot` | USDT | нет данных |
| 7 | `who_pays` | `paper_crypto_perp` | USDT | нет данных |
| 8 | `forts_adr_adaptive` | `forts_adr_adaptive` | RUB | 1 500 000 |
| 9 | `forts_adr_static` | `forts_adr_static` | RUB | 1 500 000 |
| 10 | `pump_radar` | `pump_radar` | USDT | нет данных |
| 11 | `three_robots_okx_nasdaq_1h` | `paper_block2` | USDT | 10 000 |
| 12 | `young_bounce_combo` | `young_bounce_combo` | USDT | 10 000 |
| 13 | `oac_paper` | `oac_paper` | USD | 10 000 |

Live в кабинете не показываются (блок `excluded` снимка): `us_jpm_beta_live`, `three_robots_finam_live`, `three_robots_okx_nasdaq_1h` (пометка live OKX; на сайте только paper `paper_block2`), `three_robots_okx_spcx_btc_4h`.

---

## Что уже можно считать фактом (без выдумок)

Источник: `public/data/latest.json` (`manifest[].logic`, поля счетов, `note`), `public/data/history.json`, `src/strategyMeta.js`, `src/cashCurrency.js`, `src/uiCopy.js`.

| bot_id | Заполнено фактами |
|--------|-------------------|
| `v6b1` | OKX USDT-SWAP, бумага; сигнал на закрытии часа; вход если цена у дневного хая и «радар дня» включён; лонг на весь свободный кэш; стоп/тейк есть, но без уровней; капитал 10 000 USDT; эквити = кэш леджера после комиссий, маржа в positions, нереализованный pnl не переоценён |
| `grail_b20_3x` | **Пакет 2026-09-04 подключён.** OKX USDT-SWAP, корзина 20 без mega-cap, m5hard, confidence ≥55%, одна позиция, плечо 3×, буфер 57%, стоп ≤12%, min RR 1.0 stretch_tp, cross, overlays; книга full_lev3: CAGR 1029.7%, MaxDD 47.9%, PF 1.909, MAR 21.51, 468 сделок. Бумажная эквити кабинета — не эта книга |
| `who_pays` | пять счетов и площадок; допуск «биржа открыта + сигнал S2–S5 в latest.json»; валюты не складываются; бумага |
| `forts_adr_adaptive` | FORTS, бумага; раз в месяц один из трёх вариантов полос ADR; eod_flat (overnight нет); капитал 1 500 000 RUB; эквити восстановлен из jsonl fills |
| `forts_adr_static` | FORTS, бумага; фиксированные полосы ADR; лимит у нижней / лимит у верхней; тейк и стоп есть без уровней; к концу дня в ноль; капитал 1 500 000 RUB |
| `pump_radar` | OKX спот, бумага, раз в день; лимитки ниже закрытия; пока не исполнена — не позиция; капитал в снимке пустой |
| `three_robots_okx_nasdaq_1h` | OKX USDT-SWAP 1h; MSTR/TSLA/SPCX; бумага `paper_block2`; 10 000 USDT; сигнал с часа NASDAQ; новые сделки только в сессию NYSE 09:30–16:00 America/New_York, праздники закрыты; live на сайте не показывается |
| `young_bounce_combo` | Binance spot, бумага; 10 000 USDT; монеты 25–90 дней; паттерны crash / listing_dump; выход трейлинг или 10 дней |
| `oac_paper` | акции США, бумага, 10 000 USD; ежедневный топ-20 OCC; раз в неделю до 10 имён, 15/20 сессий, 10% на имя (5% если JPM или BTC < EMA100); остаток в BOXX; флаг `defence` без правил |

**Нет ни у одной стратегии, кроме `grail_b20_3x`:** отдельного пакета книги (algorithm/config/windows/costs). У grail есть замороженная книга LEV_1_VS_3 от 2026-09-04; у остальных по-прежнему нет файлов бэктеста.

**По-прежнему ни у одной (включая grail):** Sharpe, trades.csv, equity.csv ряда, полной сетки walk-forward, overlay-графика эквити. Бумажная кривая кабинета **не** называется бэктестом и **не** называется walk-forward.

---

## Минимум, который нужно приложить на каждую стратегию

Одинаковый набор (машиночитаемые пути/поля). Можно один архив на бота: `passports/<bot_id>/`.

```
required_artifacts:
  - path: passports/<bot_id>/algorithm.md
    purpose: полное описание алгоритма человеческим языком + псевдокод
  - path: passports/<bot_id>/config.json
    purpose: параметры с единицами (см. схему ниже)
  - path: passports/<bot_id>/trades.csv
    purpose: сделки теста или бумаги с меткой series=backtest|walkforward|paper
  - path: passports/<bot_id>/equity.csv
    purpose: кривая эквити той же series
  - path: passports/<bot_id>/windows.json
    purpose: границы train/test; пустой массив если теста не было
  - path: passports/<bot_id>/costs.json
    purpose: commission_bps, slippage_bps, currency, notes
  - path: passports/<bot_id>/capital.json
    purpose: initial_capital, currency, as_of
  - path: passports/<bot_id>/overlay.json
    purpose: эталон и метод сравнения; null если эталона нет
  - path: passports/<bot_id>/aggregation.json
    purpose: как считают метрики по окнам (median/mean/min, weights)
```

Обязательные поля внутри (если значения нет — явно `null`, не пропускать ключ):

```
fields:
  algorithm: { universe, timeframe, signal_source, entry, manage, exit, schedule, timezone }
  config: { name, value, unit, meaning }[]
  trades: { time_open, time_close, symbol, side, qty, px_open, px_close, commission, slippage, pnl }
  equity: { t, equity, series }
  windows: { id, role: train|test|oos, start, end }
  costs: { commission_bps, slippage_bps, commission_currency, model }
  capital: { initial_capital, currency }
  overlay: { kind, benchmark_id, compared_series, label_ru }
  aggregation: { method, windows_used, notes }
```

---

## Пробелы по стратегиям (машиночитаемо)

### v6b1

```yaml
bot_id: v6b1
known: [venue=OKX, instrument_type=USDT-SWAP, paper=true, tf=1h, entry=long_all_free_cash, gate=daily_high_and_day_radar, capital=10000 USDT]
missing_files:
  - passports/v6b1/algorithm.md
  - passports/v6b1/config.json
  - passports/v6b1/trades.csv
  - passports/v6b1/equity.csv
  - passports/v6b1/windows.json
  - passports/v6b1/costs.json
  - passports/v6b1/overlay.json
  - passports/v6b1/aggregation.json
missing_fields:
  - day_radar.definition
  - universe.symbols
  - stop_px_or_rule
  - take_px_or_rule
  - max_positions
  - leverage
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### grail_b20_3x

Пакет Олега от 2026-09-04 лежит в `passports/grail_b20_3x/` и читается лоадером `src/grailPassport.js`. Секция «Бэктест и проверка устойчивости» больше не пишет «Нужны данные для проверки»: показаны главная карточка `full_lev3` и окна 3× / справка 1×.

```yaml
bot_id: grail_b20_3x
pack_asof: 2026-09-04
known: [venue=OKX, market=USDT-SWAP, paper_or_prelive=true, not_live_marketing=true, leverage=3, no_5x=true, max_positions=1, buffer=0.57, max_sl=12pct, min_rr=1.0, rr_action=stretch_tp, td_mode=cross, signal=m5hard, min_confidence=0.55, causality=close_t_open_t1, universe=20_no_mega, fee_bps=5, slip_bps=2, overlays="capital_tp 12 / profit_lock 7.5+25 / camarilla 3.75", primary="full_lev3 CAGR 1029.7 MaxDD 47.9 PF 1.909 MAR 21.51 n=468"]
closed_by_this_pack:
  - passports/grail_b20_3x/algorithm.md
  - passports/grail_b20_3x/config.json
  - passports/grail_b20_3x/dashboard_card.json
  - passports/grail_b20_3x/dashboard_metrics.json
  - passports/grail_b20_3x/windows.json
  - passports/grail_b20_3x/windows.csv
  - passports/grail_b20_3x/costs.json
  - passports/grail_b20_3x/capital.json
  - passports/grail_b20_3x/overlay.json   # kind=null; только правила выхода, не график
  - passports/grail_b20_3x/aggregation.json
missing_files:
  - passports/grail_b20_3x/trades.csv
  - passports/grail_b20_3x/equity.csv
missing_fields:
  - sharpe
  - winrate
  - avg_win
  - avg_loss
  - vol_ann
  - walkforward.full_grid
  - overlay.benchmark_equity
honest_notes:
  - 2024H2 @ 3x PF≈1.074 — слабое окно, на сайте показано
  - paper-smoke / latest.json equity — не источник CAGR
  - 5x сознательно исключён
  - BTC/ETH/SOL/BNB/XRP в корзине нет
```

Как проверить после деплоя: открыть `#/s/grail_b20_3x`. В паспорте должны быть пять секций; в «Бэктест…» — дата книги 2026-09-04, CAGR 1029,7%, просадка 47,9%, PF 1,909, 468 сделок, дисклеймер рядом с CAGR, таблица окон 3× с подсвеченным 2024H2 (PF 1,074), справка 1×, фраза что кривая эквити теста не приложена. Ниже по странице бумажный график кабинета не должен подписываться как эта книга.

### who_pays

```yaml
bot_id: who_pays
accounts: [paper_us_eq, paper_ru_eq, paper_forts, paper_crypto_spot, paper_crypto_perp]
known: [paper=true, venues="US_EQ,RU_EQ,FORTS,CRYPTO_SPOT,CRYPTO_PERP", gate="market_open AND signal S2-S5 in latest.json", currencies_not_summed=true]
missing_files:
  - passports/who_pays/algorithm.md
  - passports/who_pays/config.json
  - passports/who_pays/trades.csv
  - passports/who_pays/equity.csv
  - passports/who_pays/windows.json
  - passports/who_pays/costs.json
  - passports/who_pays/capital.json
  - passports/who_pays/overlay.json
  - passports/who_pays/aggregation.json
missing_fields:
  - signal.S2
  - signal.S3
  - signal.S4
  - signal.S5
  - signal.source_path_in_latest_json
  - timeframe
  - entry.rule
  - manage.rules
  - exit.rules
  - position_size
  - leverage
  - paper_us_eq.initial_capital
  - paper_ru_eq.initial_capital
  - paper_forts.initial_capital
  - paper_crypto_spot.initial_capital
  - paper_crypto_perp.initial_capital
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### forts_adr_adaptive

```yaml
bot_id: forts_adr_adaptive
known: [venue=FORTS, paper=true, band_set=one_of_three_ADR, choose_every=month, eod_flat=true, capital=1500000 RUB, equity_from=jsonl_fills]
missing_files:
  - passports/forts_adr_adaptive/algorithm.md
  - passports/forts_adr_adaptive/config.json
  - passports/forts_adr_adaptive/trades.csv
  - passports/forts_adr_adaptive/equity.csv
  - passports/forts_adr_adaptive/windows.json
  - passports/forts_adr_adaptive/costs.json
  - passports/forts_adr_adaptive/overlay.json
  - passports/forts_adr_adaptive/aggregation.json
  - passports/forts_adr_adaptive/fills.jsonl
missing_fields:
  - adr.variant_1.width
  - adr.variant_2.width
  - adr.variant_3.width
  - adr.choose_rule
  - forts.symbols
  - entry.rule
  - stop_px_or_rule
  - take_px_or_rule
  - position_size
  - leverage
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### forts_adr_static

```yaml
bot_id: forts_adr_static
known: [venue=FORTS, paper=true, bands=fixed_ADR, entry="limit_buy_lower / limit_sell_upper", has_stop=true, has_take=true, eod_flat=true, capital=1500000 RUB]
missing_files:
  - passports/forts_adr_static/algorithm.md
  - passports/forts_adr_static/config.json
  - passports/forts_adr_static/trades.csv
  - passports/forts_adr_static/equity.csv
  - passports/forts_adr_static/windows.json
  - passports/forts_adr_static/costs.json
  - passports/forts_adr_static/overlay.json
  - passports/forts_adr_static/aggregation.json
missing_fields:
  - adr.fixed_width
  - forts.symbols
  - stop_px_or_rule
  - take_px_or_rule
  - position_size
  - leverage
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### pump_radar

```yaml
bot_id: pump_radar
known: [venue=OKX_SPOT, paper=true, schedule=once_per_day, order=limit_below_close, pending_is_not_position=true]
missing_files:
  - passports/pump_radar/algorithm.md
  - passports/pump_radar/config.json
  - passports/pump_radar/trades.csv
  - passports/pump_radar/equity.csv
  - passports/pump_radar/windows.json
  - passports/pump_radar/costs.json
  - passports/pump_radar/capital.json
  - passports/pump_radar/overlay.json
  - passports/pump_radar/aggregation.json
missing_fields:
  - radar.selection_rule
  - universe.symbols
  - limit.offset_from_close
  - exit.rule
  - position_size
  - initial_capital
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### three_robots_okx_nasdaq_1h

```yaml
bot_id: three_robots_okx_nasdaq_1h
account_id: paper_block2
known: [venue=OKX, symbols="MSTR-USDT-SWAP,TSLA-USDT-SWAP,SPCX-USDT-SWAP", tf=1h, paper=true, capital=10000 USDT, signal_bar=NASDAQ_1h, session="NYSE 09:30-16:00 America/New_York, holidays closed"]
missing_files:
  - passports/three_robots_okx_nasdaq_1h/algorithm.md
  - passports/three_robots_okx_nasdaq_1h/config.json
  - passports/three_robots_okx_nasdaq_1h/trades.csv
  - passports/three_robots_okx_nasdaq_1h/equity.csv
  - passports/three_robots_okx_nasdaq_1h/windows.json
  - passports/three_robots_okx_nasdaq_1h/costs.json
  - passports/three_robots_okx_nasdaq_1h/overlay.json
  - passports/three_robots_okx_nasdaq_1h/aggregation.json
missing_fields:
  - signal.formula
  - entry.rule
  - manage.rules
  - exit.rules
  - position_size
  - leverage
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
external_repos_needed:
  - код «трёх роботов» / Macromonitor (в portfolio-krsk исходника нет)
```

### young_bounce_combo

```yaml
bot_id: young_bounce_combo
known: [venue=Binance_spot, paper=true, capital=10000 USDT, age_days="25-90", patterns="crash,listing_dump", exit="trailing OR 10 days"]
missing_files:
  - passports/young_bounce_combo/algorithm.md
  - passports/young_bounce_combo/config.json
  - passports/young_bounce_combo/trades.csv
  - passports/young_bounce_combo/equity.csv
  - passports/young_bounce_combo/windows.json
  - passports/young_bounce_combo/costs.json
  - passports/young_bounce_combo/overlay.json
  - passports/young_bounce_combo/aggregation.json
missing_fields:
  - age.anchor  # listing date vs first bar
  - crash.threshold
  - listing_dump.threshold
  - trailing.offset
  - trailing.activation
  - holding_days.calendar  # trading days vs calendar
  - position_size
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

### oac_paper

```yaml
bot_id: oac_paper
known: [market=US_EQ, paper=true, capital=10000 USD, daily_top=OCC_volume_20, weekly_n=10, persist="15/20 sessions", weight=0.10, weight_if_jpm_or_btc_below_ema100=0.05, cash_vehicle=BOXX, defence_flag=exists]
missing_files:
  - passports/oac_paper/algorithm.md
  - passports/oac_paper/config.json
  - passports/oac_paper/trades.csv
  - passports/oac_paper/equity.csv
  - passports/oac_paper/windows.json
  - passports/oac_paper/costs.json
  - passports/oac_paper/overlay.json
  - passports/oac_paper/aggregation.json
missing_fields:
  - rebalance.weekday
  - ema100.timeframe
  - defence.rules
  - exit_or_rotation.rule
  - occ.data_source
  - commission_bps
  - slippage_bps
  - walkforward.windows
  - overlay.benchmark
```

---

## Рекомендуемая схема JSON/CSV

Ниже **только образец формата**. Числа и тикеры **вымышленные**. Не копировать в кабинет как факт.

### SAMPLE `config.json`

```json
{
  "_comment": "SAMPLE — вымышленный пример, не данные кабинета",
  "bot_id": "example_bot",
  "parameters": [
    { "name": "lookback", "value": 20, "unit": "bars", "meaning": "окно расчёта сигнала" },
    { "name": "leverage", "value": 1, "unit": "x", "meaning": "без плеча" },
    { "name": "commission", "value": 4, "unit": "bps", "meaning": "комиссия теста туда-обратно / 2" }
  ]
}
```

### SAMPLE `windows.json`

```json
{
  "_comment": "SAMPLE — вымышленные окна, не walk-forward кабинета",
  "kind": "walk_forward",
  "aggregation": { "method": "median", "windows_used": ["w1", "w2"] },
  "windows": [
    { "id": "w1", "role": "train", "start": "2020-01-01", "end": "2022-12-31" },
    { "id": "w1", "role": "test", "start": "2023-01-01", "end": "2023-12-31" }
  ]
}
```

### SAMPLE `costs.json` + `capital.json` + `overlay.json`

```json
{
  "_comment": "SAMPLE — вымышленные издержки и эталон",
  "costs": { "commission_bps": 4, "slippage_bps": 2, "commission_currency": "USDT", "model": "fixed_bps_per_side" },
  "capital": { "initial_capital": 10000, "currency": "USDT", "as_of": "2020-01-01" },
  "overlay": {
    "kind": "equity_vs_benchmark",
    "benchmark_id": "buy_and_hold_btc",
    "compared_series": ["oos_equity", "benchmark_equity"],
    "label_ru": "SAMPLE: эквити OOS против buy-and-hold BTC (вымысел)"
  }
}
```

### SAMPLE `trades.csv`

```csv
# SAMPLE — вымышленные сделки, не журнал кабинета
time_open,time_close,symbol,side,qty,px_open,px_close,commission,slippage,pnl,series
2023-02-01T15:00:00Z,2023-02-01T18:00:00Z,EXAMPLE-USDT-SWAP,long,1,100,101,0.04,0.02,0.94,walkforward
```

### SAMPLE `equity.csv`

```csv
# SAMPLE — вымышленная кривая теста
t,equity,series
2023-01-01T00:00:00Z,10000,walkforward_oos
2023-12-31T00:00:00Z,10100,walkforward_oos
```

Для `grail_b20_3x` реальные числа окон уже в пакете: секция заполнена как историческая книга, не как walk-forward. Когда появятся **trades.csv / equity.csv / полная сетка train/test**, можно добавить журнал, кривую теста и устойчивость по окнам обучения. Если будет overlay-ряд — подписать, **что с чем сравнивается**. Обычный бэктест на всей истории walk-forward называть нельзя. Для остальных стратегий секция по-прежнему «Нужны данные для проверки».

---

## Внешние репозитории

В GitHub-аккаунте `varshavskiy1-beep` на момент аудита виден только `portfolio-krsk`. Исходники ботов, Macromonitor и сервер equity-ro сюда не входят. Без выгрузки оттуда полный паспорт (формула сигнала, конфиг, тест) **не восстановить** — и кабинет это честно помечает «нет данных».
