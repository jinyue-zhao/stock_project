import json
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent

INPUT_JSON = BASE_DIR / "data" / "ranking_source.json"
OUTPUT_JSON = BASE_DIR / "data" / "stock_ranking.json"

TOP_N = 100


def safe_number(value, default=0):
    try:
        if value is None:
            return default

        if pd.isna(value):
            return default

        return float(value)

    except (TypeError, ValueError):
        return default


def normalize_stock_id(value):
    if value is None:
        return ""

    return str(value).replace(".0", "").strip().zfill(4)


def load_source_data():
    if not INPUT_JSON.exists():
        raise FileNotFoundError(f"找不到輸入資料：{INPUT_JSON}")

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    if not isinstance(data, list):
        raise ValueError("ranking_source.json 格式錯誤，最外層應該是 list")

    if len(data) == 0:
        raise ValueError("ranking_source.json 是空的，無法產生排行榜")

    df = pd.DataFrame(data)

    required_columns = [
        "date",
        "stock_id",
        "stock_name",
        "close",
        "high",
        "low",
        "volume",
        "total_inst_net_buy",
        "foreign_net_buy",
        "investment_trust_net_buy",
        "margin_balance",
        "turnover_rate",
        "inst_total_ratio",
        "investment_trust_ratio",
        "price_change_pct",
    ]

    for col in required_columns:
        if col not in df.columns:
            df[col] = None

    df["date"] = df["date"].astype(str).str.slice(0, 10)
    df["stock_id"] = df["stock_id"].apply(normalize_stock_id)

    numeric_columns = [
        "close",
        "open",
        "high",
        "low",
        "volume",
        "price_change",
        "price_change_pct",
        "foreign_net_buy",
        "investment_trust_net_buy",
        "dealer_net_buy",
        "total_inst_net_buy",
        "margin_balance",
        "short_balance",
        "issued_shares",
        "market_cap",
        "turnover_rate",
        "amplitude_pct",
        "inst_total_ratio",
        "foreign_buy_ratio",
        "investment_trust_ratio",
        "inst_to_issued_ratio",
    ]

    for col in numeric_columns:
        if col in df.columns:
            df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.dropna(subset=["date", "stock_id", "close"])
    df = df.drop_duplicates(subset=["date", "stock_id"], keep="last")

    df = df.sort_values(["stock_id", "date"]).reset_index(drop=True)

    return df


def add_technical_columns(df):
    """
    計算 MA5、MA10、MA20、20 日最高價、5 日均量、前一日法人與融資資料。
    """

    result = []

    for stock_id, group in df.groupby("stock_id", sort=False):
        group = group.sort_values("date").copy()

        group["ma5"] = group["close"].rolling(window=5, min_periods=1).mean()
        group["ma10"] = group["close"].rolling(window=10, min_periods=1).mean()
        group["ma20"] = group["close"].rolling(window=20, min_periods=1).mean()

        group["high_20d"] = group["high"].rolling(window=20, min_periods=1).max()
        group["vol_ma5"] = group["volume"].rolling(window=5, min_periods=1).mean()

        group["prev_foreign_net_buy"] = group["foreign_net_buy"].shift(1)
        group["prev_margin_balance"] = group["margin_balance"].shift(1)

        group["prev_total_inst_net_buy"] = group["total_inst_net_buy"].shift(1)
        group["prev2_total_inst_net_buy"] = group["total_inst_net_buy"].shift(2)

        group["prev_investment_trust_net_buy"] = group["investment_trust_net_buy"].shift(1)

        result.append(group)

    return pd.concat(result, ignore_index=True)


def calculate_inst_buy_streak(row):
    today = safe_number(row.get("total_inst_net_buy"))
    prev1 = safe_number(row.get("prev_total_inst_net_buy"))
    prev2 = safe_number(row.get("prev2_total_inst_net_buy"))

    if today > 0 and prev1 > 0 and prev2 > 0:
        return 3

    if today > 0 and prev1 > 0:
        return 2

    if today > 0:
        return 1

    return 0


