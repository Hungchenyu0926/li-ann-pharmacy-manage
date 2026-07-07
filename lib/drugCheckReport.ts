import type { DrugCheckResult, DrugInteraction, RiskScore } from '@/types';

const esc = (s: string | undefined | null): string =>
  (s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const SEVERITY_COLOR: Record<string, string> = {
  contraindicated: '#b91c1c',
  major:           '#c2410c',
  moderate:        '#b45309',
  minor:           '#0369a1',
};

const LEVEL_COLOR: Record<string, string> = {
  low:      '#15803d',
  moderate: '#b45309',
  high:     '#b91c1c',
};

function interactionRows(list: DrugInteraction[]): string {
  if (!list.length) {
    return '<p class="ok">未偵測到顯著交互作用。</p>';
  }
  return list.map(ix => `
    <div class="ix">
      <div class="ix-head">
        <span class="badge" style="color:${SEVERITY_COLOR[ix.severity] ?? '#0369a1'};border-color:${SEVERITY_COLOR[ix.severity] ?? '#0369a1'}">${esc(ix.severityLabel)}</span>
        <strong>${esc(ix.item1)} × ${esc(ix.item2)}</strong>
      </div>
      <p>${esc(ix.description)}</p>
      ${ix.mechanism ? `<p class="sub"><strong>機轉：</strong>${esc(ix.mechanism)}</p>` : ''}
      ${ix.management ? `<p class="sub"><strong>處置建議：</strong>${esc(ix.management)}</p>` : ''}
    </div>`).join('');
}

function riskBlock(title: string, risk: RiskScore | undefined): string {
  if (!risk) return '';
  const color = LEVEL_COLOR[risk.level] ?? LEVEL_COLOR.low;
  return `
    <div class="risk">
      <div class="ix-head">
        <strong>${esc(title)}</strong>
        <span class="badge" style="color:${color};border-color:${color}">${risk.total} 分・${esc(risk.levelLabel)}</span>
      </div>
      <p class="sub">${esc(risk.interpretation)}</p>
      ${risk.contributors.length ? `<ul>${risk.contributors.map(c =>
        `<li><strong>+${c.score}</strong>　${esc(c.name)} — ${esc(c.reason)}</li>`).join('')}</ul>` : ''}
    </div>`;
}

export function buildDrugCheckReportHtml(result: DrugCheckResult, generatedAt: Date): string {
  const time = generatedAt.toLocaleString('zh-TW', { hour12: false });
  const meds = result.parsedMedications ?? [];
  return `<!DOCTYPE html>
<html lang="zh-Hant">
<head>
<meta charset="UTF-8">
<title>用藥安全評估報告</title>
<style>
  body { font-family: "Microsoft JhengHei", "Noto Sans TC", sans-serif; color: #0e141b; max-width: 800px; margin: 0 auto; padding: 32px 24px; line-height: 1.6; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; border-bottom: 2px solid #e7edf3; padding-bottom: 6px; margin: 28px 0 12px; }
  .meta { color: #4e7397; font-size: 13px; margin-bottom: 4px; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; }
  th, td { border: 1px solid #e7edf3; padding: 6px 8px; text-align: left; vertical-align: top; }
  th { background: #f1f5f9; white-space: nowrap; }
  .badge { display: inline-block; font-size: 12px; font-weight: bold; border: 1px solid; border-radius: 999px; padding: 1px 10px; }
  .ix, .risk { border: 1px solid #e7edf3; border-radius: 8px; padding: 10px 14px; margin-bottom: 10px; page-break-inside: avoid; }
  .ix-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; margin-bottom: 4px; }
  .ix p, .risk p { margin: 4px 0; font-size: 13px; }
  .sub { color: #4e7397; }
  .ok { color: #15803d; font-size: 13px; }
  ul { margin: 6px 0 0; padding-left: 20px; font-size: 13px; }
  .summary { background: #f8fafc; border: 1px solid #e7edf3; border-radius: 8px; padding: 12px 16px; font-size: 14px; }
  .disclaimer { color: #94a3b8; font-size: 12px; margin-top: 28px; border-top: 1px solid #e7edf3; padding-top: 12px; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>立安藥局　用藥安全評估報告</h1>
<p class="meta">報告產生時間：${esc(time)}</p>

<h2>整體評估摘要</h2>
<div class="summary">
  <p>${esc(result.summary)}</p>
  ${result.recommendations?.length ? `<ul>${result.recommendations.map(r => `<li>${esc(r)}</li>`).join('')}</ul>` : ''}
</div>

<h2>解析藥品清單（${meds.length}）</h2>
${meds.length ? `
<table>
  <thead><tr><th>類別</th><th>名稱</th><th>成分/學名</th><th>劑量</th><th>頻率</th><th>用法</th><th>適應症</th><th>來源</th></tr></thead>
  <tbody>
  ${meds.map(m => `<tr>
    <td>${esc(m.type)}</td>
    <td>${esc(m.name)}${m.brandName && m.brandName !== m.name ? `（${esc(m.brandName)}）` : ''}</td>
    <td>${esc(m.genericName)}</td>
    <td>${esc(m.dosage)}</td>
    <td>${esc(m.frequency)}</td>
    <td>${esc(m.route)}</td>
    <td>${esc(m.indication)}</td>
    <td>${m.source === 'manual' ? '手動輸入' : '自動解析'}</td>
  </tr>`).join('')}
  </tbody>
</table>` : '<p class="ok">未解析到任何藥品。</p>'}

<h2>藥物－藥物交互作用（${result.drugInteractions?.length ?? 0}）</h2>
${interactionRows(result.drugInteractions ?? [])}

<h2>藥物－食物交互作用（${result.foodInteractions?.length ?? 0}）</h2>
${interactionRows(result.foodInteractions ?? [])}

<h2>風險評估</h2>
${riskBlock('跌倒風險指數（Beers Criteria / STOPP v3）', result.fallRisk)}
${riskBlock('抗膽鹼負擔指數（ACB Scale）', result.anticholinergicBurden)}
${riskBlock('鎮靜昏睡風險', result.sedationRisk)}

<p class="disclaimer">⚠ ${esc(result.disclaimer)}</p>
</body>
</html>`;
}

export function downloadDrugCheckReport(result: DrugCheckResult): void {
  const now = new Date();
  const html = buildDrugCheckReportHtml(result, now);
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `用藥安全評估報告_${stamp}.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
