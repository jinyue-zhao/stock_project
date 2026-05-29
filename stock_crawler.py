# =========================================================
# TPEx 上櫃股票資料爬蟲
#
# 執行方式：
#   每日更新：python stock_crawler.py
#   歷史補抓：python stock_crawler.py backfill 30
# =========================================================

import requests
import pandas as pd
import sqlite3
import json
import time
import sys

from datetime import datetime, timedelta

try:
    import twstock
except ImportError:
    twstock = None

# =========================================================
# API 設定
# =========================================================

# 三大法人
API_URL = (
    "https://www.tpex.org.tw/web/"
    "stock/3insti/daily_trade/"
    "3itrade_hedge_result.php"
)

# 每日行情（只回傳當日）
PRICE_API_URL = (
    "https://www.tpex.org.tw/web/"
    "stock/aftertrading/daily_close_quotes/"
    "stk_quote_result.php"
)

# 發行股數（OpenAPI，只有當日）
ISSUED_SHARES_API_URL = (
    "https://www.tpex.org.tw/openapi/v1/"
    "tpex_mainboard_daily_close_quotes"
)

# 融資融券
MARGIN_API_URL = (
    "https://www.tpex.org.tw/web/"
    "stock/margin_trading/"
    "margin_balance/margin_bal_result.php"
)

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/136.0.0.0 Safari/537.36"
    )
}

TODAY_JSON_PATH = "data/tpex_stock_today.json"
HISTORY_JSON_PATH = "data/tpex_stock_history.json"

DAYS = 1   # 每日更新只抓當日

# =========================================================
# 安全轉換
# =========================================================

def safe_float(value):
    try:
        value = (
            str(value)
            .replace(",", "")
            .replace("+", "")
            .replace("X", "")
            .strip()
        )
        if value in ["---", "----", ""]:
            return None
        return float(value)
    except:
        return None


def safe_int(value):
    try:
        value = (
            str(value)
            .replace(",", "")
            .replace("+", "")
            .strip()
        )
        if value in ["---", "----", ""]:
            return None
        return int(float(value))
    except:
        return None

# =========================================================
# 找最近 N 個交易日
# =========================================================

def get_trading_days(target_days):

    trading_days = []
    current_date = datetime.today()

    print("\n===== 搜尋交易日 =====\n")

    while len(trading_days) < target_days:

        roc_year = current_date.year - 1911
        date_str = f"{roc_year}/{current_date.strftime('%m/%d')}"

        try:
            response = requests.get(
                API_URL,
                headers=HEADERS,
                params={
                    "l": "zh-tw",
                    "o": "json",
                    "se": "EW",
                    "t": "D",
                    "d": date_str,
                    "s": "0,asc"
                },
                timeout=20
            )

            data = response.json()

            if "tables" in data and data["tables"][0]["data"]:
                trading_days.append(current_date)
                print("找到交易日:", current_date.strftime("%Y-%m-%d"))
            else:
                print(current_date.strftime("%Y-%m-%d"), "休市")

        except Exception as e:
            print("交易日檢查失敗:", e)

        current_date -= timedelta(days=1)
        time.sleep(0.5)

    return sorted(trading_days)

# =========================================================
# 發行股數對照表
# =========================================================

def fetch_issued_shares_map():

    print("\n===== 抓取發行股數 =====\n")

    issued_map = {}

    try:
        response = requests.get(
            ISSUED_SHARES_API_URL,
            headers=HEADERS,
            timeout=30
        )

        for row in response.json():

            stock_id = str(
                row.get("SecuritiesCompanyCode", "")
            ).strip()

            capitals = safe_int(row.get("Capitals"))

            # Capitals 單位為元，/ 10 = 發行股數（千股）
            if stock_id and capitals is not None:
                issued_map[stock_id] = capitals / 10

        print(f"發行股數筆數：{len(issued_map)}")

    except Exception as e:
        print("發行股數失敗:", e)

    return issued_map

# =========================================================
# 三大法人
# =========================================================

