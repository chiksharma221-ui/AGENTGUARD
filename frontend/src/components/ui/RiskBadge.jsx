import React from 'react';
import Badge from './Badge';

export const RiskBadge = ({ level = 'LOW', className = '', size = 'md' }) => {
  const normalizedLevel = String(level).toUpperCase();

  return (
    <Badge
      variant={normalizedLevel}
      withDot={true}
      size={size}
      className={className}
    >
      {normalizedLevel} RISK
    </Badge>
  );
};

export default RiskBadge;
