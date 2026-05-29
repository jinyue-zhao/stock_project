import json
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parent

INPUT_JSON = BASE_DIR / "data" / "tpex_stock_today.json"
OUTPUT_JSON = BASE_DIR / "data" / "stock_ranking.json"

def safe_number(value, default=0):
    try:
        if value is None:
            return default
        return float(value)
    except (TypeError, ValueError):
        return default


def get_latest_date(data):
    dates = [
        item.get("date")
        for item in data
        if item.get("date")
    ]

    if not dates:
        return None

    return sorted(dates, reverse=True)[0]


def calculate_score(item):
    score = 0

    price_change_pct = safe_number(item.get("price_change_pct"))
    total_inst_net_buy = safe_number(item.get("total_inst_net_buy"))
    foreign_net_buy = safe_number(item.get("foreign_net_buy"))
    investment_trust_net_buy = safe_number(item.get("investment_trust_net_buy"))
    dealer_net_buy = safe_number(item.get("dealer_net_buy"))
    volume = safe_number(item.get("volume"))
    inst_total_ratio = safe_number(item.get("inst_total_ratio"))
    turnover_rate = safe_number(item.get("turnover_rate"))

    # 價格分數
    if price_change_pct > 0:
        score += 10
    if price_change_pct >= 2:
        score += 10
    if price_change_pct >= 5:
        score += 10

    # 三大法人合計買超分數
    if total_inst_net_buy > 0:
        score += 15
    if total_inst_net_buy >= 1_000:
        score += 10
    if total_inst_net_buy >= 10_000:
        score += 10
    if total_inst_net_buy >= 100_000:
        score += 10

    # 外資買超
    if foreign_net_buy > 0:
        score += 10

    # 投信買超
    if investment_trust_net_buy > 0:
        score += 10

    # 自營商買超
    if dealer_net_buy > 0:
        score += 5

    # 成交量分數
    if volume >= 100_000:
        score += 5
    if volume >= 500_000:
        score += 5
    if volume >= 1_000_000:
        score += 5

    # 法人買超占成交量比例
    if inst_total_ratio > 0:
        score += 5
    if inst_total_ratio >= 0.1:
        score += 5
    if inst_total_ratio >= 0.2:
        score += 5

    # 週轉率
    if turnover_rate >= 1:
        score += 5
    if turnover_rate >= 3:
        score += 5
    if turnover_rate >= 5:
        score += 5

    return score


def main():
    if not INPUT_JSON.exists():
        raise FileNotFoundError(f"找不到輸入資料：{INPUT_JSON}")

    with open(INPUT_JSON, "r", encoding="utf-8") as f:
        data = json.load(f)

    latest_date = get_latest_date(data)

    if latest_date is None:
        raise ValueError("找不到最新日期，請確認 tpex_stock.json 裡有 date 欄位")

    latest_data = [
        item for item in data
        if item.get("date") == latest_date
    ]

    ranking_data = []

    for item in latest_data:
        new_item = dict(item)
        new_item["score"] = calculate_score(item)
        ranking_data.append(new_item)

    ranking_data.sort(
        key=lambda item: (
            safe_number(item.get("score")),
            safe_number(item.get("total_inst_net_buy")),
            safe_number(item.get("price_change_pct")),
            safe_number(item.get("volume")),
        ),
        reverse=True
    )

    top_100 = ranking_data[:100]

    OUTPUT_JSON.parent.mkdir(parents=True, exist_ok=True)

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(top_100, f, ensure_ascii=False, indent=2)

    print(f"已產生：{OUTPUT_JSON}")
    print(f"資料日期：{latest_date}")
    print(f"排行筆數：{len(top_100)}")


if __name__ == "__main__":
    main()