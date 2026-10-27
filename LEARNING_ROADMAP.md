# Learn and Rebuild the Resume Shortlisting Project

This roadmap is designed to help you understand the project and rebuild it
yourself, one small feature at a time. Follow the phases in order. At each phase,
first make a small version without copying the existing implementation, then
compare it with this project.

## How to study

- Study in short sessions and keep notes in your own words.
- For every feature, draw the path from the page, to the API, to the database,
  and back to the page.
- Change one thing at a time. Run the app and check what changed.
- Use fake names, emails, job descriptions, and résumés while learning.
- Before using generated code, ask what each function, state value, and API call
  does. Try to explain it without looking at the source.

## Phase 1 — Web and JavaScript foundations

**Learn:** HTML forms and inputs, CSS layout, JavaScript variables, arrays,
objects, functions, modules, promises, `async`/`await`, and `fetch`.

**Build:** A static job card, then a form that reads a title and description and
shows them on the page. Make a small `fetch` request and display the response.

**Project connection:** This prepares you to understand API requests and the
form event handlers in `Frontend/src/App.jsx`.

**Ready to continue when:** You can explain how the browser collects form input
and sends a request to a server.

## Phase 2 — React and Tailwind CSS

**Learn:** Components, props, state with `useState`, effects with `useEffect`,
conditional rendering, lists and keys, controlled forms, and file inputs. Review
Tailwind spacing, layout, colors, responsive prefixes, and hover/focus states.

**Build:** Create a small page with a job list, a sign-in form, and a file picker.
Split repeated UI into components. Show loading, success, empty, and error states.

**Project connection:** Trace `AuthPanel`, `CompanyDashboard`, and
`CandidateDashboard`; identify what each component owns and which API calls it
makes.

**Ready to continue when:** You can create a form, store its values in state, and
render a list from an array.

**Official guides:** [React Learn](https://react.dev/learn) and
[Tailwind CSS documentation](https://tailwindcss.com/docs/styling-with-utility-classes).

## Phase 3 — Python fundamentals

**Learn:** Variables, strings, lists, dictionaries, conditions, loops, functions,
modules, exceptions, type hints, and virtual environments.

**Build:** Write a small Python program that reads a job description and résumé
text from two text files and prints common words.

**Project connection:** Read `Backend/main.py` from the imports down. Follow one
request handler and learn how its helper functions transform data.

**Ready to continue when:** You can write a Python function that accepts text and
returns a result, and handle invalid input without crashing.

**Official guide:** [The Python Tutorial](https://docs.python.org/3/tutorial/).
It assumes some programming background; if programming itself is new, practice
basic logic and functions before continuing through it.

## Phase 4 — HTTP and FastAPI

**Learn:** Requests and responses, URLs, JSON, HTTP methods (`GET`, `POST`,
`PATCH`), status codes, headers, validation, and CORS. Then learn FastAPI routes,
Pydantic models, dependencies, and generated API docs.

**Build:** Make a small API with `GET /jobs` and `POST /jobs`. First keep data in
memory; later connect it to SQLite.

**Project connection:** Try the endpoints in `http://127.0.0.1:8000/docs` and
match each one to its frontend `apiRequest` call.

**Ready to continue when:** You can explain the difference between a frontend
request and the backend route that handles it.

**Official guide:** [FastAPI Tutorial](https://fastapi.tiangolo.com/tutorial/).

## Phase 5 — SQLite and account access

**Learn:** Tables, primary keys, foreign keys, `SELECT`, `INSERT`, `UPDATE`,
`DELETE`, parameterized queries, and transactions. Then follow the project’s
password hashing, bearer token, account roles, and ownership checks.

**Build:** Create `users` and `jobs` tables and add a company-only route that
creates a job. Use two fake company accounts to confirm one company cannot read
the other company's private applicant data.

**Project connection:** Study `initialize_db`, `connect_db`, `current_user`,
`require_role`, and the job routes in `Backend/main.py`.

**Ready to continue when:** You can explain how a request proves who the user is
and how the API checks what that user may access.

## Phase 6 — Résumé upload and text extraction

**Learn:** Multipart form data, file validation, file size limits, file paths,
and how PDF, DOCX, and TXT extraction works. Learn why uploaded files must be
kept private and why filenames should not be trusted as storage paths.

**Build:** Upload one fake TXT file first; then add DOCX and PDF. Handle invalid
extensions, empty files, files over the limit, and PDFs that contain no
extractable text.

**Project connection:** Trace the frontend `FormData` in the candidate page into
`POST /api/resumes`, then follow where file bytes and extracted text are stored.

**Ready to continue when:** You can upload a test résumé and explain where its
original file and extracted text are saved.

## Phase 7 — Text matching and machine learning basics

**Learn:** Tokenization, stop words, bag-of-words, TF-IDF, vectors, and cosine
similarity. Understand that this project uses TF-IDF text similarity plus a
rule-based list of recognized skills; it does not train a supervised model.

**Build:** Create two or three fake job descriptions and résumés. Print their
TF-IDF similarity and recognized skill coverage. Change the wording while
keeping the meaning similar, then observe how the lexical score behaves.

**Project connection:** Study `extract_skills`, `analyze_resume`, and
`get_matches` in `Backend/main.py`. Confirm why the API returns matched skills,
skills not detected, coverage, and text similarity separately.

**Ready to continue when:** You can explain why text similarity is not the same
as a probability that a candidate is qualified.

**Official scikit-learn references:** [Working with text data](https://scikit-learn.org/stable/tutorial/text_analytics/working_with_text_data.html),
[TfidfVectorizer](https://scikit-learn.org/stable/modules/generated/sklearn.feature_extraction.text.TfidfVectorizer.html),
and [cosine similarity](https://scikit-learn.org/stable/modules/metrics.html#cosine-similarity).

## Phase 8 — Rebuild the complete workflow

Implement and connect these features in order:

1. Candidate and company registration and sign-in.
2. Company creates a job description.
3. Candidate sees the public job list.
4. Candidate uploads a résumé and applies to one job.
5. Company sees only applicants to its own job.
6. Company sees the comparison and updates application status.
7. Candidate sees the updated application status.

Use one fake company and two fake candidates to check the whole path. Verify
that data remains after restarting the backend and that a candidate cannot
download another candidate’s résumé.

## Phase 9 — Improve eligibility matching carefully

Before calling someone “eligible,” decide what the job actually requires. A
good next version can let a company list **required skills** separately from
**preferred skills**, then explain which requirements were detected in each
résumé. Add examples where the résumé uses aliases and where it does not contain
a requirement.

If you later train a model, first obtain an appropriate, consented dataset with
well-defined labels, remove or protect personal information, and measure errors
and bias. Compare the trained model with the current baseline. Do not use a
model score alone to make employment decisions.

## Phase 10 — GitHub, maintenance, and deployment basics

**Learn:** `git status`, `git diff`, commits, branches, `.gitignore`, dependency
files, environment variables, and deployment configuration.

**Build:** Make a small branch, change one feature, inspect the diff, run the
frontend lint/build and Python syntax check, then commit the change. Never add
the SQLite database, real candidate résumés, virtual environments, tokens, or
`.env` secrets to GitHub.

**Before real use:** Replace the local signing key with a strong secret, enable
HTTPS, configure protected durable storage and backups, and review privacy,
access, and retention requirements.

## Suggested weekly rhythm

Pick one phase per week if you have several hours available, or spend longer on
each phase if you are studying part time. Keep each session focused on one small
feature. Do not move on until you can describe what you built and how its data
flows through the application.
