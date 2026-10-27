"""Resume Shortlisting API with separate company and candidate accounts."""

from __future__ import annotations

import os
import re
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Generator, Literal

import jwt
from fastapi import Depends, FastAPI, File, Form, HTTPException, UploadFile
from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordBearer
from pwdlib import PasswordHash
from pydantic import BaseModel, Field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

BASE_DIR = Path(__file__).resolve().parent
DB_PATH = BASE_DIR / "shortlist.db"
UPLOAD_DIR = BASE_DIR / "uploads"
UPLOAD_DIR.mkdir(exist_ok=True)
MAX_UPLOAD_BYTES = 10 * 1024 * 1024
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
SECRET_KEY = os.getenv("SHORTLIST_SECRET_KEY", "local-development-secret-change-before-deployment")
TOKEN_TTL_HOURS = 12
password_hash = PasswordHash.recommended()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

app = FastAPI(title="Resume Shortlisting API", version="2.0.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def connect_db() -> sqlite3.Connection:
    # FastAPI can resolve synchronous dependencies and async handlers in
    # different worker threads; each request still gets its own connection.
    connection = sqlite3.connect(DB_PATH, check_same_thread=False)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def initialize_db() -> None:
    with connect_db() as db:
        db.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL UNIQUE COLLATE NOCASE,
                full_name TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('company', 'candidate')),
                company_name TEXT,
                password_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS jobs (
                id TEXT PRIMARY KEY,
                company_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                description TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS resumes (
                id TEXT PRIMARY KEY,
                candidate_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                job_id TEXT REFERENCES jobs(id) ON DELETE CASCADE,
                filename TEXT NOT NULL,
                file_path TEXT NOT NULL,
                extracted_text TEXT NOT NULL,
                uploaded_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'submitted',
                discoverable INTEGER NOT NULL DEFAULT 0
            );
            CREATE INDEX IF NOT EXISTS idx_jobs_company ON jobs(company_id);
            CREATE INDEX IF NOT EXISTS idx_resumes_job ON resumes(job_id);
            CREATE INDEX IF NOT EXISTS idx_resumes_candidate ON resumes(candidate_id);
        """)
        resume_columns = {row["name"] for row in db.execute("PRAGMA table_info(resumes)")}
        if "status" not in resume_columns:
            db.execute("ALTER TABLE resumes ADD COLUMN status TEXT NOT NULL DEFAULT 'submitted'")
        if "discoverable" not in resume_columns:
            db.execute("ALTER TABLE resumes ADD COLUMN discoverable INTEGER NOT NULL DEFAULT 0")


@app.on_event("startup")
def on_startup() -> None:
    initialize_db()


def get_db() -> Generator[sqlite3.Connection, None, None]:
    db = connect_db()
    try:
        yield db
    finally:
        db.close()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def user_public(user: sqlite3.Row | dict[str, Any]) -> dict[str, Any]:
    return {
        "id": user["id"],
        "email": user["email"],
        "full_name": user["full_name"],
        "role": user["role"],
        "company_name": user["company_name"],
    }


class RegisterInput(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    full_name: str = Field(min_length=2, max_length=120)
    password: str = Field(min_length=8, max_length=128)
    role: Literal["company", "candidate"]
    company_name: str | None = Field(default=None, max_length=160)


class LoginInput(BaseModel):
    email: str = Field(min_length=5, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class JobCreate(BaseModel):
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=20, max_length=20_000)


class ResumeVisibilityUpdate(BaseModel):
    discoverable: bool


def create_access_token(user: sqlite3.Row | dict[str, Any]) -> str:
    expires = datetime.now(timezone.utc) + timedelta(hours=TOKEN_TTL_HOURS)
    return jwt.encode(
        {"sub": user["id"], "role": user["role"], "exp": expires},
        SECRET_KEY,
        algorithm="HS256",
    )


def current_user(
    token: str = Depends(oauth2_scheme), db: sqlite3.Connection = Depends(get_db)
) -> sqlite3.Row:
    unauthorized = HTTPException(
        status_code=401,
        detail="Sign in to continue",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
        user_id = payload.get("sub")
        if not user_id:
            raise unauthorized
    except jwt.InvalidTokenError as exc:
        raise unauthorized from exc
    user = db.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    if not user:
        raise unauthorized
    return user


def require_role(role: str):
    def dependency(user: sqlite3.Row = Depends(current_user)) -> sqlite3.Row:
        if user["role"] != role:
            raise HTTPException(403, f"A {role} account is required")
        return user
    return dependency


def extract_text(path: Path, extension: str) -> str:
    if extension == ".txt":
        return path.read_text(encoding="utf-8", errors="replace")
    if extension == ".pdf":
        try:
            from pypdf import PdfReader
        except ImportError as exc:
            raise HTTPException(500, "PDF parsing is unavailable; install Backend/requirements.txt") from exc
        return "\n".join(page.extract_text() or "" for page in PdfReader(str(path)).pages)
    if extension == ".docx":
        try:
            from docx import Document
        except ImportError as exc:
            raise HTTPException(500, "DOCX parsing is unavailable; install Backend/requirements.txt") from exc
        return "\n".join(paragraph.text for paragraph in Document(str(path)).paragraphs)
    return ""


def keywords(text: str) -> set[str]:
    stop_words = {
        "and", "the", "for", "with", "from", "that", "this", "you", "your",
        "are", "our", "will", "have", "has", "who", "what", "into", "years",
        "year", "work", "team", "role", "looking", "experience", "strong",
        "ability", "must", "should", "can", "their", "they", "about", "such",
    }
    return {word for word in re.findall(r"[a-zA-Z][a-zA-Z+#.]{1,}", text.lower()) if word not in stop_words}


SKILL_ALIASES: dict[str, tuple[str, ...]] = {
    "Python": ("python",), "Java": ("java",), "JavaScript": ("javascript", "js", "ecmascript"),
    "TypeScript": ("typescript", "ts"), "C++": ("c++", "cpp"), "C#": ("c#", "c sharp"),
    "React": ("react", "react.js", "reactjs"), "Angular": ("angular",), "Vue": ("vue", "vue.js", "vuejs"),
    "Node.js": ("node.js", "nodejs", "node"), "Express": ("express", "express.js"),
    "FastAPI": ("fastapi",), "Django": ("django",), "Flask": ("flask",),
    "HTML": ("html",), "CSS": ("css",), "Tailwind CSS": ("tailwind", "tailwind css"),
    "SQL": ("sql",), "PostgreSQL": ("postgresql", "postgres"), "MySQL": ("mysql",),
    "MongoDB": ("mongodb", "mongo db"), "Redis": ("redis",), "REST API": ("rest api", "restful api"),
    "GraphQL": ("graphql",), "Git": ("git",), "Docker": ("docker",), "Kubernetes": ("kubernetes", "k8s"),
    "AWS": ("aws", "amazon web services"), "Azure": ("azure",), "Google Cloud": ("google cloud", "gcp"),
    "CI/CD": ("ci/cd", "continuous integration", "continuous delivery"),
    "Machine Learning": ("machine learning", "ml"), "Deep Learning": ("deep learning",),
    "NLP": ("natural language processing", "nlp"), "TensorFlow": ("tensorflow",),
    "PyTorch": ("pytorch",), "scikit-learn": ("scikit-learn", "sklearn"),
    "Pandas": ("pandas",), "NumPy": ("numpy",), "Excel": ("excel",),
    "Tableau": ("tableau",), "Power BI": ("power bi",), "Figma": ("figma",),
    "Agile": ("agile",), "Scrum": ("scrum",),
}


def extract_skills(text: str) -> set[str]:
    found = set()
    for skill, aliases in SKILL_ALIASES.items():
        for alias in aliases:
            pattern = rf"(?<![\w+#]){re.escape(alias)}(?![\w+#])"
            if re.search(pattern, text, flags=re.IGNORECASE):
                found.add(skill)
                break
    return found


def analyze_resume(job_description: str, resume_text: str) -> dict[str, Any]:
    job_skills = extract_skills(job_description)
    resume_skills = extract_skills(resume_text)
    matched_skills = sorted(job_skills & resume_skills)
    missing_skills = sorted(job_skills - resume_skills)
    skill_coverage = round(len(matched_skills) / len(job_skills) * 100, 1) if job_skills else None
    matched_terms = sorted(keywords(job_description) & keywords(resume_text))
    similarity = 0.0
    if job_description.strip() and resume_text.strip():
        try:
            vectors = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), sublinear_tf=True).fit_transform(
                [job_description, resume_text]
            )
            similarity = round(float(cosine_similarity(vectors[0:1], vectors[1:2])[0][0]) * 100, 1)
        except ValueError:
            pass
    return {
        "match_score": similarity,
        "matched_terms": matched_terms[:20],
        "job_skills": sorted(job_skills),
        "matched_skills": matched_skills,
        "missing_skills": missing_skills,
        "skill_match_percentage": skill_coverage,
    }


def score_resume(job_description: str, resume_text: str) -> tuple[float, list[str]]:
    """Compatibility wrapper for older callers; new responses use analyze_resume."""
    analysis = analyze_resume(job_description, resume_text)
    return analysis["match_score"], analysis["matched_terms"]


def job_public(job: sqlite3.Row) -> dict[str, Any]:
    return {
        "id": job["id"],
        "title": job["title"],
        "description": job["description"],
        "company_name": job["company_name"],
        "created_at": job["created_at"],
    }


@app.get("/api/health")
def health() -> dict[str, str]:
    return {"status": "ok", "service": "resume-shortlisting-api"}


@app.post("/api/auth/register", status_code=201)
def register(payload: RegisterInput, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    email = payload.email.strip().lower()
    if not re.fullmatch(r"[^\s@]+@[^\s@]+\.[^\s@]+", email):
        raise HTTPException(422, "Enter a valid email address")
    if payload.role == "company" and not (payload.company_name or "").strip():
        raise HTTPException(422, "Company name is required for company accounts")
    user = {
        "id": str(uuid.uuid4()),
        "email": email,
        "full_name": payload.full_name.strip(),
        "role": payload.role,
        "company_name": (payload.company_name or "").strip() if payload.role == "company" else None,
        "password_hash": password_hash.hash(payload.password),
        "created_at": utc_now(),
    }
    try:
        db.execute(
            "INSERT INTO users (id,email,full_name,role,company_name,password_hash,created_at) VALUES (?,?,?,?,?,?,?)",
            tuple(user[key] for key in ("id", "email", "full_name", "role", "company_name", "password_hash", "created_at")),
        )
        db.commit()
    except sqlite3.IntegrityError as exc:
        raise HTTPException(409, "An account with this email already exists") from exc
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_public(user)}


@app.post("/api/auth/login")
def login(payload: LoginInput, db: sqlite3.Connection = Depends(get_db)) -> dict[str, Any]:
    user = db.execute("SELECT * FROM users WHERE email = ?", (payload.email.strip().lower(),)).fetchone()
    if not user or not password_hash.verify(payload.password, user["password_hash"]):
        raise HTTPException(401, "Email or password is incorrect")
    return {"access_token": create_access_token(user), "token_type": "bearer", "user": user_public(user)}


@app.get("/api/auth/me")
def who_am_i(user: sqlite3.Row = Depends(current_user)) -> dict[str, Any]:
    return user_public(user)


@app.get("/api/jobs")
def list_jobs(db: sqlite3.Connection = Depends(get_db)) -> list[dict[str, Any]]:
    rows = db.execute(
        "SELECT jobs.*, users.company_name FROM jobs JOIN users ON users.id = jobs.company_id ORDER BY jobs.created_at DESC"
    ).fetchall()
    return [job_public(row) for row in rows]


@app.post("/api/jobs", status_code=201)
def create_job(
    payload: JobCreate,
    user: sqlite3.Row = Depends(require_role("company")),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    job_id = str(uuid.uuid4())
    created_at = utc_now()
    db.execute(
        "INSERT INTO jobs (id,company_id,title,description,created_at) VALUES (?,?,?,?,?)",
        (job_id, user["id"], payload.title.strip(), payload.description.strip(), created_at),
    )
    db.commit()
    return {"id": job_id, "title": payload.title.strip(), "description": payload.description.strip(), "company_name": user["company_name"], "created_at": created_at}


@app.get("/api/company/jobs")
def company_jobs(
    user: sqlite3.Row = Depends(require_role("company")), db: sqlite3.Connection = Depends(get_db)
) -> list[dict[str, Any]]:
    rows = db.execute(
        "SELECT jobs.*, users.company_name FROM jobs JOIN users ON users.id=jobs.company_id WHERE jobs.company_id=? ORDER BY jobs.created_at DESC",
        (user["id"],),
    ).fetchall()
    return [job_public(row) for row in rows]


@app.get("/api/candidate/resumes")
def candidate_resumes(
    user: sqlite3.Row = Depends(require_role("candidate")),
    db: sqlite3.Connection = Depends(get_db),
) -> list[dict[str, Any]]:
    rows = db.execute(
        "SELECT resumes.id,resumes.filename,resumes.job_id,resumes.uploaded_at,resumes.status,resumes.discoverable,jobs.title AS job_title "
        "FROM resumes LEFT JOIN jobs ON jobs.id=resumes.job_id "
        "WHERE resumes.candidate_id=? ORDER BY resumes.uploaded_at DESC",
        (user["id"],),
    ).fetchall()
    return [dict(row) for row in rows]


@app.patch("/api/candidate/resumes/{resume_id}/discoverability")
def update_resume_discoverability(
    resume_id: str,
    payload: ResumeVisibilityUpdate,
    user: sqlite3.Row = Depends(require_role("candidate")),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    result = db.execute(
        "UPDATE resumes SET discoverable=? WHERE id=? AND candidate_id=? AND job_id IS NULL",
        (int(payload.discoverable), resume_id, user["id"]),
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Profile résumé not found")
    db.commit()
    return {"resume_id": resume_id, "discoverable": payload.discoverable}


@app.get("/api/jobs/{job_id}/matches")
def get_matches(
    job_id: str,
    user: sqlite3.Row = Depends(require_role("company")),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    job = db.execute("SELECT * FROM jobs WHERE id=? AND company_id=?", (job_id, user["id"])).fetchone()
    if not job:
        raise HTTPException(404, "Job not found")
    rows = db.execute(
        "SELECT resumes.id,resumes.filename,resumes.extracted_text,resumes.uploaded_at,resumes.status,users.full_name,users.email,"
        "CASE WHEN resumes.job_id IS NULL THEN 'profile' ELSE 'application' END AS source "
        "FROM resumes JOIN users ON users.id=resumes.candidate_id "
        "WHERE resumes.job_id=? OR (resumes.job_id IS NULL AND resumes.discoverable=1 "
        "AND resumes.id=(SELECT profile.id FROM resumes AS profile WHERE profile.candidate_id=resumes.candidate_id "
        "AND profile.job_id IS NULL AND profile.discoverable=1 ORDER BY profile.uploaded_at DESC LIMIT 1) "
        "AND NOT EXISTS (SELECT 1 FROM resumes AS application WHERE application.candidate_id=resumes.candidate_id AND application.job_id=?))",
        (job_id, job_id),
    ).fetchall()
    matches = []
    for resume in rows:
        analysis = analyze_resume(job["description"], resume["extracted_text"])
        matches.append({
            "resume_id": resume["id"],
            "candidate_name": resume["full_name"],
            "candidate_email": resume["email"],
            "filename": resume["filename"],
            "uploaded_at": resume["uploaded_at"],
            "status": resume["status"],
            "source": resume["source"],
            **analysis,
        })
    matches.sort(
        key=lambda item: (
            item["skill_match_percentage"] if item["skill_match_percentage"] is not None else -1,
            item["match_score"],
        ),
        reverse=True,
    )
    return {"job_id": job_id, "matches": matches, "scoring": "skill_coverage_and_tfidf_cosine_similarity"}


@app.patch("/api/jobs/{job_id}/matches/{resume_id}")
def update_application_status(
    job_id: str,
    resume_id: str,
    payload: dict[str, str],
    user: sqlite3.Row = Depends(require_role("company")),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, str]:
    status = payload.get("status", "").lower()
    if status not in {"submitted", "reviewing", "shortlisted", "rejected"}:
        raise HTTPException(422, "Choose submitted, reviewing, shortlisted, or rejected")
    result = db.execute(
        "UPDATE resumes SET status=? WHERE id=? AND job_id=? AND EXISTS "
        "(SELECT 1 FROM jobs WHERE jobs.id=resumes.job_id AND jobs.company_id=?)",
        (status, resume_id, job_id, user["id"]),
    )
    if result.rowcount == 0:
        raise HTTPException(404, "Application not found")
    db.commit()
    return {"resume_id": resume_id, "status": status}


@app.get("/api/resumes/{resume_id}/download")
def download_resume(
    resume_id: str,
    job_id: str | None = None,
    user: sqlite3.Row = Depends(current_user),
    db: sqlite3.Connection = Depends(get_db),
) -> FileResponse:
    resume = db.execute(
        "SELECT resumes.filename,resumes.file_path,resumes.candidate_id,resumes.job_id "
        "FROM resumes WHERE resumes.id=?", (resume_id,),
    ).fetchone()
    if not resume:
        raise HTTPException(404, "Résumé not found")
    permitted = resume["candidate_id"] == user["id"]
    if user["role"] == "company":
        relevant_job_id = resume["job_id"] or job_id
        job = db.execute("SELECT company_id FROM jobs WHERE id=?", (relevant_job_id,)).fetchone() if relevant_job_id else None
        owns_job = bool(job and job["company_id"] == user["id"])
        permitted = owns_job and (resume["job_id"] == relevant_job_id or (resume["job_id"] is None and resume["discoverable"]))
    if not permitted:
        raise HTTPException(404, "Résumé not found")
    path = Path(resume["file_path"]).resolve()
    if not path.is_relative_to(UPLOAD_DIR.resolve()) or not path.is_file():
        raise HTTPException(404, "Résumé file is unavailable")
    return FileResponse(path, filename=resume["filename"], media_type="application/octet-stream")


@app.post("/api/resumes", status_code=201)
async def upload_resume(
    file: UploadFile = File(...),
    job_id: str | None = Form(default=None),
    discoverable: bool = Form(default=False),
    user: sqlite3.Row = Depends(require_role("candidate")),
    db: sqlite3.Connection = Depends(get_db),
) -> dict[str, Any]:
    job = db.execute("SELECT id,description FROM jobs WHERE id=?", (job_id,)).fetchone() if job_id else None
    if job_id and not job:
        raise HTTPException(404, "Job not found")
    original_name = Path(file.filename or "resume").name
    extension = Path(original_name).suffix.lower()
    if extension not in ALLOWED_EXTENSIONS:
        raise HTTPException(400, "Upload a PDF, DOCX, or TXT résumé")
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(content) > MAX_UPLOAD_BYTES:
        raise HTTPException(413, "Résumé must be 10 MB or smaller")
    if not content:
        raise HTTPException(400, "The uploaded file is empty")

    resume_id = str(uuid.uuid4())
    destination = UPLOAD_DIR / f"{resume_id}{extension}"
    destination.write_bytes(content)
    try:
        text = extract_text(destination, extension)
    except Exception:
        destination.unlink(missing_ok=True)
        raise

    uploaded_at = utc_now()
    try:
        db.execute(
            "INSERT INTO resumes (id,candidate_id,job_id,filename,file_path,extracted_text,uploaded_at,discoverable) VALUES (?,?,?,?,?,?,?,?)",
            (resume_id, user["id"], job_id, original_name, str(destination), text, uploaded_at, int(discoverable and not job_id)),
        )
        db.commit()
    except Exception:
        destination.unlink(missing_ok=True)
        raise
    result: dict[str, Any] = {
        "id": resume_id,
        "filename": original_name,
        "job_id": job_id,
        "discoverable": bool(discoverable and not job_id),
        "message": "Résumé saved to your candidate account" if not job_id else "Résumé attached to your application",
    }
    if job:
        result["match"] = {
            **analyze_resume(job["description"], text),
            "scoring": "skill_coverage_and_tfidf_cosine_similarity",
        }
    return result
