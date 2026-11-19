import React from 'react';
import { Badge } from '@/components/ui/Badge';
import {
  Clock,
  Truck as TruckIcon,
  CheckCircle2,
  FileText,
  DollarSign,
  XCircle,
  AlertTriangle,
  ShieldAlert,
  Wrench,
  Link2,
} from 'lucide-react';

type BadgeType =
  | 'planned'
  | 'in_transit'
  | 'delivered'
  | 'invoiced'
  | 'paid'
  | 'cancelled'
  | 'available'
  | 'in_use'
  | 'on_trip'
  | 'maintenance'
  | 'inactive'
  | 'active'
  | 'on_leave'
  | 'open'
  | 'settled'
  | 'unpaid'
  | 'part_paid'
  | 'overdue'
  | 'pending'
  | 'approved'
  | 'rejected';

interface StatusBadgeProps {
  status: BadgeType | string;
  className?: string;
  size?: 'sm' | 'default';
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const norm = status.toLowerCase();

  switch (norm) {
    case 'planned':
      return (
        <Badge variant="slate" className={className}>
          <Clock className="h-3 w-3" />
          <span>Planned</span>
        </Badge>
      );

    case 'in_use':
      return (
        <Badge variant="info" className={className}>
          <Link2 className="h-3 w-3" />
          <span>In Use</span>
        </Badge>
      );

    case 'in_transit':
    case 'on_trip':
      return (
        <Badge variant="info" className={className}>
          <TruckIcon className="h-3 w-3" />
          <span>{norm === 'on_trip' ? 'On Trip' : 'In Transit'}</span>
        </Badge>
      );

    case 'delivered':
      return (
        <Badge variant="success" className={className}>
          <CheckCircle2 className="h-3 w-3" />
          <span>Delivered</span>
        </Badge>
      );

    case 'invoiced':
      return (
        <Badge variant="warning" className={className}>
          <FileText className="h-3 w-3" />
          <span>Invoiced</span>
        </Badge>
      );

    case 'paid':
    case 'settled':
    case 'approved':
    case 'available':
    case 'active':
      return (
        <Badge variant="success" className={className}>
          <CheckCircle2 className="h-3 w-3" />
          <span className="capitalize">{norm}</span>
        </Badge>
      );

    case 'overdue':
    case 'rejected':
    case 'cancelled':
      return (
        <Badge variant="destructive" className={className}>
          <XCircle className="h-3 w-3" />
          <span className="capitalize">{norm}</span>
        </Badge>
      );

    case 'part_paid':
    case 'open':
    case 'pending':
      return (
        <Badge variant="warning" className={className}>
          <AlertTriangle className="h-3 w-3" />
          <span className="capitalize">{norm.replace('_', ' ')}</span>
        </Badge>
      );

    case 'maintenance':
      return (
        <Badge variant="warning" className={className}>
          <Wrench className="h-3 w-3" />
          <span>Maintenance</span>
        </Badge>
      );

    case 'inactive':
    case 'on_leave':
    default:
      return (
        <Badge variant="slate" className={className}>
          <span className="capitalize">{norm.replace('_', ' ')}</span>
        </Badge>
      );
  }
}

