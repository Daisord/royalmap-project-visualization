# 視覺化互通契約 v1

本契約定義本技能提供給視覺化 Skill 的來源規則。僅在專案啟用互通時適用；既有五類文件生命週期、驗證與完成標準維持不變。

## 1. 資料責任與位置

```text
_Documents/[專案名稱]/
├─ README.md                 # 正式文件索引與同步資訊
├─ 01-System/                # 目前有效的系統事實
├─ 02-Planning/
├─ 03-In-Progress/
├─ 04-Completed/
├─ 05-Development-Log/
└─ 06-Visualization/         # 衍生成果，可重新建立
   ├─ index.html
   └─ data/project-snapshot.json
```

- 文件 Skill 維護 Markdown；視覺化 Skill 讀取文件，建立唯讀 Snapshot 與畫面。不得把衍生成果重新當作來源掃描，或要求文件 Skill 同時維護一份 JSON 狀態。
- `06-Visualization` 只在需要產生成果時建立，不是新的文件分類。模板、樣式、圖表與產生腳本由視覺化 Skill 管理，本技能不指定前端框架。
- 畫面的修改意見先形成變更要求，再由文件 Skill 依實際證據更新來源。畫面操作本身不能代表 Human Gate 已通過。

## 2. 識別與連結

沿用既有區塊引用格式，不強制改為 YAML frontmatter。啟用互通後，在參與匯出的文件開頭填入：

```markdown
> 文件識別碼：DOC-0007
```

- `document_id` 在同一專案內唯一，分配後不可因檔名、路徑、標題或狀態改變而重編，也不可回收重用。可採 `DOC-0001` 遞增，分配前查閱專案索引與現有文件，避免重複。
- 文件移動至完成目錄時保留 ID；另建完成紀錄時使用新 ID，並連回原工作單。兩份文件描述同一 Work Unit 時，以原工作單 ID 加上 Work Unit ID 識別同一工作，不重複計數。
- Work Unit、AC、Phase、Review Finding 保留既有 ID，唯一鍵使用 `document_id + local_id`。例如 `DOC-0007/WU-01`；AC 與 Finding 必須記錄所屬 Work Unit，文件層級 Review 或 Human Gate 則明確標示作用範圍。
- Phase ID 在其規劃文件內穩定；開發文件的「目前 Phase」應連回該規劃文件與 Phase ID，不能僅憑同名階段合併。
- Evidence 可直接使用既有指令、結果與連結，不強制再編一組 ID。每項 AC 的驗證結果必須保留對應 Evidence 的位置；Finding 接受風險時保留接受人、日期與依據。
- 文件索引增加「文件識別碼」欄。未遷移文件可留為 `[待確認]`，仍可展示文件清單，但不可當作已可靠識別的工作資料。
- 來源路徑以專案文件根目錄為基準，使用相對路徑與 `/`；畫面連結依輸出位置換算。區段使用明確標題或錨點，不依賴會變動的行號。

範本中的 ID 與狀態選項都是示例。實際文件必須選定一個狀態；不得將 `待處理／進行中` 等整串選項當成有效狀態。

## 3. 狀態與判定

Snapshot 保留原文 `source_status`，並依下表轉換為機器用 `status`；文件類型另存為 `document_type`，不作為工作狀態。不同層級分別保存，不可用文件所在目錄推定 Work Unit、AC、Review 或 Human Gate 已完成。

| 對象 | 來源值 → status |
|---|---|
| 文件類型 | 專案根 README.md → index；01-System → system；02-Planning → planning；03-In-Progress → in-progress；04-Completed → completed；05-Development-Log → development-log |
| Work Unit | 待處理 → pending；進行中 → in-progress；待驗證 → verification；待 Review → review；待人工驗收 → human-gate；完成 → completed |
| AC 驗證結果 | 未執行 → pending；通過 → passed；未通過 → failed；需人工驗證 → manual；例外已接受 → accepted-exception |
| Review | 未執行 → pending；通過 → passed；需修正 → changes-requested；需人工判斷 → human-decision；有條件通過 → conditional |
| Finding 處理結果 | 待處理 → open；已修正 → resolved；接受風險 → accepted-risk；Human Gate → human-decision |
| Human Gate | 無決策 → pending；Accept／Accepted → accepted；Reject → rejected；Revise → changes-requested |