def fetch_institutional_data(trading_days):

    session  = requests.Session()
    all_data = []

    print("\n===== 抓取三大法人 =====\n")

    for current_date in trading_days:

        roc_year = current_date.year - 1911
        date_str = f"{roc_year}/{current_date.strftime('%m/%d')}"

        try:
            response = session.get(
                API_URL,
                headers=HEADERS,
                params={
                    "l": "zh-tw",
                    "o": "json",
                    "se": "EW",
                    "t": "D",
                    "d": date_str,
                    "s": "0,asc"
                },
                timeout=20
            )

            rows = response.json()["tables"][0]["data"]

            print(f"{date_str} 法人筆數: {len(rows)}")

            for row in rows:
                try:
                    all_data.append({
                        "date":
                            current_date.strftime("%Y-%m-%d"),
                        "stock_id":
                            str(row[0]).strip(),
                        "stock_name":
                            str(row[1]).strip(),
                        "foreign_net_buy":
                            safe_int(row[4]),
                        "investment_trust_net_buy":
                            safe_int(row[10]),
                        "dealer_net_buy":
                            safe_int(row[22]),
                        "total_inst_net_buy":
                            safe_int(row[23]),
                    })
                except:
                    pass

        except Exception as e:
            print("法人失敗:", e)

        time.sleep(0.5)

    return pd.DataFrame(all_data)

# =========================================================
# 當日行情（TPEx API，只回傳當日）
# =========================================================

def fetch_price_data(trading_days):

    session  = requests.Session()
    all_data = []

    print("\n===== 抓取行情（當日）=====\n")

    for current_date in trading_days:

        roc_year = current_date.year - 1911
        date_str = f"{roc_year}/{current_date.strftime('%m/%d')}"

        success = False

        for retry in range(3):
            try:
                response = session.get(
                    PRICE_API_URL,
                    headers=HEADERS,
                    params={"l": "zh-tw", "o": "json", "d": date_str},
                    timeout=30
                )
                data    = response.json()
                success = True
                break
            except Exception as e:
                print(f"{date_str} 行情重試 {retry+1}/3:", e)
                time.sleep(3)

        if not success:
            print(f"{date_str} 行情最終失敗")
            continue

        try:
            rows = data["tables"][0]["data"]

            # 從 API 回傳的 date 取得真實交易日
            raw_date = data["tables"][0].get("date", "")
            try:
                parts           = raw_date.strip().split("/")
                actual_year     = int(parts[0]) + 1911
                actual_date_str = f"{actual_year}-{parts[1]}-{parts[2]}"
            except:
                actual_date_str = datetime.today().strftime("%Y-%m-%d")

            print(f"API 實際交易日: {actual_date_str}，行情筆數: {len(rows)}")

            for row in rows:
                try:
                    close = safe_float(row[2])
                    if close is None:
                        continue
                    all_data.append({
                        "date":         actual_date_str,
                        "stock_id":     str(row[0]).strip(),
                        "stock_name":   str(row[1]).strip(),
                        "close":        close,
                        "price_change": safe_float(row[3]),
                        "open":         safe_float(row[4]),
                        "high":         safe_float(row[5]),
                        "low":          safe_float(row[6]),
                        "volume":       safe_int(row[8]),
                    })
                except:
                    pass

        except Exception as e:
            print("行情解析失敗:", e)

        time.sleep(0.5)

    return pd.DataFrame(all_data)

# =========================================================
# 歷史行情（twstock，backfill 專用）
# =========================================================

def fetch_price_data_history(stock_ids, start_date, end_date):

    if twstock is None:
        print("請先安裝 twstock：pip install twstock")
        return pd.DataFrame()

    all_data = []

    months_needed = set()
    cur = datetime.strptime(start_date, "%Y-%m-%d")
    end = datetime.strptime(end_date,   "%Y-%m-%d")

    while cur <= end:
        months_needed.add((cur.year, cur.month))
        cur += timedelta(days=28)

    months_needed.add((end.year, end.month))
    months_needed = sorted(months_needed)

    print(
        f"\n===== twstock 歷史行情 =====\n"
        f"期間：{start_date} ~ {end_date}，"
        f"股票數：{len(stock_ids)}\n"
    )

    for idx, stock_id in enumerate(stock_ids):
        try:
            stock = twstock.Stock(stock_id)

            for year, month in months_needed:
                try:
                    stock.fetch(year, month)
                    time.sleep(0.2)
                except:
                    pass

            for i, d in enumerate(stock.date):
                date_str = d.strftime("%Y-%m-%d")
                if not (start_date <= date_str <= end_date):
                    continue
                try:
                    all_data.append({
                        "date":         date_str,
                        "stock_id":     stock_id,
                        "stock_name":   None,
                        "close":        stock.price[i],
                        "price_change": None,
                        "open":         stock.open[i],
                        "high":         stock.high[i],
                        "low":          stock.low[i],
                        "volume":       stock.capacity[i],
                    })
                except:
                    pass

            if (idx + 1) % 100 == 0:
                print(f"  行情進度：{idx+1} / {len(stock_ids)}")

            time.sleep(0.3)

        except Exception as e:
            print(f"  {stock_id} 失敗: {e}")

    return pd.DataFrame(all_data)

