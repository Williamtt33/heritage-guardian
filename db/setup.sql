-- ============================================================
-- 墨韵三维 · Supabase 数据库初始化
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- ── 1. models 表 ──
CREATE TABLE IF NOT EXISTS public.models (
  id            TEXT PRIMARY KEY,
  name          TEXT NOT NULL,
  name_en       TEXT,
  description   TEXT,
  description_en TEXT,
  file          TEXT NOT NULL,
  thumbnail     TEXT,
  tags          TEXT[] DEFAULT '{}',
  point_count   TEXT,
  size          TEXT,
  featured      BOOLEAN DEFAULT false,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 2. hotspots 表 ──
CREATE TABLE IF NOT EXISTS public.hotspots (
  id            TEXT PRIMARY KEY,
  model_id      TEXT NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  position_x    FLOAT NOT NULL,
  position_y    FLOAT NOT NULL,
  position_z    FLOAT NOT NULL,
  title         TEXT,
  title_en      TEXT,
  description   TEXT,
  description_en TEXT,
  note          TEXT,
  sort_order    INT DEFAULT 0,
  camera_pos_x  FLOAT,
  camera_pos_y  FLOAT,
  camera_pos_z  FLOAT,
  camera_tgt_x  FLOAT,
  camera_tgt_y  FLOAT,
  camera_tgt_z  FLOAT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 3. camera_paths 表 ──
CREATE TABLE IF NOT EXISTS public.camera_paths (
  id            TEXT PRIMARY KEY,
  model_id      TEXT NOT NULL REFERENCES public.models(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  name_en       TEXT,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- ── 4. keyframes 表 ──
CREATE TABLE IF NOT EXISTS public.keyframes (
  id            TEXT PRIMARY KEY,
  path_id       TEXT NOT NULL REFERENCES public.camera_paths(id) ON DELETE CASCADE,
  sort_order    INT NOT NULL DEFAULT 0,
  pos_x         FLOAT NOT NULL,
  pos_y         FLOAT NOT NULL,
  pos_z         FLOAT NOT NULL,
  tgt_x         FLOAT NOT NULL,
  tgt_y         FLOAT NOT NULL,
  tgt_z         FLOAT NOT NULL
);

-- ── 5. admin_users 表 ──
CREATE TABLE IF NOT EXISTS public.admin_users (
  email         TEXT PRIMARY KEY,
  created_at    TIMESTAMPTZ DEFAULT now()
);

-- 插入管理员
INSERT INTO public.admin_users (email)
VALUES ('1590992057@qq.com')
ON CONFLICT (email) DO NOTHING;

-- ── 6. RLS 策略：公开可读，认证用户可写 ──
ALTER TABLE public.models ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.hotspots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_paths ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.keyframes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- models
DROP POLICY IF EXISTS "Public read models" ON public.models;
CREATE POLICY "Public read models" ON public.models
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write models" ON public.models;
CREATE POLICY "Auth write models" ON public.models
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- hotspots
DROP POLICY IF EXISTS "Public read hotspots" ON public.hotspots;
CREATE POLICY "Public read hotspots" ON public.hotspots
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write hotspots" ON public.hotspots;
CREATE POLICY "Auth write hotspots" ON public.hotspots
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- camera_paths
DROP POLICY IF EXISTS "Public read camera_paths" ON public.camera_paths;
CREATE POLICY "Public read camera_paths" ON public.camera_paths
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write camera_paths" ON public.camera_paths;
CREATE POLICY "Auth write camera_paths" ON public.camera_paths
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- keyframes
DROP POLICY IF EXISTS "Public read keyframes" ON public.keyframes;
CREATE POLICY "Public read keyframes" ON public.keyframes
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Auth write keyframes" ON public.keyframes;
CREATE POLICY "Auth write keyframes" ON public.keyframes
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- admin_users
DROP POLICY IF EXISTS "Auth read admin_users" ON public.admin_users;
CREATE POLICY "Auth read admin_users" ON public.admin_users
  FOR SELECT USING (auth.role() = 'authenticated');

-- ── 7. 存储桶（需通过 API 或 Dashboard 创建，见下方说明）──
-- 请在 Supabase Dashboard → Storage 中手动创建以下公开桶：

-- 桶名: splat-files
--   ☑ 公开桶 (public bucket)
--   文件大小限制: 150 MB
--   允许的 MIME 类型: application/octet-stream

-- 桶名: thumbnails
--   ☑ 公开桶 (public bucket)
--   文件大小限制: 5 MB
--   允许的 MIME 类型: image/png,image/jpeg,image/webp

-- 桶名: report-photos
--   ☑ 公开桶 (public bucket)
--   文件大小限制: 5 MB
--   允许的 MIME 类型: image/png,image/jpeg,image/webp

-- ════════════════════════════════════════════════════════════════
-- 8. community_reports 表（公众参与上报系统）
-- ════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.community_reports (
  id              TEXT PRIMARY KEY,
  model_id        TEXT,
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'other',
  reporter        TEXT DEFAULT '匿名用户',
  reporter_email  TEXT,
  photos          JSONB DEFAULT '[]',
  status          TEXT NOT NULL DEFAULT 'pending',
  admin_note      TEXT,
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.community_reports ENABLE ROW LEVEL SECURITY;

-- 任何人可读
DROP POLICY IF EXISTS "Public read reports" ON public.community_reports;
CREATE POLICY "Public read reports" ON public.community_reports
  FOR SELECT USING (true);

-- 任何人可提交（匿名上报）
DROP POLICY IF EXISTS "Public insert reports" ON public.community_reports;
CREATE POLICY "Public insert reports" ON public.community_reports
  FOR INSERT WITH CHECK (true);

-- 管理员可更新状态
DROP POLICY IF EXISTS "Admin update reports" ON public.community_reports;
CREATE POLICY "Admin update reports" ON public.community_reports
  FOR UPDATE USING (
    auth.role() = 'authenticated'
    AND auth.uid() IN (SELECT user_id FROM public.admin_users)
  )
  WITH CHECK (
    auth.role() = 'authenticated'
    AND auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- 管理员可删除
DROP POLICY IF EXISTS "Admin delete reports" ON public.community_reports;
CREATE POLICY "Admin delete reports" ON public.community_reports
  FOR DELETE USING (
    auth.role() = 'authenticated'
    AND auth.uid() IN (SELECT user_id FROM public.admin_users)
  );

-- Storage RLS: report-photos 桶
-- 任何人可读
DROP POLICY IF EXISTS "Public read report photos" ON storage.objects;
CREATE POLICY "Public read report photos" ON storage.objects
  FOR SELECT USING (bucket_id = 'report-photos');

-- 任何人可上传
DROP POLICY IF EXISTS "Public upload report photos" ON storage.objects;
CREATE POLICY "Public upload report photos" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'report-photos');
