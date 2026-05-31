-- Seeds: templates de publicação rápida (Studio Vx4)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM publish_templates WHERE featured = true LIMIT 1) THEN
    INSERT INTO publish_templates (
      preset, segment, title, description, headline, featured, featured_sort,
      recommended_duration_ms, accent_color, background_css, preferred_orientation, icon_key
    ) VALUES
      ('menu', 'restaurant', 'Cardápio digital', 'Ideal para restaurantes, lancherias e balcões.', 'Cardápio pronto para vender', true, 10,
       12000, '#ff9800', 'linear-gradient(135deg, #2b1400 0%, #7a3a00 100%)', 'portrait', 'storefront'),
      ('promotion', 'retail', 'Promoção do dia', 'Oferta direta para vender rápido na tela.', 'Oferta em destaque', true, 20,
       8000, '#e91e63', 'linear-gradient(135deg, #2a0010 0%, #b0003a 100%)', 'landscape', 'campaign'),
      ('ad', 'gym', 'Anúncio indoor', 'Conteúdo de impacto para TVs e totens.', 'Anúncio de impacto', true, 30,
       10000, '#1976d2', 'linear-gradient(135deg, #001a33 0%, #0d47a1 100%)', 'landscape', 'tv'),
      ('announcement', 'church', 'Comunicado', 'Avisos, eventos e mensagens locais.', 'Aviso claro na tela', true, 40,
       9000, '#7b1fa2', 'linear-gradient(135deg, #160021 0%, #6a1b9a 100%)', 'landscape', 'auto_awesome'),
      ('institutional', 'retail', 'Institucional', 'Marca, serviços e presença fixa no ambiente.', 'Presença de marca', true, 50,
       15000, '#2e7d32', 'linear-gradient(135deg, #001f12 0%, #1b5e20 100%)', 'landscape', 'business');
  END IF;
END $$;
