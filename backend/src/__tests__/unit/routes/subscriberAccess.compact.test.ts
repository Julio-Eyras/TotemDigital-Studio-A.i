jest.mock('../../../config/database', () => ({
  getDatabase: jest.fn(() => ({})),
}));

jest.mock('../../../config/featureFlags', () => ({
  TOTEMDIGITAL_COMPACT: true,
}));

jest.mock('../../../utils/compactOwnerPublisher', () => ({
  resolveCompactOwnerPublisherId: jest.fn(async () => 7),
}));

describe('resolveCompactScopedPublisherId (compact)', () => {
  beforeEach(async () => {
    const compactOwnerModule = await import('../../../utils/compactOwnerPublisher');
    (compactOwnerModule.resolveCompactOwnerPublisherId as jest.Mock).mockResolvedValue(7);
  });

  it('bloqueia publisher diferente do owner', async () => {
    const { resolveCompactScopedPublisherId } = await import('../../../routes/subscriber-access');

    await expect(resolveCompactScopedPublisherId(99)).rejects.toThrow(
      'Modo compacto: publisher_id deve ser o publisher do owner (publisher_id=7).'
    );
  });

  it('permite quando publisher é o owner', async () => {
    const { resolveCompactScopedPublisherId } = await import('../../../routes/subscriber-access');

    await expect(resolveCompactScopedPublisherId(7)).resolves.toBe(7);
  });
});
