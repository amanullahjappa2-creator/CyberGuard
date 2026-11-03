import csv
import hashlib
import hmac
import io
import json
import math
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
from werkzeug.security import check_password_hash, generate_password_hash


ROOT = Path(__file__).resolve().parent
SKILL_TAGS = ("passwords", "phishing", "social-engineering", "network", "web", "cloud", "response")
CLASS_CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
NICKNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_-]{2,23}$")
CLASS_CODE_PATTERN = re.compile(r"^[A-Z2-9]{6}$")
USERNAME_PATTERN = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{2,23}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")
MAX_SCORE_PER_ISSUE = 125
MAX_PROGRESS_BYTES = 1024 * 1024


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
        TEACHER_INVITE_CODE=os.environ.get("CYBERGUARD_TEACHER_INVITE_CODE", ""),
        MAX_CONTENT_LENGTH=MAX_PROGRESS_BYTES,
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

    def migrate_legacy_schema(connection):
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS classes (
                class_code TEXT PRIMARY KEY,
                teacher_token_hash TEXT NOT NULL,
                created_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS leaderboard (
                nickname_key TEXT PRIMARY KEY,
                nickname TEXT NOT NULL,
                score INTEGER NOT NULL,
                completed_levels TEXT NOT NULL,
                skill_stats TEXT NOT NULL,
                level_stats TEXT NOT NULL,
                class_code TEXT REFERENCES classes(class_code),
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS leaderboard_score_idx ON leaderboard(score DESC, updated_at ASC)"
        )
        connection.execute(
            "CREATE INDEX IF NOT EXISTS leaderboard_class_idx ON leaderboard(class_code, score DESC)"
        )

    def migrate_accounts_schema(connection):
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                user_id INTEGER PRIMARY KEY AUTOINCREMENT,
                full_name TEXT NOT NULL CHECK(length(full_name) BETWEEN 1 AND 100),
                username TEXT NOT NULL COLLATE NOCASE UNIQUE,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'student' CHECK(role IN ('student', 'teacher', 'admin')),
                status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'pending', 'suspended')),
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )
        connection.execute("CREATE INDEX IF NOT EXISTS users_role_status_idx ON users(role, status)")

    def migrate_teacher_ownership_schema(connection):
        connection.execute(
            "ALTER TABLE classes ADD COLUMN owner_user_id INTEGER REFERENCES users(user_id)"
        )
        connection.execute("CREATE INDEX IF NOT EXISTS classes_owner_idx ON classes(owner_user_id)")

    def migrate_class_membership_schema(connection):
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS class_members (
                member_id INTEGER PRIMARY KEY AUTOINCREMENT,
                class_code TEXT NOT NULL REFERENCES classes(class_code) ON DELETE CASCADE,
                user_id INTEGER NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK(status IN ('pending', 'active', 'rejected')),
                joined_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE(class_code, user_id)
            )
            """
        )
        connection.execute("CREATE INDEX IF NOT EXISTS class_members_user_idx ON class_members(user_id, status)")

    def migrate_student_progress_schema(connection):
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS student_progress (
                user_id INTEGER PRIMARY KEY REFERENCES users(user_id) ON DELETE CASCADE,
                progress_json TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """
        )

    DATABASE_MIGRATIONS = (
        (1, migrate_legacy_schema),
        (2, migrate_accounts_schema),
        (3, migrate_teacher_ownership_schema),
        (4, migrate_class_membership_schema),
        (5, migrate_student_progress_schema),
    )

    def initialize_db():
        with db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            schema_version = connection.execute("PRAGMA user_version").fetchone()[0]
            latest_version = DATABASE_MIGRATIONS[-1][0]
            if schema_version > latest_version:
                raise RuntimeError(
                    f"Database schema version {schema_version} is newer than this application supports."
                )
            for version, migration in DATABASE_MIGRATIONS:
                if version > schema_version:
                    migration(connection)
                    connection.execute(f"PRAGMA user_version = {version}")

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

    def authenticated_user():
        user_id = session.get("user_id")
        if not isinstance(user_id, int) or isinstance(user_id, bool):
            return None
        with db_connection() as connection:
            user = connection.execute(
                """
                SELECT user_id, full_name, username, email, role, status, created_at
                FROM users WHERE user_id = ?
                """,
                (user_id,),
            ).fetchone()
        if not user or user["status"] != "active":
            session.clear()
            return None
        return user

    def public_user(user):
        return {
            "id": user["user_id"],
            "fullName": user["full_name"],
            "username": user["username"],
            "email": user["email"],
            "role": user["role"],
            "createdAt": user["created_at"],
        }

    def owns_class(user, class_code):
        with db_connection() as connection:
            owner = connection.execute(
                "SELECT owner_user_id FROM classes WHERE class_code = ?",
                (class_code,),
            ).fetchone()
        return bool(
            owner
            and owner["owner_user_id"] is not None
            and (user["role"] == "admin" or owner["owner_user_id"] == user["user_id"])
        )

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

    def is_finite_number(value):
        return isinstance(value, (int, float)) and not isinstance(value, bool) and (
            isinstance(value, int) or math.isfinite(value)
        )

    def normalize_student_progress(value):
        if not isinstance(value, dict) or value.get("schemaVersion") != 2:
            return None
        unlocked = value.get("unlocked")
        levels = value.get("levels")
        xp = value.get("xp", 0)
        if (
            not isinstance(unlocked, int)
            or isinstance(unlocked, bool)
            or not 1 <= unlocked <= 30
            or not isinstance(levels, dict)
            or len(levels) > 30
            or not is_finite_number(xp)
            or not 0 <= xp <= 10_000_000
        ):
            return None
        normalized_levels = {}
        for level_id, record in levels.items():
            if (
                not isinstance(level_id, str)
                or not re.fullmatch(r"(?:[1-9]|[12]\d|30)", level_id)
                or not 1 <= int(level_id) <= unlocked
                or not isinstance(record, dict)
            ):
                return None
            number = int(level_id)
            score = record.get("score")
            stars = record.get("stars")
            hints = record.get("hints", 0)
            xp_granted = record.get("xpGranted", False)
            if (
                not isinstance(score, int)
                or isinstance(score, bool)
                or not 0 <= score <= LEVEL_SCORE_CAPS[number]
                or not isinstance(stars, int)
                or isinstance(stars, bool)
                or not 0 <= stars <= 3
                or not isinstance(hints, int)
                or isinstance(hints, bool)
                or not 0 <= hints <= 100
                or not isinstance(xp_granted, bool)
            ):
                return None
            normalized_levels[level_id] = {
                "score": score,
                "stars": stars,
                "hints": hints,
                "xpGranted": xp_granted,
            }

        achievements = value.get("achievements", [])
        if (
            not isinstance(achievements, list)
            or len(achievements) > 100
            or any(not isinstance(item, str) or len(item) > 64 for item in achievements)
        ):
            return None
        mastery = value.get("mastery", {})
        if not isinstance(mastery, dict) or set(mastery) - set(SKILL_TAGS):
            return None
        normalized_mastery = {}
        for skill, score in mastery.items():
            if (
                not is_finite_number(score)
                or not 0 <= score <= 100
            ):
                return None
            normalized_mastery[skill] = score

        adaptive = value.get("adaptive", {})
        if not isinstance(adaptive, dict):
            return None
        mastery_scores = adaptive.get("masteryScores", {})
        events = adaptive.get("events", [])
        sessions = adaptive.get("sessions", [])
        if (
            not isinstance(mastery_scores, dict)
            or set(mastery_scores) - set(SKILL_TAGS)
            or not isinstance(events, list)
            or len(events) > 2000
            or not isinstance(sessions, list)
            or len(sessions) > 200
        ):
            return None
        normalized_mastery_scores = {}
        for skill, score in mastery_scores.items():
            if (
                not is_finite_number(score)
                or not 0 <= score <= 100
            ):
                return None
            normalized_mastery_scores[skill] = score

        def normalize_session(item):
            if not isinstance(item, dict):
                return None
            level_id = item.get("levelId")
            accuracy = item.get("accuracy")
            skill = item.get("skillTag")
            elapsed = item.get("elapsedSeconds", 0)
            hints = item.get("hints", 0)
            mistakes = item.get("mistakes", 0)
            score = item.get("score", 0)
            session_id = item.get("sessionId", "")
            completed_at = item.get("completedAt", "")
            if (
                not isinstance(level_id, int)
                or isinstance(level_id, bool)
                or not 1 <= level_id <= 30
                or skill not in SKILL_TAGS
                or not is_finite_number(accuracy)
                or not 0 <= accuracy <= 100
                or not is_finite_number(elapsed)
                or not 0 <= elapsed <= 86400
                or any(not isinstance(count, int) or isinstance(count, bool) or not 0 <= count <= 100
                       for count in (hints, mistakes))
                or not is_finite_number(score)
                or not 0 <= score <= 100000
                or not isinstance(session_id, str)
                or len(session_id) > 100
                or not isinstance(completed_at, str)
                or len(completed_at) > 40
            ):
                return None
            return {
                "sessionId": session_id,
                "levelId": level_id,
                "skillTag": skill,
                "accuracy": accuracy,
                "elapsedSeconds": elapsed,
                "hints": hints,
                "mistakes": mistakes,
                "score": score,
                "completedAt": completed_at,
            }

        normalized_sessions = []
        for item in sessions:
            normalized = normalize_session(item)
            if normalized is None:
                return None
            normalized_sessions.append(normalized)
        normalized_history = value.get("sessionHistory", [])
        if not isinstance(normalized_history, list) or len(normalized_history) > 200:
            return None
        normalized_history = [normalize_session(item) for item in normalized_history]
        if any(item is None for item in normalized_history):
            return None

        normalized_events = []
        for item in events:
            if not isinstance(item, dict):
                return None
            level_id = item.get("levelId")
            skill = item.get("skillTag")
            outcome = item.get("outcome")
            difficulty = item.get("difficulty")
            issue_index = item.get("issueIndex", 0)
            seconds = item.get("seconds", 0)
            timestamp = item.get("timestamp", 0)
            before = item.get("masteryBefore", 50)
            after = item.get("masteryAfter", 50)
            session_id = item.get("sessionId", "")
            if (
                not isinstance(level_id, int)
                or isinstance(level_id, bool)
                or not 1 <= level_id <= 30
                or not isinstance(skill, str)
                or skill not in SKILL_TAGS
                or not isinstance(outcome, str)
                or outcome not in {"correct", "wrong", "hint"}
                or not isinstance(difficulty, int)
                or isinstance(difficulty, bool)
                or not 1 <= difficulty <= 5
                or not isinstance(issue_index, int)
                or isinstance(issue_index, bool)
                or not 0 <= issue_index <= 5
                or not is_finite_number(seconds)
                or not 0 <= seconds <= 3600
                or not is_finite_number(timestamp)
                or any(
                    not is_finite_number(value)
                    or not 0 <= value <= 100
                    for value in (before, after)
                )
                or not isinstance(session_id, str)
                or len(session_id) > 100
            ):
                return None
            normalized_events.append(
                {
                    "sessionId": session_id,
                    "levelId": level_id,
                    "skillTag": skill,
                    "issueIndex": issue_index,
                    "difficulty": difficulty,
                    "outcome": outcome,
                    "hintUsed": item.get("hintUsed") is True,
                    "seconds": seconds,
                    "category": skill,
                    "timestamp": timestamp,
                    "masteryBefore": before,
                    "masteryAfter": after,
                }
            )

        terms = value.get("unlockedTerms", [])
        streak = value.get("streak", {"count": 0, "lastDate": None})
        certificate_id = value.get("certificateId")
        finished = value.get("finished", False)
        if (
            not isinstance(terms, list)
            or len(terms) > 200
            or any(not isinstance(term, str) or len(term) > 80 for term in terms)
            or not isinstance(streak, dict)
            or not isinstance(streak.get("count", 0), int)
            or isinstance(streak.get("count", 0), bool)
            or not 0 <= streak.get("count", 0) <= 10000
            or (
                streak.get("lastDate") is not None
                and (not isinstance(streak["lastDate"], str) or len(streak["lastDate"]) > 10)
            )
            or (certificate_id is not None and (not isinstance(certificate_id, str) or len(certificate_id) > 80))
            or not isinstance(finished, bool)
            or (finished and unlocked != 30)
        ):
            return None
        return {
            "schemaVersion": 2,
            "unlocked": unlocked,
            "levels": normalized_levels,
            "finished": finished,
            "xp": xp,
            "achievements": list(dict.fromkeys(achievements)),
            "mastery": normalized_mastery,
            "adaptive": {
                "masteryScores": normalized_mastery_scores,
                "events": normalized_events,
                "sessions": normalized_sessions,
            },
            "sessionHistory": normalized_history,
            "unlockedTerms": list(dict.fromkeys(terms)),
            "streak": {"count": streak.get("count", 0), "lastDate": streak.get("lastDate")},
            "certificateId": certificate_id,
        }

    def teacher_class(class_code):
        with db_connection() as connection:
            record = connection.execute(
                "SELECT teacher_token_hash, owner_user_id FROM classes WHERE class_code = ?", (class_code,)
            ).fetchone()
        if not record:
            return None
        if record["owner_user_id"] is not None:
            user = authenticated_user()
            if (
                user
                and user["role"] in {"teacher", "admin"}
                and (user["role"] == "admin" or user["user_id"] == record["owner_user_id"])
            ):
                return record
            return None
        authorization = request.headers.get("Authorization", "")
        token = authorization.removeprefix("Bearer ").strip()
        if not token or not hmac.compare_digest(
            record["teacher_token_hash"], hashlib.sha256(token.encode()).hexdigest()
        ):
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

    @app.post("/api/auth/register")
    @rate_limited
    @require_csrf
    def register():
        data = payload()
        if data is None:
            return jsonify(error="A JSON object is required."), 400
        full_name = data.get("fullName")
        username = data.get("username")
        email = data.get("email")
        password = data.get("password")
        confirmation = data.get("confirmPassword")
        if (
            not isinstance(full_name, str)
            or not full_name.strip()
            or len(full_name.strip()) > 100
            or any(ord(character) < 32 for character in full_name)
        ):
            return jsonify(error="Full name must contain 1–100 characters."), 400
        if not isinstance(username, str) or not USERNAME_PATTERN.fullmatch(username):
            return jsonify(error="Username must be 3–24 letters, numbers, dots, underscores, or hyphens."), 400
        if (
            not isinstance(email, str)
            or len(email) > 254
            or not EMAIL_PATTERN.fullmatch(email)
        ):
            return jsonify(error="Enter a valid email address."), 400
        if (
            not isinstance(password, str)
            or not 12 <= len(password) <= 128
            or password != confirmation
        ):
            return jsonify(error="Password must be 12–128 characters and match the confirmation."), 400

        role = "student"
        teacher_invite_code = data.get("teacherInviteCode", "")
        configured_invite_code = current_app.config["TEACHER_INVITE_CODE"]
        if teacher_invite_code:
            if (
                not isinstance(teacher_invite_code, str)
                or not configured_invite_code
                or not hmac.compare_digest(teacher_invite_code, configured_invite_code)
            ):
                return jsonify(error="The teacher invitation code is invalid."), 403
            role = "teacher"

        normalized_email = email.casefold()
        timestamp = datetime.now(timezone.utc).isoformat()
        password_hash = generate_password_hash(password, method="scrypt")
        try:
            with db_connection() as connection:
                connection.execute(
                    """
                    INSERT INTO users (full_name, username, email, password_hash, role, status, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, 'active', ?, ?)
                    """,
                    (
                        full_name.strip(),
                        username,
                        normalized_email,
                        password_hash,
                        role,
                        timestamp,
                        timestamp,
                    ),
                )
                user = connection.execute(
                    """
                    SELECT user_id, full_name, username, email, role, status, created_at
                    FROM users WHERE username = ?
                    """,
                    (username,),
                ).fetchone()
        except sqlite3.IntegrityError:
            return jsonify(error="That username or email is already registered."), 409

        session.clear()
        session["user_id"] = user["user_id"]
        session["csrf_token"] = secrets.token_urlsafe(32)
        return jsonify(user=public_user(user)), 201

    @app.post("/api/auth/login")
    @rate_limited
    @require_csrf
    def login():
        data = payload()
        if data is None:
            return jsonify(error="A JSON object is required."), 400
        identifier = data.get("identifier")
        password = data.get("password")
        if (
            not isinstance(identifier, str)
            or not identifier.strip()
            or len(identifier) > 254
            or not isinstance(password, str)
            or not password
            or len(password) > 128
        ):
            return jsonify(error="Username/email and password are required."), 400

        identity = identifier.strip()
        with db_connection() as connection:
            user = connection.execute(
                """
                SELECT user_id, full_name, username, email, password_hash, role, status, created_at
                FROM users WHERE username = ? COLLATE NOCASE OR email = ? COLLATE NOCASE
                """,
                (identity, identity),
            ).fetchone()
        if (
            not user
            or user["status"] != "active"
            or not check_password_hash(user["password_hash"], password)
        ):
            return jsonify(error="Invalid username/email or password."), 401

        session.clear()
        session["user_id"] = user["user_id"]
        session["csrf_token"] = secrets.token_urlsafe(32)
        return jsonify(user=public_user(user)), 200

    @app.get("/api/auth/me")
    @rate_limited
    def auth_me():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        return jsonify(user=public_user(user))

    @app.get("/api/student/progress")
    @rate_limited
    def get_student_progress():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "student":
            return jsonify(error="Student authorization is required."), 403
        with db_connection() as connection:
            record = connection.execute(
                "SELECT progress_json, updated_at FROM student_progress WHERE user_id = ?",
                (user["user_id"],),
            ).fetchone()
        return jsonify(
            progress=json.loads(record["progress_json"]) if record else None,
            updatedAt=record["updated_at"] if record else None,
        )

    @app.put("/api/student/progress")
    @rate_limited
    @require_csrf
    def save_student_progress():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "student":
            return jsonify(error="Student authorization is required."), 403
        data = payload()
        progress = normalize_student_progress(data.get("progress") if data else None)
        if progress is None:
            return jsonify(error="Learning progress has an invalid or unsupported format."), 400
        expected_updated_at = data.get("expectedUpdatedAt") if data else None
        if expected_updated_at is not None and (
            not isinstance(expected_updated_at, str) or len(expected_updated_at) > 40
        ):
            return jsonify(error="The progress backup version is invalid."), 400
        progress_json = json.dumps(progress, ensure_ascii=True, separators=(",", ":"), allow_nan=False)
        if len(progress_json.encode("utf-8")) > MAX_PROGRESS_BYTES:
            return jsonify(error="Learning progress is larger than the allowed backup size."), 413
        timestamp = datetime.now(timezone.utc).isoformat()
        with db_connection() as connection:
            connection.execute("BEGIN IMMEDIATE")
            existing = connection.execute(
                "SELECT updated_at FROM student_progress WHERE user_id = ?",
                (user["user_id"],),
            ).fetchone()
            current_updated_at = existing["updated_at"] if existing else None
            if current_updated_at != expected_updated_at:
                return jsonify(
                    error="The account backup changed on another device. Reload it and retry the merge."
                ), 409
            if existing:
                current = connection.execute(
                    "SELECT progress_json FROM student_progress WHERE user_id = ?",
                    (user["user_id"],),
                ).fetchone()
                if current["progress_json"] == progress_json:
                    return jsonify(saved=True, updatedAt=current_updated_at)
            connection.execute(
                """
                INSERT INTO student_progress (user_id, progress_json, updated_at)
                VALUES (?, ?, ?)
                ON CONFLICT(user_id) DO UPDATE SET
                    progress_json = excluded.progress_json,
                    updated_at = excluded.updated_at
                WHERE student_progress.progress_json != excluded.progress_json
                """,
                (user["user_id"], progress_json, timestamp),
            )
        return jsonify(saved=True, updatedAt=timestamp)

    @app.delete("/api/student/progress")
    @rate_limited
    @require_csrf
    def delete_student_progress():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "student":
            return jsonify(error="Student authorization is required."), 403
        with db_connection() as connection:
            connection.execute("DELETE FROM student_progress WHERE user_id = ?", (user["user_id"],))
        return jsonify(deleted=True)

    @app.post("/api/auth/logout")
    @rate_limited
    @require_csrf
    def logout():
        session.clear()
        return jsonify(loggedOut=True)

    @app.get("/api/teacher/classes")
    @rate_limited
    def list_teacher_classes():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] not in {"teacher", "admin"}:
            return jsonify(error="Teacher authorization is required."), 403
        with db_connection() as connection:
            if user["role"] == "admin":
                rows = connection.execute(
                    """
                    SELECT class_code, created_at FROM classes
                    WHERE owner_user_id IS NOT NULL ORDER BY created_at DESC
                    """
                ).fetchall()
            else:
                rows = connection.execute(
                    """
                    SELECT class_code, created_at FROM classes
                    WHERE owner_user_id = ? ORDER BY created_at DESC
                    """,
                    (user["user_id"],),
                ).fetchall()
        return jsonify(
            classes=[{"classCode": row["class_code"], "createdAt": row["created_at"]} for row in rows]
        )

    @app.post("/api/teacher/classes")
    @rate_limited
    @require_csrf
    def create_teacher_class():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "teacher":
            return jsonify(error="Teacher authorization is required."), 403
        code = "".join(secrets.choice(CLASS_CODE_CHARS) for _ in range(6))
        token = secrets.token_urlsafe(32)
        timestamp = datetime.now(timezone.utc).isoformat()
        with db_connection() as connection:
            while connection.execute("SELECT 1 FROM classes WHERE class_code = ?", (code,)).fetchone():
                code = "".join(secrets.choice(CLASS_CODE_CHARS) for _ in range(6))
            connection.execute(
                """
                INSERT INTO classes (class_code, teacher_token_hash, created_at, owner_user_id)
                VALUES (?, ?, ?, ?)
                """,
                (code, hashlib.sha256(token.encode()).hexdigest(), timestamp, user["user_id"]),
            )
        return jsonify(classCode=code, createdAt=timestamp), 201

    @app.get("/api/student/classes")
    @rate_limited
    def list_student_classes():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "student":
            return jsonify(error="Student authorization is required."), 403
        with db_connection() as connection:
            rows = connection.execute(
                """
                SELECT m.class_code, m.status, m.joined_at, c.created_at
                FROM class_members AS m
                JOIN classes AS c ON c.class_code = m.class_code
                WHERE m.user_id = ? AND m.status IN ('pending', 'active')
                ORDER BY m.joined_at DESC
                """,
                (user["user_id"],),
            ).fetchall()
        return jsonify(
            classes=[
                {
                    "classCode": row["class_code"],
                    "status": row["status"],
                    "joinedAt": row["joined_at"],
                }
                for row in rows
            ]
        )

    @app.post("/api/student/classes")
    @rate_limited
    @require_csrf
    def join_student_class():
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] != "student":
            return jsonify(error="Student authorization is required."), 403
        data = payload()
        class_code = data.get("classCode") if data else None
        if not isinstance(class_code, str) or not CLASS_CODE_PATTERN.fullmatch(class_code):
            return jsonify(error="A valid class code is required."), 400
        timestamp = datetime.now(timezone.utc).isoformat()
        with db_connection() as connection:
            classroom = connection.execute(
                "SELECT owner_user_id FROM classes WHERE class_code = ?",
                (class_code,),
            ).fetchone()
            if not classroom or classroom["owner_user_id"] is None:
                return jsonify(error="That class code was not found."), 404
            existing = connection.execute(
                "SELECT status FROM class_members WHERE class_code = ? AND user_id = ?",
                (class_code, user["user_id"]),
            ).fetchone()
            if existing and existing["status"] in {"pending", "active"}:
                return jsonify(error="You already have a pending request or membership for this class."), 409
            connection.execute(
                """
                INSERT INTO class_members (class_code, user_id, status, joined_at, updated_at)
                VALUES (?, ?, 'pending', ?, ?)
                ON CONFLICT(class_code, user_id) DO UPDATE SET
                    status = 'pending', joined_at = excluded.joined_at, updated_at = excluded.updated_at
                """,
                (class_code, user["user_id"], timestamp, timestamp),
            )
        return jsonify(classCode=class_code, status="pending"), 201

    @app.get("/api/teacher/classes/<class_code>/members")
    @rate_limited
    def list_class_members(class_code):
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] not in {"teacher", "admin"} or not CLASS_CODE_PATTERN.fullmatch(class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        if not owns_class(user, class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        with db_connection() as connection:
            rows = connection.execute(
                """
                SELECT u.user_id, u.full_name, u.username, m.status, m.joined_at
                FROM class_members AS m
                JOIN users AS u ON u.user_id = m.user_id
                WHERE m.class_code = ? AND m.status IN ('pending', 'active')
                ORDER BY CASE m.status WHEN 'pending' THEN 0 ELSE 1 END, m.joined_at
                """,
                (class_code,),
            ).fetchall()
        return jsonify(
            members=[
                {
                    "userId": row["user_id"],
                    "fullName": row["full_name"],
                    "username": row["username"],
                    "status": row["status"],
                    "joinedAt": row["joined_at"],
                }
                for row in rows
            ]
        )

    @app.post("/api/teacher/classes/<class_code>/members/<int:user_id>/status")
    @rate_limited
    @require_csrf
    def update_class_member_status(class_code, user_id):
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] not in {"teacher", "admin"} or not CLASS_CODE_PATTERN.fullmatch(class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        if not owns_class(user, class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        data = payload()
        status = data.get("status") if data else None
        if not isinstance(status, str) or status not in {"active", "rejected"}:
            return jsonify(error="Member status must be active or rejected."), 400
        with db_connection() as connection:
            result = connection.execute(
                """
                UPDATE class_members SET status = ?, updated_at = ?
                WHERE class_code = ? AND user_id = ? AND status = 'pending'
                """,
                (status, datetime.now(timezone.utc).isoformat(), class_code, user_id),
            )
            if result.rowcount != 1:
                return jsonify(error="No pending request was found for this student."), 404
        return jsonify(userId=user_id, status=status)

    @app.delete("/api/teacher/classes/<class_code>/members/<int:user_id>")
    @rate_limited
    @require_csrf
    def remove_class_member(class_code, user_id):
        user = authenticated_user()
        if not user:
            return jsonify(error="Authentication is required."), 401
        if user["role"] not in {"teacher", "admin"} or not CLASS_CODE_PATTERN.fullmatch(class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        if not owns_class(user, class_code):
            return jsonify(error="Teacher authorization is required for this class."), 403
        with db_connection() as connection:
            result = connection.execute(
                "DELETE FROM class_members WHERE class_code = ? AND user_id = ? AND status = 'active'",
                (class_code, user_id),
            )
            if result.rowcount != 1:
                return jsonify(error="No active membership was found for this student."), 404
        return jsonify(removed=True, userId=user_id)

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
                classroom = connection.execute(
                    "SELECT owner_user_id FROM classes WHERE class_code = ?", (class_code,)
                ).fetchone()
            if not classroom:
                return jsonify(error="That class code was not found."), 404
            if classroom["owner_user_id"] is not None:
                learner = authenticated_user()
                if not learner or learner["role"] != "student":
                    return jsonify(error="An approved student membership is required for this class."), 403
                with db_connection() as connection:
                    membership = connection.execute(
                        """
                        SELECT 1 FROM class_members
                        WHERE class_code = ? AND user_id = ? AND status = 'active'
                        """,
                        (class_code, learner["user_id"]),
                    ).fetchone()
                if not membership:
                    return jsonify(error="An approved student membership is required for this class."), 403
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
