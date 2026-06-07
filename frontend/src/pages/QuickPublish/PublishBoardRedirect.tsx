import React from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';

/** Redireciona /publish-board → /quick-publish?mode=create preservando query params. */
const PublishBoardRedirect: React.FC = () => {
  const [searchParams] = useSearchParams();
  const next = new URLSearchParams(searchParams);
  next.set('mode', 'create');
  return <Navigate to={`/quick-publish?${next.toString()}`} replace />;
};

export default PublishBoardRedirect;
