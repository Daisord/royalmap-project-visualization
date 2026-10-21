---
name: royalmap-project-visualization
description: >
  建立或更新 RoyalMap 專案 Markdown 文件的離線 HTML 儀表板與可追溯 JSON Snapshot，呈現文件索引、工作狀態及驗收審查。
  適用於 RoyalMap 文件視覺化；一般程式碼審查、文件規劃及工作狀態變更由各自工作流處理。
---

# RoyalMap 專案視覺化

## 使用邊界

- 相容 RoyalMap 文件 Skill 2.1.0 的互通契約 v1。先讀 [references/data-contract.md](references/data-contract.md)；完整契約保存在 [references/visualization-contract.md](references/visualization-contract.md)，不需另一套 Skill 才能讀取。
- 使用者指定的 `_Documents/[專案名稱]/` 是來源根目錄；不得把 Repository 根目錄直接當成文件根目錄。先讀 README 索引與相關正式文件。
- Markdown 是正式來源，Snapshot 與 HTML 是衍生成果。不得因畫面需求更改 WU、AC、Review 或 Human Gate 的結論，也不得將使用者要求視覺化視為驗收接受。
- 第一版由 Agent 依來源語意整理工作資料，不以通用 Markdown 解析器猜測狀態。缺漏、歧義及未讀取內容使用 unknown／null 並留下來源與原因。

## 建立或更新

腳本需要 Node.js 22 或更新版本，僅使用內建模組。全域安裝與人工操作範例見 [README.md](README.md)。

- 以本次載入的 `SKILL.md` 所在目錄定位 `scripts/project.mjs`、references 與 assets，不能以目前專案目錄推定 Skill 路徑，也不要寫死使用者名稱或安裝位置。
- 下列 `[Skill根目錄]`、`[文件根目錄]`、`[草稿.json]` 均替換為絕對路徑，保留引號；可以直接從目標專案目錄執行，不需切換到 Skill 目錄。Evidence 參數仍依資料契約使用相對於文件根目錄的路徑。
- 文件根目錄須含 README.md；有多個 `_Documents/[專案名稱]/` 候選時，先確認使用者要處理哪個。草稿放在目標專案的暫存位置或系統暫存目錄，避免覆蓋其他專案的草稿。
- Skill 安裝目錄只供讀取腳本與模板；輸出固定寫入目標文件根目錄的 `06-Visualization/`。確認目標專案可寫；權限不足時依執行環境處理，不把輸出改寫到 Skill 安裝目錄。

1. 取得本次正式來源清單、雜湊及文件索引骨架，將輸出保存為工作用 JSON 草稿；避免放進五類正式文件目錄。來源若依賴本機證據檔案，將其相對路徑加在命令末端，一併記錄版本。

   ```sh
   node "[Skill根目錄]/scripts/project.mjs" capture "[文件根目錄]" > "[草稿.json]"
   ```

   PowerShell 請用 UTF-8 寫入，避免舊版重新導向產生 UTF-16：

   ```powershell
   node "[Skill根目錄]/scripts/project.mjs" capture "[文件根目錄]" | Set-Content -Encoding UTF8 "[草稿.json]"
   ```

2. 依 `data-contract.md` 填入 `work_units`、`coverage.work_units` 與 `issues`。優先讀工作單、必要 Evidence 及 Review／Human Gate 區段。保留 `sources`，來源改變時重新 capture 並重新核對結論，不能只換雜湊沿用舊判斷。
3. 建立儀表板：

   ```sh
   node "[Skill根目錄]/scripts/project.mjs" build "[文件根目錄]" "[草稿.json]"
   ```

   輸出固定為 `06-Visualization/index.html` 與 `06-Visualization/data/project-snapshot.json`。HTML 內嵌同一份 JSON，可直接離線開啟，不使用 CDN、後端或外部圖表服務。
4. 開啟 HTML 檢查桌面與窄螢幕：文字不截斷、表格可捲動、鍵盤可操作篩選、來源連結正確。核對至少一筆 Work Unit、AC／Evidence、Human Gate 與問題記錄；空資料與未知資料都須可辨識。
5. 交付前重新核對來源：

   ```sh
   node "[Skill根目錄]/scripts/project.mjs" check "[文件根目錄]"
   ```

   通過代表來源版本一致，且 HTML 與 JSON 及目前模板相符，並非證實 Agent 的語意解讀正確。HTML 缺漏或模板更新後須重新 build。語意核對未完成時，不得把來源索引標為已同步。更新索引同步區塊時依契約操作；腳本不修改任何正式 Markdown。

## 呈現與交接

- 總覽顯示來源範圍、產生時間、各狀態數量、待人工確認及資料問題。缺少可靠分母時不顯示百分比；部分擷取不可宣稱涵蓋整個專案。
- 文件、工作、審查與證據均可回到來源檔案及具名區段。相同 WU 只使用原工作單的穩定鍵，不因完成紀錄再計數。
- 靜態 HTML 無法自行察覺本機文件變更，須明示「離線快照」，再次使用前執行 check；失敗時重新整理，不可宣稱即時同步。
- 沿用現有模板。後續 AI 工作讀取索引、相關 Markdown 及必要 JSON，不反覆讀取整份 HTML／CSS。
- 回報輸出位置、涵蓋範圍、未解析或待確認項目、來源核對結果。不要用示範數值補齊正式畫面。

## 維護

在原始專案維護腳本或模板後執行 `node --test "[Skill根目錄]/tests/project.test.mjs"`；精簡安裝未含 tests 時回原始專案執行。更新全域安裝副本後，既有儀表板若因模板版本不同而無法通過 check，需重新 build。變更狀態規則時同步修訂資料契約與測試；不要靜默改變 contract_version 1 的既有意義。