- 無法辨識、缺漏或互相矛盾的值使用 `unknown` 並顯示「待確認」，保留來源與問題原因；不得預設為通過、不適用或零項。範本選項、未填佔位符與多個 Human Decision 同時勾選都屬於待確認。
- AC 勾選不取代驗證 Evidence；例外接受不等於測試通過。有條件 Review 或接受風險必須連回具體條件與決策依據。
- Human Decision 尚未勾選時只表示待決策；已選定時仍須有決策人、日期、說明及作用範圍。缺少依據的接受宣稱列為待確認，不得自動完成工作。
- 完成宣稱若與必要 AC、Review、重大 Finding 或 Human Gate 證據衝突，保留原宣稱並顯示異常，交回文件 Skill 釐清，不由匯出程序自行修正。
- 沒有明確定義且完整的工作範圍時，只顯示狀態數量，不產生進度百分比。若計算比例，保留分子、分母、去重方式、納入範圍及計算規則；文件數、AC 通過率不可冒充整體專案完成率。

## 4. Snapshot 最小交接要求

以下是視覺化 Skill 應提供的資料語意，不是本技能新增的匯出器或完整 JSON Schema：

| 欄位 | 要求 |
|---|---|
| contract_version | 固定為整數 `1`；未支援版本應報告不相容，不可靜默套用 |
| generated_at | 含時區的 ISO 8601 產生時間 |
| sources | 本次讀取的正式來源清單，含文件 ID（未知可為 null）、相對路徑與內容 SHA-256；未提交文件也須能識別版本 |
| documents | 文件 ID、標題、類型、原始狀態、更新日及來源位置；未知值保留 null 或 unknown |
| work_units | 穩定鍵、所屬文件、local_id、標題、原始與標準狀態、AC／Review／Human Gate 及其作用範圍；每項結論能回到來源區段 |
| issues | 缺漏、重複 ID、衝突、無法解析與失效連結，附來源位置；未知數量不可輸出為零 |

來源位置至少包含 `path` 與 `section`。AC、Finding 與 Evidence 都保留原始 ID（若有）、關聯與證據位置，避免只留下無法核對的摘要。必要資訊解析失敗時報告問題並停止該項完成判定；不得為了完成畫面填入示範資料。

來源清單及內容雜湊須涵蓋專案索引與實際參與推導的文件／證據；來源新增、移動、刪除或內容改變都應使舊 Snapshot 失效。畫面須顯示產生時間、涵蓋範圍與同步狀態，過期資料不可顯示為即時現況。

## 5. 更新與相容性

1. 舊專案先保留原文件，從索引及本次需要展示的文件補 ID 與必要欄位；缺漏列為待確認，不強制批次搬移或全面改寫。
2. 文件 Skill 新增、移動、刪除或更新來源時，同步索引及交叉連結；若已有視覺化成果，將索引中的同步狀態設為「待更新」。
3. 視覺化 Skill 更新衍生資料並驗證來源清單、雜湊、ID、關聯與狀態後，才可將索引標為「已同步」；無法驗證時標「待確認」，來源已知變動時標「待更新」。
4. 索引中的「視覺化呈現（啟用時保留）」區塊是同步記錄，不是工作事實；計算索引來源雜湊時排除此區塊，避免更新同步時間使 Snapshot 立即過期。其他索引內容仍納入雜湊。
5. AI 後續工作優先讀索引、受影響 Markdown 及 Evidence；HTML、CSS、JavaScript 不作為常規交接上下文。沿用呈現模板，由視覺化 Skill 更新受影響資料。

實際 JSON Schema、解析器、模板與端到端驗證由後續視覺化 Skill 實作；不能僅因本契約存在，就宣稱儀表板或自動同步功能已可使用。
