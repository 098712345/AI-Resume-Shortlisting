# Resume Shortlisting API

FastAPI service for the Shortlist React app. It provides separate company and
candidate accounts, private company workspaces, public job listings, and
candidate applications.

## Run locally on Windows

From a PowerShell terminal:

```powershell
cd "C:\Users\omkar\Desktop\Resume Shorlist\Backend"
\.venv\Scripts\python.exe -m pip install -r requirements.txt
\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

API documentation is at `http://127.0.0.1:8000/docs` and the health check is
`http://127.0.0.1:8000/api/health`.

## Accounts and access

- Create an account as a **company** or **candidate** at the homepage.
- Companies can create job posts and view applicants only for their own jobs.
- Candidates can save and download résumés, browse public job posts, apply to a specific job, and see each application status.
- Companies can post jobs, review applicant contact details and résumé matches, download application résumés, and update application status.
- Passwords are hashed. The API issues expiring bearer tokens after sign-in.
- Accounts, jobs, and application records are stored in `shortlist.db`.
- Uploaded files are stored in `uploads/`; extracted text is in SQLite.

## Main endpoints

- `POST /api/auth/register` and `POST /api/auth/login`
- `GET /api/auth/me`
- `GET /api/jobs` — public job listings
- `POST /api/jobs` — create a job as a company
- `GET /api/company/jobs` — current company's jobs
- `GET /api/candidate/resumes` — list the signed-in candidate's saved résumé records
- `POST /api/resumes` — save a profile résumé (`file` form field), or apply to a job (`file` and `job_id` form fields)
- `GET /api/resumes/{resume_id}/download` — download a résumé if you own it or own the job application
- `GET /api/jobs/{job_id}/matches` — applicants for a job, restricted to its company
- `PATCH /api/jobs/{job_id}/matches/{resume_id}` — update an application to submitted, reviewing, shortlisted, or rejected

Résumé files support PDF, DOCX, and TXT up to 10 MB. Applicant results show
recognized skill coverage (using a built-in skill and alias list) and TF-IDF
text similarity. This is a transparent baseline, not a trained hiring model;
companies should review the original résumé before making hiring decisions.

For deployment, set a strong random `SHORTLIST_SECRET_KEY` environment variable,
use HTTPS, and move the SQLite database and uploaded files to protected durable
storage. The default signing key is only for local development.