def calculate_chip_score(row):
    """
    籌碼穩定度：40 分
    1-A 法人連續買超：10
    1-B 法人買超佔比：10
    1-C 投信認養度：10
    1-D 外資空翻多：10
    """

    score = 0
    details = {}

    # 1-A 法人連續買超天數
    inst_streak = calculate_inst_buy_streak(row)

    if inst_streak >= 3:
        streak_score = 10
    elif inst_streak == 2:
        streak_score = 7
    elif inst_streak == 1:
        streak_score = 4
    else:
        streak_score = 0

    score += streak_score
    details["inst_buy_streak_score"] = streak_score
    details["inst_buy_streak_days"] = inst_streak

    # 1-B 法人買超佔比
    inst_ratio = safe_number(row.get("inst_total_ratio"))

    if inst_ratio >= 0.20:
        concentration_score = 10
    elif inst_ratio >= 0.10:
        concentration_score = 7
    elif inst_ratio >= 0.05:
        concentration_score = 4
    else:
        concentration_score = 0

    score += concentration_score
    details["inst_concentration_score"] = concentration_score

    # 1-C 投信認養度
    trust_today = safe_number(row.get("investment_trust_net_buy"))
    trust_prev = safe_number(row.get("prev_investment_trust_net_buy"))
    trust_ratio = safe_number(row.get("investment_trust_ratio"))

    if trust_today > 0 and trust_prev > 0 and trust_ratio > 0.02:
        trust_score = 10
    else:
        trust_score = 0

    score += trust_score
    details["trust_recognition_score"] = trust_score

    # 1-D 外資空翻多
    foreign_today = safe_number(row.get("foreign_net_buy"))
    foreign_prev = safe_number(row.get("prev_foreign_net_buy"))

    if foreign_prev < 0 and foreign_today > 0:
        foreign_reversal_score = 10
    else:
        foreign_reversal_score = 0

    score += foreign_reversal_score
    details["foreign_reversal_score"] = foreign_reversal_score

    return score, details


def calculate_price_score(row):
    """
    價格動能：25 分
    2-A 均線多頭排列：10
    2-B 近期相對強度：5
    2-C 單日漲幅強度：10
    """

    score = 0
    details = {}

    close = safe_number(row.get("close"))
    ma5 = safe_number(row.get("ma5"))
    ma10 = safe_number(row.get("ma10"))
    ma20 = safe_number(row.get("ma20"))
    high_20d = safe_number(row.get("high_20d"))
    price_change_pct = safe_number(row.get("price_change_pct"))

    # 2-A 均線多頭排列
    if close > ma5 > ma10 > ma20:
        bullish_score = 10
    else:
        bullish_score = 0

    score += bullish_score
    details["bullish_alignment_score"] = bullish_score

    # 2-B 近期相對強度
    if high_20d > 0:
        relative_strength_score = min((close / high_20d) * 5, 5)
    else:
        relative_strength_score = 0

    relative_strength_score = round(relative_strength_score, 2)

    score += relative_strength_score
    details["relative_strength_score"] = relative_strength_score

    # 2-C 單日漲幅強度
    if price_change_pct > 3:
        surge_score = 10
    elif price_change_pct >= 1:
        surge_score = 5
    else:
        surge_score = 0

    score += surge_score
    details["price_surge_score"] = surge_score

    return round(score, 2), details


