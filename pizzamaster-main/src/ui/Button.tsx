import React from 'react';
import clsx from 'clsx';

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'ghost' | 'danger';
  size?: 'sm' | 'md';
};

export default function Button({ variant='primary', size='md', className, ...props }: Props) {
  const base = 'inline-flex items-center justify-center rounded-xl font-semibold transition border border-white/10';
  const v = variant==='primary'
    ? 'bg-primary text-black hover:opacity-90'
    : variant==='danger'
      ? 'bg-red-500 text-white hover:bg-red-600'
      : 'bg-white/5 text-white hover:bg-white/10';
  const s = size==='sm' ? 'px-3 py-2 text-sm' : 'px-4 py-2.5 text-sm';
  return <button className={clsx(base, v, s, className)} {...props} />;
}
