const loginBox = document.getElementById("loginBox");
const dashboard = document.getElementById("dashboard");
const notice = document.getElementById("notice");
const adminStatus = document.getElementById("adminStatus");
function message(el, text, error=false) { el.textContent=text; el.className=error?"notice-error":"notice-ok"; }
async function api(url, options={}) {
  const response = await fetch(url, { credentials:"same-origin", ...options,
    headers: { ...(options.body ? {"Content-Type":"application/json"} : {}), ...(options.headers||{}) }});
  let data = {}; try { data = await response.json(); } catch {}
  if (!response.ok) throw new Error(data.error || "Request असफल हुआ।");
  return data;
}
async function checkSession() {
  try { const me=await api("/api/admin/me"); showDashboard(me.username); await loadAdminJobs(); }
  catch { loginBox.classList.remove("hidden"); dashboard.classList.add("hidden"); }
}
function showDashboard(username) {
  loginBox.classList.add("hidden"); dashboard.classList.remove("hidden");
  message(adminStatus, `Logged in: ${username}`);
}
document.getElementById("loginForm").addEventListener("submit", async e => {
  e.preventDefault(); const form=new FormData(e.currentTarget);
  try { const result=await api("/api/admin/login",{method:"POST",body:JSON.stringify({username:form.get("username"),password:form.get("password")})});
    e.currentTarget.reset(); showDashboard(result.username); await loadAdminJobs(); message(notice,"Login सफल हुआ।");
  } catch(err) { message(notice,err.message,true); }
});
document.getElementById("logout").addEventListener("click", async () => {
  try { await api("/api/admin/logout",{method:"POST"}); } catch {}
  dashboard.classList.add("hidden"); loginBox.classList.remove("hidden"); message(notice,"Logout हो गया।");
});
document.getElementById("jobForm").addEventListener("submit", async e => {
  e.preventDefault(); const form=new FormData(e.currentTarget); const payload=Object.fromEntries(form.entries());
  try { await api("/api/admin/jobs",{method:"POST",body:JSON.stringify(payload)}); e.currentTarget.reset(); message(notice,"Job database में add हो गई।"); await loadAdminJobs(); }
  catch(err) { message(notice,err.message,true); }
});
async function loadAdminJobs() {
  const jobs=await api("/api/jobs"); const list=document.getElementById("adminJobs"); list.replaceChildren();
  if(!jobs.length){const p=document.createElement("p");p.textContent="अभी कोई job listing नहीं है।";list.append(p);return;}
  jobs.forEach(job=>{
    const item=document.createElement("div");item.className="admin-job";
    const title=document.createElement("strong");title.textContent=`${job.title} — ${job.organization}`;
    const info=document.createElement("p");info.textContent=`${job.state} | ${job.category} | अंतिम तिथि: ${job.last_date||"नहीं दी गई"}`;
    const del=document.createElement("button");del.textContent="Delete";
    del.addEventListener("click",async()=>{if(!confirm("क्या आप यह job हटाना चाहते हैं?"))return;try{await api(`/api/admin/jobs/${job.id}`,{method:"DELETE"});await loadAdminJobs();message(notice,"Job हट गई।")}catch(e){message(notice,e.message,true)}});
    item.append(title,info,del);list.append(item);
  });
}
checkSession();