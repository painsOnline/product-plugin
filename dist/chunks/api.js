import{a as m}from"./constants.js";function w(o){const e=document.getElementById("product-plugin-topbar");if(e)return e;const t=document.createElement("div");t.id="product-plugin-topbar",t.style.cssText=`
    position: fixed; top: 0; left: 0; right: 0; z-index: 99999;
    background: #fff0e6; border-bottom: 2px solid #ff6b00;
    padding: 10px 20px; display: flex; align-items: center;
    justify-content: space-between; font-family: sans-serif;
  `;const n=document.createElement("span");n.style.cssText="color: #333; font-size: 14px;",n.textContent=`系统识别到您已进入到 ${o} 平台商品详情页，可以点击右方按钮抓取商品详细数据`;const s=document.createElement("button");return s.id="product-plugin-grab-btn",s.style.cssText=`
    background: #ff6b00; color: #fff; border: none; padding: 8px 20px;
    border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: bold;
  `,s.textContent="一键抓取商品数据",t.appendChild(n),t.appendChild(s),document.body.insertBefore(t,document.body.firstChild),document.body.style.marginTop="50px",t}function C(o,e){const t=document.createElement("div");t.id="product-plugin-modal-overlay",t.style.cssText=`
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    z-index: 100000; display: flex; align-items: center;
    justify-content: center;
  `;const n=document.createElement("div");n.style.cssText=`
    background: #fff; border-radius: 8px; padding: 24px;
    max-width: 700px; max-height: 80vh; width: 90%;
    overflow-y: auto; box-shadow: 0 4px 24px rgba(0,0,0,0.15);
  `;const s=document.createElement("div");s.style.cssText=`
    display: flex; justify-content: space-between; align-items: center;
    margin-bottom: 16px; border-bottom: 1px solid #eee; padding-bottom: 12px;
  `;const r=document.createElement("h3");r.style.cssText="margin: 0; font-size: 18px;",r.textContent=o;const a=document.createElement("button");a.textContent="×",a.style.cssText=`
    background: none; border: none; font-size: 24px; cursor: pointer;
    color: #999;
  `,s.appendChild(r),s.appendChild(a),n.appendChild(s),n.appendChild(e),t.appendChild(n);const c=()=>t.remove();return a.addEventListener("click",c),t.addEventListener("click",i=>{i.target===t&&c()}),document.body.appendChild(t),{modal:n,close:c}}function E(o,e,t={}){const n=document.createElement("button");return n.textContent=o,n.style.cssText=`
    padding: 8px 20px; border-radius: 4px; cursor: pointer;
    font-size: 14px; border: none;
  `,Object.assign(n.style,t),n.addEventListener("click",e),n}async function u(o,e={}){const{method:t="GET",headers:n={},body:s,needAuth:r=!0}=e,a={"Content-Type":"application/json",...n};if(r){const l=await p();Object.assign(a,l)}const c=`${m}${o}`,i={method:t,headers:a};s&&t!=="GET"&&(i.body=JSON.stringify(s));const d=await(await fetch(c,i)).json();if(d.code==="401"&&await x()){const f=await p();return Object.assign(a,f),(await fetch(c,{...i,headers:a})).json()}return d.code==="429"&&await b()?u(o,e):d}async function p(){const o=await chrome.storage.local.get(["auth_token","tenant_code"]),e={},t=o.auth_token,n=o.tenant_code;return t&&(e.Authorization=`Bearer ${t}`),n&&(e.Tenant=n),e}async function x(){return new Promise(o=>{chrome.runtime.sendMessage({type:"SHOW_LOGIN_DIALOG"},e=>{o((e==null?void 0:e.success)??!1)})})}async function b(){return new Promise(o=>{chrome.runtime.sendMessage({type:"SHOW_CAPTCHA_FLOW"},e=>{o((e==null?void 0:e.success)??!1)})})}async function T(o,e){let t=o;if(e){const n=new URLSearchParams(e);t=`${o}?${n.toString()}`}return u(t,{method:"GET"})}async function v(o,e){return u(o,{method:"POST",body:e})}export{E as a,C as b,w as c,v as d,T as e};
