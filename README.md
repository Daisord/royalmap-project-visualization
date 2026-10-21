# RoyalMap Project Visualization

將 RoyalMap Markdown 文件整理成可追溯的離線 HTML 儀表板。與 `royalmap-system-planning-document` 2.1.0 搭配，正式 Markdown 保持唯一事實來源。

第一版支援文件索引、Work Unit 狀態、AC／Evidence、Review／Finding、Human Gate 及資料問題。Agent 負責理解文件；內建 Node.js 腳本負責來源版本核對、結構驗證與固定模板輸出。沒有自動推算完成率，也不會修改正式文件。

## 使用

需要 Node.js 22+，不需 npm install。先依下方「全域安裝」安裝 Skill；完整工作流程見 [SKILL.md](SKILL.md)。

可在任一專案中提示 Codex：

```text
使用 $royalmap-project-visualization，將 D:/Projects/App/_Documents/App 的正式文件建立為離線儀表板，未知資訊標為待確認。
```

手動執行腳本時，以絕對路徑分別指定 Skill 與目標文件。以下 PowerShell 範例可從目標專案目錄執行：

```powershell
$skillRoot = Join-Path $env:USERPROFILE '.agents/skills/royalmap-project-visualization'
$documentRoot = 'D:/Projects/App/_Documents/App'
# 使用獨立暫存檔，避免多個專案共用同一份草稿
$draftPath = Join-Path $env:TEMP ("royalmap-" + [guid]::NewGuid().ToString('N') + '.json')

node "$skillRoot/scripts/project.mjs" capture "$documentRoot" |
  Set-Content -Encoding UTF8 "$draftPath"

# 依 Skill 中的 references/data-contract.md 整理 $draftPath 的工作資料後
node "$skillRoot/scripts/project.mjs" build "$documentRoot" "$draftPath"
node "$skillRoot/scripts/project.mjs" check "$documentRoot"
```

輸出：

```text
_Documents/App/06-Visualization/
├─ index.html
└─ data/project-snapshot.json
```

直接以瀏覽器開啟 `index.html`。Markdown 來源連結可導向原始檔，實際顯示／下載行為依瀏覽器而異；區段名稱會顯示供人工定位。HTML 是離線快照，不能自動讀取本機最新文件；重開或交接前執行 check。

check 同時核對來源、JSON 與實際 HTML；HTML 缺漏、與 JSON 不一致或模板已更新時，須重新 build。

## 全域安裝

依 [OpenAI 官方 Skill 說明](https://learn.chatgpt.com/docs/build-skills)，`~/.agents/skills/` 是目前使用者跨專案共用的技能目錄。Windows 預設位置為 `%USERPROFILE%\.agents\skills\`；這裡的「全域」指目前使用者的本機 Codex，不會自動同步到其他使用者、電腦或雲端環境。

從本專案根目錄執行以下 PowerShell 命令，首次安裝到尚不存在的目標目錄：

```powershell
$sourceRoot = (Get-Location).Path
$installRoot = Join-Path $env:USERPROFILE '.agents/skills/royalmap-project-visualization'
if (Test-Path -LiteralPath $installRoot) { throw "安裝目錄已存在，請先確認要更新的版本：$installRoot" }
New-Item -ItemType Directory -Path $installRoot -Force | Out-Null
foreach ($item in @('SKILL.md', 'README.md', 'LICENSE', 'agents', 'references', 'scripts', 'assets')) {
  Copy-Item -LiteralPath (Join-Path $sourceRoot $item) -Destination $installRoot -Recurse
}
```

保留目錄結構，不只複製 `SKILL.md`。`output/` 內是畫面驗證假資料及截圖，不納入安裝；`tests/` 留在原始專案供維護使用。此 Skill 不依賴原始專案的位置；未安裝 `royalmap-system-planning-document` 時也能讀取隨附契約並產生儀表板。

Codex 通常會自動偵測新 Skill；若技能清單未出現，重新啟動 Codex。使用 `$royalmap-project-visualization` 明確指定，或以 RoyalMap 儀表板建立／更新需求讓 Codex 自動選用。避免同時在個人與專案技能目錄安裝同名副本，以免選錯版本。

更新時，將上述同一組檔案與目錄從原始專案同步至安裝副本，勿把 `output/` 一併複製。原始專案修改不會自動更新全域安裝副本；模板更新後，既有儀表板可能需要重新 build 才能通過 check。

## 執行位置與權限

- Skill 根目錄是腳本與模板的位置；文件根目錄是要讀取的 `_Documents/[專案名稱]/`，其中須有 README.md。不要直接把 Repository 根目錄當成文件根目錄。
- 腳本及草稿使用加上引號的絕對路徑；Evidence 追加參數則使用相對於文件根目錄的路徑，例如 `node "$skillRoot/scripts/project.mjs" capture "$documentRoot" "evidence/test-result.txt"`。
- Node.js 須可從 PATH 執行；安裝 Skill 不會安裝 Node.js。只需讀取 Skill 目錄，但草稿位置與目標專案的 `06-Visualization/` 必須可寫。
- 若執行環境限制寫入其他專案，需讓該專案成為可寫工作區或依環境取得授權；輸出仍保存在目標文件目錄。
- 維護時在原始專案執行 `node --test tests/project.test.mjs`；全域安裝無須包含測試或驗證截圖。

## 限制

- capture 只擷取文件清單與開頭 metadata，工作、審查與決策由 Agent 依來源整理；未整理時顯示未擷取，不當成零項。
- 腳本能核對結構、識別碼、來源區段與內容版本，不能證明 Evidence 的業務含義正確，仍需來源核對。
- 本版沒有架構圖自動解析、多專案中心、監看服務、寫回介面或部署功能。

契約來源：[RoyalMap 文件 Skill](https://github.com/Daisord/royalmap-system-planning-document)，隨附 v1 副本便於獨立使用；更動上游契約時應核對相容性。授權見 [LICENSE](LICENSE)。