# =========================================================
# 融資融券
# =========================================================

def fetch_margin_data(trading_days):

    session  = requests.Session()
    all_data = []

    print("\n===== 抓取融資融券 =====\n")

    for current_date in trading_days:

        roc_year = current_date.year - 1911
        date_str = f"{roc_year}/{current_date.strftime('%m/%d')}"

        try:
            response = session.get(
                MARGIN_API_URL,
                headers=HEADERS,
                params={"l": "zh-tw", "o": "json", "d": date_str},
                timeout=20
            )

            rows = response.json()["tables"][0]["data"]

            print(f"{date_str} 融資融券筆數: {len(rows)}")

            for row in rows:
                try:
                    all_data.append({
                        "date":            current_date.strftime("%Y-%m-%d"),
                        "stock_id":        str(row[0]).strip(),
                        "margin_balance":  safe_int(row[12]),
                        "short_balance":   safe_int(row[15]),
                    })
                except:
                    pass

        except Exception as e:
            print("融資融券失敗:", e)

        time.sleep(0.5)

    return pd.DataFrame(all_data)

# =========================================================
# Merge
# =========================================================

def merge_data(price_df, inst_df, margin_df, issued_map):

    print("\n===== 合併資料 =====\n")

    df = price_df.merge(
        inst_df,
        on=["date", "stock_id", "stock_name"],
        how="left"
    )

    df = df.merge(
        margin_df,
        on=["date", "stock_id"],
        how="left"
    )

    # 發行股數
    df["issued_shares"] = df["stock_id"].map(issued_map)

    # 市值
    df["market_cap"] = df["close"] * df["issued_shares"]

    # 週轉率（%）
    df["turnover_rate"] = (
        df["volume"] / df["issued_shares"]
    ) * 100

    # 振幅（%）
    df["amplitude_pct"] = (
        (df["high"] - df["low"]) / df["close"]
    ) * 100

    # 漲跌幅（%）
    df["price_change_pct"] = (
        df["price_change"]
        / (df["close"] - df["price_change"])
    ) * 100

    # 法人佔成交量
    df["inst_total_ratio"] = (
        df["total_inst_net_buy"] / df["volume"]
    )

    # 外資佔成交量
    df["foreign_buy_ratio"] = (
        df["foreign_net_buy"] / df["volume"]
    )

    # 投信佔成交量
    df["investment_trust_ratio"] = (
        df["investment_trust_net_buy"] / df["volume"]
    )

    # 法人佔發行股數
    df["inst_to_issued_ratio"] = (
        df["total_inst_net_buy"] / df["issued_shares"]
    )

    print("Merge 完成")

    return df

# =========================================================
# 清洗
# =========================================================

def clean_data(df):

    print("\n===== 清洗資料 =====\n")

    df = df.drop_duplicates(subset=["date", "stock_id"])
    df = df.dropna(subset=["close"])
    df = df[df["stock_id"].str.len() == 4]
    df = df[
        ~df["stock_name"].str.contains(
            "|".join(["債", "特", "購", "售", "牛", "熊", "ETF"]),
            na=False
        )
    ]
    df = df[df["volume"] > 0]
    df = df[df["close"] > 0]
    df = df.reset_index(drop=True)

    print("清洗完成")

    return df

# =========================================================
# JSON
# =========================================================

