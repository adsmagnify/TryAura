import{w as Y,x as K,q as W,y as H,t as Q,r as l,o as e,z as G,A as X}from"./chunk-5KNZJZUH-C21ORtGP.js";import"./types-D0aIzRCm.js";import{b as Z}from"./index-CR7vH6Gl.js";function ee(t){if(!t)return"—";const n=new Date(t);return Number.isNaN(n.getTime())?"—":n.toLocaleString()}function B(t){switch(t){case"completed":return{label:"Success",tone:"ok"};case"failed":return{label:"Failed",tone:"fail"};case"processing":return{label:"Processing",tone:"pending"};case"queued":return{label:"Queued",tone:"pending"};case"retrying":return{label:"Retrying",tone:"pending"};default:return{label:t,tone:"pending"}}}function se(t){const n=B(t.status);return{id:t.id,time:ee(t.createdAt),productLabel:t.productId?`Product ${t.productId}`:"Try-on job",status:t.status,statusLabel:n.label,duration:t.processingTimeMs?`${Math.round(t.processingTimeMs/1e3)}s`:void 0,error:t.error||void 0}}const ie=Y(function(){const{shop:n,settings:a,stats:r,usage:v,activity:j,backendStatus:m,backendUrl:L,initialTab:R,isDevAdmin:E}=W(),g=H(),y=Q(),[i,c]=l.useState(R),I="nanobanana",[h,N]=l.useState(a.buttonText||"Try This Dress 👗"),[u,k]=l.useState(a.buttonColor||"#1a1a2e"),[x,w]=l.useState(a.enabled),[S,C]=l.useState(a.watermarkEnabled),[T,A]=l.useState(a.maxDailyRequests||100),[D,z]=l.useState(a.processingMessage||"Our AI is styling you..."),b=g.data;l.useEffect(()=>{N(a.buttonText||"Try This Dress"),k(a.buttonColor||"#1a1a2e"),w(a.enabled),C(a.watermarkEnabled),A(a.maxDailyRequests||100),z(a.processingMessage||"Our AI is styling you...")},[a]);const d=l.useMemo(()=>j.map(se),[j]),$=l.useMemo(()=>[["time","product","status","duration_sec","error"],...d.map(o=>[o.time,o.productLabel,o.statusLabel,o.duration||"",o.error||""])].map(o=>o.map(J=>`"${String(J).replace(/"/g,'""')}"`).join(",")).join(`
`),[d]),_=`data:text/csv;charset=utf-8,${encodeURIComponent($)}`,q=`{% if settings.tryon_enabled != false %}
  <script>
    window.TRYON_BACKEND_URL = {{ settings.tryon_api_url | default: shop.metafields.tryaura.api_url | json }};
    window.TryOnConfig = {
      apiUrl: window.TRYON_BACKEND_URL,
      productId: {{ product.id | json }},
    };
  <\/script>
  {{ 'tryon-widget.js' | asset_url | script_tag }}
{% endif %}`,O="{% render 'tryon-button' %}",F=`{
  "name": "Virtual Try-On",
  "settings": [
    {
      "type": "checkbox",
      "id": "tryon_enabled",
      "label": "Enable Virtual Try-On",
      "default": true
    },
    {
      "type": "text",
      "id": "tryon_api_url",
      "label": "Backend API URL",
      "placeholder": "https://your-backend.com"
    }
  ]
}`,U={dashboard:"Dashboard",settings:"Settings",install:"Installation Guide",logs:"Activity Logs"},M=()=>{const s=new FormData;s.set("intent","save-settings"),s.set("enabled",x?"on":"off"),s.set("watermarkEnabled",S?"on":"off"),s.set("aiProvider",I),s.set("buttonText",h),s.set("buttonColor",u),s.set("maxDailyRequests",String(T)),s.set("processingMessage",D),g.submit(s,{method:"post"})},V=()=>{const s=new FormData;s.set("intent","reset-settings"),g.submit(s,{method:"post"})},p=s=>{const o=new URLSearchParams(y.search);return o.set("tab",s),`${y.pathname}?${o.toString()}`};return e.jsxs("div",{children:[e.jsx("style",{children:te}),e.jsxs("div",{className:"shell",children:[e.jsxs("aside",{className:"sidebar",children:[e.jsxs("div",{className:"sidebar-logo",children:[e.jsx("h1",{children:"👗 Virtual Try-On"}),e.jsx("p",{children:"Shopify Plugin Admin"}),e.jsx("p",{className:"text-sm text-muted",style:{marginTop:8},children:n})]}),e.jsxs("nav",{className:"sidebar-nav",children:[e.jsxs("a",{className:`nav-item ${i==="dashboard"?"active":""}`,href:p("dashboard"),onClick:s=>{s.preventDefault(),c("dashboard")},children:[e.jsx("span",{className:"icon",children:"📊"})," Dashboard"]}),e.jsxs("a",{className:`nav-item ${i==="settings"?"active":""}`,href:p("settings"),onClick:s=>{s.preventDefault(),c("settings")},children:[e.jsx("span",{className:"icon",children:"⚙️"})," Settings"]}),e.jsxs("a",{className:`nav-item ${i==="install"?"active":""}`,href:p("install"),onClick:s=>{s.preventDefault(),c("install")},children:[e.jsx("span",{className:"icon",children:"🔌"})," Installation"]}),e.jsxs("a",{className:`nav-item ${i==="logs"?"active":""}`,href:p("logs"),onClick:s=>{s.preventDefault(),c("logs")},children:[e.jsx("span",{className:"icon",children:"📋"})," Activity Logs"]}),E?e.jsxs(G,{className:"nav-item",to:"/platform",children:[e.jsx("span",{className:"icon",children:"🛠️"})," Platform Admin"]}):null]}),e.jsx("div",{className:"sidebar-footer",children:"v1.0.0 · AI Try-On Plugin"})]}),e.jsxs("div",{className:"main",children:[e.jsxs("div",{className:"topbar",children:[e.jsx("h2",{children:U[i]}),e.jsxs("div",{className:"topbar-actions",children:[e.jsxs("span",{className:`badge ${x?"badge-green":"badge-red"}`,children:[e.jsx("span",{className:"dot"})," ",x?"Plugin Active":"Plugin Disabled"]}),i==="settings"?e.jsx("button",{className:"btn btn-primary btn-sm",onClick:M,children:"💾 Save Changes"}):null]})]}),e.jsxs("div",{className:"content",children:[i==="dashboard"?e.jsxs("div",{id:"tab-dashboard",children:[b?e.jsx("div",{className:`alert ${b.ok?"alert-success":"alert-error"}`,children:b.message}):null,m==="unreachable"?e.jsx("div",{className:"alert alert-error",children:"⚠ Backend not reachable. Connect backend to sync settings."}):null,m==="unauthorized"?e.jsxs("div",{className:"alert alert-info",children:["ℹ Backend is reachable, but admin API auth failed. Set matching ",e.jsx("code",{style:{fontFamily:"monospace"},children:"API_SECRET"})," for frontend and backend."]}):null,m==="connected"?e.jsxs("div",{className:"alert alert-success",children:["✓ Backend connected at ",L]}):null,e.jsxs("div",{className:"stats-grid",children:[e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Total Try-Ons"}),e.jsx("div",{className:"stat-value",children:r.totalJobs}),e.jsx("div",{className:"stat-change",children:r.totalJobs===0?"No try-ons yet":"Live from backend"})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Success Rate"}),e.jsx("div",{className:"stat-value",children:`${r.successRate}%`}),e.jsx("div",{className:"stat-change",children:r.totalJobs===0?"—":"Live from backend"})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Avg. Processing"}),e.jsx("div",{className:"stat-value",children:r.averageProcessingTimeMs?`${Math.round(r.averageProcessingTimeMs/1e3)}s`:"—"}),e.jsx("div",{className:"stat-change",children:r.totalJobs===0?"—":"Live from backend"})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Failed Jobs"}),e.jsx("div",{className:"stat-value",children:r.failedJobs}),e.jsx("div",{className:"stat-change",children:r.totalJobs===0?"—":"Live from backend"})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Daily Usage"}),e.jsxs("div",{className:"stat-value",children:[v.dailyUsed," / ",r.dailyLimit??a.maxDailyRequests]}),e.jsx("div",{className:"stat-change",children:"Resets daily"})]}),e.jsxs("div",{className:"stat-card",children:[e.jsx("div",{className:"stat-label",children:"Monthly Usage"}),e.jsxs("div",{className:"stat-value",children:[v.monthlyUsed," / ",r.monthlyLimit??"—"]}),e.jsx("div",{className:"stat-change",children:"Set by TryAura platform"})]})]}),e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-header",children:e.jsxs("div",{children:[e.jsx("div",{className:"card-title",children:"Plugin Controls"}),e.jsx("div",{className:"card-subtitle",children:"Quickly enable or disable features store-wide"})]})}),e.jsxs("div",{className:"toggle-row",children:[e.jsxs("div",{className:"toggle-info",children:[e.jsx("h4",{children:"Virtual Try-On Button"}),e.jsx("p",{children:'Show "Try This Dress" button on all product pages'})]}),e.jsxs("label",{className:"toggle",children:[e.jsx("input",{type:"checkbox",checked:x,onChange:s=>w(s.target.checked)}),e.jsx("span",{className:"toggle-track"})]})]}),e.jsxs("div",{className:"toggle-row",children:[e.jsxs("div",{className:"toggle-info",children:[e.jsx("h4",{children:"Mobile Support"}),e.jsx("p",{children:"Display button and modal on mobile devices"})]}),e.jsxs("label",{className:"toggle",children:[e.jsx("input",{type:"checkbox",defaultChecked:!0}),e.jsx("span",{className:"toggle-track"})]})]}),e.jsxs("div",{className:"toggle-row",children:[e.jsxs("div",{className:"toggle-info",children:[e.jsx("h4",{children:"Download Button"}),e.jsx("p",{children:"Allow customers to download their try-on result"})]}),e.jsxs("label",{className:"toggle",children:[e.jsx("input",{type:"checkbox",defaultChecked:!0}),e.jsx("span",{className:"toggle-track"})]})]}),e.jsxs("div",{className:"toggle-row",children:[e.jsxs("div",{className:"toggle-info",children:[e.jsx("h4",{children:"Result Watermark"}),e.jsx("p",{children:"Add your store name watermark to generated images"})]}),e.jsxs("label",{className:"toggle",children:[e.jsx("input",{type:"checkbox",checked:S,onChange:s=>C(s.target.checked)}),e.jsx("span",{className:"toggle-track"})]})]})]}),e.jsxs("div",{className:"card",children:[e.jsxs("div",{className:"card-header",children:[e.jsx("div",{className:"card-title",children:"Recent Activity"}),e.jsx("a",{className:"btn btn-ghost btn-sm",href:p("logs"),onClick:s=>{s.preventDefault(),c("logs")},children:"View All →"})]}),d.length===0?e.jsxs("p",{className:"text-muted text-sm",children:["No try-ons yet for ",n,"."]}):d.slice(0,4).map(s=>e.jsx(P,{log:s,compact:!0},s.id))]})]}):null,i==="settings"?e.jsxs("div",{id:"tab-settings",children:[e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-header",children:e.jsxs("div",{children:[e.jsx("div",{className:"card-title",children:"AI Provider"}),e.jsx("div",{className:"card-subtitle",children:"Choose your AI processing backend"})]})}),e.jsx("div",{className:"provider-grid",children:e.jsxs("div",{className:"provider-option selected",children:[e.jsx("div",{className:"provider-check",children:"✓"}),e.jsx("h4",{children:"🍌 Nano Banana Pro"}),e.jsx("p",{children:"Exclusive model · Production quality · Optimized latency"})]})}),e.jsx("p",{className:"text-sm text-muted",style:{marginBottom:16},children:"More models coming soon."}),e.jsxs("div",{className:"form-row",children:[e.jsxs("label",{className:"form-label",children:["API Key ",e.jsx("span",{children:"(stored securely server-side)"})]}),e.jsx("input",{type:"text",placeholder:"Enter your Nano Banana Pro API key"})]}),e.jsxs("div",{className:"alert alert-info",style:{marginBottom:0},children:["ℹ API keys are stored in your backend ",e.jsx("code",{style:{fontFamily:"monospace"},children:".env"})," file and never exposed to the browser."]})]}),e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-header",children:e.jsx("div",{className:"card-title",children:"Button Appearance"})}),e.jsxs("div",{className:"form-grid-2",children:[e.jsxs("div",{className:"form-row",style:{marginBottom:0},children:[e.jsx("label",{className:"form-label",children:"Button Label"}),e.jsx("input",{type:"text",value:h,onChange:s=>N(s.target.value)})]}),e.jsxs("div",{className:"form-row",style:{marginBottom:0},children:[e.jsx("label",{className:"form-label",children:"Button Colour"}),e.jsx("input",{type:"color",value:u,onChange:s=>k(s.target.value)})]})]}),e.jsx("div",{className:"mt-2 text-sm text-muted",children:"Preview:"}),e.jsx("div",{style:{marginTop:10},children:e.jsx("button",{id:"btn-preview",style:{display:"inline-flex",alignItems:"center",gap:8,padding:"12px 24px",background:u,color:"#fff",border:"none",borderRadius:8,fontSize:15,fontWeight:600,cursor:"default",fontFamily:"inherit"},children:h})})]}),e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-header",children:e.jsx("div",{className:"card-title",children:"Limits & Messages"})}),e.jsxs("div",{className:"form-grid-2",children:[e.jsxs("div",{className:"form-row",children:[e.jsx("label",{className:"form-label",children:"Max Daily Requests"}),e.jsx("input",{type:"number",value:T,onChange:s=>A(Number(s.target.value)),min:1,max:1e4})]}),e.jsxs("div",{className:"form-row",children:[e.jsx("label",{className:"form-label",children:"Max File Size (MB)"}),e.jsx("input",{type:"number",defaultValue:10,min:1,max:20})]})]}),e.jsxs("div",{className:"form-row",children:[e.jsxs("label",{className:"form-label",children:["Processing Message ",e.jsx("span",{children:"(shown while AI works)"})]}),e.jsx("input",{type:"text",value:D,onChange:s=>z(s.target.value)})]}),e.jsxs("div",{className:"form-row",style:{marginBottom:0},children:[e.jsxs("label",{className:"form-label",children:["Error Message ",e.jsx("span",{children:"(shown on failure)"})]}),e.jsx("input",{type:"text",defaultValue:"Something went wrong. Please try a clearer photo."})]})]}),e.jsxs("div",{style:{display:"flex",justifyContent:"flex-end",gap:10},children:[e.jsx("button",{className:"btn btn-ghost",onClick:V,children:"Reset to Defaults"}),e.jsx("button",{className:"btn btn-primary",onClick:M,children:"💾 Save Settings"})]})]}):null,i==="install"?e.jsxs("div",{id:"tab-install",children:[e.jsx("div",{className:"alert alert-info",children:"📌 Follow these steps to add the Virtual Try-On plugin to your Shopify theme."}),e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-title",style:{marginBottom:16},children:"Step 1 — Upload the Plugin File"}),e.jsxs("p",{className:"text-sm text-muted",style:{marginBottom:14},children:["In your Shopify admin, go to ",e.jsx("strong",{children:"Online Store → Themes → Actions → Edit Code"}),". Under ",e.jsx("strong",{children:"Assets"}),", upload the file ",e.jsx("code",{style:{fontFamily:"monospace"},children:"tryon-widget.js"}),"."]}),e.jsx("p",{className:"text-sm text-muted",children:"You can download the latest plugin file here:"}),e.jsx("div",{style:{marginTop:12},children:e.jsx("a",{href:"/tryon-widget.js",download:!0,className:"btn btn-primary",children:"⬇ Download tryon-widget.js"})})]}),e.jsx(f,{title:"Step 2 — Add the Liquid Snippet",text:"Create a new snippet called tryon-button.liquid and paste this code:",code:q}),e.jsx(f,{title:"Step 3 — Render in Product Template",text:"In your product template (e.g. sections/main-product.liquid), add this line just after your Add-to-Cart button block:",code:O}),e.jsx(f,{title:"Step 4 — Configure Theme Settings",text:"Add these settings to your config/settings_schema.json:",code:F})]}):null,i==="logs"?e.jsx("div",{id:"tab-logs",children:e.jsxs("div",{className:"card",children:[e.jsxs("div",{className:"card-header",children:[e.jsx("div",{className:"card-title",children:"Activity Log"}),e.jsx("a",{className:"btn btn-ghost btn-sm",href:_,download:"tryon-activity.csv",children:"⬇ Export CSV"})]}),e.jsx("div",{children:d.length===0?e.jsxs("p",{className:"text-muted text-sm",children:["No activity for ",n," yet."]}):d.map(s=>e.jsx(P,{log:s},s.id))})]})}):null]})]})]})]})});function P({log:t,compact:n=!1}){const a=B(t.status).tone,r=a==="ok"?"badge-green":a==="fail"?"badge-red":"badge-amber";return e.jsxs("div",{className:"log-row",children:[e.jsx("div",{className:`log-status ${a}`}),e.jsxs("div",{style:{flex:1},children:[e.jsxs("div",{children:[e.jsx("strong",{children:t.productLabel}),!n&&t.error?e.jsxs(e.Fragment,{children:[" — ",t.error]}):null]}),e.jsxs("div",{className:"log-meta",children:[t.time,t.duration?` · ${t.duration}`:""]}),n&&t.error?e.jsx("div",{className:"text-sm",style:{color:"var(--red)"},children:t.error}):null]}),e.jsx("span",{className:`badge ${r}`,children:t.statusLabel})]})}function f({title:t,text:n,code:a}){const r=async()=>{await navigator.clipboard.writeText(a)};return e.jsxs("div",{className:"card",children:[e.jsx("div",{className:"card-title",style:{marginBottom:16},children:t}),e.jsx("p",{className:"text-sm text-muted",style:{marginBottom:14},children:n}),e.jsxs("div",{className:"code-block",style:{position:"relative"},children:[e.jsx("button",{className:"copy-btn",onClick:r,children:"Copy"}),e.jsx("pre",{children:a})]})]})}const te=`
@import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300;0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&family=DM+Mono:wght@400;500&display=swap');
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
:root {
  --bg: #f4f5f7;
  --surface: #ffffff;
  --surface-2: #f9fafb;
  --border: #e5e7eb;
  --text: #111827;
  --text-2: #6b7280;
  --text-3: #9ca3af;
  --accent: #1a1a2e;
  --accent-hover: #2d2d4e;
  --green: #16a34a;
  --green-bg: #f0fdf4;
  --green-border: #bbf7d0;
  --red: #dc2626;
  --red-bg: #fef2f2;
  --amber: #d97706;
  --amber-bg: #fffbeb;
  --radius: 12px;
  --radius-sm: 8px;
  --shadow: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
}
body { font-family: 'DM Sans', sans-serif; background: var(--bg); color: var(--text); min-height: 100vh; font-size: 15px; line-height: 1.6; }
.shell { display: flex; min-height: 100vh; }
.sidebar { width: 240px; background: var(--accent); color: #fff; display: flex; flex-direction: column; position: fixed; top: 0; left: 0; bottom: 0; z-index: 100; }
.sidebar-logo { padding: 24px 20px; border-bottom: 1px solid rgba(255,255,255,0.1); }
.sidebar-logo h1 { font-size: 16px; font-weight: 700; letter-spacing: -0.01em; }
.sidebar-logo p { font-size: 12px; opacity: 0.55; margin-top: 2px; }
.sidebar-nav { padding: 12px 10px; flex: 1; }
.nav-item { display: flex; align-items: center; gap: 10px; padding: 10px 12px; border-radius: 8px; cursor: pointer; font-size: 14px; font-weight: 500; transition: background 0.15s; color: rgba(255,255,255,0.7); margin-bottom: 2px; }
.nav-item:hover { background: rgba(255,255,255,0.1); color: #fff; }
.nav-item.active { background: rgba(255,255,255,0.15); color: #fff; }
.nav-item .icon { font-size: 16px; width: 20px; text-align: center; }
.sidebar-footer { padding: 16px 20px; border-top: 1px solid rgba(255,255,255,0.1); font-size: 12px; color: rgba(255,255,255,0.4); }
.main { margin-left: 240px; flex: 1; display: flex; flex-direction: column; }
.topbar { background: var(--surface); border-bottom: 1px solid var(--border); padding: 16px 32px; display: flex; align-items: center; justify-content: space-between; position: sticky; top: 0; z-index: 50; }
.topbar h2 { font-size: 18px; font-weight: 600; }
.topbar-actions { display: flex; gap: 10px; align-items: center; }
.badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 12px; font-weight: 600; }
.badge-green { background: var(--green-bg); color: var(--green); border: 1px solid var(--green-border); }
.badge-red { background: var(--red-bg); color: var(--red); }
.badge-amber { background: var(--amber-bg); color: var(--amber); }
.dot { width: 6px; height: 6px; border-radius: 50%; background: currentColor; }
.content { padding: 32px; flex: 1; }
.card { background: var(--surface); border-radius: var(--radius); border: 1px solid var(--border); box-shadow: var(--shadow); padding: 24px; margin-bottom: 20px; }
.card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 20px; }
.card-title { font-size: 16px; font-weight: 600; }
.card-subtitle { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.stats-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 16px; margin-bottom: 24px; }
.stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 20px; box-shadow: var(--shadow); }
.stat-label { font-size: 12px; color: var(--text-2); font-weight: 500; text-transform: uppercase; letter-spacing: 0.05em; }
.stat-value { font-size: 30px; font-weight: 700; margin: 6px 0 4px; letter-spacing: -0.02em; font-family: 'DM Mono', monospace; }
.stat-change { font-size: 12px; color: var(--text-3); }
.stat-change.up { color: var(--green); }
.toggle-row { display: flex; align-items: center; justify-content: space-between; padding: 16px 0; border-bottom: 1px solid var(--border); }
.toggle-row:last-child { border-bottom: none; padding-bottom: 0; }
.toggle-info h4 { font-size: 14px; font-weight: 600; }
.toggle-info p { font-size: 13px; color: var(--text-2); margin-top: 2px; }
.toggle { position: relative; width: 44px; height: 24px; flex-shrink: 0; }
.toggle input { opacity: 0; width: 0; height: 0; }
.toggle-track { position: absolute; inset: 0; background: #d1d5db; border-radius: 12px; cursor: pointer; transition: background 0.2s; }
.toggle input:checked + .toggle-track { background: var(--green); }
.toggle-track::after { content: ''; position: absolute; width: 18px; height: 18px; background: #fff; border-radius: 50%; top: 3px; left: 3px; transition: transform 0.2s; box-shadow: 0 1px 3px rgba(0,0,0,0.2); }
.toggle input:checked + .toggle-track::after { transform: translateX(20px); }
.form-row { margin-bottom: 20px; }
label.form-label { display: block; font-size: 13px; font-weight: 600; color: var(--text); margin-bottom: 6px; }
label.form-label span { color: var(--text-3); font-weight: 400; }
input[type="text"], input[type="number"], input[type="color"], select, textarea { width: 100%; padding: 10px 14px; border: 1px solid var(--border); border-radius: var(--radius-sm); font-family: inherit; font-size: 14px; color: var(--text); background: var(--surface); transition: border-color 0.15s, box-shadow 0.15s; outline: none; }
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 3px rgba(26,26,46,0.08); }
input[type="color"] { padding: 4px; height: 40px; cursor: pointer; }
.form-grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.btn { padding: 10px 20px; border-radius: var(--radius-sm); font-family: inherit; font-size: 14px; font-weight: 600; border: none; cursor: pointer; transition: background 0.15s, transform 0.1s, box-shadow 0.15s; display: inline-flex; align-items: center; gap: 6px; text-decoration: none; }
.btn:active { transform: translateY(1px); }
.btn-primary { background: var(--accent); color: #fff; }
.btn-primary:hover { background: var(--accent-hover); box-shadow: 0 4px 12px rgba(26,26,46,0.25); }
.btn-ghost { background: transparent; color: var(--text-2); border: 1px solid var(--border); }
.btn-ghost:hover { background: var(--surface-2); }
.btn-sm { padding: 6px 14px; font-size: 13px; }
.alert { display: flex; gap: 12px; padding: 14px 16px; border-radius: var(--radius-sm); font-size: 14px; margin-bottom: 20px; }
.alert-success { background: var(--green-bg); border: 1px solid var(--green-border); color: var(--green); }
.alert-error { background: var(--red-bg); border: 1px solid #fecaca; color: var(--red); }
.alert-info { background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; }
.provider-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 20px; }
.provider-option { border: 2px solid var(--border); border-radius: var(--radius); padding: 16px; cursor: pointer; transition: border-color 0.15s, background 0.15s; position: relative; }
.provider-option.selected { border-color: var(--accent); background: #f8f8fc; }
.provider-option h4 { font-size: 14px; font-weight: 700; margin-bottom: 4px; }
.provider-option p { font-size: 12px; color: var(--text-2); }
.provider-check { position: absolute; top: 12px; right: 12px; width: 20px; height: 20px; border-radius: 50%; background: var(--accent); color: #fff; font-size: 11px; display: none; align-items: center; justify-content: center; }
.provider-option.selected .provider-check { display: flex; }
.code-block { background: #1e1e2e; color: #cdd6f4; border-radius: var(--radius-sm); padding: 16px; font-family: 'DM Mono', monospace; font-size: 13px; line-height: 1.7; overflow-x: auto; position: relative; }
.copy-btn { position: absolute; top: 10px; right: 10px; background: rgba(255,255,255,0.1); color: #cdd6f4; border: none; border-radius: 6px; padding: 4px 10px; font-size: 11px; cursor: pointer; font-family: inherit; transition: background 0.15s; }
.copy-btn:hover { background: rgba(255,255,255,0.2); }
.log-row { display: flex; align-items: center; gap: 16px; padding: 12px 0; border-bottom: 1px solid var(--border); font-size: 14px; }
.log-row:last-child { border-bottom: none; }
.log-status { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.log-status.ok { background: var(--green); }
.log-status.fail { background: var(--red); }
.log-status.pending { background: var(--amber); }
.log-meta { color: var(--text-3); font-size: 12px; font-family: 'DM Mono', monospace; }
.text-muted { color: var(--text-2); }
.text-sm { font-size: 13px; }
.mt-2 { margin-top: 8px; }
@media (max-width: 900px) {
  .stats-grid { grid-template-columns: 1fr 1fr; }
  .sidebar { display: none; }
  .main { margin-left: 0; }
}
@media (max-width: 580px) {
  .stats-grid { grid-template-columns: 1fr; }
  .form-grid-2 { grid-template-columns: 1fr; }
  .provider-grid { grid-template-columns: 1fr; }
  .content { padding: 20px 16px; }
}
`,oe=K(function(){return Z.error(X())});export{oe as ErrorBoundary,ie as default};
