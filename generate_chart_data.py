import json
from pathlib import Path

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent
INPUT_JSON = BASE_DIR / "data" / "ranking_source.json"
OUTPUT_JSON = BASE_DIR / "data" / "chart_data.json"

DAYS = 20


METRICS = {
    "close": "收盤價",
    "price_change_pct": "漲跌幅",
    "volume": "成交量",
    "foreign_net_buy": "外資買賣超",
    "investment_trust_net_buy": "投信買賣超",
    "dealer_net_buy": "自營商買賣超",
    "total_inst_net_buy": "三大法人合計",
    "inst_total_ratio": "法人/成交量",
    "turnover_rate": "週轉率",
    "margin_balance": "融資餘額",
}


def normalize_stock_id(value):
    return str(value).replace(".0", "").strip().zfill(4)


def main():
    if not INPUT_JSON.exists():
        raise FileNotFoundError(f"找不到 {INPUT_JSON}")

    df = pd.read_json(INPUT_JSON)

    df["date"] = df["date"].astype(str).str.slice(0, 10)
    df["stock_id"] = df["stock_id"].apply(normalize_stock_id)

    for col in METRICS.keys():
        if col not in df.columns:
            df[col] = None
        df[col] = pd.to_numeric(df[col], errors="coerce")

    df = df.sort_values(["stock_id", "date"])

    result = {}

    for stock_id, group in df.groupby("stock_id"):
        group = group.sort_values("date").tail(DAYS)

        if group.empty:
            continue

        stock_name = group["stock_name"].dropna().iloc[-1] if "stock_name" in group.columns else ""

        records = []

        for _, row in group.iterrows():
            item = {
                "date": row["date"],
            }

            for metric in METRICS.keys():
                value = row.get(metric)

                if pd.isna(value):
                    item[metric] = None
                else:
                    item[metric] = float(value)

            records.append(item)

        result[stock_id] = {
            "stock_id": stock_id,
            "stock_name": stock_name,
            "metrics": METRICS,
            "data": records,
        }

    with open(OUTPUT_JSON, "w", encoding="utf-8") as f:
        json.dump(
            result,
            f,
            ensure_ascii=False,
            indent=2,
            allow_nan=False,
        )

    print(f"已產生：{OUTPUT_JSON}")
    print(f"股票數量：{len(result)}")


if __name__ == "__main__":
    main()