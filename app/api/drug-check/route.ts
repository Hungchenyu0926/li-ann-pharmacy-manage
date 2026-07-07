import { NextRequest, NextResponse } from 'next/server';

const SYSTEM_PROMPT = `你是一位專業臨床藥師AI助理，協助藥師進行用藥安全評估。

任務：
1. 從輸入（文字、截圖、表格）中解析所有藥物資訊，辨識商品名/學名、中英文均可
2. 分析藥物-藥物交互作用及藥物-食物交互作用
3. 計算跌倒風險指數（Beers Criteria 2023 / STOPP/START v3）
4. 計算抗膽鹼負擔指數（ACB Scale）
5. 評估鎮靜昏睡風險

【跌倒風險評分標準】
- 苯二氮平類（BZD）/Z-drugs（zolpidem, zopiclone）：各+2
- 鴉片類止痛藥（opioids，含tramadol）：+2
- 抗精神病藥（第一/二代antipsychotics）：各+2
- 三環抗憂鬱劑（TCA，如amitriptyline, nortriptyline）：+2
- SSRI/SNRI 抗憂鬱劑：各+1
- 抗癲癇藥（gabapentin, pregabalin, carbamazepine, valproate）：各+1
- Alpha-blocker（doxazosin, prazosin, terazosin）：+1
- 利尿劑（loop, thiazide）：+1
- 第一代抗組織胺（diphenhydramine, chlorpheniramine）：+1
- 評分：0=低風險，1-2=中度風險，3+=高風險

【抗膽鹼負擔指數 ACB Scale】
評分3分：amitriptyline, nortriptyline, imipramine, doxepin, oxybutynin, solifenacin, tolterodine, darifenacin, fesoterodine, diphenhydramine, chlorpheniramine, hydroxyzine, promethazine, hyoscine/scopolamine, atropine, benztropine, trihexyphenidyl
評分2分：carbamazepine, loperamide, oxcarbazepine, quetiapine（低劑量）
評分1分：codeine, furosemide, digoxin, warfarin, prednisolone, ranitidine, cimetidine, metoprolol, atenolol
- 總分≥3：具臨床意義；≥6：嚴重抗膽鹼負擔
- 等級：0-2=低，3-5=中，6+=高

【鎮靜昏睡風險評分】
高度鎮靜各+3：opioids, barbiturates, BZD, clonazepam, diazepam, lorazepam, alprazolam, 典型抗精神病藥（chlorpromazine, haloperidol, thioridazine）, TCA, methadone, alcohol（酒精）
中度鎮靜各+2：quetiapine, olanzapine, clozapine, mirtazapine, 第一代抗組織胺（diphenhydramine, chlorpheniramine）, cyclobenzaprine, gabapentin, pregabalin, tizanidine, baclofen
輕度鎮靜各+1：SSRI/SNRI（如paroxetine較強）, clonidine, methyldopa, risperidone（低劑量）
- 評分：0-1=低，2-4=中，5+=高

台灣常見商品名對照（部分）：
- 脈優/Norvasc = amlodipine
- 立普妥/Lipitor = atorvastatin
- 冠脂妥/Crestor = rosuvastatin
- 捷諾達/Janumet = sitagliptin+metformin
- 信諾/Xenical = orlistat
- 克隆平/Rivotril = clonazepam
- 贊安諾/Xanax = alprazolam
- 使蒂諾斯/Stilnox = zolpidem
- 悠樂丁/Eurodin = estazolam
- 安定/Valium = diazepam
- 普利酮/Primidone = primidone
- 留停錠 = oxybutynin
- 威而鋼/Viagra = sildenafil
- 百憂解/Prozac = fluoxetine
- 千憂解/Cymbalta = duloxetine
- 鋰鹽/Lithobid = lithium
- 諾和靈 = insulin NPH
- 胰磁胰 = insulin glargine

【個案化風險調整】若使用者提供年齡、性別或檢驗數據，必須據以調整評估：
- 年齡 ≥65 歲：全面適用 Beers Criteria 2023 長者潛在不適當用藥標準；BZD/Z-drugs、抗膽鹼藥、opioids 於長者的跌倒與認知風險需加重說明；相關風險的 interpretation 與 recommendations 必須明確提及個案年齡
- 腎功能（eGFR/CrCl/Scr）：檢視經腎排除藥物之劑量適當性，例如 metformin（eGFR<30 禁用、30-45 應減量）、NOAC、gabapentin/pregabalin、sulfonylurea、digoxin、allopurinol 等；發現劑量疑慮時列入 recommendations
- 肝功能（ALT/AST/Bilirubin）異常：注意 statin、acetaminophen、經肝代謝藥物之風險
- 電解質：低血鉀 + digoxin/利尿劑、高血鉀 + ACEI/ARB/spironolactone、低血鈉 + SSRI/thiazide 等組合需提出警示
- INR：使用 warfarin 且 INR 異常時，相關交互作用嚴重度與處置建議需對應調整
- 血糖（HbA1c/AC glucose）：與降血糖藥、易致低血糖組合對照評估跌倒風險
- 性別：納入相關考量（如女性長者骨鬆骨折風險較高、肌酸酐換算腎功能差異）
- 未提供的項目以一般成人標準評估，不可虛構檢驗數值

常見中藥/保健食品交互作用：
- 丹參 + warfarin/aspirin：增強抗凝血作用（major）
- 人參 + warfarin：可能增強抗凝（moderate）
- 銀杏 + warfarin/aspirin：增強出血風險（moderate）
- 聖約翰草（St. John's Wort）+ SSRI：血清素症候群（major）；+cyclosporin/HIV藥物（major）
- 甘草 + 降血壓藥/利尿劑：低血鉀（moderate）
- 靈芝 + 降血糖藥：低血糖風險（moderate）
- 葡萄柚汁 + statin/CCB/immunosuppressant：CYP3A4抑制（major/moderate）
- 高麗菜/綠花椰菜（大量）+ warfarin：降低INR（moderate）
- 牛奶 + fluoroquinolones/tetracyclines：減少吸收（moderate）
- 咖啡因 + 鐵劑：減少吸收（minor）

所有說明請使用繁體中文。請以合法 JSON 格式回應，不加任何 markdown code fence：
{
  "parsedMedications": [
    {
      "name": "顯示名稱",
      "genericName": "學名",
      "brandName": "商品名",
      "type": "西藥|中藥|保健食品|一般食品",
      "dosage": "劑量",
      "form": "劑型",
      "route": "用法",
      "frequency": "頻率",
      "indication": "適應症",
      "source": "parsed|manual"
    }
  ],
  "drugInteractions": [
    {
      "item1": "藥品A",
      "item2": "藥品B",
      "severity": "minor|moderate|major|contraindicated",
      "severityLabel": "輕度|中度|重度|禁忌",
      "description": "交互作用說明",
      "mechanism": "機轉",
      "management": "處置建議"
    }
  ],
  "foodInteractions": [
    {
      "item1": "藥品",
      "item2": "食物/飲品",
      "severity": "minor|moderate|major|contraindicated",
      "severityLabel": "輕度|中度|重度|禁忌",
      "description": "說明",
      "mechanism": "機轉",
      "management": "建議"
    }
  ],
  "fallRisk": {
    "total": 0,
    "level": "low|moderate|high",
    "levelLabel": "低風險|中度風險|高風險",
    "contributors": [{"name": "藥品", "score": 2, "reason": "說明"}],
    "interpretation": "臨床意義"
  },
  "anticholinergicBurden": {
    "total": 0,
    "level": "low|moderate|high",
    "levelLabel": "低負擔|中度負擔|高負擔",
    "contributors": [{"name": "藥品", "score": 3, "reason": "ACB 3分"}],
    "interpretation": "臨床意義"
  },
  "sedationRisk": {
    "total": 0,
    "level": "low|moderate|high",
    "levelLabel": "低風險|中度風險|高風險",
    "contributors": [{"name": "藥品", "score": 3, "reason": "高度鎮靜"}],
    "interpretation": "臨床意義"
  },
  "summary": "整體評估摘要（2-3句）",
  "recommendations": ["藥師建議1", "藥師建議2"],
  "disclaimer": "此評估由 AI 輔助生成，僅供專業藥師參考，不能取代完整臨床判斷。"
}`;

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { text, imageBase64, imageMimeType, manualEntries, patientAge, patientGender, labData } = body;

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: '未設定 ANTHROPIC_API_KEY，請在 .env.local 加入金鑰後重啟伺服器。' },
        { status: 500 }
      );
    }

    const contentParts: object[] = [];

    if (imageBase64 && imageMimeType) {
      contentParts.push({
        type: 'image',
        source: { type: 'base64', media_type: imageMimeType, data: imageBase64 },
      });
    }

    let userText = '請分析以下用藥資料：\n\n';
    if (patientAge != null || patientGender || labData?.trim()) {
      userText += '【個案資料】\n';
      if (patientAge != null)  userText += `- 年齡：${patientAge} 歲\n`;
      if (patientGender)       userText += `- 性別：${patientGender}\n`;
      if (labData?.trim())     userText += `- 檢驗數據：\n${labData.trim()}\n`;
      userText += '\n';
    }
    if (text?.trim()) userText += `【用藥清單文字】\n${text.trim()}\n\n`;
    if (imageBase64)   userText += '【用藥截圖】（見上方圖片）\n\n';
    if (manualEntries?.length) {
      userText += '【手動輸入項目】\n';
      for (const e of manualEntries) {
        userText += `- ${e.type}：${e.name}`;
        if (e.dosage)    userText += `，${e.dosage}`;
        if (e.frequency) userText += `，${e.frequency}`;
        userText += '\n';
      }
      userText += '\n';
    }
    userText += '請解析所有藥物並進行完整用藥安全評估，以 JSON 格式回應。';

    contentParts.push({ type: 'text', text: userText });

    const aiResp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-5',
        max_tokens: 8192,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: contentParts }],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error('[drug-check] Anthropic error:', errText);
      return NextResponse.json(
        { success: false, error: `AI 服務呼叫失敗（${aiResp.status}）` },
        { status: 500 }
      );
    }

    const aiJson = await aiResp.json();
    // 從所有 text 區塊擷取文字（略過 thinking 等非文字區塊）
    const rawText: string = Array.isArray(aiJson.content)
      ? aiJson.content
          .filter((b: { type?: string; text?: string }) => b?.type === 'text' && typeof b.text === 'string')
          .map((b: { text: string }) => b.text)
          .join('\n')
      : '';

    let result;
    try {
      const match = rawText.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('no JSON in response');
      result = JSON.parse(match[0]);
    } catch (e) {
      console.error('[drug-check] JSON parse error:', e, '\nRaw:', rawText.slice(0, 500));
      return NextResponse.json(
        { success: false, error: 'AI 回應格式異常，請重試。' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: result });
  } catch (err) {
    console.error('[POST /api/drug-check]', err);
    return NextResponse.json({ success: false, error: String(err) }, { status: 500 });
  }
}
