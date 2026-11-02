import tempfile
import unittest
from pathlib import Path

from app import SKILL_TAGS, create_app


class ScoreboardApiTests(unittest.TestCase):
    def setUp(self):
        self.temporary_directory = tempfile.TemporaryDirectory()
        self.app = create_app(
            {
                "TESTING": True,
                "SECRET_KEY": "test-key-not-for-production",
                "DATABASE": str(Path(self.temporary_directory.name) / "scoreboard.sqlite3"),
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
        response = self.client.post("/api/classes", json={})
        self.assertEqual(response.status_code, 403)
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

    def test_static_server_does_not_expose_application_or_database_files(self):
        home = self.client.get("/")
        self.assertEqual(home.status_code, 200)
        home.close()
        teacher_page = self.client.get("/teacher.html")
        self.assertEqual(teacher_page.status_code, 200)
        teacher_page.close()
        self.assertEqual(self.client.get("/app.py").status_code, 404)
        self.assertEqual(self.client.get("/instance/cyberguard.sqlite3").status_code, 404)

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


if __name__ == "__main__":
    unittest.main()
