@echo off
chcp 65001

cd /d C:\Users\user\OneDrive\Desktop\stock_project_web

echo ============================== >> crawler_log.txt
echo Start update: %date% %time% >> crawler_log.txt
echo ============================== >> crawler_log.txt

echo [1/4] 更新今日股票資料 >> crawler_log.txt
python stock_crawler.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo stock_crawler.py failed >> crawler_log.txt
    exit /b 1
)

echo [2/4] 修正歷史漲跌幅 >> crawler_log.txt
python repair_price_change_pct.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo repair_price_change_pct.py failed >> crawler_log.txt
    exit /b 1
)

echo [3/4] 產生排行榜與全部分數 >> crawler_log.txt
python generate_ranking_json.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo generate_ranking_json.py failed >> crawler_log.txt
    exit /b 1
)

echo [4/4] 產生圖表資料 >> crawler_log.txt
python generate_chart_data.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo generate_chart_data.py failed >> crawler_log.txt
    exit /b 1
)

echo [5/5] 上傳到 GitHub >> crawler_log.txt
git add . >> crawler_log.txt 2>&1
git commit -m "Auto update stock data" >> crawler_log.txt 2>&1
git push >> crawler_log.txt 2>&1

echo Finish update: %date% %time% >> crawler_log.txt
echo. >> crawler_log.txt