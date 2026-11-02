import csv
import hashlib
import hmac
import io
import json
import os
import re
import secrets
import sqlite3
import threading
import time
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
from functools import wraps
from pathlib import Path

from flask import Flask, Response, current_app, jsonify, request, send_from_directory, session


ROOT = Path(__file__).resolve().parent
SKILL_TAGS = ("passwords", "phishing", "social-engineering", "network", "web", "cloud", "response")
CLASS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$")
CLASS_CODE_PATTERN = re.compile(r"^[A-Z2-9]{6}$")
MAX_SCORE_PER_ISSUE = 125


def load_level_score_caps():
    caps = {}
    for level_id in range(1, 31):
        path = ROOT / "levels" / f"level{level_id:02}.json"
        with path.open(encoding="utf-8") as level_file:
            level = json.load(level_file)
        issues = level.get("issues")
        if level.get("id") != level_id or not isinstance(issues, list) or not 3 <= len(issues) <= 6:
            raise RuntimeError(f"Level {level_id} is missing valid issue data for score checks.")
        caps[level_id] = len(issues) * MAX_SCORE_PER_ISSUE
    return caps


LEVEL_SCORE_CAPS = load_level_score_caps()


def create_app(test_config=None):
    app = Flask(__name__, static_folder=None)
    app.config.from_mapping(
        SECRET_KEY=os.environ.get("CYBERGUARD_SECRET_KEY") or secrets.token_hex(32),
        DATABASE=os.environ.get("CYBERGUARD_DATABASE", str(ROOT / "instance" / "cyberguard.sqlite3")),
        MAX_CONTENT_LENGTH=16 * 1024,
        RATE_LIMIT=30,
        RATE_WINDOW_SECONDS=60,
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=os.environ.get("CYBERGUARD_COOKIE_SECURE", "").lower() in {"1", "true", "yes"},
    )
    if test_config:
        app.config.update(test_config)
    if not app.config["SECRET_KEY"]:
        raise RuntimeError("CYBERGUARD_SECRET_KEY must not be empty.")
    app.extensions["rate_limits"] = {}
    app.extensions["rate_limit_lock"] = threading.Lock()

    def connect_db():
        database = Path(current_app.config["DATABASE"])
        database.parent.mkdir(parents=True, exist_ok=True)
        connection = sqlite3.connect(database)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection

    @contextmanager
    def db_connection():
        connection = connect_db()
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()

    def initialize_db():
        with db_connection() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS classes (
                    class_code TEXT PRIMARY KEY,
                    teacher_token_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE IF NOT EXISTS leaderboard (
                    nickname_key TEXT PRIMARY KEY,
                    nickname TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    completed_levels TEXT NOT NULL,
                    skill_stats TEXT NOT NULL,
                    level_stats TEXT NOT NULL,
                    class_code TEXT REFERENCES classes(class_code),
                    updated_at TEXT NOT NULL
                );
                CREATE INDEX IF NOT EXISTS leaderboard_score_idx
                    ON leaderboard(score DESC, updated_at ASC);
                CREATE INDEX IF NOT EXISTS leaderboard_class_idx
                    ON leaderboard(class_code, score DESC);
                """
            )

    with app.app_context():
        initialize_db()

    def rate_limited(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            now = time.monotonic()
            key = (request.remote_addr or "unknown", request.endpoint or function.__name__)
            limits = current_app.extensions["rate_limits"]
            with current_app.extensions["rate_limit_lock"]:
                requests = [stamp for stamp in limits.get(key, []) if now - stamp < current_app.config["RATE_WINDOW_SECONDS"]]
                if len(requests) >= current_app.config["RATE_LIMIT"]:
                    return jsonify(error="Too many requests. Please wait and try again."), 429
                requests.append(now)
                limits[key] = requests
            return function(*args, **kwargs)

        return wrapper

    def require_csrf(function):
        @wraps(function)
        def wrapper(*args, **kwargs):
            expected = session.get("csrf_token", "")
            supplied = request.headers.get("X-CSRF-Token", "")
            if not expected or not supplied or not hmac.compare_digest(expected, supplied):
                return jsonify(error="A valid same-session CSRF token is required."), 403
            return function(*args, **kwargs)

        return wrapper

    def payload():
        data = request.get_json(silent=True)
        if not isinstance(data, dict):
            return None
        return data

    def valid_skill_stats(value):
        if not isinstance(value, dict) or set(value) - set(SKILL_TAGS):
            return False
        return all(
            score is None or (isinstance(score, (int, float)) and not isinstance(score, bool) and 0 <= score <= 100)
            for score in value.values()
        )

    def valid_level_stats(value, completed):
        if not isinstance(value, list) or len(value) > 30:
            return False
        seen = set()
        for item in value:
            if not isinstance(item, dict):
                return False
            level_id = item.get("levelId")
            accuracy = item.get("accuracy")
            if (
                not isinstance(level_id, int)
                or isinstance(level_id, bool)
                or level_id not in completed
                or level_id in seen
                or not isinstance(accuracy, (int, float))
                or isinstance(accuracy, bool)
                or not 0 <= accuracy <= 100
            ):
                return False
            seen.add(level_id)
        return True

    def teacher_class(class_code):
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()
        if not token:
            return None
        with db_connection() as connection:
            record = connection.execute(
                "SELECT teacher_token_hash FROM classes WHERE class_code = ?", (class_code,)
            ).fetchone()
        if not record or not hmac.compare_digest(record["teacher_token_hash"], hashlib.sha256(token.encode()).hexdigest()):
            return None
        return record

    @app.after_request
    def security_headers(response):
        response.headers.setdefault(
            "Content-Security-Policy",
            "default-src 'self'; base-uri 'self'; object-src 'none'; script-src 'self'; "
            "style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; "
            "connect-src 'self'; worker-src 'self'; manifest-src 'self'; "
            "form-action 'self'; frame-ancestors 'none'",
        )
        response.headers.setdefault("X-Content-Type-Options", "nosniff")
        response.headers.setdefault("Referrer-Policy", "no-referrer")
        response.headers.setdefault("X-Frame-Options", "DENY")
        response.headers.setdefault(
            "Permissions-Policy",
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )
        response.headers.setdefault("Cross-Origin-Opener-Policy", "same-origin")
        response.headers.setdefault("Cross-Origin-Resource-Policy", "same-origin")
        response.headers.setdefault("X-Permitted-Cross-Domain-Policies", "none")
        if request.is_secure:
            response.headers.setdefault(
                "Strict-Transport-Security",
                "max-age=31536000; includeSubDomains",
            )
        if request.path.startswith("/api/"):
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/")
    def home():
        return send_from_directory(ROOT, "index.html")

    @app.get("/<path:asset>")
    def static_asset(asset):
        first_path = asset.split("/", 1)[0]
        allowed_root_files = {
            "index.html",
            "manifest.webmanifest",
            "service-worker.js",
            "level-catalog.json",
            "teacher.html",
        }
        allowed_directories = {"assets", "css", "js", "lang", "levels"}
        if asset not in allowed_root_files and first_path not in allowed_directories:
            return jsonify(error="Not found."), 404
        return send_from_directory(ROOT, asset)

    @app.get("/api/csrf")
    @rate_limited
    def csrf_token():
        token = secrets.token_urlsafe(32)
        session["csrf_token"] = token
        response = jsonify(token=token)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/api/health")
    @rate_limited
    def health():
        return jsonify(status="ok")

    @app.post("/api/classes")
    @rate_limited
    @require_csrf
    def create_class():
        code = "".join(secrets.choice(CLASS_CODE_CHARS) for _ in range(6))
        token = secrets.token_urlsafe(32)
        with db_connection() as connection:
            while connection.execute("SELECT 1 FROM classes WHERE class_code = ?", (code,)).fetchone():
                code = "".join(secrets.choice(CLASS_CODE_CHARS) for _ in range(6))
            connection.execute(
                "INSERT INTO classes (class_code, teacher_token_hash, created_at) VALUES (?, ?, ?)",
                (code, hashlib.sha256(token.encode()).hexdigest(), datetime.now(timezone.utc).isoformat()),
            )
        return jsonify(classCode=code, teacherToken=token), 201

    @app.post("/api/score")
    @rate_limited
    @require_csrf
    def submit_score():
        data = payload()
        if data is None or data.get("privacyConsent") is not True:
            return jsonify(error="Explicit privacy consent is required before score upload."), 400
        nickname = data.get("nickname")
        if not isinstance(nickname, str) or not NICKNAME_PATTERN.fullmatch(nickname):
            return jsonify(error="Use a 3–24 character nickname with letters, numbers, underscores, or hyphens."), 400
        nickname_key = nickname.lower()
        completed = data.get("completedLevels")
        if (
            not isinstance(completed, list)
            or len(completed) > 30
            or any(not isinstance(level, int) or isinstance(level, bool) or not 1 <= level <= 30 for level in completed)
            or len(set(completed)) != len(completed)
        ):
            return jsonify(error="Completed level data is invalid."), 400
        score = data.get("score")
        if (
            not isinstance(score, int)
            or isinstance(score, bool)
            or score < 0
            or score > sum(LEVEL_SCORE_CAPS[level_id] for level_id in completed)
        ):
            return jsonify(error="The submitted score is outside the possible range for completed levels."), 400
        skills = data.get("skillStats")
        level_stats = data.get("levelStats")
        if not valid_skill_stats(skills) or not valid_level_stats(level_stats, set(completed)):
            return jsonify(error="Skill or level performance data is invalid."), 400
        class_code = data.get("classCode")
        if class_code:
            if not isinstance(class_code, str) or not CLASS_CODE_PATTERN.fullmatch(class_code):
                return jsonify(error="Class code is invalid."), 400
            with db_connection() as connection:
                exists = connection.execute("SELECT 1 FROM classes WHERE class_code = ?", (class_code,)).fetchone()
            if not exists:
                return jsonify(error="That class code was not found."), 404
        else:
            class_code = None
        updated_at = datetime.now(timezone.utc).isoformat()
        with db_connection() as connection:
            existing = connection.execute(
                "SELECT score, class_code FROM leaderboard WHERE nickname_key = ?", (nickname_key,)
            ).fetchone()
            best_score = max(score, existing["score"] if existing else 0)
            if class_code is None and existing:
                class_code = existing["class_code"]
            connection.execute(
                """
                INSERT INTO leaderboard (
                    nickname_key, nickname, score, completed_levels, skill_stats,
                    level_stats, class_code, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(nickname_key) DO UPDATE SET
                    nickname = excluded.nickname,
                    score = excluded.score,
                    completed_levels = excluded.completed_levels,
                    skill_stats = excluded.skill_stats,
                    level_stats = excluded.level_stats,
                    class_code = excluded.class_code,
                    updated_at = excluded.updated_at
                """,
                (
                    nickname_key,
                    nickname,
                    best_score,
                    json.dumps(sorted(completed)),
                    json.dumps(skills),
                    json.dumps(level_stats),
                    class_code,
                    updated_at,
                ),
            )
        return jsonify(saved=True, score=best_score, updatedAt=updated_at), 200

    @app.get("/api/leaderboard")
    @rate_limited
    def leaderboard():
        scope = request.args.get("scope", "global")
        if scope not in {"global", "weekly", "class"}:
            return jsonify(error="Leaderboard scope must be global, weekly, or class."), 400
        query = "SELECT nickname, score, completed_levels, skill_stats, updated_at FROM leaderboard"
        parameters = []
        if scope == "weekly":
            query += " WHERE updated_at >= ?"
            parameters.append((datetime.now(timezone.utc) - timedelta(days=7)).isoformat())
        elif scope == "class":
            class_code = request.args.get("classCode", "")
            if not CLASS_CODE_PATTERN.fullmatch(class_code):
                return jsonify(error="A valid class code is required."), 400
            query += " WHERE class_code = ?"
            parameters.append(class_code)
        query += " ORDER BY score DESC, updated_at ASC LIMIT 50"
        with db_connection() as connection:
            records = connection.execute(query, parameters).fetchall()
        return jsonify(
            scope=scope,
            entries=[
                {
                    "rank": index + 1,
                    "nickname": row["nickname"],
                    "score": row["score"],
                    "completedLevels": json.loads(row["completed_levels"]),
                }
                for index, row in enumerate(records)
            ],
        )

    @app.get("/api/classes/<class_code>/report")
    @rate_limited
    def class_report(class_code):
        if not CLASS_CODE_PATTERN.fullmatch(class_code) or not teacher_class(class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        with db_connection() as connection:
            rows = connection.execute(
                "SELECT nickname, score, skill_stats, level_stats FROM leaderboard WHERE class_code = ?",
                (class_code,),
            ).fetchall()
        skill_totals = {skill: [0.0, 0] for skill in SKILL_TAGS}
        level_totals = {}
        students = []
        for row in rows:
            skills = json.loads(row["skill_stats"])
            for skill, score in skills.items():
                if score is not None:
                    skill_totals[skill][0] += score
                    skill_totals[skill][1] += 1
            for item in json.loads(row["level_stats"]):
                record = level_totals.setdefault(item["levelId"], [0.0, 0])
                record[0] += item["accuracy"]
                record[1] += 1
            populated_skills = [score for score in skills.values() if score is not None]
            average = sum(populated_skills) / len(populated_skills) if populated_skills else None
            if average is not None and average < 50:
                students.append({"nickname": row["nickname"], "score": row["score"], "averageAccuracy": round(average)})
        average_skills = {
            skill: round(total / count) if count else None
            for skill, (total, count) in skill_totals.items()
        }
        hardest_levels = [
            {"levelId": level_id, "averageAccuracy": round(total / count), "submissions": count}
            for level_id, (total, count) in sorted(level_totals.items(), key=lambda entry: (entry[1][0] / entry[1][1], entry[0]))[:5]
        ]
        return jsonify(
            classCode=class_code,
            studentCount=len(rows),
            averageScore=round(sum(row["score"] for row in rows) / len(rows)) if rows else 0,
            averageSkills=average_skills,
            hardestLevels=hardest_levels,
            studentsNeedingHelp=students,
        )

    @app.get("/api/classes/<class_code>/export.csv")
    @rate_limited
    def export_class(class_code):
        if not CLASS_CODE_PATTERN.fullmatch(class_code) or not teacher_class(class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        with db_connection() as connection:
            rows = connection.execute(
                "SELECT nickname, score, skill_stats FROM leaderboard WHERE class_code = ? ORDER BY score DESC",
                (class_code,),
            ).fetchall()
        output = io.StringIO()
        writer = csv.writer(output)
        writer.writerow(["nickname", "score", *SKILL_TAGS])
        for row in rows:
            skills = json.loads(row["skill_stats"])
            writer.writerow([row["nickname"], row["score"], *(skills.get(skill, "") for skill in SKILL_TAGS)])
        return Response(
            output.getvalue(),
            mimetype="text/csv",
            headers={"Content-Disposition": f'attachment; filename="cyberguard-class-{class_code}.csv"'},
        )

    @app.errorhandler(413)
    def payload_too_large(_error):
        return jsonify(error="Request data exceeds the allowed size."), 413

    return app


app = create_app()


if __name__ == "__main__":
    app.run(host=os.environ.get("HOST", "127.0.0.1"), port=int(os.environ.get("PORT", "5000")), debug=False)
