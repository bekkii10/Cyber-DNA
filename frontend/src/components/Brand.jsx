import React from 'react';
import { ShieldCheck } from 'lucide-react';

export const BrandMark = ({ size = 22 }) => <span className="brand-mark"><ShieldCheck size={size} aria-hidden="true" /></span>;

// The logo is a real button so it is keyboard accessible; `onClick` decides where it navigates.
export const Brand = ({ onClick, label = 'Cyber DNA home', children }) => (
  <button type="button" className="brand" onClick={onClick} aria-label={label}>
    <BrandMark />
    <span><b>CYBER DNA</b><small>AD THREAT ANALYTICS</small></span>
    {children}
  </button>
);
