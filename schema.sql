-- Study Scheduler Database Schema

-- Reference Book Library
CREATE TABLE IF NOT EXISTS books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  book_type TEXT NOT NULL DEFAULT 'chapter_based',
  total_pages INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Book units (chapters, sections, problems)
CREATE TABLE IF NOT EXISTS book_units (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  title TEXT,
  start_page INT,
  end_page INT,
  sort_order INT NOT NULL DEFAULT 0,
  parent_label TEXT
);

-- Students
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  grade TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Study Plans
CREATE TABLE IF NOT EXISTS plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Plan subject configurations
CREATE TABLE IF NOT EXISTS plan_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  book_id UUID NOT NULL REFERENCES books(id),
  display_name TEXT,
  start_unit_index INT NOT NULL DEFAULT 0,
  duration_hours DECIMAL(4,2) NOT NULL DEFAULT 0.75,
  duration_display TEXT DEFAULT '0.75h',
  units_per_day INT NOT NULL DEFAULT 1,
  study_days TEXT[] DEFAULT ARRAY['mon','tue','wed','thu','fri','sat'],
  review_interval INT,
  review_type TEXT DEFAULT 'review',
  on_completion TEXT DEFAULT 'stop',
  next_book_id UUID REFERENCES books(id),
  sort_order INT NOT NULL DEFAULT 0
);

-- Plan day events (off days, events, notes)
CREATE TABLE IF NOT EXISTS plan_day_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  event_type TEXT NOT NULL DEFAULT 'event',
  content TEXT NOT NULL,
  is_off_day BOOLEAN DEFAULT FALSE
);

-- Plan entries (generated or manual entries for each day)
CREATE TABLE IF NOT EXISTS plan_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id UUID NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'study',
  book_name TEXT,
  duration_display TEXT,
  content TEXT NOT NULL,
  detail TEXT,
  sort_order INT NOT NULL DEFAULT 0
);

-- Enable Row Level Security (disabled for simplicity since single user)
ALTER TABLE books ENABLE ROW LEVEL SECURITY;
ALTER TABLE book_units ENABLE ROW LEVEL SECURITY;
ALTER TABLE students ENABLE ROW LEVEL SECURITY;
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_subjects ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_day_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE plan_entries ENABLE ROW LEVEL SECURITY;

-- Create policies allowing all operations (single user app)
CREATE POLICY "Allow all on books" ON books FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on book_units" ON book_units FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on students" ON students FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plans" ON plans FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plan_subjects" ON plan_subjects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plan_day_events" ON plan_day_events FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all on plan_entries" ON plan_entries FOR ALL USING (true) WITH CHECK (true);
