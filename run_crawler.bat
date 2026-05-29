@echo off
chcp 65001

cd /d C:\Users\user\OneDrive\Desktop\stock_project_web

echo ============================== >> crawler_log.txt
echo Start update: %date% %time% >> crawler_log.txt
echo ============================== >> crawler_log.txt

python stock_crawler.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo stock_crawler.py failed >> crawler_log.txt
    exit /b 1
)

python generate_ranking_json.py >> crawler_log.txt 2>&1

if errorlevel 1 (
    echo generate_ranking_json.py failed >> crawler_log.txt
    exit /b 1
)

git add . >> crawler_log.txt 2>&1
git commit -m "Auto update stock data" >> crawler_log.txt 2>&1
git push >> crawler_log.txt 2>&1

echo Finish update: %date% %time% >> crawler_log.txt
echo. >> crawler_log.txt