def save_json(df):
    """
    同時產生：
    1. tpex_stock_today.json：只放今天資料，每次覆蓋
    2. tpex_stock_history.json：累積歷史資料，不覆蓋舊資料
    """

    import os

    # 確保 data 資料夾存在
    os.makedirs("data", exist_ok=True)

    # 先處理今日資料
    today_df = df.copy()
    today_df = today_df.astype(object).where(pd.notnull(today_df), None)

    with open(TODAY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(
            today_df.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
            allow_nan=False
        )

    print(f"今日 JSON 儲存完成：{TODAY_JSON_PATH}，共 {len(today_df)} 筆")

    # 再處理歷史資料
    if os.path.exists(HISTORY_JSON_PATH):
        try:
            old_df = pd.read_json(HISTORY_JSON_PATH)
            print(f"讀取舊歷史 JSON：{len(old_df)} 筆")
        except Exception as e:
            print("舊歷史 JSON 讀取失敗，改用空資料：", e)
            old_df = pd.DataFrame()
    else:
        old_df = pd.DataFrame()

    combined_df = pd.concat([old_df, df], ignore_index=True)

    combined_df = combined_df.drop_duplicates(
        subset=["date", "stock_id"],
        keep="last"
    )

    combined_df = combined_df.sort_values(
        by=["date", "stock_id"],
        ascending=[False, True]
    )

    combined_df = combined_df.astype(object).where(pd.notnull(combined_df), None)

    with open(HISTORY_JSON_PATH, "w", encoding="utf-8") as f:
        json.dump(
            combined_df.to_dict(orient="records"),
            f,
            ensure_ascii=False,
            indent=2,
            allow_nan=False
        )

    print(f"歷史 JSON 儲存完成：{HISTORY_JSON_PATH}，共 {len(combined_df)} 筆")

def save_sqlite(daily_df, stock_info_df):

    conn = sqlite3.connect(DB_NAME)

    # 自動重建表（schema 不符時刪掉重來）
    try:
        existing_cols = set(
            row[1] for row in
            conn.execute(
                "PRAGMA table_info(daily_stock_data)"
            ).fetchall()
        )
        new_cols = set(daily_df.columns)

        if not new_cols.issubset(existing_cols):
            print("偵測到欄位變更，重建資料表...")
            conn.execute("DROP TABLE IF EXISTS daily_stock_data")
            conn.commit()

    except Exception:
        pass

    # 刪除同日舊資料再寫入
    today = daily_df["date"].iloc[0]

    try:
        conn.execute(
            "DELETE FROM daily_stock_data WHERE date = ?",
            (today,)
        )
        conn.commit()
    except Exception:
        pass

    daily_df.to_sql(
        "daily_stock_data",
        conn,
        if_exists="append",
        index=False
    )

    stock_info_df.to_sql(
        "stock_info",
        conn,
        if_exists="replace",
        index=False
    )

    conn.close()

    print(f"SQLite 儲存完成（交易日：{today}）")

# =========================================================
# 驗證
# =========================================================

def verify_sqlite():

    conn = sqlite3.connect(DB_NAME)

    df = pd.read_sql("""
        SELECT date, stock_id, stock_name,
               close, volume, market_cap,
               turnover_rate, total_inst_net_buy,
               inst_to_issued_ratio
        FROM daily_stock_data
        LIMIT 10
    """, conn)

    print("\n===== SQLite 驗證 =====\n")
    print(df)

    conn.close()

# =========================================================
# 歷史補抓（backfill）
# 行情用 twstock，法人/融資券用 TPEx API
# =========================================================

def backfill_history(days=30):

    today      = datetime.today()
    end_date   = today.strftime("%Y-%m-%d")

    print(
        f"\n===== 歷史補抓 =====\n"
        f"目標：最近 {days} 個交易日\n"
    )

    # 1. 找 days 個交易日
    trading_days = get_trading_days(days)
    trading_days = sorted(trading_days)
    start_date   = trading_days[0].strftime("%Y-%m-%d")

    print(f"期間：{start_date} ~ {end_date}")
    print(f"交易日數：{len(trading_days)}")

    # 2. 法人歷史
    inst_df = fetch_institutional_data(trading_days)
    print(f"法人歷史筆數：{len(inst_df)}")

    # 3. 融資融券歷史
    margin_df = fetch_margin_data(trading_days)
    print(f"融資融券歷史筆數：{len(margin_df)}")

    if inst_df.empty:
        print("法人資料為空，中止")
        return

    # 4. 股票清單（4碼）
    stock_ids = [
        s for s in inst_df["stock_id"].unique().tolist()
        if len(str(s)) == 4
    ]
    print(f"股票數量：{len(stock_ids)} 支")

    # 5. 行情歷史（twstock）
    price_df = fetch_price_data_history(
        stock_ids, start_date, end_date
    )
    print(f"行情歷史筆數：{len(price_df)}")

    if price_df.empty:
        print("行情資料為空，中止")
        return

    # 補股票名稱
    name_map = (
        inst_df[["stock_id", "stock_name"]]
        .drop_duplicates("stock_id")
        .set_index("stock_id")["stock_name"]
        .to_dict()
    )
    price_df["stock_name"] = price_df["stock_id"].map(name_map)

    # 6. 發行股數
    issued_map = fetch_issued_shares_map()

    # 7. Merge
    df = merge_data(price_df, inst_df, margin_df, issued_map)

    # 8. 清洗
    df = clean_data(df)
    print(f"清洗後筆數：{len(df)}")

    # 9. 存入 SQLite
    conn = sqlite3.connect(DB_NAME)

    # 自動重建表（schema 不符時）
    table_dropped = False

    try:
        existing_cols = set(
            row[1] for row in
            conn.execute(
                "PRAGMA table_info(daily_stock_data)"
            ).fetchall()
        )
        new_cols = set(df.columns)

        if existing_cols and not new_cols.issubset(existing_cols):
            print("偵測到欄位變更，重建資料表...")
            conn.execute("DROP TABLE IF EXISTS daily_stock_data")
            conn.commit()
            table_dropped = True

    except Exception:
        pass

    # 表存在才需要刪除舊區間資料
    # 表剛被刪掉就不需要（to_sql 會自動建立）
    if not table_dropped:
        try:
            conn.execute(
                "DELETE FROM daily_stock_data "
                "WHERE date >= ? AND date <= ?",
                (start_date, end_date)
            )
            conn.commit()
        except Exception:
            pass

    df.to_sql(
        "daily_stock_data",
        conn,
        if_exists="append",
        index=False
    )

    # 更新 stock_info
    stock_info_df = (
        df[["stock_id", "stock_name", "issued_shares"]]
        .copy()
        .drop_duplicates(subset=["stock_id"])
    )

    stock_info_df.to_sql(
        "stock_info",
        conn,
        if_exists="replace",
        index=False
    )

    conn.close()

    save_json(df)

    print(
        f"\n===== 歷史補抓完成 ====="
        f"\n共 {len(df)} 筆"
        f"\n期間：{start_date} ~ {end_date}\n"
    )

# =========================================================
# 主程式（每日更新）
# =========================================================

def main():

    trading_days = get_trading_days(DAYS)

    issued_map = fetch_issued_shares_map()
    inst_df    = fetch_institutional_data(trading_days)
    price_df   = fetch_price_data(trading_days)
    margin_df  = fetch_margin_data(trading_days)

    df = merge_data(price_df, inst_df, margin_df, issued_map)
    df = clean_data(df)

    stock_info_df = (
        df[["stock_id", "stock_name", "issued_shares"]]
        .copy()
        .drop_duplicates(subset=["stock_id"])
    )

    print("\n===== 最終資料（前10筆）=====\n")
    print(
        df[[
            "date", "stock_id", "stock_name",
            "close", "volume", "market_cap",
            "turnover_rate", "total_inst_net_buy",
            "inst_to_issued_ratio"
        ]].head(10)
    )
    print(f"\n總筆數: {len(df)}")

    save_json(df)
    #save_sqlite(df, stock_info_df)
    #verify_sqlite()

    print("\n===== 全部完成 =====\n")

# =========================================================
# 執行入口
# =========================================================

if __name__ == "__main__":

    if len(sys.argv) >= 2 and sys.argv[1] == "backfill":

        days = int(sys.argv[2]) if len(sys.argv) >= 3 else 30

        backfill_history(days=days)

    else:

        main()