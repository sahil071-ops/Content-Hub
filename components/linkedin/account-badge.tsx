import type { LinkedInAccount } from '@/types/database';
import { Building2, User } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AccountBadgeProps {
  account: Pick<LinkedInAccount, 'name' | 'avatar_url' | 'account_type'>;
  size?: 'sm' | 'md';
}

export function AccountBadge({ account, size = 'md' }: AccountBadgeProps) {
  const Icon = account.account_type === 'company' ? Building2 : User;

  return (
    <div className={cn('flex items-center gap-1.5', size === 'sm' && 'gap-1')}>
      <div className={cn(
        'rounded-full bg-muted flex items-center justify-center shrink-0 overflow-hidden',
        size === 'sm' ? 'h-5 w-5' : 'h-7 w-7'
      )}>
        {account.avatar_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={account.avatar_url} alt={account.name} className="w-full h-full object-cover" />
        ) : (
          <Icon className={cn('text-muted-foreground', size === 'sm' ? 'h-3 w-3' : 'h-4 w-4')} />
        )}
      </div>
      <span className={cn('font-medium', size === 'sm' ? 'text-xs' : 'text-sm')}>{account.name}</span>
    </div>
  );
}
