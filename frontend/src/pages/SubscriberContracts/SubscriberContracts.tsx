import React from 'react';
import { useSearchParams } from 'react-router-dom';
import Contracts from '../Contracts/Contracts';

/**
 * Maintenance page: Subscriber Contracts (subscriber_contracts)
 * Wrapper around existing Contracts page, forcing subscriber context.
 */
const SubscriberContracts: React.FC = () => {
  const [params] = useSearchParams();
  const subscriberId = params.get('subscriberId');
  const initialSubscriberId = subscriberId ? Number(subscriberId) : undefined;

  return <Contracts initialType="subscriber" initialSubscriberId={initialSubscriberId} />;
};

export default SubscriberContracts;

