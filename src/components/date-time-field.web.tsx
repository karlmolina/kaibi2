import { createElement } from 'react';

type Props = { value: Date; onChange: (d: Date) => void };

const pad = (n: number) => String(n).padStart(2, '0');
const toLocalInput = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

export function DateTimeField({ value, onChange }: Props) {
  return createElement('input', {
    type: 'datetime-local',
    value: toLocalInput(value),
    onChange: (e: { target: { value: string } }) => {
      const d = new Date(e.target.value);
      if (!Number.isNaN(d.getTime())) onChange(d);
    },
    style: {
      colorScheme: 'dark',
      background: 'rgba(255,255,255,0.1)',
      color: 'white',
      border: 'none',
      borderRadius: 12,
      padding: '12px 16px',
      fontSize: 16,
    },
  });
}
