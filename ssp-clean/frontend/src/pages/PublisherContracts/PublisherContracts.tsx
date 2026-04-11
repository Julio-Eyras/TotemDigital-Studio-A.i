import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Contracts from '../Contracts/Contracts';

/**
 * Maintenance page: Publisher Contracts (publisher_contracts)
 * Wrapper around existing Contracts page, forcing publisher context.
 */
const PublisherContracts: React.FC = () => {
  const [params] = useSearchParams();
  const publisherId = params.get('publisherId');
  const initialPublisherId = publisherId ? Number(publisherId) : undefined;

  return <Contracts initialType="publisher" initialPublisherId={initialPublisherId} />;
};

export default PublisherContracts;

