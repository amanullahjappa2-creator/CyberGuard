import sqlite3
import tempfile
import unittest
from pathlib import Path

from app import SKILL_TAGS, create_app
from werkzeug.security import check_password_hash


class ScoreboardApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-key-not-for-production",
                "DATABASE": str(Path(self.temporary_directory.name) / "scoreboard.sqlite3"),
                "TEACHER_INVITE_CODE": "test-teacher-invite-code",
                "RATE_LIMIT": 100,
            }
        )
        self.client = self.app.test_client()
        self.csrf = self.client.get("/api/csrf").get_json()["token"]

    def tearDown(self):
        self.temporary_directory.cleanup()

    def post(self, path, data):
        return self.client.post(path, json=data, headers={"X-CSRF-Token": self.csrf})

    def create_class(self):
        response = self.post("/api/classes", {})
        self.assertEqual(response.status_code, 201)
        return response.get_json()

    def score_payload(self, **overrides):
        data = {
            "privacyConsent": True,
            "nickname": "Learner_01",
            "score": 400,
            "completedLevels": [1],
            "skillStats": {skill: 75 for skill in SKILL_TAGS},
            "levelStats": [{"levelId": 1, "accuracy": 75}],
        }
        data.update(overrides)
        return data

    def test_explicit_consent_nickname_and_score_sanity_are_required(self):
        self.assertEqual(self.post("/api/score", self.score_payload(privacyConsent=False)).status_code, 400)
        self.assertEqual(self.post("/api/score", self.score_payload(nickname="Student Name")).status_code, 400)
        self.assertEqual(self.post("/api/score", self.score_payload(nickname="_alias")).status_code, 400)
        self.assertEqual(self.post("/api/score", self.score_payload(score=501)).status_code, 400)
        response = self.post("/api/score", self.score_payload())
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["score"], 400)

    def test_mutations_require_csrf_and_validate_class_membership(self):
        self.assertEqual(self.client.post("/api/classes", json={}).status_code, 403)
        self.assertEqual(self.client.post("/api/score", json=self.score_payload()).status_code, 403)
        self.assertEqual(self.post("/api/score", self.score_payload(classCode="ABC234")).status_code, 404)
        self.assertEqual(
            self.post("/api/score", self.score_payload(completedLevels=[1, 1])).status_code, 400
        )

    def test_class_leaderboard_and_teacher_report_require_teacher_token(self):
        teacher = self.create_class()
        class_code = teacher["classCode"]
        response = self.post(
            "/api/score",
            self.score_payload(
                classCode=class_code,
                skillStats={**{skill: 75 for skill in SKILL_TAGS}, "phishing": 30},
                levelStats=[{"levelId": 1, "accuracy": 30}],
            ),
        )
        self.assertEqual(response.status_code, 200)
        class_board = self.client.get(f"/api/leaderboard?scope=class&classCode={class_code}").get_json()
        self.assertEqual(class_board["entries"][0]["nickname"], "Learner_01")
        endpoint = f"/api/classes/{class_code}/report"
        self.assertEqual(self.client.get(endpoint).status_code, 403)
        headers = {"Authorization": f"Bearer {teacher['teacherToken']}"}
        report = self.client.get(endpoint, headers=headers).get_json()
        self.assertEqual(report["studentCount"], 1)
        self.assertEqual(report["averageSkills"]["phishing"], 30)
        self.assertEqual(report["hardestLevels"][0]["levelId"], 1)
        csv_response = self.client.get(f"/api/classes/{class_code}/export.csv", headers=headers)
        self.assertEqual(csv_response.status_code, 200)
        self.assertIn(b"Learner_01", csv_response.data)

    def test_weekly_leaderboard_contains_recent_submission(self):
        self.assertEqual(self.post("/api/score", self.score_payload()).status_code, 200)
        response = self.client.get("/api/leaderboard?scope=weekly")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.get_json()["entries"]), 1)

    def test_student_cannot_request_membership_in_legacy_token_class(self):
        teacher = self.create_class()
        student = self.app.test_client()
        csrf = student.get("/api/csrf").get_json()["token"]
        response = student.post(
            "/api/auth/register",
            json={
                "fullName": "Student Example",
                "username": "student01",
                "email": "student@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(response.status_code, 201)
        csrf = student.get("/api/csrf").get_json()["token"]
        join_response = student.post(
            "/api/student/classes",
            json={"classCode": teacher["classCode"]},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(join_response.status_code, 404)

    def test_static_server_does_not_expose_application_or_database_files(self):
        home = self.client.get("/")
        self.assertEqual(home.status_code, 200)
        self.assertIn("frame-ancestors 'none'", home.headers["Content-Security-Policy"])
        self.assertEqual(home.headers["X-Content-Type-Options"], "nosniff")
        self.assertEqual(home.headers["X-Frame-Options"], "DENY")
        self.assertEqual(home.headers["Referrer-Policy"], "no-referrer")
        self.assertEqual(home.headers["Cross-Origin-Opener-Policy"], "same-origin")
        self.assertEqual(home.headers["Cross-Origin-Resource-Policy"], "same-origin")
        self.assertNotIn("Strict-Transport-Security", home.headers)
        home.close()
        teacher_page = self.client.get("/teacher.html")
        self.assertEqual(teacher_page.status_code, 200)
        self.assertEqual(
            teacher_page.headers["Content-Security-Policy"],
            home.headers["Content-Security-Policy"],
        )
        teacher_page.close()
        self.assertEqual(self.client.get("/app.py").status_code, 404)
        self.assertEqual(self.client.get("/instance/cyberguard.sqlite3").status_code, 404)

    def test_api_responses_have_security_headers_and_are_not_cached(self):
        response = self.client.get("/api/health")
        self.assertEqual(response.headers["Cache-Control"], "no-store")
        self.assertIn("default-src 'self'", response.headers["Content-Security-Policy"])
        self.assertEqual(
            response.headers["Permissions-Policy"],
            "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
        )

    def test_hsts_is_only_sent_for_https_requests(self):
        response = self.app.test_client().get("/api/health", base_url="https://localhost")
        self.assertEqual(
            response.headers["Strict-Transport-Security"],
            "max-age=31536000; includeSubDomains",
        )

    def test_api_rate_limit_returns_a_clear_429(self):
        limited_app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-key-not-for-production",
                "DATABASE": str(Path(self.temporary_directory.name) / "limited.sqlite3"),
                "RATE_LIMIT": 1,
            }
        )
        client = limited_app.test_client()
        self.assertEqual(client.get("/api/health").status_code, 200)
        limited = client.get("/api/health")
        self.assertEqual(limited.status_code, 429)
        self.assertIn("Too many requests", limited.get_json()["error"])

    def test_registration_login_session_rotation_and_logout(self):
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        invalid = self.post(
            "/api/auth/register",
            {
                "fullName": "Student Example",
                "username": "student01",
                "email": "student@example.test",
                "password": "short",
                "confirmPassword": "short",
            },
        )
        self.assertEqual(invalid.status_code, 400)

        password = "safe-example-password-2026"
        response = self.post(
            "/api/auth/register",
            {
                "fullName": "Student Example",
                "username": "student01",
                "email": "STUDENT@example.test",
                "password": password,
                "confirmPassword": password,
                "role": "admin",
            },
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["user"]["role"], "student")
        self.assertNotIn("password", response.get_json()["user"])
        self.assertNotIn("password_hash", response.get_json()["user"])
        self.assertEqual(self.client.get("/api/auth/me").status_code, 200)

        database = self.app.config["DATABASE"]
        connection = sqlite3.connect(database)
        try:
            password_hash = connection.execute(
                "SELECT password_hash FROM users WHERE username = ?", ("student01",)
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertNotEqual(password_hash, password)
        self.assertTrue(check_password_hash(password_hash, password))
        connection = sqlite3.connect(database)
        try:
            connection.execute("UPDATE users SET status = 'suspended' WHERE username = ?", ("student01",))
            connection.commit()
        finally:
            connection.close()
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)
        connection = sqlite3.connect(database)
        try:
            connection.execute("UPDATE users SET status = 'active' WHERE username = ?", ("student01",))
            connection.commit()
        finally:
            connection.close()

        stale_csrf = self.csrf
        self.assertEqual(
            self.client.post("/api/auth/logout", headers={"X-CSRF-Token": stale_csrf}).status_code,
            403,
        )
        duplicate = self.client.post(
            "/api/auth/register",
            json={
                "fullName": "Another Student",
                "username": "student02",
                "email": "student@example.test",
                "password": password,
                "confirmPassword": password,
            },
            headers={"X-CSRF-Token": self.client.get("/api/csrf").get_json()["token"]},
        )
        self.assertEqual(duplicate.status_code, 409)

        login_csrf = self.client.get("/api/csrf").get_json()["token"]
        failed_login = self.client.post(
            "/api/auth/login",
            json={"identifier": "student01", "password": "incorrect-password"},
            headers={"X-CSRF-Token": login_csrf},
        )
        self.assertEqual(failed_login.status_code, 401)
        login_csrf = self.client.get("/api/csrf").get_json()["token"]
        login = self.client.post(
            "/api/auth/login",
            json={"identifier": "student@example.test", "password": password},
            headers={"X-CSRF-Token": login_csrf},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.get_json()["user"]["username"], "student01")
        self.assertNotIn("password_hash", login.get_json()["user"])
        self.assertEqual(
            self.client.post("/api/auth/logout", headers={"X-CSRF-Token": login_csrf}).status_code,
            403,
        )
        logout_csrf = self.client.get("/api/csrf").get_json()["token"]
        self.assertEqual(
            self.client.post("/api/auth/logout", headers={"X-CSRF-Token": logout_csrf}).status_code,
            200,
        )
        self.assertEqual(self.client.get("/api/auth/me").status_code, 401)

    def test_migrations_preserve_existing_scoreboard_data(self):
        database = Path(self.temporary_directory.name) / "legacy.sqlite3"
        connection = sqlite3.connect(database)
        try:
            connection.executescript(
                """
                CREATE TABLE classes (
                    class_code TEXT PRIMARY KEY,
                    teacher_token_hash TEXT NOT NULL,
                    created_at TEXT NOT NULL
                );
                CREATE TABLE leaderboard (
                    nickname_key TEXT PRIMARY KEY,
                    nickname TEXT NOT NULL,
                    score INTEGER NOT NULL,
                    completed_levels TEXT NOT NULL,
                    skill_stats TEXT NOT NULL,
                    level_stats TEXT NOT NULL,
                    class_code TEXT REFERENCES classes(class_code),
                    updated_at TEXT NOT NULL
                );
                INSERT INTO classes VALUES ('ABC234', 'existing-hash', '2026-01-01T00:00:00+00:00');
                INSERT INTO leaderboard VALUES (
                    'learner01', 'Learner_01', 400, '[1]', '{}', '[]', 'ABC234',
                    '2026-01-01T00:00:00+00:00'
                );
                """
            )
        finally:
            connection.close()

        create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-key-not-for-production",
                "DATABASE": str(database),
            }
        )
        connection = sqlite3.connect(database)
        try:
            self.assertEqual(connection.execute("PRAGMA user_version").fetchone()[0], 4)
            self.assertEqual(
                connection.execute("SELECT class_code FROM classes").fetchone()[0],
                "ABC234",
            )
            self.assertEqual(
                connection.execute("SELECT nickname, score FROM leaderboard").fetchone(),
                ("Learner_01", 400),
            )
            self.assertIsNotNone(
                connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'"
                ).fetchone()
            )
            class_columns = {
                row[1] for row in connection.execute("PRAGMA table_info(classes)").fetchall()
            }
            self.assertIn("owner_user_id", class_columns)
            self.assertIsNotNone(
                connection.execute(
                    "SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'class_members'"
                ).fetchone()
            )
        finally:
            connection.close()

    def test_teacher_invite_and_owned_classes_enforce_account_roles(self):
        teacher_response = self.post(
            "/api/auth/register",
            {
                "fullName": "Teacher Example",
                "username": "teacher01",
                "email": "teacher@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
                "teacherInviteCode": "test-teacher-invite-code",
            },
        )
        self.assertEqual(teacher_response.status_code, 201)
        self.assertEqual(teacher_response.get_json()["user"]["role"], "teacher")

        csrf = self.client.get("/api/csrf").get_json()["token"]
        class_response = self.client.post(
            "/api/teacher/classes",
            json={},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(class_response.status_code, 201)
        class_code = class_response.get_json()["classCode"]
        self.assertNotIn("teacherToken", class_response.get_json())
        self.assertEqual(self.client.get("/api/teacher/classes").get_json()["classes"][0]["classCode"], class_code)
        self.assertEqual(self.client.get(f"/api/classes/{class_code}/report").status_code, 200)

        outsider = self.app.test_client()
        csrf = outsider.get("/api/csrf").get_json()["token"]
        student = outsider.post(
            "/api/auth/register",
            json={
                "fullName": "Student Example",
                "username": "student01",
                "email": "student@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(student.status_code, 201)
        self.assertEqual(outsider.get("/api/teacher/classes").status_code, 403)
        self.assertEqual(outsider.get(f"/api/classes/{class_code}/report").status_code, 403)
        csrf = outsider.get("/api/csrf").get_json()["token"]
        self.assertEqual(
            outsider.post("/api/teacher/classes", json={}, headers={"X-CSRF-Token": csrf}).status_code,
            403,
        )

        foreign_teacher = self.app.test_client()
        csrf = foreign_teacher.get("/api/csrf").get_json()["token"]
        response = foreign_teacher.post(
            "/api/auth/register",
            json={
                "fullName": "Other Teacher",
                "username": "teacher02",
                "email": "teacher2@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
                "teacherInviteCode": "test-teacher-invite-code",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(foreign_teacher.get(f"/api/classes/{class_code}/report").status_code, 403)
        self.assertEqual(foreign_teacher.get("/api/teacher/classes").get_json()["classes"], [])

    def test_student_class_join_requires_owner_approval_and_removal(self):
        teacher_response = self.post(
            "/api/auth/register",
            {
                "fullName": "Teacher Example",
                "username": "teacher01",
                "email": "teacher@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
                "teacherInviteCode": "test-teacher-invite-code",
            },
        )
        self.assertEqual(teacher_response.status_code, 201)
        csrf = self.client.get("/api/csrf").get_json()["token"]
        created = self.client.post("/api/teacher/classes", json={}, headers={"X-CSRF-Token": csrf})
        class_code = created.get_json()["classCode"]

        student = self.app.test_client()
        csrf = student.get("/api/csrf").get_json()["token"]
        registered = student.post(
            "/api/auth/register",
            json={
                "fullName": "Student Example",
                "username": "student01",
                "email": "student@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(registered.status_code, 201)
        csrf = student.get("/api/csrf").get_json()["token"]
        joined = student.post(
            "/api/student/classes",
            json={"classCode": class_code},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(joined.status_code, 201)
        self.assertEqual(joined.get_json()["status"], "pending")
        self.assertEqual(student.get("/api/student/classes").get_json()["classes"][0]["status"], "pending")
        denied_score = student.post(
            "/api/score",
            json=self.score_payload(classCode=class_code),
            headers={"X-CSRF-Token": student.get("/api/csrf").get_json()["token"]},
        )
        self.assertEqual(denied_score.status_code, 403)
        self.assertEqual(
            student.post(
                "/api/student/classes",
                json={"classCode": class_code},
                headers={"X-CSRF-Token": student.get("/api/csrf").get_json()["token"]},
            ).status_code,
            409,
        )

        members_url = f"/api/teacher/classes/{class_code}/members"
        members = self.client.get(members_url).get_json()["members"]
        self.assertEqual(len(members), 1)
        self.assertEqual(members[0]["username"], "student01")
        member_id = members[0]["userId"]
        csrf = self.client.get("/api/csrf").get_json()["token"]
        approved = self.client.post(
            f"{members_url}/{member_id}/status",
            json={"status": "active"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(approved.status_code, 200)
        self.assertEqual(student.get("/api/student/classes").get_json()["classes"][0]["status"], "active")
        accepted_score = student.post(
            "/api/score",
            json=self.score_payload(classCode=class_code),
            headers={"X-CSRF-Token": student.get("/api/csrf").get_json()["token"]},
        )
        self.assertEqual(accepted_score.status_code, 200)

        foreign = self.app.test_client()
        csrf = foreign.get("/api/csrf").get_json()["token"]
        foreign.post(
            "/api/auth/register",
            json={
                "fullName": "Other Teacher",
                "username": "teacher02",
                "email": "teacher2@example.test",
                "password": "safe-example-password-2026",
                "confirmPassword": "safe-example-password-2026",
                "teacherInviteCode": "test-teacher-invite-code",
            },
            headers={"X-CSRF-Token": csrf},
        )
        csrf = foreign.get("/api/csrf").get_json()["token"]
        denied = foreign.post(
            f"{members_url}/{member_id}/status",
            json={"status": "rejected"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(denied.status_code, 403)
        csrf = self.client.get("/api/csrf").get_json()["token"]
        removed = self.client.delete(
            f"{members_url}/{member_id}",
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(removed.status_code, 200)
        self.assertEqual(student.get("/api/student/classes").get_json()["classes"], [])


if __name__ == "__main__":
    unittest.main()
