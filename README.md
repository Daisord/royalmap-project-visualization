# RoyalMap 專案視覺化

一套將 RoyalMap Markdown 文件整理為可追溯 JSON Snapshot 與離線 HTML 儀表板的技能，協助團隊及 Coding Agent 檢視文件索引、工作狀態、驗收審查及待確認事項。

完整工作規則請參閱 [SKILL.md](SKILL.md)，Snapshot 格式請參閱 [資料契約](references/data-contract.md)。本技能相容 [RoyalMap 系統文件與開發規劃](https://github.com/Daisord/royalmap-system-planning-document) 2.1.0 的互通契約 v1；正式 Markdown 持續作為事實來源。

## 適用情境

- 將既有 RoyalMap 文件整理為可直接開啟的離線儀表板。
- 查看 Work Unit（工作單位）的狀態、Acceptance Criteria（驗收條件）及 Evidence（證據）。
- 核對 Review（審查）、Finding（審查發現）與 Human Gate（人工確認關卡）的結果及來源。
- 在來源文件更新後重新建立快照，或在交接前核對來源與畫面是否一致。

## 安裝至 Codex

前置需求：已安裝 Git、Codex 與 Node.js 22+，且 `git`、`node` 可從 PATH 執行。不需 npm install。將本儲存庫 Clone 到個人技能目錄後，即可在不同專案使用此技能。以下指令擇一執行。

### Windows PowerShell

```powershell
New-Item -ItemType Directory -Force -Path "$HOME/.agents/skills" | Out-Null

git clone https://github.com/Daisord/royalmap-project-visualization.git "$HOME/.agents/skills/royalmap-project-visualization"
```

### macOS／Linux

```bash
mkdir -p "$HOME/.agents/skills"

git clone https://github.com/Daisord/royalmap-project-visualization.git \
  "$HOME/.agents/skills/royalmap-project-visualization"
```

第一次下載使用 `git clone`；若目標目錄已存在，請先確認是否為同一份儲存庫，再依下方方式更新。個人技能目錄的「全域」指目前使用者的本機環境，不會自動同步到其他使用者、電腦或雲端環境。

### 更新技能

Windows PowerShell、macOS 與 Linux 均可使用：

```sh
git -C "$HOME/.agents/skills/royalmap-project-visualization" pull --ff-only
```

若本機修改與更新衝突，或分支已分歧，更新會停止；請先保留並處理本機變更，再重新執行。其他開發目錄的修改需先推送到 GitHub，再於安裝目錄 pull，不同 Clone 不會自動同步。模板更新後，既有儀表板可能需重新 build 才能通過 check。

### 已下載至其他位置

可將專案資料夾複製到個人技能目錄，保留以下檔案及目錄的相對位置：

```text
~/.agents/skills/royalmap-project-visualization/
├─ SKILL.md
├─ README.md
├─ LICENSE
├─ agents/
├─ references/
├─ scripts/
├─ assets/
└─ tests/
```

不要只複製 `SKILL.md`；腳本需要 assets 內的模板，Agent 也需讀取 references 內的契約。`output/` 是本機驗證假資料及截圖，已由 `.gitignore` 排除，不隨 Clone 下載，手動複製時也請略過。

以複製方式安裝且未保留 Git 資訊時，後續需自行同步檔案；若要改用 Git 更新，可先將舊安裝目錄改名備份，再依上方步驟 Clone。避免同時在個人與專案技能目錄安裝同名副本，以免選錯版本。

### 確認與使用

在 Codex CLI／IDE 使用 `/skills` 查看技能，或在提示中輸入：

```text
$royalmap-project-visualization

請根據 D:/Projects/App/_Documents/App 的正式文件建立離線儀表板，
整理工作狀態、驗收證據、審查及人工決策，
未知資訊標為待確認，並在交付前核對來源版本。
```

已有儀表板時，可要求更新及核對：

```text
$royalmap-project-visualization

請更新 D:/Projects/App/_Documents/App 的既有儀表板，
重新核對已變動來源與相關工作結論，保留待確認事項，
不要只替換來源雜湊後沿用舊判斷。
```

Codex 會自動偵測技能變更，也可依 RoyalMap 儀表板建立／更新需求自動選用本技能；若技能未出現，請重新啟動 Codex。技能目錄與使用方式可參閱 [OpenAI 官方技能文件](https://learn.chatgpt.com/docs/build-skills)。以上路徑僅為示例，請替換為實際文件位置。

## 手動執行腳本

Agent 負責閱讀文件並整理工作資料；Node.js 腳本負責來源版本核對、結構驗證與固定模板輸出。`capture` 只建立文件索引及來源骨架，不會自動解析完整工作、審查或決策。

1. 確認 Skill 安裝位置及目標文件根目錄。目標應為 `_Documents/[專案名稱]/`，其中須有 README.md，不要直接使用 Repository 根目錄。
2. 執行 capture，將結果保存為 UTF-8 JSON 草稿。
3. 依 [資料契約](references/data-contract.md)，由 Agent 或人工閱讀來源後整理草稿中的 `work_units`、`coverage` 與 `issues`。未擷取資料保留 null，不以空陣列或示範數值補齊。
4. 執行 build，開啟輸出的 HTML 檢查畫面，再執行 check 核對來源與輸出。

下列命令均使用絕對路徑，可從目標專案目錄執行；請替換文件根目錄。Skill 目錄只需可讀，草稿位置及目標專案的 `06-Visualization/` 必須可寫。

### Windows PowerShell

```powershell
$skillRoot = Join-Path $HOME '.agents/skills/royalmap-project-visualization'
$documentRoot = 'D:/Projects/App/_Documents/App'
$draftPath = Join-Path $env:TEMP ("royalmap-" + [guid]::NewGuid().ToString('N') + '.json')

node "$skillRoot/scripts/project.mjs" capture "$documentRoot" |
  Set-Content -Encoding UTF8 "$draftPath"
```

依來源整理 `$draftPath` 後，沿用相同 PowerShell 工作階段中的變數執行：

```powershell
node "$skillRoot/scripts/project.mjs" build "$documentRoot" "$draftPath"
node "$skillRoot/scripts/project.mjs" check "$documentRoot"
```

### macOS／Linux

```bash
skill_root="$HOME/.agents/skills/royalmap-project-visualization"
document_root="/path/to/Solution/_Documents/App"
draft_path="$(mktemp "${TMPDIR:-/tmp}/royalmap-XXXXXX")"

node "$skill_root/scripts/project.mjs" capture "$document_root" > "$draft_path"
```

依來源整理 `$draft_path` 後，沿用相同 Shell 工作階段中的變數執行：

```bash
node "$skill_root/scripts/project.mjs" build "$document_root" "$draft_path"
node "$skill_root/scripts/project.mjs" check "$document_root"
```

若來源依賴本機證據檔，capture 時可追加相對於文件根目錄的路徑，例如 PowerShell 的 `node "$skillRoot/scripts/project.mjs" capture "$documentRoot" "evidence/test-result.txt"`。證據路徑不可是絕對路徑、遠端 URL 或指向根目錄外的連結。

## 來源與輸出結構

目標專案的文件結構如下；本儲存庫根目錄的 README 則用於介紹技能本身。

```text
[方案根目錄]/
└─ _Documents/
   └─ [專案名稱]/
      ├─ README.md
      ├─ 01-System/
      ├─ 02-Planning/
      ├─ 03-In-Progress/
      ├─ 04-Completed/
      ├─ 05-Development-Log/
      └─ 06-Visualization/
         ├─ index.html
         └─ data/
            └─ project-snapshot.json
```

`06-Visualization/` 是衍生成果，不是第六種文件生命週期。輸出固定寫入目標文件目錄，不會改寫正式 Markdown；若環境限制寫入其他專案，需讓該專案成為可寫工作區或依環境取得授權。

直接以瀏覽器開啟 `index.html`。HTML 內嵌 JSON，不需後端或 CDN；來源連結導向原始檔，區段名稱顯示在連結旁供人工定位，實際顯示或下載行為依瀏覽器而異。分享時若需保留來源連結，應連同原文件目錄及相對結構一起提供。

## 搭配系統文件 Skill

[royalmap-system-planning-document](https://github.com/Daisord/royalmap-system-planning-document) 負責建立與維護正式 Markdown、穩定文件識別碼、WU／AC ID、Evidence、Review 及 Human Gate；本技能依這些來源產生唯讀視覺化。

來源規範採用 [視覺化互通契約 v1](references/visualization-contract.md)，實際 JSON 格式見 [資料契約](references/data-contract.md)。隨附契約可獨立讀取，不需先安裝另一套 Skill；若來源缺少識別碼或證據，會保留待確認事項，不為了完成畫面修改工作結論。

來源新增、移動、刪除或更新時，先依文件工作流維護索引及同步狀態，再重新整理相關資料並建立儀表板。腳本不修改索引的同步記錄；Agent 完成來源版本與語意核對後，才可依互通契約更新索引的同步狀態。

## 維護與驗證

修改腳本或模板後，在本儲存庫根目錄執行：

```sh
node --test tests/project.test.mjs
```

已安裝的 Clone 也包含 tests，可從其他目錄執行 `node --test "$HOME/.agents/skills/royalmap-project-visualization/tests/project.test.mjs"`。

儀表板交付、重開或交接前，使用上方 check 指令。通過表示來源清單與內容版本一致，且實際 HTML 與 JSON 及目前模板相符；HTML 缺漏或不一致時會失敗。來源變動時需重新 capture 並核對結論，不能只更新雜湊。

check 不能證明 Agent 的語意解讀或 Evidence 的業務含義正確，仍需核對來源及驗收結果。畫面驗證包含桌面與窄螢幕、鍵盤操作、搜尋篩選、來源連結，以及未知與空資料的顯示。

## 限制

- HTML 是離線快照，無法自動察覺本機文件變更，不代表即時同步。
- 工作資料由 Agent 或人工依來源整理；未擷取不代表零項或已通過。
- 缺少可靠分母時只顯示狀態數量，不自動推算專案完成率。
- 本版沒有架構圖自動解析、多專案中心、監看服務、寫回介面或部署功能。

## 授權

請參閱 [LICENSE](LICENSE)。
