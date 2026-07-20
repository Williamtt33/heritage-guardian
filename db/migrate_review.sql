-- ============================================================
-- 模型审核 + Heritage 字段迁移
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- 适用于已有 setup.sql 初始化的数据库
-- ============================================================

-- ── 1. models 表：审核相关字段 ──
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'approved',
  ADD COLUMN IF NOT EXISTS tracking_code TEXT,
  ADD COLUMN IF NOT EXISTS reporter_name TEXT,
  ADD COLUMN IF NOT EXISTS reporter_contact TEXT,
  ADD COLUMN IF NOT EXISTS review_note TEXT,
  ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

-- ── 2. models 表：Heritage 扩展字段 ──
ALTER TABLE public.models
  ADD COLUMN IF NOT EXISTS protection_level TEXT,
  ADD COLUMN IF NOT EXISTS construction_year TEXT,
  ADD COLUMN IF NOT EXISTS architectural_style TEXT,
  ADD COLUMN IF NOT EXISTS conservation_status TEXT DEFAULT 'good',
  ADD COLUMN IF NOT EXISTS location JSONB;

-- ── 3. 索引：加速追踪码查询 ──
CREATE INDEX IF NOT EXISTS idx_models_tracking_code ON public.models(tracking_code);
CREATE INDEX IF NOT EXISTS idx_models_status ON public.models(status);

-- ── 4. 更新 RLS：仅 approved 模型公开可读 ──
-- 先删除旧策略，再创建新的
DROP POLICY IF EXISTS "Public read models" ON public.models;
CREATE POLICY "Public read models" ON public.models
  FOR SELECT USING (status = 'approved' OR status IS NULL);

-- 认证用户可读写所有模型
DROP POLICY IF EXISTS "Auth write models" ON public.models;
CREATE POLICY "Auth write models" ON public.models
  FOR ALL USING (auth.role() = 'authenticated')
  WITH CHECK (auth.role() = 'authenticated');

-- ── 5. 已存在的数据默认设为 approved ──
UPDATE public.models SET status = 'approved' WHERE status IS NULL;
