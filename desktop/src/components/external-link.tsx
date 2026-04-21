import { type ComponentProps } from 'react';

type Props = Omit<ComponentProps<'a'>, 'href'> & { href: string };

export function ExternalLink({ href, ...rest }: Props) {
  return (
    <a
      target="_blank"
      rel="noopener noreferrer"
      {...rest}
      href={href}
    />
  );
}
