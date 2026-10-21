# Snapshot 實作格式 v1

本檔將 [互通契約 v1](visualization-contract.md) 具體化為第一版 renderer 可接受的格式。capture 輸出的 sources、documents 是骨架；不是已完成的分析結果。

## 來源與範圍

- `capture` 遞迴掃描根 README.md 與 01-System 至 05-Development-Log 的 `.md`，不讀 06-Visualization，不跟隨符號連結。
- `sources` 包含 `document_id`、`path`、`sha256`；額外本機證據可作為 capture 的追加相對路徑參數。不得使用絕對路徑、`..`、遠端 URL 或根目錄外的連結目標。
- 索引來源雜湊排除標題為 `## 視覺化呈現（啟用時保留）` 的完整區塊（至下一個二級標題或 EOF）；其餘內容按原始 UTF-8 bytes 計算 SHA-256。
- 遠端 Commit／PR／測試系統的證據，先在正式文件記錄版本、結果及連結，Snapshot 引用該正式文件區段；腳本不連網驗證。
- `coverage.work_units`：`not-extracted`、`partial`、`complete`。未擷取時 `work_units` 是 null；部分擷取時使用陣列並說明 `coverage.note`。complete 僅用於已核對範圍內所有工作及重複引用的情況。

## 欄位

根物件必須含 `contract_version: 1`、`project`、`generated_at`、`sources`、`documents`、`coverage`、`work_units`、`issues`。產生器會重新填寫 generated_at；它表示產生時間，不表示驗收時間。

documents：`document_id`（未知為 null）、`title`、`document_type`、`source_status`、`updated_at`、`source: {path, section}`。保留 capture 取得的文件清單；索引與目錄類型不代表 WU 已完成。

每筆 Work Unit 的格式如下，值僅為格式示意，不能複製為真實專案資料：

```json
{
  "id": "DOC-0007/WU-01",
  "document_id": "DOC-0007",
  "local_id": "WU-01",
  "title": "來源中的工作名稱",
  "source_status": "待驗證",
  "status": "verification",
  "source": {"path": "03-In-Progress/工作-開發中.md", "section": "3. Work Unit 與進度"},
  "acceptance_criteria": [
    {
      "id": "AC-01-01",
      "source_status": "未執行",
      "status": "pending",
      "source": {"path": "03-In-Progress/工作-開發中.md", "section": "Acceptance Criteria"},
      "evidence": []
    }
  ],
  "review": {
    "source_status": "未執行", "status": "pending", "scope": "DOC-0007/WU-01",
    "source": {"path": "03-In-Progress/工作-開發中.md", "section": "5. Independent Review"},
    "evidence": [], "findings": null
  },
  "human_gate": {
    "source_status": "無決策", "status": "pending", "scope": "DOC-0007/WU-01",
    "source": {"path": "03-In-Progress/工作-開發中.md", "section": "7. Human Gate"},
    "decision_by": null, "decision_at": null, "note": null
  }
}
```

- 狀態列舉與原文對應依完整契約。無法對應時 status 使用 `unknown`，issues 記錄原因，不能以模糊字串猜測。
- `acceptance_criteria`、`review`、`human_gate`、`findings` 未擷取或缺漏時為 null；已核對不存在項目才使用空陣列。Review／Gate 的 `scope` 使用 WU 完整鍵或 `document:DOC-0007`，不可留空。
- 多筆 WU 共用同一文件 scope 時，Review 與 Human Gate 各自的完整內容必須一致，包括狀態、證據、Findings 與決策資訊；矛盾或漏列會拒絕輸出。
- Evidence 格式：`{summary, source: {path, section}}`。passed、accepted-exception、conditional、accepted-risk 必須有來源依據。原始指令及結果留在正式來源，不在畫面推定驗證通過。
- Finding 格式：`{id, severity, source_status, status, summary, source, evidence}`；severity 為 Critical／Major／Minor／Decision；接受風險的依據須包括決策人與時間。
- Human Gate 的 accepted 需有 decision_by、含時區的 decision_at 或 YYYY-MM-DD、note 及 source。其他決策也保留相同資訊，缺漏使用 unknown。
- Work Unit completed 需 AC 全為 passed 或 accepted-exception、Review passed 或 conditional、無未處理 Critical／Major Finding、Human Gate accepted。否則改用 unknown，保留 source_status 的完成宣稱，並建立 issue；腳本會拒絕沒有依據的 completed。
- `issues` 每筆是 `{message, source: {path, section}}`，缺 ID、未知狀態、部分覆蓋、文件矛盾等均須保留。來源區段未能定位時使用文件標題，並說明原因。

來源區段必須是檔案中實際存在的 Markdown 標題文字（不含 `#`），程式碼圍欄內的範例標題不算來源區段；整份文件或無標題證據可填 `file`。同一文件層級 Finding 被多筆 WU 引用時，保留相同 ID 與完全相同的內容，不能重建成多個不同問題。Snapshot 不包含可執行 HTML 或任意跳轉 URL；renderer 僅把文字作為 textContent 顯示。

## 不同步的處理

build 會重新計算來源清單與雜湊，任何新增、刪除、移動或內容變動都拒絕輸出。check 也執行同一組驗證，並比對實際 HTML 與 JSON 依目前模板產生的內容；HTML 缺漏、不一致或模板更新時須重新 build。來源未變但人工語意核對仍有疑慮時，維持待確認；不得僅因腳本通過就宣稱 Human Gate 接受。
