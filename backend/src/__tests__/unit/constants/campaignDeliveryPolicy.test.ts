import { sqlTotemRegistryActive } from '../../../constants/campaignDeliveryPolicy';

describe('campaignDeliveryPolicy', () => {
  it('sqlTotemRegistryActive usa o alias dado', () => {
    expect(sqlTotemRegistryActive('t_direct')).toContain('t_direct');
    expect(sqlTotemRegistryActive('t_direct')).toMatch(/is_active/);
  });
});
