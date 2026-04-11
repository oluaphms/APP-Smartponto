-- ============================================================
-- Migração: adiciona coluna status à tabela notifications
-- Execute no Supabase: SQL Editor → New query → colar e Run
-- ============================================================

-- 1. Adiciona a coluna status com valor padrão 'pending'
ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'pending'
  CHECK (status IN ('pending', 'read', 'resolved'));

-- 2. Sincroniza registros existentes: se já estava lido, marca como 'read'
UPDATE notifications
  SET status = 'read'
  WHERE read = true AND status = 'pending';

-- 3. Índice para filtrar notificações não resolvidas (consulta mais comum)
CREATE INDEX IF NOT EXISTS idx_notifications_status
  ON notifications(user_id, status);

-- 4. Atualiza a política de update para permitir mudança de status
DROP POLICY IF EXISTS "Notifications update own" ON notifications;
CREATE POLICY "Notifications update own"
  ON notifications FOR UPDATE TO authenticated
  USING (auth.uid()::text = user_id);
