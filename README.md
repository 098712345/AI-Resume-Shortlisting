# Resume Shortlisting System

A full-stack project where companies post job descriptions and review candidate
applications. Candidates create accounts, upload résumés, browse open roles, and
apply. Applicant results show recognized skill coverage and TF-IDF text
similarity to help companies compare résumés with a role.

## Features

- Separate candidate and company accounts.
- Company job posts and applicant review.
- Candidate résumé upload and job applications.
- PDF, DOCX, and TXT text extraction.
- Skill coverage, matched and undetected skills, and TF-IDF cosine similarity.
- Application status tracking and access-controlled résumé downloads.

Matching is a prototype aid, not a trained hiring model or an automatic decision.
The skill list is finite, and companies should review the source résumé.

## Run locally on Windows

Start the backend and frontend in separate PowerShell terminals.

### Backend

```powershell
cd "C:\Users\omkar\Desktop\Resume Shorlist\Backend"
py -3.11 -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --host 127.0.0.1 --port 8000
```

If the virtual environment already exists, skip its creation command. The API
docs are at `http://127.0.0.1:8000/docs`.

### Frontend

```powershell
cd "C:\Users\omkar\Desktop\Resume Shorlist\Frontend"
npm install
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

More details are in [the project report](PROJECT_REPORT.md) and
[`Backend/README.md`](Backend/README.md).

## Local data and deployment

The SQLite database and uploaded résumé files are local application data and are
excluded from Git. For deployment, configure a strong `SHORTLIST_SECRET_KEY`,
serve over HTTPS, and use protected durable storage.
