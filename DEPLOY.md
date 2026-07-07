# 部署指南（立安藥局管理系統）

本專案透過 **GitHub → Vercel 自動部署**：推送到 `main` 分支後，Vercel 會自動 build 並上線。

線上網址：<https://li-ann-pharmacy-manage-git-main-hungchenyu0926s-projects.vercel.app/>

---

## 一、日常推送上線流程

```bash
# 1. 確認變更
git status

# 2. 加入要提交的檔案（避免 git add -A，以免誤加機密檔）
git add <檔案路徑>

# 3. 建立 commit
git commit -m "說明本次變更"

# 4. 推送到 main → Vercel 自動部署
git push origin main
```

推送後到 [vercel.com](https://vercel.com) → 專案 **li-ann-pharmacy-manage** → **Deployments** 看即時建置進度（約 1–3 分鐘）。

---

## 二、環境變數設定（**重要**）

本機的 `.env.local` 已被 `.gitignore` 排除，**不會**上傳到 GitHub / Vercel。
因此所有金鑰都必須「手動」在 Vercel 後台設定一次。

**設定位置**：Vercel → 專案 → **Settings → Environment Variables**

| 變數名稱 | 用途 | 是否必填 |
|---|---|---|
| `ANTHROPIC_API_KEY` | 用藥安全評估（/drug-check）的 AI 分析 | 用到該功能才需要 |
| `GOOGLE_CREDENTIALS` | Google Sheets 服務帳號憑證（整段 JSON 貼一行） | 慢箋 / 借還 / 業績功能需要 |
| `SHEET_ID` | Google 試算表 ID | 慢箋 / 借還 / 業績功能需要 |
| `LINE_CHANNEL_ACCESS_TOKEN` | LINE 通知（選填） | 否 |
| `LINE_ADMIN_USER_ID` | LINE 通知（選填） | 否 |

> 每個變數記得勾選 **Production**（建議也勾 **Preview**）。
> **新增或修改變數後，必須到 Deployments 對最新部署點 Redeploy**，變數才會生效。

---

## 三、部署後線上檢查清單

- [ ] Vercel Deployments 顯示最新 commit 為 **Ready**（綠色）
- [ ] 開啟線上網址，首頁總覽正常載入
- [ ] 側邊欄五個項目都可點擊切換：
  - [ ] 首頁總覽
  - [ ] 慢箋提醒管理
  - [ ] 藥品借還管理
  - [ ] 業績管理
  - [ ] 用藥安全評估
- [ ] 慢箋 / 借還 / 業績頁面能讀到 Google Sheets 資料（若空白 → 檢查 `GOOGLE_CREDENTIALS` / `SHEET_ID`）
- [ ] 用藥安全評估：貼一組用藥清單能跑出分析（若報錯 → 檢查 `ANTHROPIC_API_KEY` 並 Redeploy）
- [ ] 手機開啟網址，版面正常（表格可左右捲動、選單為 Hamburger）

---

## 四、常見問題

**Q：用藥安全評估顯示「未設定 ANTHROPIC_API_KEY」**
A：Vercel 未設該變數，或設了但沒 Redeploy。到 Settings → Environment Variables 加入後 Redeploy。

**Q：用藥安全評估顯示「credit balance too low」**
A：Anthropic 帳戶餘額不足，到 <https://console.anthropic.com/> → Plans & Billing 儲值。

**Q：慢箋 / 借還 / 業績頁面空白或報錯**
A：`GOOGLE_CREDENTIALS` 或 `SHEET_ID` 未設 / 設錯，或服務帳號沒有該試算表的存取權限。

**Q：本機開發如何啟動？**
A：
```bash
npm install
# 建立 .env.local 並填入上表變數（可參考 .env.local.example）
npm run dev      # http://localhost:3000
```

**Q：推送前想先確認不會壞掉？**
A：
```bash
npx tsc --noEmit   # 型別檢查
npm run build      # 完整建置（Vercel 也是跑這個）
```
