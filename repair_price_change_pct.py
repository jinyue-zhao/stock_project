import json
from pathlib import Path

import pandas as pd


DATA_PATH = Path("data/ranking_source.json")


def main():
    if not DATA_PATH.exists():
        raise FileNotFoundError("找不到 data/ranking_source.json")

    with open(DATA_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)

    df = pd.DataFrame(data)

    df["date"] = df["date"].astype(str).str.slice(0, 10)
    df["stock_id"] = (
        df["stock_id"]
        .astype(str)
        .str.replace(".0", "", regex=False)
        .str.strip()
        .str.zfill(4)
    )

    df["close"] = pd.to_numeric(df["close"], errors="coerce")

    df = df.sort_values(["stock_id", "date"]).reset_index(drop=True)

    # 以前一個交易日收盤價計算漲跌
    df["prev_close"] = df.groupby("stock_id")["close"].shift(1)

    df["price_change"] = df["close"] - df["prev_close"]

    df["price_change_pct"] = (
        df["price_change"] / df["prev_close"]
    ) * 100

    # 第一筆沒有前一日資料，無法計算，保留為 0
    df["price_change"] = df["price_change"].fillna(0)
    df["price_change_pct"] = df["price_change_pct"].fillna(0)

    # 不需要輸出 prev_close
    df = df.drop(columns=["prev_close"])

    df = df.sort_values(
        ["date", "stock_id"],
        ascending=[False, True]
    ).reset_index(drop=True)

    df = df.astype(object).where(pd.notnull(df), None)

    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(
            df.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
            allow_nan=False
        )

    print("已重新計算 ranking_source.json 的歷史漲跌幅")
    print("總筆數：", len(df))
    print("日期數：", df["date"].nunique())


if __name__ == "__main__":
    main()