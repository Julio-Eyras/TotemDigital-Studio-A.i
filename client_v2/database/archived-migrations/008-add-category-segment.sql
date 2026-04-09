-- Migration: Adicionar campo categoria/segmento (observabilidade/agrupamento)
-- Data: 2026-01-20
--
-- Objetivo:
--  - Permitir agrupamentos por "Categoria/Segmento" na UX (Locais, Campanhas, Playlists, Assinantes, Exibidores)
--  - Campo opcional (TEXT), não quebra dados existentes

ALTER TABLE IF EXISTS subscribers
  ADD COLUMN IF NOT EXISTS category_segment TEXT;

ALTER TABLE IF EXISTS publishers
  ADD COLUMN IF NOT EXISTS category_segment TEXT;

ALTER TABLE IF EXISTS locals
  ADD COLUMN IF NOT EXISTS category_segment TEXT;

ALTER TABLE IF EXISTS campaigns
  ADD COLUMN IF NOT EXISTS category_segment TEXT;

ALTER TABLE IF EXISTS playlists
  ADD COLUMN IF NOT EXISTS category_segment TEXT;

