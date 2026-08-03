-- Study-plan feature removed 2026-07-14 (no longer fits the app).
-- Reverses 20260712140051_add_study_plan. The table held a single advisory JSON blob; dropping it
-- loses only that roadmap note (never part of FSRS scheduling or history).
DROP TABLE "StudyPlan";
