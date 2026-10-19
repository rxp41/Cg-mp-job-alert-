const jobsEl = document.getElementById("jobs");
const statusEl = document.getElementById("status");
async function loadJobs() {
  statusEl.textContent = "Jobs लोड हो रही हैं…";
  const params = new URLSearchParams();
  const q = document.getElementById("q").value.trim();
  const state = document.getElementById("state").value;
  const category = document.getElementById("category").value;
  if (q) params.set("q", q);
  if (state) params.set("state", state);
  if (category) params.set("category", category);
  try {
    const response = await fetch("/api/jobs?" + params.toString());
    if (!response.ok) throw new Error("डेटा लोड नहीं हुआ");
    const jobs = await response.json();
    jobsEl.replaceChildren();
    if (!jobs.length) {
      statusEl.textContent = "अभी कोई job listing उपलब्ध नहीं है। Admin panel से verified vacancy जोड़ें।";
      return;
    }
    statusEl.textContent = `${jobs.length} job listing मिलीं।`;
    jobs.forEach(job => {
      const card = document.createElement("article"); card.className = "job";
      const title = document.createElement("h2"); title.textContent = job.title;
      const org = document.createElement("p"); org.textContent = job.organization; org.className = "muted";
      const tags = document.createElement("div");
      [job.category, job.state].forEach(t => { const span=document.createElement("span"); span.className="tag"; span.textContent=t; tags.append(span); });
      const location = document.createElement("p"); location.textContent = "स्थान: " + job.location;
      const qual = document.createElement("p"); qual.textContent = "योग्यता: " + job.qualification;
      const date = document.createElement("p"); date.textContent = job.last_date ? "अंतिम तिथि: " + job.last_date : "अंतिम तिथि: आधिकारिक नोटिस देखें";
      const desc = document.createElement("p"); desc.textContent = job.description;
      const apply = document.createElement("a"); apply.className="apply"; apply.textContent="Official Website / Apply";
      apply.href = job.official_url; apply.target="_blank"; apply.rel="noopener noreferrer";
      card.append(title,org,tags,location,qual,date,desc,apply); jobsEl.append(card);
    });
  } catch (e) { statusEl.textContent = "Server से संपर्क नहीं हो पाया। Server चालू है या नहीं जाँचें।"; }
}
document.getElementById("search").addEventListener("click", loadJobs);
document.getElementById("q").addEventListener("keydown", e => { if (e.key === "Enter") loadJobs(); });
loadJobs();