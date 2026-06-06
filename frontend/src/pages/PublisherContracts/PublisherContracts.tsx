import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Contracts from '../Contracts/Contracts';

/**
 * Manutenção: contratos da organização (publisher_contracts).
 * Wrapper da página Contracts, forçando contexto publisher na API.
 */
const PublisherContracts: React.FC = () => {
  const [params] = useSearchParams();
  const publisherId = params.get('publisherId');
  const initialPublisherId = publisherId ? Number(publisherId) : undefined;

  return <Contracts initialType="publisher" initialPublisherId={initialPublisherId} />;
};

export default PublisherContracts;

