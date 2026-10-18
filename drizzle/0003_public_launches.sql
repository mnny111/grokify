ALTER TABLE projects ADD COLUMN public_launch INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS jobs_project_status ON jobs(project,status);
CREATE INDEX IF NOT EXISTS projects_parent ON projects(parent);
