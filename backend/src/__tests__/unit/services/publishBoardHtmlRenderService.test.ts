import { renderPublishBoardHtml } from '../../../services/publishBoardHtmlRenderService';

describe('publishBoardHtmlRenderService', () => {
  it('gera promoção sem dependência de CDN externa', () => {
    const html = renderPublishBoardHtml({
      preset: 'promotion',
      subscriberId: 1,
      boardTitle: 'Promo',
      accentColor: '#e91e63',
      orientation: 'landscape',
      content: {
        headline: 'Oferta',
        offer: 'Combo',
        price: 'R$ 19,90',
        urgency: 'Hoje',
      },
      blockOrder: ['headline', 'offer', 'price', 'urgency'],
    });
    expect(html).toContain('<!DOCTYPE html>');
    expect(html).not.toContain('cdnjs.cloudflare.com');
    expect(html).not.toContain('gsap');
    expect(html).toContain('Oferta');
    expect(html).toContain('@keyframes ss-fade-up');
  });

  it('gera anúncio com CTA e template dedicado', () => {
    const html = renderPublishBoardHtml({
      preset: 'ad',
      subscriberId: 2,
      boardTitle: 'Anúncio',
      accentColor: '#1976d2',
      orientation: 'portrait',
      content: {
        headline: 'Impacto',
        brand: 'Marca X',
        message: 'Mensagem objetiva',
        cta: 'Confira',
      },
      blockOrder: ['headline', 'brand', 'message', 'cta'],
    });
    expect(html).toContain('Confira');
    expect(html).toContain('Marca X');
    expect(html).toContain('class="cta');
  });

  it('gera cardápio com endpoint de refresh dinâmico', () => {
    const html = renderPublishBoardHtml({
      preset: 'menu',
      subscriberId: 3,
      boardTitle: 'Cardápio',
      accentColor: '#ff9800',
      orientation: 'portrait',
      showPrices: true,
      menuLines: [{ name: 'Hambúrguer', price: 19.9, description: 'Artesanal' }],
      productOrder: [],
    });
    expect(html).toContain("public-menu/'+SUBSCRIBER_ID");
    expect(html).toContain('SUBSCRIBER_ID=3');
    expect(html).toContain('setInterval(refresh,60000)');
    expect(html).toContain('Hambúrguer');
  });
});
