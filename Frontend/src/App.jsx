import { useEffect, useState } from "react";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:8000";

async function apiRequest(path, token, options = {}) {
  const headers = new Headers(options.headers || {});
  if (token) headers.set("Authorization", `Bearer ${token}`);
  if (options.body && !(options.body instanceof FormData) && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json");
  }
  const response = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed. Please try again.");
  return data;
}

async function downloadResume(resumeId, token, jobId = null) {
  const query = jobId ? `?job_id=${encodeURIComponent(jobId)}` : "";
  const response = await fetch(`${API_BASE}/api/resumes/${resumeId}/download${query}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.detail || "Could not download this résumé.");
  }
  const objectUrl = URL.createObjectURL(await response.blob());
  const disposition = response.headers.get("content-disposition") || "";
  const encodedFilename = disposition.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
  const plainFilename = disposition.match(/filename="([^"]+)"/i)?.[1];
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = encodedFilename ? decodeURIComponent(encodedFilename) : plainFilename || "resume";
  link.click();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function Brand({ light = false }) {
  return <a className={`flex items-center gap-2.5 text-xl font-bold tracking-tight ${light ? "text-[#f7f5ee]" : "text-[#173c32]"}`} href="#home"><span className={`grid size-8 place-items-center rounded-full font-serif text-lg ${light ? "bg-[#f7f5ee] text-[#173c32]" : "bg-[#173c32] text-[#f7f5ee]"}`}>s</span> shortlist<span className="-ml-2 text-[#db7650]">.</span></a>;
}

function AuthPanel({ onSignedIn, onBack, initialMode = "register" }) {
  const [mode, setMode] = useState(initialMode);
  const [role, setRole] = useState("candidate");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const endpoint = mode === "register" ? "/api/auth/register" : "/api/auth/login";
    const body = mode === "register"
      ? { full_name: fullName, email, password, role, company_name: role === "company" ? companyName : null }
      : { email, password };
    try {
      const result = await apiRequest(endpoint, null, { method: "POST", body: JSON.stringify(body) });
      onSignedIn(result.access_token, result.user);
    } catch (requestError) {
      setError(requestError.message || "Could not reach the API. Make sure FastAPI is running.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen bg-[#f7f5ee] lg:grid-cols-[1fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-[#173c32] px-12 py-10 text-[#f7f5ee] lg:flex lg:min-h-screen lg:flex-col lg:justify-between xl:px-20">
        <div className="absolute -right-32 -top-20 size-[34rem] rounded-full border border-white/10" />
        <div className="absolute -right-12 top-0 size-[26rem] rounded-full border border-white/10" />
        <div className="absolute -bottom-40 left-1/4 size-[30rem] rounded-full bg-[#d9a469]/20 blur-3xl" />
        <div className="relative"><Brand light /></div>
        <div className="relative max-w-lg py-16">
          <p className="mb-6 text-[10px] font-bold tracking-[.2em] text-[#e1b887]">ONE PLACE FOR WHAT’S NEXT</p>
          <h1 className="font-serif text-6xl leading-[1.03] tracking-tight xl:text-7xl">Work worth<br />finding.<br /><i className="font-normal text-[#e1b887]">People worth</i><br /><i className="font-normal text-[#e1b887]">meeting.</i></h1>
          <p className="mt-7 max-w-sm text-sm leading-6 text-white/65">Shortlist gives companies and candidates a clearer way to meet around the right opportunity.</p>
          <div className="mt-12 flex items-center gap-4 border-t border-white/15 pt-5"><span className="font-serif text-3xl text-[#e1b887]">01</span><p className="text-xs leading-5 text-white/70">Create your own workspace.<br />Your account stays yours.</p></div>
        </div>
        <p className="relative text-[10px] tracking-wide text-white/40">SHORTLIST · A MORE HUMAN START TO HIRING</p>
      </aside>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-14 xl:px-24">
        <div className="flex items-center justify-between lg:justify-end"><span className="lg:hidden"><Brand /></span><button className="text-xs font-semibold text-slate-500 transition hover:text-[#173c32]" onClick={onBack}>← <span className="underline underline-offset-4">Back to home</span></button></div>
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10">
          <p className="text-[10px] font-bold tracking-[.19em] text-[#bd6849]">{mode === "register" ? "START YOUR NEXT CHAPTER" : "GOOD TO HAVE YOU BACK"}</p>
          <h2 className="mt-3 font-serif text-4xl font-medium tracking-tight text-[#173c32]">{mode === "register" ? "Create your account" : "Sign in"}</h2>
          <p className="mt-2 text-sm text-slate-500">{mode === "register" ? "Set up your personal Shortlist workspace." : "Return to your Shortlist workspace."}</p>
          <div className="mt-7 flex items-center gap-5 border-b border-stone-300 text-sm font-medium">
            <button className={`border-b-2 pb-3 transition ${mode === "register" ? "border-[#173c32] text-[#173c32]" : "border-transparent text-slate-400 hover:text-slate-700"}`} onClick={() => { setMode("register"); setError(""); }}>Create account</button>
            <button className={`border-b-2 pb-3 transition ${mode === "login" ? "border-[#173c32] text-[#173c32]" : "border-transparent text-slate-400 hover:text-slate-700"}`} onClick={() => { setMode("login"); setError(""); }}>Sign in</button>
          </div>
          <form className="mt-6 grid gap-4" onSubmit={submit}>
            {mode === "register" && <>
              <div><span className="mb-2 block text-xs font-semibold text-slate-700">I’m here as</span><div className="grid grid-cols-2 border-y border-stone-300">
                {[{ value: "candidate", label: "A candidate", detail: "Looking for my next role" }, { value: "company", label: "A company", detail: "Building a team" }].map((item) => <button className={`py-3 text-left transition ${item.value === "company" ? "border-l border-stone-300 pl-4" : "pr-4"} ${role === item.value ? "text-[#173c32]" : "text-slate-400 hover:text-slate-700"}`} key={item.value} onClick={() => setRole(item.value)} type="button"><strong className="block text-xs">{item.label} {role === item.value && <span className="ml-1 text-[#bd6849]">✓</span>}</strong><span className="mt-1 block text-[10px] text-slate-500">{item.detail}</span></button>)}
              </div></div>
              <label className="grid gap-1.5 text-xs font-semibold text-slate-700">{role === "company" ? "Your name" : "Full name"}<input autoComplete="name" className="h-11 border-b border-stone-300 bg-transparent px-0 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#173c32]" placeholder="e.g. Jordan Lee" value={fullName} onChange={(event) => setFullName(event.target.value)} required minLength={2} /></label>
              {role === "company" && <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Company name<input className="h-11 border-b border-stone-300 bg-transparent px-0 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#173c32]" placeholder="e.g. Northstar Studio" value={companyName} onChange={(event) => setCompanyName(event.target.value)} required /></label>}
            </>}
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Email address<input autoComplete="email" className="h-11 border-b border-stone-300 bg-transparent px-0 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#173c32]" type="email" placeholder="you@example.com" value={email} onChange={(event) => setEmail(event.target.value)} required /></label>
            <label className="grid gap-1.5 text-xs font-semibold text-slate-700">Password<input autoComplete={mode === "register" ? "new-password" : "current-password"} className="h-11 border-b border-stone-300 bg-transparent px-0 text-sm font-normal outline-none transition placeholder:text-slate-400 focus:border-[#173c32]" type="password" placeholder={mode === "register" ? "At least 8 characters" : "Enter your password"} value={password} onChange={(event) => setPassword(event.target.value)} required minLength={mode === "register" ? 8 : 1} /></label>
            {error && <p className="border-l-2 border-red-500 bg-red-50 px-3 py-2.5 text-xs text-red-700" role="alert">{error}</p>}
            <button className="mt-3 flex h-12 items-center justify-between bg-[#173c32] px-4 text-sm font-semibold text-white transition hover:bg-[#245848] disabled:cursor-wait disabled:opacity-60" type="submit" disabled={busy}><span>{busy ? "Please wait…" : mode === "register" ? `Create ${role} account` : "Sign in to your account"}</span><span aria-hidden="true">→</span></button>
          </form>
          <p className="mt-5 text-[10px] leading-5 text-slate-500">Your account type determines which workspace you can access. Company and candidate spaces stay separate.</p>
        </div>
        <p className="text-center text-[10px] text-slate-400">© 2026 Shortlist · Thoughtful matching for better hiring</p>
      </section>
    </main>
  );
}

function CompanyDashboard({ token, user }) {
  const [jobs, setJobs] = useState([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [matches, setMatches] = useState({});
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadJobs() {
    setJobs(await apiRequest("/api/company/jobs", token));
  }
  useEffect(() => {
    let active = true;
    apiRequest("/api/company/jobs", token)
      .then((data) => { if (active) setJobs(data); })
      .catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [token]);

  async function createJob(event) {
    event.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      await apiRequest("/api/jobs", token, { method: "POST", body: JSON.stringify({ title, description }) });
      setTitle("");
      setDescription("");
      setNotice("Job posted. Candidates can now find it in the job list.");
      await loadJobs();
    } catch (error) { setNotice(error.message); }
    finally { setBusy(false); }
  }

  async function showMatches(jobId) {
    setNotice("");
    try {
      const data = await apiRequest(`/api/jobs/${jobId}/matches`, token);
      setMatches((previous) => ({ ...previous, [jobId]: data.matches }));
    } catch (error) { setNotice(error.message); }
  }

  async function updateStatus(jobId, resumeId, status) {
    try {
      await apiRequest(`/api/jobs/${jobId}/matches/${resumeId}`, token, {
        method: "PATCH", body: JSON.stringify({ status }),
      });
      setMatches((previous) => ({
        ...previous,
        [jobId]: previous[jobId].map((item) => item.resume_id === resumeId ? { ...item, status } : item),
      }));
    } catch (error) { setNotice(error.message); }
  }

  async function downloadApplicantResume(resumeId, jobId) {
    try { await downloadResume(resumeId, token, jobId); }
    catch (error) { setNotice(error.message); }
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[.9fr_1.1fr]">
      <section className="h-fit rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <p className="text-[10px] font-extrabold tracking-[.16em] text-violet-700">COMPANY WORKSPACE</p>
        <h2 className="mt-2 text-2xl font-extrabold">Post a role</h2>
        <p className="mt-1 text-sm text-slate-500">This job belongs to {user.company_name}. Results can include applications and candidate profiles shared for matching.</p>
        <form className="mt-5 grid gap-3" onSubmit={createJob}>
          <label className="grid gap-1.5 text-xs font-bold">Job title<input className="rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-violet-400" value={title} onChange={(event) => setTitle(event.target.value)} required minLength={3} maxLength={160} placeholder="e.g. Frontend Engineer" /></label>
          <label className="grid gap-1.5 text-xs font-bold">Job description<textarea className="resize-y rounded-lg border border-stone-200 px-3 py-2.5 text-sm font-normal leading-6 outline-none focus:border-violet-400" value={description} onChange={(event) => setDescription(event.target.value)} required minLength={20} maxLength={20000} rows={6} placeholder="Describe responsibilities, required skills, and experience…" /></label>
          <button className="min-h-11 rounded-lg bg-violet-600 px-4 text-sm font-bold text-white hover:bg-violet-700 disabled:opacity-60" disabled={busy || !title.trim() || description.trim().length < 20}>{busy ? "Posting…" : "Post job"}</button>
        </form>
      </section>
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex items-end justify-between gap-3"><div><p className="text-[10px] font-extrabold tracking-[.16em] text-violet-700">YOUR COMPANY</p><h2 className="mt-2 text-2xl font-extrabold">Your job posts</h2></div><span className="text-xs text-slate-400">{jobs.length} total</span></div>
        {jobs.length === 0 ? <p className="mt-6 rounded-xl bg-stone-50 p-5 text-sm text-slate-500">You haven’t posted a job yet.</p> : <div className="mt-5 grid gap-3">{jobs.map((job) => (
          <article className="rounded-xl border border-stone-200 p-4" key={job.id}>
            <h3 className="font-bold">{job.title}</h3>
            <p className="mt-1 line-clamp-3 whitespace-pre-wrap text-xs leading-5 text-slate-500">{job.description}</p>
            <button className="mt-3 rounded-lg bg-violet-50 px-3 py-2 text-xs font-bold text-violet-800 hover:bg-violet-100" onClick={() => showMatches(job.id)}>{matches[job.id] ? "Refresh candidate matches" : "Find matching candidates"}</button>
            {matches[job.id] && <div className="mt-3 grid gap-2 border-t border-stone-100 pt-3">{matches[job.id].length === 0 ? <p className="text-xs text-slate-500">No applications or shared candidate profiles match this role yet.</p> : matches[job.id].map((match) => (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-stone-50 p-3" key={match.resume_id}>
                <div className="min-w-0"><strong className="block truncate text-xs">{match.candidate_name}</strong><span className="block text-[10px] text-slate-500">{match.candidate_email} · {match.filename} · {match.source === "profile" ? "Shared profile" : "Applied"}</span><span className="mt-1 block text-[10px] font-semibold text-emerald-800">Skill coverage: {match.skill_match_percentage === null ? "No recognized skills found in this job description" : `${match.skill_match_percentage}% (${match.matched_skills.length}/${match.job_skills.length})`}</span><span className="block text-[10px] text-slate-600">Found: {match.matched_skills.length ? match.matched_skills.join(", ") : "No recognized listed skills"}</span>{match.missing_skills.length > 0 && <span className="block text-[10px] text-amber-800">Not detected: {match.missing_skills.join(", ")}</span>}</div>
                <div className="flex items-center gap-2"><span className="text-right"><strong className="block text-sm font-extrabold text-violet-700">{match.match_score}%</strong><span className="block text-[9px] text-slate-400">text similarity</span></span><button className="rounded border border-stone-300 px-2 py-1 text-[10px]" onClick={() => downloadApplicantResume(match.resume_id, job.id)}>Résumé</button>{match.source === "application" ? <select aria-label={`Application status for ${match.candidate_name}`} className="rounded border border-stone-300 bg-white px-2 py-1 text-[10px]" value={match.status} onChange={(event) => updateStatus(job.id, match.resume_id, event.target.value)}><option value="submitted">Submitted</option><option value="reviewing">Reviewing</option><option value="shortlisted">Shortlisted</option><option value="rejected">Rejected</option></select> : <span className="rounded bg-sky-50 px-2 py-1 text-[10px] text-sky-800">Profile match</span>}</div>
              </div>
            ))}</div>}
          </article>
        ))}</div>}
      </section>
      {notice && <p className="rounded-lg border border-violet-200 bg-violet-50 px-4 py-3 text-xs text-violet-900 lg:col-span-2" role="status">{notice}</p>}
    </div>
  );
}

function CandidateDashboard({ token }) {
  const [jobs, setJobs] = useState([]);
  const [files, setFiles] = useState({});
  const [profileFile, setProfileFile] = useState(null);
  const [savedResumes, setSavedResumes] = useState([]);
  const [notice, setNotice] = useState("");
  const [busyJob, setBusyJob] = useState(null);
  const [uploadingProfile, setUploadingProfile] = useState(false);

  async function downloadCandidateResume(resumeId) {
    try { await downloadResume(resumeId, token); }
    catch (error) { setNotice(error.message); }
  }

  async function toggleDiscoverability(resumeId, discoverable) {
    try {
      await apiRequest(`/api/candidate/resumes/${resumeId}/discoverability`, token, {
        method: "PATCH", body: JSON.stringify({ discoverable }),
      });
      setSavedResumes((previous) => previous.map((resume) => resume.id === resumeId ? { ...resume, discoverable } : resume));
      setNotice(discoverable
        ? "Companies can now find this résumé when it matches one of their jobs."
        : "This résumé is now private to your candidate account.");
    } catch (error) { setNotice(error.message); }
  }

  async function loadCandidateData() {
    try {
      const [availableJobs, candidateResumes] = await Promise.all([
        apiRequest("/api/jobs", token),
        apiRequest("/api/candidate/resumes", token),
      ]);
      setJobs(availableJobs);
      setSavedResumes(candidateResumes);
    } catch (error) { setNotice(error.message); }
  }
  useEffect(() => {
    let active = true;
    Promise.all([apiRequest("/api/jobs", token), apiRequest("/api/candidate/resumes", token)])
      .then(([availableJobs, candidateResumes]) => {
        if (!active) return;
        setJobs(availableJobs);
        setSavedResumes(candidateResumes);
      })
      .catch((error) => { if (active) setNotice(error.message); });
    return () => { active = false; };
  }, [token]);

  async function saveProfileResume() {
    if (!profileFile) { setNotice("Choose a résumé file to upload."); return; }
    const form = new FormData();
    form.append("file", profileFile);
    setUploadingProfile(true);
    setNotice("");
    try {
      await apiRequest("/api/resumes", token, { method: "POST", body: form });
      setProfileFile(null);
      setNotice("Résumé saved to your candidate account.");
      await loadCandidateData();
    } catch (error) { setNotice(error.message); }
    finally { setUploadingProfile(false); }
  }

  async function apply(jobId) {
    const file = files[jobId];
    if (!file) { setNotice("Choose a résumé for the job you want to apply to."); return; }
    const form = new FormData();
    form.append("file", file);
    form.append("job_id", jobId);
    setBusyJob(jobId);
    setNotice("");
    try {
      const result = await apiRequest("/api/resumes", token, { method: "POST", body: form });
      const coverage = result.match.skill_match_percentage === null
        ? "No recognized skills were found in the job description"
        : `Recognized skill coverage: ${result.match.skill_match_percentage}%`;
      setNotice(`Application submitted. ${coverage}; text similarity: ${result.match.match_score}%.`);
      setFiles((previous) => ({ ...previous, [jobId]: null }));
      await loadCandidateData();
    } catch (error) { setNotice(error.message); }
    finally { setBusyJob(null); }
  }

  return (
    <div className="mx-auto grid max-w-5xl gap-8">
      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <div className="flex flex-wrap items-end justify-between gap-3"><div><p className="text-[10px] font-bold tracking-[.17em] text-[#bd6849]">YOUR CANDIDATE PROFILE</p><h2 className="mt-2 font-serif text-3xl text-[#173c32]">Your résumé</h2><p className="mt-1 text-sm text-slate-500">Save a résumé to your account now, then use it when applying to a role.</p></div><span className="text-xs text-slate-400">PDF, DOCX, or TXT · 10 MB max</span></div>
        <div className="mt-6 grid gap-5 md:grid-cols-[1fr_auto] md:items-center">
          <label className="flex min-h-20 cursor-pointer items-center gap-4 border-y border-dashed border-stone-300 px-3 py-3 hover:border-[#173c32]"><span className="grid size-10 shrink-0 place-items-center rounded-full bg-[#e9eee8] text-lg text-[#173c32]">↑</span><span className="min-w-0"><strong className="block truncate text-sm font-semibold text-[#173c32]">{profileFile?.name || "Choose a résumé file"}</strong><span className="mt-1 block text-xs text-slate-500">Your file is stored with your candidate account.</span></span><input className="sr-only" type="file" accept=".pdf,.docx,.txt" onChange={(event) => { setProfileFile(event.target.files?.[0] || null); setNotice(""); }} /></label>
          <button className="min-h-11 bg-[#173c32] px-5 text-sm font-semibold text-white transition hover:bg-[#245848] disabled:cursor-not-allowed disabled:opacity-50" disabled={!profileFile || uploadingProfile} onClick={saveProfileResume}>{uploadingProfile ? "Uploading…" : "Save résumé"}</button>
        </div>
        {notice && <p className="mt-4 border-l-2 border-[#bd6849] bg-[#f7f5ee] px-4 py-3 text-xs text-[#173c32]" role="status">{notice}</p>}
        {savedResumes.length > 0 && <div className="mt-5 border-t border-stone-100 pt-4"><p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Your résumés and applications</p><div className="grid gap-2 sm:grid-cols-2">{savedResumes.map((resume) => <div className="flex flex-wrap items-center justify-between gap-3 bg-[#f7f5ee] px-3 py-2.5" key={resume.id}><div className="min-w-0"><span className="block truncate text-xs font-medium text-slate-700">{resume.filename}</span><span className="text-[10px] text-slate-400">{resume.job_title || "Profile résumé"}{resume.job_id ? ` · ${resume.status}` : ""}</span></div><div className="flex items-center gap-3">{!resume.job_id && <label className="flex items-center gap-1.5 text-[10px] text-slate-600"><input type="checkbox" checked={Boolean(resume.discoverable)} onChange={(event) => toggleDiscoverability(resume.id, event.target.checked)} />Share for matching</label>}<button className="shrink-0 border-b border-[#173c32] text-[10px] font-semibold text-[#173c32]" onClick={() => downloadCandidateResume(resume.id)}>Download</button></div></div>)}</div><p className="mt-2 text-[10px] leading-5 text-slate-500">When enabled, companies can view and download this profile résumé for matching against their jobs. You can turn sharing off at any time.</p></div>}
      </section>

      <section className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
        <p className="text-[10px] font-bold tracking-[.17em] text-[#bd6849]">OPPORTUNITIES</p><h2 className="mt-2 font-serif text-3xl text-[#173c32]">Open roles</h2><p className="mt-1 text-sm text-slate-500">Choose a role and apply with a résumé.</p>
        {jobs.length === 0 ? <div className="mt-8 border-y border-stone-200 py-10 text-center"><span className="mx-auto grid size-12 place-items-center rounded-full bg-[#e9eee8] font-serif text-xl text-[#173c32]">⌕</span><h3 className="mt-4 text-lg font-semibold text-[#173c32]">No open roles yet</h3><p className="mx-auto mt-2 max-w-md text-sm leading-6 text-slate-500">A company needs to publish a job before it appears here. Your résumé is saved to your profile and will be ready when a role opens.</p></div> : <div className="mt-6 grid gap-4">{jobs.map((job) => <article className="rounded-xl border border-stone-200 p-5" key={job.id}><div className="flex flex-wrap items-start justify-between gap-2"><div><h3 className="text-lg font-bold">{job.title}</h3><p className="mt-1 text-xs font-semibold text-violet-700">{job.company_name}</p></div><span className="text-[10px] text-slate-400">{new Date(job.created_at).toLocaleDateString()}</span></div><p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600">{job.description}</p><div className="mt-4 flex flex-wrap items-center gap-3"><label className="flex min-h-10 cursor-pointer items-center border-b border-dashed border-stone-300 px-1 text-xs text-slate-600 hover:border-[#173c32]">{files[job.id]?.name || "Choose résumé for this application"}<input className="sr-only" type="file" accept=".pdf,.docx,.txt" onChange={(event) => setFiles((previous) => ({ ...previous, [job.id]: event.target.files?.[0] || null }))} /></label><button className="min-h-10 bg-[#173c32] px-4 text-xs font-semibold text-white hover:bg-[#245848] disabled:opacity-50" disabled={busyJob === job.id} onClick={() => apply(job.id)}>{busyJob === job.id ? "Submitting…" : "Apply with résumé"}</button></div></article>)}</div>}
      </section>
    </div>
  );
}

function App() {
  const [token, setToken] = useState(() => localStorage.getItem("shortlist_token"));
  const [user, setUser] = useState(null);
  const [restoring, setRestoring] = useState(Boolean(localStorage.getItem("shortlist_token")));
  const [page, setPage] = useState("home");
  const [authMode, setAuthMode] = useState("register");

  useEffect(() => {
    if (!token) return;
    apiRequest("/api/auth/me", token).then(setUser).catch(() => {
      localStorage.removeItem("shortlist_token");
      setToken(null);
      setUser(null);
    }).finally(() => setRestoring(false));
  }, [token]);

  function signIn(accessToken, account) {
    localStorage.setItem("shortlist_token", accessToken);
    setToken(accessToken);
    setUser(account);
  }

  function signOut() {
    localStorage.removeItem("shortlist_token");
    setToken(null);
    setUser(null);
    setPage("home");
  }

  function openAuth(mode) {
    setAuthMode(mode);
    setPage("auth");
  }

  if (!restoring && !user && page === "auth") {
    return <AuthPanel initialMode={authMode} onBack={() => setPage("home")} onSignedIn={signIn} />;
  }

  return (
    <main className="min-h-screen bg-[#f7f5ee] text-[#1c2924]">
      <div className="mx-auto max-w-[1440px] px-6 sm:px-10 lg:px-16">
        <header className="flex h-[82px] items-center justify-between border-b border-[#d9d8ce]">
          <Brand />
          {user ? <div className="flex items-center gap-4"><span className="hidden text-right sm:block"><strong className="block text-xs">{user.full_name}</strong><span className="text-[10px] capitalize text-slate-500">{user.role} account</span></span><button className="border-b border-[#173c32] pb-1 text-xs font-semibold text-[#173c32]" onClick={signOut}>Sign out</button></div> : <><nav className="hidden items-center gap-8 text-xs font-medium text-slate-600 md:flex"><a className="hover:text-[#bd6849]" href="#approach">Our approach</a><a className="hover:text-[#bd6849]" href="#for-whom">Who it’s for</a></nav><div className="flex items-center gap-4"><button className="hidden text-xs font-semibold text-[#173c32] sm:block" onClick={() => openAuth("login")}>Sign in</button><button className="bg-[#173c32] px-4 py-2.5 text-xs font-semibold text-white transition hover:bg-[#245848]" onClick={() => openAuth("register")}>Join Shortlist <span className="ml-2">↗</span></button></div></>}
        </header>
      </div>

      {restoring ? <p className="py-24 text-center text-sm text-slate-500">Restoring your account…</p> : user ? <section className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14 lg:px-12">{user.role === "company" ? <CompanyDashboard token={token} user={user} /> : <CandidateDashboard token={token} />}</section> : <>
        <section className="mx-auto grid max-w-[1440px] items-center gap-12 px-6 pb-16 pt-16 sm:px-10 sm:pb-20 sm:pt-20 md:grid-cols-[1fr_.86fr] lg:px-16 lg:pb-28 lg:pt-24">
          <div className="relative z-10 max-w-2xl">
            <p className="mb-7 text-[10px] font-bold tracking-[.22em] text-[#bd6849]">THE SEARCH FOR A GOOD FIT</p>
            <h1 className="font-serif text-[3.5rem] leading-[.98] tracking-[-.045em] text-[#173c32] sm:text-7xl lg:text-[5.7rem]">A better kind<br />of <i className="font-normal">shortlist.</i></h1>
            <p className="mt-7 max-w-lg text-sm leading-7 text-[#646b62] sm:text-base">Bring the right people and the right opportunities closer together. Thoughtful tools for hiring teams and a clearer path for candidates.</p>
            <div className="mt-8 flex flex-wrap items-center gap-5"><button className="group inline-flex items-center gap-7 bg-[#173c32] px-5 py-3.5 text-xs font-semibold text-white transition hover:bg-[#245848]" onClick={() => openAuth("register")}>Create your account <span className="transition group-hover:translate-x-1">→</span></button><button className="border-b border-[#173c32]/40 pb-1 text-xs font-semibold text-[#173c32] hover:border-[#173c32]" onClick={() => openAuth("login")}>Already a member? Sign in</button></div>
            <div className="mt-14 flex items-center gap-4 border-t border-[#d9d8ce] pt-5 text-[10px] uppercase tracking-[.12em] text-[#777d73]"><span className="size-2 rounded-full bg-[#bd6849]" /> Built for people on both sides of hiring</div>
          </div>

          <div className="relative mx-auto min-h-[430px] w-full max-w-[560px] sm:min-h-[500px]">
            <div className="absolute right-0 top-0 h-[86%] w-[82%] bg-[#173c32]" />
            <div className="absolute right-[6%] top-[8%] w-[72%] text-[#f7f5ee]"><p className="text-[9px] font-semibold tracking-[.2em] text-[#e1b887]">A ROLE WITH ROOM TO GROW</p><h2 className="mt-3 font-serif text-3xl leading-tight sm:text-4xl">Product<br />Designer</h2><p className="mt-2 text-[10px] text-white/60">Northstar Studio · Remote</p><div className="mt-7 h-px bg-white/20"/><p className="mt-4 max-w-[250px] text-xs leading-5 text-white/75">Shape useful products alongside a curious, collaborative team.</p></div>
            <div className="absolute bottom-[4%] left-0 w-[76%] border border-[#d9d8ce] bg-[#fffefa] p-5 shadow-[0_18px_45px_rgba(23,60,50,.12)] sm:p-6"><div className="flex items-center justify-between"><p className="text-[9px] font-bold tracking-[.17em] text-[#8a8e84]">A CANDIDATE PROFILE</p><span className="text-[10px] text-[#bd6849]">01 / 03</span></div><div className="mt-5 flex items-center gap-3"><span className="grid size-11 place-items-center rounded-full bg-[#e9c9ad] font-serif text-sm text-[#5f4938]">AM</span><div><h3 className="text-sm font-semibold text-[#173c32]">Alex Morgan</h3><p className="mt-1 text-[10px] text-[#858a80]">Product design · 6 years</p></div></div><div className="mt-5 flex flex-wrap gap-2"><span className="bg-[#e9eee8] px-2.5 py-1 text-[9px] text-[#355b4e]">Product strategy</span><span className="bg-[#e9eee8] px-2.5 py-1 text-[9px] text-[#355b4e]">Prototyping</span><span className="bg-[#e9eee8] px-2.5 py-1 text-[9px] text-[#355b4e]">Research</span></div><div className="mt-5 flex items-center justify-between border-t border-[#e9e8e0] pt-4"><span className="text-[10px] text-[#858a80]">Role alignment</span><span className="font-serif text-xl text-[#173c32]">Strong</span></div></div>
            <span className="absolute bottom-[12%] right-[4%] font-serif text-5xl text-[#d07a56]">✳</span>
          </div>
        </section>

        <section className="border-y border-[#d9d8ce] bg-[#efeee6]" id="for-whom"><div className="mx-auto grid max-w-[1440px] gap-0 px-6 sm:px-10 md:grid-cols-2 lg:px-16"><article className="grid gap-5 border-b border-[#d9d8ce] py-8 sm:grid-cols-[150px_1fr] sm:py-10 md:border-b-0 md:border-r md:pr-10"><p className="text-[10px] font-bold tracking-[.16em] text-[#bd6849]">FOR TEAMS</p><div><h2 className="font-serif text-3xl text-[#173c32]">Hire with more focus.</h2><p className="mt-2 max-w-md text-xs leading-6 text-[#646b62]">Create a company space, describe the role, and review applicants who have raised their hand.</p><button className="mt-4 border-b border-[#173c32]/40 pb-1 text-xs font-semibold text-[#173c32]" onClick={() => openAuth("register")}>Create a company account <span className="ml-2">→</span></button></div></article><article className="grid gap-5 py-8 sm:grid-cols-[150px_1fr] sm:py-10 md:pl-10"><p className="text-[10px] font-bold tracking-[.16em] text-[#bd6849]">FOR CANDIDATES</p><div><h2 className="font-serif text-3xl text-[#173c32]">Find work that fits.</h2><p className="mt-2 max-w-md text-xs leading-6 text-[#646b62]">Build your candidate account, explore open roles, and apply with your experience in view.</p><button className="mt-4 border-b border-[#173c32]/40 pb-1 text-xs font-semibold text-[#173c32]" onClick={() => openAuth("register")}>Create a candidate account <span className="ml-2">→</span></button></div></article></div></section>

        <section className="mx-auto max-w-[1440px] px-6 py-16 sm:px-10 sm:py-20 lg:px-16" id="approach"><div className="grid gap-8 md:grid-cols-[.8fr_1.2fr] md:gap-16"><div><p className="text-[10px] font-bold tracking-[.2em] text-[#bd6849]">A CLEARER PROCESS</p><h2 className="mt-4 max-w-sm font-serif text-4xl leading-tight text-[#173c32]">A good match starts with understanding.</h2></div><div className="divide-y divide-[#d9d8ce] border-y border-[#d9d8ce]">{[{ n: "01", title: "Tell us what matters", body: "Companies describe the role, its responsibilities, and the skills they need." }, { n: "02", title: "Bring experience forward", body: "Candidates choose an opening and submit a résumé through their own account." }, { n: "03", title: "Review with context", body: "The hiring team sees applications for its own role, with a similarity score to help guide review." }].map((step) => <article className="grid gap-3 py-5 sm:grid-cols-[56px_1fr_1.2fr] sm:gap-5" key={step.n}><span className="font-serif text-xl text-[#bd6849]">{step.n}</span><h3 className="text-sm font-semibold text-[#173c32]">{step.title}</h3><p className="text-xs leading-5 text-[#73796f]">{step.body}</p></article>)}</div></div></section>
        <section className="bg-[#173c32] px-6 py-12 text-center text-[#f7f5ee] sm:px-10 sm:py-16"><p className="text-[9px] font-semibold tracking-[.2em] text-[#e1b887]">A BETTER MATCH BEGINS HERE</p><h2 className="mt-3 font-serif text-3xl sm:text-4xl">Make your next move count.</h2><button className="mt-6 border border-white/30 px-5 py-3 text-xs font-semibold transition hover:bg-white hover:text-[#173c32]" onClick={() => openAuth("register")}>Join Shortlist <span className="ml-3">→</span></button></section>
      </>}
      <footer className="bg-[#f7f5ee]"><div className="mx-auto flex min-h-[76px] max-w-[1440px] flex-wrap items-center justify-between gap-3 px-6 py-4 text-[10px] text-[#858a80] sm:px-10 lg:px-16"><Brand /><span>Good people. Better matched.</span><span>© 2026 Shortlist</span></div></footer>
    </main>
  );
}

export default App;