def calculate_volume_score(row):
    """
    價量與換手率：20 分
    3-A 成交量增比：7
    3-B 量價配合度：7
    3-C 換手率：6
    """

    score = 0
    details = {}

    volume = safe_number(row.get("volume"))
    vol_ma5 = safe_number(row.get("vol_ma5"))
    price_change_pct = safe_number(row.get("price_change_pct"))
    turnover_rate = safe_number(row.get("turnover_rate"))

    # 3-A 成交量增比
    if vol_ma5 > 0 and volume > vol_ma5 * 1.5:
        volume_spike_score = 7
    elif vol_ma5 > 0 and volume > vol_ma5:
        volume_spike_score = 4
    else:
        volume_spike_score = 0

    score += volume_spike_score
    details["volume_spike_score"] = volume_spike_score

    # 3-B 量價配合度
    if price_change_pct > 0 and vol_ma5 > 0 and volume > vol_ma5:
        pv_synergy_score = 7
    else:
        pv_synergy_score = 0

    score += pv_synergy_score
    details["price_volume_synergy_score"] = pv_synergy_score

    # 3-C 換手率
    if turnover_rate > 1:
        turnover_score = 6
    else:
        turnover_score = 0

    score += turnover_score
    details["turnover_score"] = turnover_score

    return score, details


def calculate_psych_score(row):
    """
    市場心理與風險：15 分
    4-A K 線形態位階：5
    4-B 融資減肥訊號：10
    """

    score = 0
    details = {}

    close = safe_number(row.get("close"))
    high = safe_number(row.get("high"))
    low = safe_number(row.get("low"))

    margin_today = safe_number(row.get("margin_balance"))
    margin_prev = safe_number(row.get("prev_margin_balance"))
    total_inst_net_buy = safe_number(row.get("total_inst_net_buy"))

    # 4-A K 線形態位階
    if high > low:
        candle_score = ((close - low) / (high - low)) * 5
        candle_score = max(0, min(candle_score, 5))
    else:
        candle_score = 0

    candle_score = round(candle_score, 2)

    score += candle_score
    details["candle_finish_score"] = candle_score

    # 4-B 融資減肥訊號
    if margin_today < margin_prev and total_inst_net_buy > 0:
        margin_reduction_score = 10
    else:
        margin_reduction_score = 0

    score += margin_reduction_score
    details["margin_reduction_score"] = margin_reduction_score

    return round(score, 2), details


def calculate_scores(row):
    chip_score, chip_details = calculate_chip_score(row)
    price_score, price_details = calculate_price_score(row)
    volume_score, volume_details = calculate_volume_score(row)
    psych_score, psych_details = calculate_psych_score(row)

    total_score = chip_score + price_score + volume_score + psych_score
    total_score = round(total_score, 2)

    details = {}
    details.update(chip_details)
    details.update(price_details)
    details.update(volume_details)
    details.update(psych_details)

    return chip_score, price_score, volume_score, psych_score, total_score, details


def main():
    df = load_source_data()
    df = add_technical_columns(df)

    latest_date = sorted(df["date"].dropna().unique(), reverse=True)[0]

    latest_df = df[df["date"] == latest_date].copy()

    ranking_rows = []

    for _, row in latest_df.iterrows():
        chip_score, price_score, volume_score, psych_score, total_score, details = calculate_scores(row)

        item = row.to_dict()

        item["chip_score"] = chip_score
        item["price_score"] = price_score
        item["volume_score"] = volume_score
        item["psych_score"] = psych_score
        item["total_score"] = total_score
        item["score"] = total_score
        item["score_details"] = details

        ranking_rows.append(item)

    ranking_df = pd.DataFrame(ranking_rows)

    ranking_df = ranking_df.sort_values(
        by=[
            "total_score",
            "chip_score",
            "price_score",
            "volume_score",
            "total_inst_net_buy",
            "price_change_pct",
            "volume",
        ],
        ascending=[False, False, False, False, False, False, False]
    )

    ranking_df = ranking_df.head(TOP_N)

    ranking_df = ranking_df.astype(object).where(pd.notnull(ranking_df), None)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(
            ranking_df.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
            allow_nan=False
        )

    print(f"已產生：{OUTPUT_JSON}")
    print(f"資料日期：{latest_date}")
    print(f"排行筆數：{len(ranking_df)}")

    if len(df["date"].unique()) < 20:
        print("提醒：ranking_source.json 少於 20 個交易日，MA20 與 20 日高點參考性較低。")


if __name__ == "__main__":
    main()