@echo off
chcp 65001

cd /d C:\Users\user\OneDrive\Desktop\stock_project_web

echo ==============================
echo 開始更新股票資料
echo ==============================

python stock_crawler.py

echo ==============================
echo 開始產生股票排行榜
echo ==============================

python generate_ranking_json.py

echo ==============================
echo 開始上傳到 GitHub
echo ==============================

git add data/tpex_stock_today.json data/tpex_stock_history.json data/stock_ranking.json
git commit -m "Update stock data"
git push

echo ==============================
echo 全部完成
echo ==============================

pause